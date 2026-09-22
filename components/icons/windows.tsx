/**
 * The Windows mark - four panes, matching the Windows 11 logo.
 *
 * Unlike the Linux and Apple marks beside it, this one is not vendored from
 * Simple Icons: that set carries no Windows icon (Microsoft asked for its
 * brand marks to be removed). The current logo is four equal squares on a
 * 2x2 grid, so it is constructed here from plain geometry rather than copied
 * path data - which is also why it needs no attribution.
 */
export default function WindowsLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      height="24"
      width="24"
      aria-hidden="true"
      {...props}
    >
      <title>Windows</title>
      <path
        fill="currentColor"
        d="M2 2h9.2v9.2H2V2Zm10.8 0H22v9.2h-9.2V2ZM2 12.8h9.2V22H2v-9.2Zm10.8 0H22V22h-9.2v-9.2Z"
      />
    </svg>
  );
}
