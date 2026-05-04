import { useEffect, useState } from 'react';

export function CountdownBar({ durationMs }: { durationMs: number }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="w-full h-0.5 rounded-full overflow-hidden bg-border/40">
      <div
        className="h-full bg-accent/50"
        style={{
          width: go ? '0%' : '100%',
          transition: go ? `width ${durationMs}ms linear` : 'none',
        }}
      />
    </div>
  );
}
