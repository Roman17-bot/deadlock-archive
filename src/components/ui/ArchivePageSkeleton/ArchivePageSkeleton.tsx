import './ArchivePageSkeleton.css';

export type ArchivePageSkeletonKind =
  | 'home'
  | 'hero-table'
  | 'hero-roster'
  | 'hero-statistics'
  | 'hero-detail'
  | 'items'
  | 'item-detail'
  | 'mechanics'
  | 'updates';

function Bars({ widths }: { widths: string[] }) {
  return (
    <div className="aps-bars">
      {widths.map((width, index) => (
        <span className="aps-bar" style={{ width }} key={index} />
      ))}
    </div>
  );
}

function Heading({
  title = '36rem',
  description = true,
}: {
  title?: string;
  description?: boolean;
}) {
  return (
    <div className="aps-heading">
      <span className="aps-kicker" />
      <span className="aps-title" style={{ width: title }} />
      {description && <Bars widths={['76%', '54%']} />}
    </div>
  );
}

function Plates({ count }: { count: number }) {
  return (
    <div className="aps-plates">
      {Array.from({ length: count }, (_, index) => (
        <div className="aps-plate" key={index}>
          <span className="aps-portrait" />
          <Bars widths={['72%', '38%']} />
        </div>
      ))}
    </div>
  );
}

function Trend({ variant }: { variant: number }) {
  return (
    <svg className="aps-trend" viewBox="0 0 160 36" preserveAspectRatio="none" focusable="false">
      <path className="aps-chart-grid" d="M0 6H160M0 18H160M0 30H160" />
      <path
        className="aps-chart-line"
        d={
          variant % 2
            ? 'M2 14L26 20L54 15L81 26L106 18L130 22L158 12'
            : 'M2 28L26 20L54 23L81 13L106 16L130 8L158 12'
        }
      />
    </svg>
  );
}

function Ledger({ statistics = false }: { statistics?: boolean }) {
  return (
    <div className={'aps-ledger' + (statistics ? ' aps-ledger-statistics' : '')}>
      <div className="aps-ledger-row aps-ledger-head">
        <Bars widths={['56%']} />
        <Bars widths={['50%']} />
        <Bars widths={['46%']} />
        <Bars widths={['42%']} />
        <Bars widths={['54%']} />
      </div>
      {Array.from({ length: statistics ? 5 : 7 }, (_, index) => (
        <div className="aps-ledger-row" key={index}>
          <div className="aps-ledger-name">
            <span className="aps-portrait" />
            <Bars widths={[index % 2 ? '85%' : '62%']} />
          </div>
          <Bars widths={['38%']} />
          {statistics ? <Trend variant={index} /> : <Bars widths={['46%']} />}
          <Bars widths={['46%']} />
          {statistics ? <Trend variant={index + 1} /> : <Bars widths={['33%']} />}
        </div>
      ))}
    </div>
  );
}

function SkeletonContent({ kind }: { kind: ArchivePageSkeletonKind }) {
  switch (kind) {
    case 'home':
      return (
        <>
          <div className="aps-home-hero">
            <div className="aps-home-copy">
              <div className="aps-home-kicker">
                <Bars widths={['78%', '52%']} />
              </div>
              <Bars widths={['45%']} />
              <div className="aps-home-titles">
                <span className="aps-title" />
                <span className="aps-title aps-wrap-line" />
                <span className="aps-title aps-gold-title" />
                <span className="aps-title aps-gold-title aps-wrap-line" />
              </div>
              <div className="aps-home-description">
                <Bars widths={['96%', '89%', '61%']} />
              </div>
              <div className="aps-tools aps-home-actions">
                <span className="aps-control" />
                <Bars widths={['68%', '94%']} />
              </div>
            </div>
            <div className="aps-panel aps-home-sheet">
              <div className="aps-home-sheet-heading">
                <span className="aps-kicker" />
              </div>
              <div className="aps-home-titles">
                <span className="aps-title" />
                <span className="aps-title aps-wrap-line" />
                <span className="aps-title aps-gold-title" />
                <span className="aps-title aps-gold-title aps-wrap-line" />
              </div>
              <Plates count={40} />
            </div>
          </div>
          <div className="aps-panel aps-home-strip">
            <Bars widths={['58%']} />
            <Bars widths={['64%']} />
            <Bars widths={['45%']} />
          </div>
        </>
      );
    case 'hero-table':
      return (
        <>
          <span className="aps-crumb" />
          <div className="aps-register-heading">
            <Heading />
            <div className="aps-panel aps-version">
              <Bars widths={['65%', '82%', '49%']} />
            </div>
          </div>
          <div className="aps-panel aps-register">
            <div className="aps-tools">
              <span className="aps-field" />
              <span className="aps-control" />
              <span className="aps-control" />
              <span className="aps-control" />
            </div>
            <div className="aps-tools aps-level">
              <span className="aps-rail" />
              <span className="aps-control" />
            </div>
            <Ledger />
          </div>
        </>
      );
    case 'hero-roster':
      return (
        <>
          <span className="aps-crumb" />
          <Heading title="30rem" description={false} />
          <div className="aps-panel aps-folder">
            <div>
              <Bars widths={['41%', '55%']} />
              <span className="aps-field" />
              <Plates count={18} />
            </div>
            <div className="aps-panel aps-preview">
              <div className="aps-scene" />
              <Bars widths={['61%', '85%', '69%']} />
            </div>
          </div>
        </>
      );
    case 'hero-statistics':
      return (
        <>
          <span className="aps-crumb" />
          <Heading title="43rem" />
          <div className="aps-tools aps-statistics-tools">
            <span className="aps-field" />
            <span className="aps-control" />
            <span className="aps-control aps-segmented" />
          </div>
          <span className="aps-bar aps-statistics-date" />
          <div className="aps-panel aps-statistics-columns">
            <span className="aps-bar" />
            <span className="aps-control aps-segmented" />
          </div>
          <Ledger statistics />
        </>
      );
    case 'hero-detail':
      return (
        <>
          <span className="aps-crumb" />
          <div className="aps-panel aps-dossier">
            <div className="aps-scene" />
            <Heading title="27rem" />
          </div>
          <div className="aps-tools">
            <span className="aps-control" />
            <span className="aps-control" />
          </div>
          <div className="aps-panel aps-summary">
            <Bars widths={['32%', '69%', '55%']} />
          </div>
        </>
      );
    case 'items':
      return (
        <>
          <Heading title="26rem" />
          <div className="aps-shop">
            <div className="aps-shop-tools">
              <span className="aps-field" />
              <div className="aps-shop-categories">
                <span className="aps-control" />
                <span className="aps-control" />
                <span className="aps-control" />
                <span className="aps-control" />
              </div>
              <div className="aps-shop-controls">
                <div>
                  <span className="aps-kicker" />
                  <div className="aps-shop-tiers">
                    {['36%', '43%', '52%', '47%'].map((width) => (
                      <div className="aps-shop-tier" key={width}>
                        <Bars widths={[width, '72%']} />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="aps-kicker" />
                  <div className="aps-shop-activation">
                    <span className="aps-control" />
                    <span className="aps-control" />
                    <span className="aps-control" />
                  </div>
                </div>
                <span className="aps-control aps-shop-reset" />
              </div>
            </div>
            <div className="aps-panel aps-shop-filters">
              <Bars widths={['64%', '86%', '71%', '75%', '58%', '80%']} />
            </div>
            <div className="aps-shop-results">
              <Bars widths={['25%']} />
              <div className="aps-shop-groups">
                {['gold', 'green', 'lilac'].map((color) => (
                  <div className={'aps-panel aps-shop-group aps-' + color} key={color}>
                    <span className="aps-kicker" />
                    <Plates count={6} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    case 'item-detail':
      return (
        <>
          <span className="aps-crumb" />
          <div className="aps-item-heading">
            <span className="aps-portrait aps-item-icon" />
            <Heading title="29rem" />
          </div>
          <div className="aps-item-columns">
            <div className="aps-summary">
              <Bars widths={['80%', '64%', '42%', '90%', '74%', '51%']} />
            </div>
            <div className="aps-panel aps-summary">
              <span className="aps-kicker" />
              <Bars widths={['64%', '86%', '56%', '74%']} />
            </div>
          </div>
        </>
      );
    case 'mechanics':
      return (
        <>
          <div className="aps-mechanics-intro">
            <div>
              <Heading title="31rem" description={false} />
              <span className="aps-title aps-gold-title" />
              <span className="aps-title aps-gold-title aps-mechanics-wrap" />
              <div className="aps-mechanics-description">
                <Bars widths={['76%', '68%', '61%']} />
              </div>
              <span className="aps-bar aps-mechanics-version" />
              <div className="aps-tools">
                <span className="aps-control" />
                <span className="aps-bar aps-mechanics-download" />
              </div>
            </div>
            <div className="aps-panel aps-stamp">
              <svg viewBox="0 0 64 64" focusable="false">
                <path d="M32 2L62 32L32 62L2 32Z M42 19H21L34 32L21 45H42" />
              </svg>
              <Bars widths={['68%', '39%', '57%']} />
            </div>
          </div>
          <div className="aps-panel aps-calculator">
            <Bars widths={['28%', '44%']} />
            <div className="aps-tools">
              <span className="aps-control" />
              <span className="aps-control" />
              <span className="aps-field" />
            </div>
          </div>
        </>
      );
    case 'updates':
      return (
        <>
          <div className="aps-heading">
            <span className="aps-kicker" />
            <span className="aps-title" />
            <span className="aps-title aps-updates-wrap" />
            <Bars widths={['89%', '65%']} />
          </div>
          <div className="aps-update-columns">
            <div className="aps-panel aps-summary">
              <span className="aps-kicker" />
              <span className="aps-title" />
              <Bars widths={['74%', '57%']} />
            </div>
            <div className="aps-panel aps-summary">
              <span className="aps-kicker" />
              <Bars widths={['74%', '54%']} />
              <span className="aps-control" />
            </div>
          </div>
          <div className="aps-panel aps-summary">
            <Bars widths={['32%', '85%', '56%']} />
          </div>
        </>
      );
  }
}

export function ArchivePageSkeleton({ kind }: { kind: ArchivePageSkeletonKind }) {
  return (
    <div className={'archive-page-skeleton archive-page-skeleton--' + kind} aria-hidden="true">
      <SkeletonContent kind={kind} />
    </div>
  );
}
