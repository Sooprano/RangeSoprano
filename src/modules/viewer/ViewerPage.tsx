import { PageHeader } from '@/components/ui/PageHeader';

export default function ViewerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Viewer"
        description="Explore preflop ranges by format, position, and situation."
      />
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-content-muted">
        The range grid lands in the next phase.
      </div>
    </>
  );
}
