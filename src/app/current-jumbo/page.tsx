import CurrentJumboRoll from '@/components/CurrentJumboRoll';

export default function CurrentJumboPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Current Jumbo Roll</h1>
        <p className="text-muted-foreground mt-1">
          Manage the currently active jumbo roll in production
        </p>
      </div>

      <CurrentJumboRoll />
    </div>
  );
}
