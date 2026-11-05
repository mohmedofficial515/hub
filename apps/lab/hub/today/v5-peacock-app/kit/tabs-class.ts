import { focusRing } from './meta';

/** Shared look of Radix `Tabs.Trigger`: an underline tab, 44 px on phones, 36 px on desktop. */
export const tabTriggerClass = `-mb-px inline-flex h-11 items-center gap-1.5 border-b-2 border-transparent px-3 text-body-sm font-medium text-muted-foreground transition-colors duration-120 hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground md:h-9 ${focusRing}`;
