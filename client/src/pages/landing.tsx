import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-medium tracking-tight">cliver</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login"
          >
            Sign in
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-3xl font-semibold tracking-tight mb-3">
            Customer screening, automated
          </h1>
          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            Run background research on customers in minutes using configurable AI models with web search and custom tools.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => window.location.href = '/api/login'}
              data-testid="button-get-started"
            >
              Get started
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/api/guest-login'}
            >
              Try as guest
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-5">
        <div className="max-w-5xl mx-auto px-6 text-center text-xs text-muted-foreground">
          cliver
        </div>
      </footer>
    </div>
  );
}
