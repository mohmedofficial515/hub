/**
 * @file tabs-class.ts
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/tabs-class.ts. Contract: apps/web/README.md.
 */
import { focusRing } from '@/components/cards/meta';

/** Shared look of Radix `Tabs.Trigger`: an underline tab, 44 px on phones, 36 px on desktop. */
// The tab underline is one of the markers the design keeps by name (README, Results); it is not a card edge.
// eslint-disable-next-line hub/no-raw-palette
export const tabTriggerClass = `-mb-px inline-flex h-11 items-center gap-1.5 border-b-2 border-transparent px-3 text-body-sm font-medium text-muted-foreground transition-colors duration-120 hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground md:h-9 ${focusRing}`;
