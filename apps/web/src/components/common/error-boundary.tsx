'use client';

/**
 * @file error-boundary.tsx
 * @description Keeps a crash inside what crashed. Next's `error.tsx` guards a route's page; this guards what the shell draws itself, such as the sheet.
 */
import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback: (reset: () => void) => ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children;
  }
}
