/**
 * A "G" mark for the Google sign-in button, drawn as an outline.
 *
 * Deliberately not Google's four-colour logo, and not a filled silhouette of
 * it: this sits in a row with the GitHub and GitLab marks, which lucide ships
 * as 2px stroked line icons. A filled, multi-colour glyph in that row reads as
 * a mistake. The geometry is a plain stroked G on lucide's 24x24 grid with the
 * same stroke weight and round caps, so the three buttons look like one set.
 *
 * (Tracing the outline of Google's real letterform was tried and looked worse
 * at 18px - the contour of the thin parts closes up into a smudge.)
 */
export default function GoogleLogo({
  size = 24,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      height={size}
      width={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <title>Google</title>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <path d="M21 12h-8" />
    </svg>
  );
}
