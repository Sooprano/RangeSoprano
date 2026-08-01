import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Single-line label that ellipsis-truncates and — only when it is actually
 * truncated — reveals its full text in a small tooltip on hover, styled in the
 * app's design language instead of the browser's plain native `title` popup.
 * The tooltip flies out to the right so it never covers neighbouring rows.
 */
export function TruncatedLabel({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  // Re-measured on every hover so it self-corrects when the column resizes.
  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setTruncated(el.scrollWidth > el.clientWidth + 1);
  }, []);

  return (
    <span className="group/tl relative block w-full" onMouseEnter={measure}>
      <span ref={ref} className={cn('block w-full truncate', className)}>
        {text}
      </span>
      {truncated && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-full top-1/2 z-30 ml-2 whitespace-nowrap',
            'rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-content',
            'shadow-lg shadow-black/25',
            '-translate-y-1/2 -translate-x-1 opacity-0',
            'transition duration-150 ease-out',
            'group-hover/tl:translate-x-0 group-hover/tl:opacity-100',
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}
