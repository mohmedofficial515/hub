/**
 * @file shell.spec.ts
 * @description The shell loads on its own, in the order a real page loads it. The kit and the workbench reach each other, and a value read at load time would break every page, so this holds that door shut.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/en/demo/today',
}));

describe('shell', () => {
  it('loads through the kit first', async () => {
    const kit = await import('@/components/kit');
    expect(kit.cn).toBeTypeOf('function');
    const { Shell } = await import('@/components/shell/shell');
    expect(Shell).toBeTypeOf('function');
  });
});
