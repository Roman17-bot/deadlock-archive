import type { ReactNode } from 'react';

export function HeroNoteMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hero-notes-metric">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
