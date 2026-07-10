/* eslint-disable @next/next/no-img-element */
// Split auth layout: Whistle branding fills the left half of the screen,
// the login/signup form sits on the right. On small screens the side panel
// hides and a compact logo shows above the form instead.
export function AuthSplit({ tagline, children }: { tagline?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-1/2 flex-col items-center justify-center border-r border-border bg-surface/60 p-12 lg:flex">
        <img src="/whistle-logo.png" alt="Whistle" className="mb-6 h-32 w-auto" />
        <div className="text-4xl font-bold tracking-tight text-accent">Whistle</div>
        <div className="mt-1 text-sm text-text-muted">By School of Sports</div>
        {tagline && <p className="mt-8 max-w-sm text-center text-sm leading-relaxed text-text-secondary">{tagline}</p>}
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <img src="/whistle-logo.png" alt="Whistle" className="mx-auto mb-3 h-16 w-auto" />
            <div className="mb-1 text-2xl font-bold tracking-tight text-accent">Whistle</div>
            <div className="text-xs text-text-muted">By School of Sports</div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
