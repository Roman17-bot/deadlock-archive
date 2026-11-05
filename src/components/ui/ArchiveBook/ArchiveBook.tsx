import './ArchiveBook.css';

export function ArchiveBook({ loading }: { loading: boolean }) {
  return (
    <span className="archive-book" data-loading={loading ? '' : undefined} aria-hidden="true">
      <span className="archive-book__binding">
        <span className="archive-book__back" />
        <span className="archive-book__fore-edge" />
        <span className="archive-book__paper archive-book__paper--right" />
        <span className="archive-book__spine" />
        <span className="archive-book__turns">
          <span className="archive-book__leaf">
            <span className="archive-book__paper archive-book__paper--right" />
            <span className="archive-book__paper archive-book__paper--left" />
          </span>
        </span>
        <span className="archive-book__cover">
          <svg className="archive-book__leather" viewBox="0 0 36 48" fill="none" focusable="false">
            <path
              fill="#f0be76"
              opacity=".14"
              d="M1 1h30l2 2-9 .4-6-.7L7 4 3 7l.7 12-1 9L4 43l8 3H1ZM34 31l1 15-2 1-11-1 9-1 2-5Z"
            />
            <path
              stroke="#ad8054"
              strokeWidth=".65"
              opacity=".8"
              d="M8 8h20l3 3v25l-3 3H8l-2-3V11Z"
            />
            <path
              stroke="#e1ad67"
              strokeWidth=".8"
              strokeLinecap="round"
              d="M6 15v-4l3-3h4m12 0h3l3 3v4m0 17v4l-3 3h-3m-12 0H9l-3-3v-4M16 42.5h6"
            />
            <path
              stroke="#deb17e"
              strokeWidth=".55"
              strokeLinecap="round"
              opacity=".53"
              d="m30 3 2 .7 1 2M4 6l.5 3M2 25l.9 2m27-8 1 1m-23 9 .4 2m25 10-1 3-2 .4M9 44l3 1m7-41 4-.3"
            />
            <path
              fill="#24160f"
              fillRule="evenodd"
              d="M9 15h10c6.5 0 9.5 3.5 9.5 9.4 0 5.8-3 9.6-9.7 9.6H9v-1.5h2.8v-16H9Zm6.5 1.7v15.6h2.9c4.1 0 6.2-2.9 6.2-7.9 0-5.1-2-7.7-6.2-7.7Z"
              transform="translate(0 .8)"
            />
            <path
              fill="#edc784"
              fillRule="evenodd"
              d="M9 15h10c6.5 0 9.5 3.5 9.5 9.4 0 5.8-3 9.6-9.7 9.6H9v-1.5h2.8v-16H9Zm6.5 1.7v15.6h2.9c4.1 0 6.2-2.9 6.2-7.9 0-5.1-2-7.7-6.2-7.7Z"
            />
          </svg>
          <span className="archive-book__paper archive-book__paper--left" />
        </span>
      </span>
    </span>
  );
}
