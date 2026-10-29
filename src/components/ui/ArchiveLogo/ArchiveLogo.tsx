import type { SVGProps } from 'react';

/** The original framed D, refined as an engraved archive emblem. */
export function ArchiveLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 56" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M5 1H43L47 5V51L43 55H5L1 51V5Z" pathLength="1" stroke="currentColor" />
      <path d="M6 6H42V50H6Z" stroke="currentColor" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 12H25C36 12 40 19 40 28S35 44 25 44H12V42H16V14H12V12ZM22 15V41H25C31 41 34 36 34 28S31 15 25 15H22Z"
      />
    </svg>
  );
}
