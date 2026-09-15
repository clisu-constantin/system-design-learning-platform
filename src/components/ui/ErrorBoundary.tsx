import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the user knows which part failed. */
  area?: string;
}

interface State {
  error: Error | null;
}

/**
 * Keeps one broken simulation from taking down the whole application - labs run
 * continuous loops, so an isolated failure should stay isolated.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[system-design-interactive]', this.props.area ?? 'app', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A failed code-split fetch is a stale document, not a bug in the view.
    const isChunkError = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(
      error.message,
    );

    return (
      <div className="card m-4 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">
              {isChunkError
                ? 'This view could not be loaded'
                : this.props.area
                  ? `${this.props.area} crashed`
                  : 'Something went wrong'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isChunkError
                ? 'The page is referencing a build that is no longer being served, usually because the dev server restarted. Reloading fetches the current one.'
                : 'The rest of the application is still running. Reset this view to try again.'}
            </p>
            <pre className="ascii mt-3 max-h-40">{error.message}</pre>
            <div className="mt-4 flex flex-wrap gap-2">
              {isChunkError ? (
                <Button variant="primary" onClick={() => window.location.reload()}>
                  <RotateCcw className="h-4 w-4" />
                  Reload the page
                </Button>
              ) : null}
              <Button onClick={() => this.setState({ error: null })}>
                <RotateCcw className="h-4 w-4" />
                Reset view
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
