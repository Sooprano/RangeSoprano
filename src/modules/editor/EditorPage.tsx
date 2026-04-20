import { PageHeader } from '@/components/ui/PageHeader';

export default function EditorPage() {
  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Editor"
        description="Build, import and export preflop ranges with mixed frequencies."
      />
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-content-muted">
        The editor grid arrives in a later phase.
      </div>
    </>
  );
}
