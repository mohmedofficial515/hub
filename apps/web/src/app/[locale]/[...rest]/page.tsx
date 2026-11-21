/**
 * @file An address deeper than any route (`/en/nope/deep/path`). Without this, Next answers with its own page, outside the locale layout.
 */
import { notFound } from 'next/navigation';

export default function Unknown() {
  notFound();
}
