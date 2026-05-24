import type { ReactNode } from 'react';

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="from-gr-pink to-gr-purple bg-gradient-to-r bg-clip-text text-base font-bold tracking-[0.3em] text-transparent uppercase">
      {children}
    </div>
  );
}
