/**
 * @file types.ts
 * @description The card as the web works with it. Field names follow the approved design's kit, whose components read them,
 * and `map.ts` builds them from the API's `CardSummary` and `CardFull` (docs/04 §1.8). Detail shapes follow docs/03 §6.
 */
import type { CardType, PlanExplainer, Priority, Role } from '@hub/contracts';

export type { CardType, Priority, Role } from '@hub/contracts';

export type ActorKind = 'user' | 'agent' | 'system';
export type Via = 'web' | 'mcp' | 'hook' | 'adapter' | 'import' | 'scheduler' | 'telegram';

export interface Member {
  id: string;
  name: string;
  email?: string | undefined;
  /** 1 to 12, the avatar hue. */
  avatarColor: number;
  roles: Role[];
  lastActiveAt?: string | undefined;
  online?: boolean | undefined;
}

export interface ActorRef {
  kind: ActorKind;
  userId: string | null;
  displayName: string | null;
  via: Via;
}

/** A row of `card_events`. `data` is kind-specific (docs/03 §5.2); `field_changed` carries `{ field, from, to }`. */
export interface CardEvent {
  id: string;
  seq: number;
  kind: string;
  actorKind: ActorKind;
  actorId?: string | undefined;
  actorName?: string | undefined;
  /** Adapter name when `actorKind` is `system` (github, oasdiff, lab, docs, scheduler). */
  adapter?: string | undefined;
  via: Via;
  at: string;
  data: Record<string, string | number | boolean | null>;
}

export interface CardComment {
  id: string;
  authorKind: 'user' | 'agent';
  authorId: string;
  authorName?: string | undefined;
  via: Via;
  body: string;
  at: string;
  editedAt?: string | undefined;
  redacted?: boolean | undefined;
}

export type LinkKind = 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates';

export interface CardLink {
  kind: LinkKind;
  key: string;
  /** The other card as the API returned it, so a link can show its title and status without another request. */
  card?: CardListItem | undefined;
}

export interface CardAttachment {
  kind: 'screenshot' | 'review' | 'file';
  name: string;
  url: string;
}

export interface CardFlags {
  blocked?: boolean | undefined;
  overdue?: boolean | undefined;
  escalated?: boolean | undefined;
  stale?: boolean | undefined;
  noSummary?: boolean | undefined;
}

export interface TaskDetail {
  specialty: 'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs';
  effort?: 'S' | 'M' | 'L' | 'XL' | undefined;
  /** Markdown checklist, one `- [ ]` / `- [x]` per line. */
  acceptance?: string | undefined;
  prompt?: string | undefined;
  origin:
    'manual' | 'import_suggestion' | 'session_followup' | 'redesign_port' | 'decision' | 'handoff' | 'plan';
  claimedById?: string | undefined;
  claimedAt?: string | undefined;
  branch?: string | undefined;
  prUrl?: string | undefined;
  startedAt?: string | undefined;
  doneAt?: string | undefined;
}

export interface DecisionOption {
  id: string;
  title: string;
  pros: string[];
  cons: string[];
  cost?: string | undefined;
  recommended?: boolean | undefined;
}

export interface DecisionDetail {
  kind: 'product' | 'technical' | 'financial' | 'design';
  question: string;
  options: DecisionOption[];
  deciderRole: Role;
  chosenOptionId?: string | undefined;
  rationale?: string | undefined;
  decidedById?: string | undefined;
  decidedAt?: string | undefined;
  /** Hours before the due date at which a reminder went out. */
  remindersSent: number[];
  escalatedAt?: string | undefined;
  escalatedToRole?: Role | undefined;
  adrPath?: string | undefined;
  adrPrUrl?: string | undefined;
  adrStatus: 'none' | 'drafted' | 'pr_opened' | 'merged' | 'failed';
}

export interface NeedDetail {
  kind: 'token' | 'account' | 'contract' | 'value_check' | 'file' | 'access' | 'other';
  responsibleRole: Role;
  requesterId?: string | undefined;
  /** Where the value was put, never the value itself. Shown after delivery. */
  location?: string | undefined;
  deliveredById?: string | undefined;
  deliveredAt?: string | undefined;
  verifiedById?: string | undefined;
  verifiedAt?: string | undefined;
  verificationNote?: string | undefined;
  /** The person who verified is the person who delivered (D24). */
  selfVerified?: boolean | undefined;
}

export interface ChangeCommit {
  sha: string;
  message: string;
  at: string;
  files: number;
  additions: number;
  deletions: number;
}

export interface ChangeSession {
  sessionId: string;
  changed?: string | undefined;
  remaining?: string | undefined;
  durationSec: number;
  noSummary: boolean;
}

export interface ChangeDetail {
  kind: 'commits' | 'pull_request' | 'session';
  authorLogin?: string | undefined;
  authorUserId?: string | undefined;
  commits: ChangeCommit[];
  commitCount: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  windowStart?: string | undefined;
  windowEnd?: string | undefined;
  prNumber?: number | undefined;
  prState?: 'open' | 'merged' | 'closed' | undefined;
  prUrl?: string | undefined;
  session?: ChangeSession | undefined;
}

/** One entry of the oasdiff changelog, as `HandoffDetail.payload` stores it. */
export interface OasdiffChange {
  endpoint: string;
  severity: 'breaking' | 'non-breaking';
  change: string;
  before?: string | undefined;
  after?: string | undefined;
}

export interface HandoffDetail {
  fromRole: Role;
  toRole: Role;
  kind: 'contract' | 'component' | 'design' | 'data' | 'other';
  severity: 'breaking' | 'notable' | 'info';
  summary: string;
  prompt?: string | undefined;
  payload: {
    oasdiff?: OasdiffChange[] | undefined;
    schemas?: string[] | undefined;
    files?: string[] | undefined;
  };
  sourceCardKey?: string | undefined;
  acknowledgedById?: string | undefined;
  acknowledgedAt?: string | undefined;
  appliedById?: string | undefined;
  appliedAt?: string | undefined;
  appliedTaskKey?: string | undefined;
}

export interface RedesignDetail {
  app: 'web' | 'dashboard' | 'hub';
  page: string;
  version: string;
  labPath: string;
  labUrl: string;
  /** The version's README front-matter, as the scanner read it. */
  frontMatter?: Record<string, unknown> | undefined;
  base?: string | undefined;
  concept: string;
  touchesComponents: string[];
  reviewScore?: number | undefined;
  reviewSummary?: string | undefined;
  approvedById?: string | undefined;
  approvedAt?: string | undefined;
  rejectedById?: string | undefined;
  rejectedAt?: string | undefined;
  decisionNote?: string | undefined;
  portTaskKey?: string | undefined;
  portedRef?: string | undefined;
}

export interface DocHeading {
  level: number;
  text: string;
  anchor: string;
}

export interface DocDetail {
  sourceName: string;
  path: string;
  kind: 'doc' | 'adr' | 'status' | 'readme' | 'other';
  lang: 'en' | 'ar';
  headings: DocHeading[];
  wordCount: number;
  lastCommitSha: string;
  lastIndexedAt: string;
  referencedBy: string[];
  /** Where the source can be read in a browser, when the source has such a place. */
  webUrl?: string | undefined;
}

export interface ReleaseDetail {
  version: string;
  repo?: string | undefined;
  tag?: string | undefined;
  releasedAt?: string | undefined;
  includedKeys: string[];
  /** What the API stores. Resolve it to cards with `useIncluded` (features/releases). */
  includedIds?: string[] | undefined;
  /** The included cards, as the API sends them. */
  included?: CardListItem[] | undefined;
  notes: { team: string; owner: string; accountant: string };
}

/** docs/15 §4. */
export interface IdeaDetail {
  problem?: string | undefined;
  notes?: string | undefined;
  role?: Role | undefined;
  planKey?: string | undefined;
  /** The Idea Studio chat it was accepted from, and the report it holds (owner decision 9c). */
  sourceChatId?: string | undefined;
  sourceMessageId?: string | undefined;
}

export interface PlanStep {
  id: string;
  title: string;
  role?: Role | undefined;
  taskKey?: string | undefined;
  done: boolean;
  /** What the studio proposed for the step (owner decision 9a). `after` names earlier steps by id. */
  why?: string | undefined;
  size?: 'S' | 'M' | 'L' | undefined;
  after?: string[] | undefined;
  acceptance?: string | undefined;
  /** One of the plan's `phases`, by id (v5-live-plan). Absent on a step outside any phase. */
  phaseId?: string | undefined;
  /** When the step last became done, set by Hub. */
  doneAt?: string | undefined;
  /** Pictures and clips that show the step done (v5-live-plan, batch 3). Hub's: the form never sends them. */
  evidence?: StepEvidence[] | undefined;
}

/** One file of a step's evidence: an attachment of the plan card, served at `evidenceUrl`. */
export interface StepEvidence {
  attachmentId: string;
  kind: 'before' | 'after' | 'video';
  caption?: string | undefined;
  mime: string;
  width?: number | null | undefined;
  height?: number | null | undefined;
  addedAt: string;
  /** How it came: `mcp` when Claude attached it. */
  via: 'web' | 'mcp';
  /** Who added it: they may remove it again. */
  addedBy?: string | null | undefined;
  /** A picture has a small WebP for a grid, at `…/file?size=thumb`. */
  thumb?: boolean | undefined;
}

/** A named part of a plan's steps, in the order of `PlanDetail.phases` (v5-live-plan). */
export interface PlanPhase {
  id: string;
  title: string;
  note?: string | undefined;
}

/** docs/15 §4. */
export interface PlanDetail {
  body: string;
  steps: PlanStep[];
  /** In order. Empty on a plan saved before phases: its steps read as one list. */
  phases: PlanPhase[];
  /** The plan explained on video by Hams (v5-live-plan, batch 4); null until asked for. */
  explainer?: PlanExplainer | null | undefined;
  ideaKey?: string | undefined;
  /** The Plan Studio chat it was saved from, and the reply whose plan it holds (owner decision 9c). */
  sourceChatId?: string | undefined;
  sourceMessageId?: string | undefined;
}

export interface CardCore {
  id: string;
  key: string;
  status: string;
  title: string;
  priority: Priority;
  ownerRole: Role | null;
  dueAt?: string | undefined;
  closedAt?: string | undefined;
  flags?: CardFlags | undefined;
  body?: string | undefined;
  createdAt: string;
  lastEventAt: string;
  createdByKind: ActorKind;
  createdById?: string | undefined;
  createdByName?: string | undefined;
  createdVia: Via;
  assigneeId?: string | undefined;
  assigneeName?: string | undefined;
  module?: string | undefined;
  repo?: string | undefined;
  branch?: string | undefined;
  tags: string[];
  commentCount: number;
  /** How many open cards wait on this one. */
  blocksCount?: number | undefined;
  archivedAt?: string | undefined;
  /** The verb waiting on this member, or null (review B2). The API's answer, from the card's state. */
  awaiting?: string | null | undefined;
  /** `CardFull.actions`, and the status it answered for. A predicted status does not match, and the rules run again. */
  serverActions?: readonly unknown[] | undefined;
  serverActionsStatus?: string | undefined;
}

/** What a list row knows: `CardSummary`. */
export type CardListItem = CardCore & { type: CardType };

/** What only `GET /cards/{key}` returns. */
export interface CardExtras {
  /** Member ids. */
  watchers: string[];
  watching: boolean;
  links: CardLink[];
  /** Filled by the History tab's query, in key order. */
  events: CardEvent[];
  /** Filled by the Comments tab's query. */
  comments: CardComment[];
  attachments: CardAttachment[];
  /** The API's answer for this member (docs/04 §2). */
  allowedActions: string[];
}

type Full<T extends CardType> = CardCore & CardExtras & { type: T };

export type TaskCard = Full<'task'> & { task: TaskDetail };
export type DecisionCard = Full<'decision'> & { decision: DecisionDetail };
export type NeedCard = Full<'need'> & { need: NeedDetail };
export type ChangeCard = Full<'change'> & { change: ChangeDetail };
export type HandoffCard = Full<'handoff'> & { handoff: HandoffDetail };
export type RedesignCard = Full<'redesign'> & { redesign: RedesignDetail };
export type DocCard = Full<'doc'> & { doc: DocDetail };
export type ReleaseCard = Full<'release'> & { release: ReleaseDetail };
export type IdeaCard = Full<'idea'> & { idea: IdeaDetail };
export type PlanCard = Full<'plan'> & { plan: PlanDetail };

/** The card as `GET /cards/{key}` returns it: narrow on `card.type` to reach its detail. */
export type HubCard =
  | TaskCard
  | DecisionCard
  | NeedCard
  | ChangeCard
  | HandoffCard
  | RedesignCard
  | DocCard
  | ReleaseCard
  | IdeaCard
  | PlanCard;

export const isFullCard = (card: CardListItem | HubCard): card is HubCard => 'allowedActions' in card;
