import { PageHeader } from '@/components/ui/PageHeader';

export default function TrainerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Trainer"
        description="Practice decisions against your saved ranges. Classic and drawing modes."
      />
      <div className="rounded-xl border border-border bg-surface p-10 text-center text-sm text-content-muted">
        Training sessions arrive in a later phase.
      </div>
    </>
  );
}
