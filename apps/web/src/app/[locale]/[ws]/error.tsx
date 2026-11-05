'use client';

/**
 * @file A page crashed. This renders inside the project's layout, so the sidebar and header survive and the member can walk away (review M9).
 */
import { type CaughtError, PageCrash } from '@/components/shell/boundaries';

export default function PageError(props: CaughtError) {
  return <PageCrash {...props} />;
}
