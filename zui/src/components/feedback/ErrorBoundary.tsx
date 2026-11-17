"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./ErrorState";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Al cambiar (por ejemplo, la ruta) se descarta el error y se vuelve a intentar. */
  resetKey?: unknown;
  /** Sustituye la vista de error por defecto. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Textos de la vista por defecto. */
  title?: ReactNode;
  message?: ReactNode;
  retryLabel?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Captura errores de render de su subárbol y muestra un `ErrorState` con reintento. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.reset();
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    const {
      title = "This section could not be displayed",
      message = "Something failed while rendering this content. You can try again; if it keeps happening, reload the page.",
      retryLabel,
    } = this.props;
    return <ErrorState title={title} message={message} retryLabel={retryLabel} onRetry={this.reset} />;
  }
}
