import { ReactNode } from "react";

interface InfoCardProps {
  title: string;
  children: ReactNode;
}

export function InfoCard({ title, children }: InfoCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 min-w-[140px]">
      <h3 className="text-zinc-400 text-xs font-medium mb-2 text-center">
        {title}
      </h3>
      <div className="text-center">{children}</div>
    </div>
  );
}
