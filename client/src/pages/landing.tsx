import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Search, Zap, Shield } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Cliver</h1>
          </div>
          <Button
            onClick={() => window.location.href = '/api/login'}
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-4xl font-semibold tracking-tight mb-4">
              AI-Powered Customer Screening
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Speed up customer onboarding and follow-up screening with automated customer reports. Flag potential issues in minutes, not hours.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Card className="p-6 hover-elevate">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Multi-Model Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Get simultaneous responses from multiple AI models for comprehensive insights
              </p>
            </Card>

            <Card className="p-6 hover-elevate">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Search className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Web Search Integration</h3>
              <p className="text-sm text-muted-foreground">
                Powered by real-time web search and custom screening tools
              </p>
            </Card>

            <Card className="p-6 hover-elevate">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Configurable Workflows</h3>
              <p className="text-sm text-muted-foreground">
                Customize AI models, prompts, and reasoning settings for your needs
              </p>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button
              size="lg"
              onClick={() => window.location.href = '/api/guest-login'}
              className="px-8"
              data-testid="button-get-started"
            >
              Get Started
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Try it now, no sign-in required
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Cliver. Powered by AI.
        </div>
      </footer>
    </div>
  );
}
