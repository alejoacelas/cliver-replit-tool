import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-lg font-medium mb-1">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-4">
          The page you're looking for doesn't exist.
        </p>
        <Link href="/" className="text-sm underline underline-offset-2">
          Go home
        </Link>
      </div>
    </div>
  );
}
