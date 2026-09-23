// Live feedback for "choose a password" fields (signup, reset). Kept free of
// server imports so both the client forms and lib/auth.ts can share the
// minimum length.

export const PASSWORD_MIN_LENGTH = 12;

const NEUTRAL = "border-ctp-crust focus:ring-ctp-surface0";

export type PasswordLengthFeedback = {
  valid: boolean;
  // Too short and the field has been left - the point to say so in red.
  // While still typing it only gets a soft red ring.
  showTooShort: boolean;
  stateClass: string;
};

export function passwordLengthFeedback(
  password: string,
  focused: boolean,
): PasswordLengthFeedback {
  const valid = password.length >= PASSWORD_MIN_LENGTH;
  const tooShort = password.length > 0 && !valid;

  let stateClass = NEUTRAL;
  if (valid) {
    stateClass = "border-ctp-green focus:ring-ctp-green/30";
  } else if (tooShort) {
    stateClass = focused
      ? "border-ctp-crust focus:ring-ctp-red/30"
      : "border-ctp-red";
  }

  return { valid, showTooShort: tooShort && !focused, stateClass };
}

export type PasswordConfirmFeedback = {
  matches: boolean;
  // Only once the confirmation can no longer become a match - it has stopped
  // being a prefix of the password. A half-typed but correct confirmation is
  // not an error, so it stays neutral.
  mismatch: boolean;
  stateClass: string;
};

export function passwordConfirmFeedback(
  password: string,
  confirm: string,
  focused: boolean,
): PasswordConfirmFeedback {
  const matches = confirm.length > 0 && confirm === password;
  const mismatch = confirm.length > 0 && !password.startsWith(confirm);

  let stateClass = NEUTRAL;
  if (matches) {
    stateClass = "border-ctp-green focus:ring-ctp-green/30";
  } else if (mismatch) {
    stateClass = focused
      ? "border-ctp-crust focus:ring-ctp-red/30"
      : "border-ctp-red";
  }

  return { matches, mismatch, stateClass };
}
