import type { ReactNode } from 'react';

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-gr-pink text-base font-bold tracking-[0.3em] uppercase">{children}</div>
  );
}
