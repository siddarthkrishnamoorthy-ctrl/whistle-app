export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
      <p className="max-w-sm text-sm text-text-secondary">
        This screen is scoped for {phase} of the build plan and hasn&apos;t been implemented yet.
      </p>
    </div>
  );
}
