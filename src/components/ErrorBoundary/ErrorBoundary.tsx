import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[range-soprano] uncaught render error', error, info);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div
        role="alert"
        className="flex h-full min-h-screen w-full flex-col items-center justify-center gap-3 bg-bg p-8 text-center text-content"
      >
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-md text-sm text-content-muted">
          The app hit an unexpected error. Reloading usually fixes it; your
          ranges are stored locally and stay safe.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          Reload
        </button>
      </div>
    );
  }
}
