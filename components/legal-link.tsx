import Link from "next/link";

const LINK_CLASS =
  "text-ctp-lavender underline underline-offset-2 transition-colors hover:text-ctp-text";

/**
 * A link to a section of /legal for the small consent lines under sign-up,
 * CLI login approval and publishing. `newTab` is for the upload wizard, where
 * following it in the same tab would leave a step half saved.
 */
export default function LegalLink({
  section,
  newTab = false,
  children,
}: {
  section: "terms" | "privacy";
  newTab?: boolean;
  children: React.ReactNode;
}) {
  const href = `/legal#${section}`;

  if (newTab) {
    return (
      <Link href={href} target="_blank" rel="noopener" className={LINK_CLASS}>
        {children}
      </Link>
    );
  }

  return (
    <Link href={href} className={LINK_CLASS}>
      {children}
    </Link>
  );
}
