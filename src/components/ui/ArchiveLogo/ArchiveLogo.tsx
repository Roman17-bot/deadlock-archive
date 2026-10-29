import type { SVGProps } from 'react';

/** Original DA mark: cast lettering with an architectural stepped edge. */
export function ArchiveLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 56 64" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path fillRule="evenodd" d="M8 4h23l17 13v30L31 60H8V4Zm8 8v40h12l12-9V21l-12-9H16Z" />
      <path d="m24 47 9-30h6l10 30h-7l-2-7h-9l-2 7h-5Zm9-13h5l-2.5-9-2.5 9Z" />
    </svg>
  );
}
