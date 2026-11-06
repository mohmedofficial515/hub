/**
 * @file index.ts
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/sheet-sections/index.ts. Contract: apps/web/README.md.
 */
import type { ComponentType } from 'react';

import { ChangeSection } from '@/components/cards/sheet-sections/change';
import { DecisionSection } from '@/components/cards/sheet-sections/decision';
import { DocSection } from '@/components/cards/sheet-sections/doc';
import { HandoffSection } from '@/components/cards/sheet-sections/handoff';
import { IdeaSection } from '@/components/cards/sheet-sections/idea';
import { NeedSection } from '@/components/cards/sheet-sections/need';
import { PlanSection } from '@/components/cards/sheet-sections/plan';
import { RedesignSection } from '@/components/cards/sheet-sections/redesign';
import { ReleaseSection } from '@/components/cards/sheet-sections/release';
import type { SectionProps } from '@/components/cards/sheet-sections/shared';
import { TaskSection } from '@/components/cards/sheet-sections/task';
import type { CardType } from '@/features/cards/types';

/** One entry per card type (08 §5.4). To extend a type, edit its file; the sheet picks it up from here. */
export const sheetSections = {
  task: TaskSection,
  decision: DecisionSection,
  need: NeedSection,
  change: ChangeSection,
  handoff: HandoffSection,
  redesign: RedesignSection,
  doc: DocSection,
  release: ReleaseSection,
  idea: IdeaSection,
  plan: PlanSection,
} as unknown as Record<CardType, ComponentType<SectionProps>>;

export { DecisionOptionCard } from '@/components/cards/sheet-sections/decision';
export { ContractChange, HandoffDiffList } from '@/components/cards/sheet-sections/handoff';
export { NeedStatusStepper } from '@/components/cards/sheet-sections/need';
export type { SectionProps } from '@/components/cards/sheet-sections/shared';
export {
  ActionPanel,
  Checklist,
  Fact,
  Facts,
  NoteActionForm,
  SubHeading,
} from '@/components/cards/sheet-sections/shared';
