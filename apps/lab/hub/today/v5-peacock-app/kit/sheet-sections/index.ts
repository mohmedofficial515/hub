import type { ComponentType } from 'react';
import type { CardType } from '@lab/mocks/hub-app';
import { ChangeSection } from './change';
import { DecisionSection } from './decision';
import { DocSection } from './doc';
import { HandoffSection } from './handoff';
import { NeedSection } from './need';
import { RedesignSection } from './redesign';
import { ReleaseSection } from './release';
import type { SectionProps } from './shared';
import { TaskSection } from './task';

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
} as unknown as Record<CardType, ComponentType<SectionProps>>;

export type { SectionProps } from './shared';
export { ActionPanel, Checklist, Fact, Facts, NoteActionForm, SubHeading } from './shared';
export { ContractChange, HandoffDiffList } from './handoff';
export { DecisionOptionCard } from './decision';
export { NeedStatusStepper } from './need';
