import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback override. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * App-level error boundary. Catches render errors in any descendant
 * and shows a friendly fallback with reload + home actions.
 *
 * Place near the top of the tree (above routes) so a single rendering
 * error doesn't take the whole app down.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to monitoring; replace with Sentry / LogRocket / etc. when wired up.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary]", error, info?.componentStack);
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-lg p-8 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"
              aria-hidden="true"
            >
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              An unexpected error occurred while rendering this page. You can try
              reloading or head back to the dashboard.
            </p>

            {import.meta.env.DEV && (
              <pre className="mt-4 max-h-40 w-full overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
                {error.message}
                {error.stack ? "\n\n" + error.stack : ""}
              </pre>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={this.reset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
              <Button
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                <Home className="mr-2 h-4 w-4" />
                Go to dashboard
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }
}

export default ErrorBoundary;
