import { PageHeader } from '@/components/ui/PageHeader';
import { RangeGrid } from '@/components/RangeGrid';

export default function ViewerPage() {
  return (
    <>
      <PageHeader
        eyebrow="Module"
        title="Viewer"
        description="Explore preflop ranges by format, position, and situation."
      />
      <RangeGrid />
    </>
  );
}
