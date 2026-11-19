/**
 * @file kit.ts
 * @description The kit's public surface. Pages import from here: `import { CardRow, useKeyboardList } from '@/components/kit';`.
 * Props and examples are in apps/web/README.md.
 */
export { cn } from '@/lib/utils';

// Router (every page needs it)
export {
  AppLink,
  closeCard,
  goTo,
  hrefFor,
  type HrefOptions,
  navigate,
  openCard,
  type OpenCardOptions,
  type Route,
  setQuery,
  type SheetTab,
  useRoute,
  type ViewId,
} from '@/components/shell/router';

// Card types, so a page can narrow without a second import
export type {
  CardListItem,
  ChangeCard,
  DecisionCard,
  DocCard,
  HandoffCard,
  HubCard,
  IdeaCard,
  Member,
  NeedCard,
  PlanCard,
  RedesignCard,
  ReleaseCard,
  Role,
  TaskCard,
} from '@/features/cards/types';

// Vocabulary and strings
export {
  avatarClass,
  focusRing,
  focusRingInset,
  prioClass,
  roleIcon,
  statusIcon,
  statusTone,
  stretchedFocus,
  type Tone,
  toneClass,
  typeClass,
  typeIcon,
} from '@/components/cards/meta';
export { Bidi, fill, fmt, Ltr } from '@/components/common/text';
export * from '@/lib/format';
export {
  actionName,
  type CardAction,
  eventLabel,
  kitMessages,
  type Locale,
  useLocale,
  useT,
} from '@/lib/i18n';

// Atoms
export { ActorChip, Avatar } from '@/components/cards/avatar';
export {
  MineMark,
  Pill,
  PriorityBadge,
  RoleBadge,
  StatusBadge,
  TypeBadge,
  TypeDot,
  TypeIcon,
} from '@/components/cards/badges';
export { CardChip, CardKey } from '@/components/cards/card-key';
export { CopyButton, copyText } from '@/components/common/copy-button';
export { RelativeTime } from '@/components/common/relative-time';
export { Button, type ButtonProps, type ButtonVariant, IconButton, Kbd } from '@/components/ui/button';
export {
  type OffCopy,
  type OffKey,
  setHelpMode,
  Tip,
  type TipCopy,
  type TipFact,
  type TipKey,
  TipProvider,
  useHelpMode,
  useKeyLabels,
  usingKeyboard,
} from '@/components/ui/rich-tip';
export { Tooltip } from '@/components/ui/tooltip';

// Forms and dialogs
export { CardPicker, DocPicker, type DocPickerItem } from '@/components/cards/pickers';
export { ConfirmDialog, Modal } from '@/components/ui/dialog';
export {
  detectSecret,
  Field,
  focusFirstInvalid,
  SecretFilterError,
  Select,
  Textarea,
  TextInput,
} from '@/components/ui/form';

// States and layout
export {
  ChipGroup,
  type ExtraChip,
  FilterBar,
  type FilterGroup,
  type FilterOption,
  rememberMine,
  type SelectFilter,
  useFilter,
  useFilterList,
} from '@/components/common/filter-bar';
export { PageContainer, PageHeader, SectionHeader, usePageTitleFocus } from '@/components/common/layout';
export {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
  SkeletonRow,
  SkeletonRows,
} from '@/components/common/states';
export { matchAny, matchKey } from '@/lib/keys';
export { useRoving } from '@/lib/roving';

// Rows, keyboard, feedback
export { CardRow, type CardRowProps } from '@/components/cards/card-row';
export { PickField } from '@/components/cards/pick-field';
export { RowAction } from '@/components/cards/row-action';
export { dismissToast, showToast, type ToastOptions } from '@/components/common/toast';
export { Segmented } from '@/components/ui/segmented';
export { portalRoot, useFocusReturn, useMedia, usePageWide } from '@/lib/hooks';
export { focusRowWhenReady, type KeyboardListOptions, useKeyboardList } from '@/lib/keyboard-list';
export { setPreference, shortcutsEnabled, usePreference } from '@/lib/preferences';

// Cards and session: data
export {
  type ActionPayload,
  actionsFor,
  type AvailableAction,
  awaitedAction,
  usePerformAction,
} from '@/features/cards/actions';
export { qk } from '@/features/cards/keys';
export {
  addComment,
  addLink,
  allCards,
  type CardFilters,
  createCard,
  getCard,
  handoffAgeMs,
  isHandoffStale,
  type NewCardInput,
  openBlockers,
  portTaskOf,
  removeLink,
  setArchived,
  toggleWatch,
  updateCard,
  useCard,
  useCardComments,
  useCardEvents,
  useCardQuery,
  useCards,
  useCardSearch,
  useCardsQuery,
  useReadyTasks,
  writeCard,
} from '@/features/cards/store';
export { useLiveStatus } from '@/features/live/live-provider';
export {
  type AwaitingCard,
  type AwaitingGroup,
  buildAwaiting,
  type Counters,
  isLate,
  isOverdue,
  type MyCounts,
  type Session,
  useAwaiting,
  useCounters,
  useMe,
  useMember,
  useMembers,
  useMyCounts,
  useSession,
  useToday,
  useWorkspace,
  useWorkspaces,
} from '@/features/session/session';

// The sheet's parts other pages reuse
export {
  ActionPanel,
  Checklist,
  ContractChange,
  DecisionOptionCard,
  Fact,
  Facts,
  HandoffDiffList,
  NeedStatusStepper,
  NoteActionForm,
  type SectionProps,
  sheetSections,
  SubHeading,
} from '@/components/cards/sheet-sections';
export { tabTriggerClass } from '@/components/ui/tabs-class';

// Screenshots and markdown
export { Lightbox, type LightboxImage } from '@/components/common/lightbox';
export { headingsOf, type MarkdownHeading, MarkdownView, slugify } from '@/components/common/markdown';
export { CommandBlock, ShownOnce } from '@/components/common/shown-once';
export { RoleChecks } from '@/components/ui/role-checks';
export { RowMenu, type RowMenuItem } from '@/components/ui/row-menu';
