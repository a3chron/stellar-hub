// Finds `[custom.*]` sections in a Starship TOML config so the UI can
// highlight the parts that execute arbitrary shell commands.
//
// This is a security surface, not decoration: the CLI refuses to apply a theme
// containing custom commands and sends the user here to decide whether to
// trust it. If a section is missed, the page tells the user a dangerous config
// is clean.
//
// The CLI is the reference implementation. It decodes the file with a real
// TOML parser and warns when the top-level `custom` key exists and is a
// non-empty table (stellar-cli/internal/theme/validator.go). So anything TOML
// accepts as a path into `custom` has to be recognised here too - including
// `["custom".foo]`, `['custom'.foo]` and `[custom . foo]`, which all produce
// the same table and all execute.
//
// Two layers, deliberately:
//
//   hasCustomSections() decodes with a real TOML parser. It is the answer to
//   "is this theme dangerous", so it must agree with the CLI exactly, and a
//   hand-written scanner cannot - TOML spells the same table too many ways
//   (`[custom.x]`, `custom.x.y = …`, `custom = { … }`, `["\u0063ustom".x]`).
//
//   findCustomSections() is the line scanner, and answers a different, weaker
//   question: which line ranges should be highlighted. A range it misses costs
//   highlighting, never the warning.

export interface CustomSection {
  /** e.g. "custom.git_status", normalised from whatever spelling was used. */
  name: string;
  /** Index (into configContent.split("\n")) of the header line, inclusive. */
  startLine: number;
  /** Index of the line where the section ends, exclusive. */
  endLine: number;
}

type TableHeader = { line: number; keys: string[] };

/**
 * Walks one line, given the multi-line string delimiter left open by the
 * previous line, and reports the delimiter still open at its end.
 *
 * Returning the state per line is what stops a `[git_branch]` *inside* a
 * command body from being mistaken for a new table - which would end the
 * custom section early and leave the rest of the command unhighlighted.
 */
function scanLine(
  line: string,
  openDelimiter: string | null,
): { open: string | null; startsOutsideString: boolean; bracketDelta: number } {
  let index = 0;
  let open = openDelimiter;
  let bracketDelta = 0;
  const startsOutsideString = open === null;

  if (open !== null) {
    const closeAt = line.indexOf(open);
    if (closeAt === -1) {
      return { open, startsOutsideString, bracketDelta };
    }
    index = closeAt + open.length;
    open = null;
  }

  while (index < line.length) {
    const rest = line.slice(index);

    // A comment runs to end of line - nothing after it can open a string.
    if (rest.startsWith("#")) {
      return { open: null, startsOutsideString, bracketDelta };
    }

    const multiline = ['"""', "'''"].find((d) => rest.startsWith(d));
    if (multiline) {
      const closeAt = line.indexOf(multiline, index + multiline.length);
      if (closeAt === -1) {
        return { open: multiline, startsOutsideString, bracketDelta };
      }
      index = closeAt + multiline.length;
      continue;
    }

    // Single-line strings. A basic string honours backslash escapes; a literal
    // string ('...') does not, which is why they are handled separately.
    if (rest.startsWith('"') || rest.startsWith("'")) {
      const quote = rest[0];
      const honoursEscapes = quote === '"';
      let cursor = index + 1;
      while (cursor < line.length) {
        if (honoursEscapes && line[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (line[cursor] === quote) {
          break;
        }
        cursor++;
      }
      index = cursor + 1;
      continue;
    }

    // Bracket depth outside strings and comments. A table header balances its
    // own brackets, so this only stays positive inside a multi-line array
    // value - where a line like "[1]," must not be mistaken for a table.
    if (rest.startsWith("[")) {
      bracketDelta++;
    } else if (rest.startsWith("]")) {
      bracketDelta--;
    }

    index++;
  }

  return { open, startsOutsideString, bracketDelta };
}

/**
 * Splits the inside of a table header into its dotted key parts, honouring
 * quoted parts and the whitespace TOML permits around the dots. Returns null
 * if the text is not a well-formed key path.
 */
function parseKeyPath(inner: string): string[] | null {
  const keys: string[] = [];
  let index = 0;

  while (index < inner.length) {
    while (index < inner.length && /\s/.test(inner[index])) {
      index++;
    }
    if (index >= inner.length) {
      return null;
    }

    const quote = inner[index];
    if (quote === '"' || quote === "'") {
      const honoursEscapes = quote === '"';
      let cursor = index + 1;
      let value = "";
      let closed = false;
      while (cursor < inner.length) {
        if (honoursEscapes && inner[cursor] === "\\") {
          // \uXXXX / \UXXXXXXXX are legal in a basic string, including in a
          // key - `["\u0063ustom".git]` is spelled differently but *is*
          // `custom`, and treating the escape as a literal "u" would hide it.
          const marker = inner[cursor + 1];
          const width = marker === "u" ? 4 : 8;
          if (marker === "u" || marker === "U") {
            const hex = inner.slice(cursor + 2, cursor + 2 + width);
            if (/^[0-9a-fA-F]+$/.test(hex) && hex.length === width) {
              value += String.fromCodePoint(Number.parseInt(hex, 16));
              cursor += 2 + width;
              continue;
            }
          }
          value += marker ?? "";
          cursor += 2;
          continue;
        }
        if (inner[cursor] === quote) {
          closed = true;
          break;
        }
        value += inner[cursor];
        cursor++;
      }
      if (!closed) {
        return null;
      }
      keys.push(value);
      index = cursor + 1;
    } else {
      let cursor = index;
      while (cursor < inner.length && /[A-Za-z0-9_-]/.test(inner[cursor])) {
        cursor++;
      }
      if (cursor === index) {
        return null;
      }
      keys.push(inner.slice(index, cursor));
      index = cursor;
    }

    while (index < inner.length && /\s/.test(inner[index])) {
      index++;
    }
    if (index < inner.length) {
      if (inner[index] !== ".") {
        return null;
      }
      index++;
    }
  }

  return keys.length > 0 ? keys : null;
}

/**
 * Cuts an inline comment off a line, ignoring `#` inside strings.
 *
 * Needed before locating a header's closing bracket: `[custom.git] # see
 * [custom.other]` has its last `]` inside the comment, so searching the raw
 * line finds the wrong one, the key path fails to parse, and the whole header
 * is dropped - silently un-flagging a live custom command.
 */
function stripLineComment(line: string): string {
  let index = 0;
  while (index < line.length) {
    const char = line[index];
    if (char === "#") {
      return line.slice(0, index);
    }
    if (char === '"' || char === "'") {
      const honoursEscapes = char === '"';
      index++;
      while (index < line.length) {
        if (honoursEscapes && line[index] === "\\") {
          index += 2;
          continue;
        }
        if (line[index] === char) {
          break;
        }
        index++;
      }
    }
    index++;
  }
  return line;
}

/** Every table header in the file, in order, with its key path. */
function findTableHeaders(lines: string[]): TableHeader[] {
  const headers: TableHeader[] = [];
  let open: string | null = null;
  let arrayDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const result = scanLine(line, open);

    // A header can only begin a line that is outside both a multi-line string
    // and a multi-line array value.
    if (result.startsOutsideString && arrayDepth === 0) {
      const trimmed = stripLineComment(line).trim();
      if (trimmed.startsWith("[")) {
        const isArray = trimmed.startsWith("[[");
        const openLen = isArray ? 2 : 1;
        const closer = isArray ? "]]" : "]";
        const closeAt = trimmed.lastIndexOf(closer);

        // Nothing may follow the closing bracket; "[1]," is an array element,
        // not a table header. Comments are already gone.
        const tail = trimmed.slice(closeAt + closer.length).trim();
        const tailIsEmptyOrComment = tail === "";

        if (closeAt > openLen - 1 && tailIsEmptyOrComment) {
          const keys = parseKeyPath(trimmed.slice(openLen, closeAt));
          if (keys) {
            headers.push({ line: i, keys });
          }
        }
      }
    }

    open = result.open;
    arrayDepth = Math.max(0, arrayDepth + result.bracketDelta);
  }

  return headers;
}

export function findCustomSections(configContent: string): CustomSection[] {
  const lines = configContent.split("\n");
  const headers = findTableHeaders(lines);

  return headers.flatMap((header, position) => {
    if (header.keys[0] !== "custom") {
      return [];
    }
    const next = headers[position + 1];
    return [
      {
        name: header.keys.join("."),
        startLine: header.line,
        endLine: next ? next.line : lines.length,
      },
    ];
  });
}
