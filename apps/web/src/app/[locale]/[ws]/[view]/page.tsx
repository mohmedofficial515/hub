/**
 * @file An address under a project that names no view (`/en/goteav/nope`). Every view has its own folder now, so this only says
 * "not found", inside the shell: without it the address would fall through to `[locale]/[...rest]`, outside the project's frame.
 */
import { notFound } from 'next/navigation';

export default function UnknownView() {
  notFound();
}
