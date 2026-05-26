interface DebugViewProps {
  speed: number;
  debugVersion: string;
  debugMessage: string;
}

export function DebugView({ speed, debugVersion, debugMessage }: DebugViewProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Speed Display */}
      <div className="text-center">
        <span className="text-zinc-400 text-sm uppercase tracking-wider">Speed</span>
        <div className="text-white text-3xl font-bold">{speed} km/hr</div>
      </div>

      {/* Debug Console Box */}
      <div className="border-2 border-orange-500 rounded-lg p-4 min-w-[200px]">
        <div className="text-blue-400 text-sm font-mono">Debug {debugVersion}</div>
        <div className="text-orange-400 text-lg font-mono mt-1">{`"${debugMessage}"`}</div>
      </div>
    </div>
  );
}
