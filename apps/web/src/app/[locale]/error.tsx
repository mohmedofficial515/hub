'use client';

/**
 * @file The shell itself, or a page outside a project, crashed. The language and theme still hold, because this sits inside the locale layout.
 */
import { type CaughtError, FullPageCrash } from '@/components/shell/boundaries';

export default function LocaleError(props: CaughtError) {
  return <FullPageCrash {...props} />;
}
