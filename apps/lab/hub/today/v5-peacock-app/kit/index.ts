// The kit's public surface. Pages import from here: `import { CardRow, useKeyboardList } from '../../kit';`
// See kit/README.md for props and examples.

export { cn } from '@lab/ui/hub-cn';

// Router (lives in shell/, surfaced here because every page needs it)
export { AppLink, closeCard, hrefFor, navigate, openCard, setQuery, useRoute, type HrefOptions, type OpenCardOptions, type Route, type SheetTab, type ViewId } from '../shell/router';

// Card types, so a page can narrow without a second import
export type { ChangeCard, DecisionCard, DocCard, HandoffCard, HubCard, NeedCard, RedesignCard, ReleaseCard, TaskCard } from '@lab/mocks/hub-app';

// Vocabulary and strings
export { actionName, eventLabel, kitMessages, type CardAction } from './i18n';
export * from './format';
export { Bidi, fill, fmt, Ltr } from './text';
export { avatarClass, focusRing, focusRingInset, stretchedFocus, prioClass, roleIcon, statusIcon, statusTone, toneClass, typeClass, typeIcon, type Tone } from './meta';

// Atoms
export { MineMark, Pill, PriorityBadge, RoleBadge, StatusBadge, TypeBadge, TypeDot, TypeIcon } from './badges';
export { Button, IconButton, Kbd, type ButtonProps, type ButtonVariant } from './button';
export { CardChip, CardKey } from './card-key';
export { ActorChip, Avatar } from './avatar';
export { CopyButton, copyText } from './copy-button';
export { RelativeTime } from './relative-time';
export { Tooltip } from './tooltip';

// Forms and dialogs
export { detectSecret, Field, focusFirstInvalid, SecretFilterError, Select, Textarea, TextInput } from './form';
export { ConfirmDialog, Modal } from './dialog';
export { CardPicker, DocPicker, type DocPickerItem } from './pickers';
export { archiveInbox, markCardsRead, markInboxRead, markInboxUnread, markSourceRead, restoreInbox, unreadCount, useInbox } from './inbox-store';

// States and layout
export { EmptyState, ErrorState, LoadingRegion, Skeleton, SkeletonRow, SkeletonRows } from './states';
export { PageContainer, PageHeader, SectionHeader } from './layout';
export { useRoving } from './roving';
export { ChipGroup, FilterBar, rememberMine, useFilter, useFilterList, type ExtraChip, type FilterGroup, type FilterOption, type SelectFilter } from './filter-bar';
export { matchAny, matchKey } from './keys';

// Rows, keyboard, feedback
export { CardRow, type CardRowProps } from './card-row';
export { RowAction } from './row-action';
export { Segmented } from './segmented';
export { PickField } from './pick-field';
export { focusRowWhenReady, useKeyboardList, type KeyboardListOptions } from './keyboard-list';
export { dismissToast, showToast, type ToastOptions } from './toast';
export { setPreference, shortcutsEnabled, usePreference } from './preferences';
export { portalRoot, useFocusReturn, useMedia } from './hooks';

// Cards and session
export { actionsFor, awaitedAction, usePerformAction, type AvailableAction } from './card-actions';
export { actedOn, addCard, addComment, addLink, allCards, actOn, cardsActedWith, createCard, getCard, handoffAgeMs, isHandoffStale, isTimelineSeen, markTimelineSeen, nextCardKey, notifyCardStore, patchCard, portTaskOf, searchCards, setArchived, openBlockers, toggleWatch, updateTask, useCard, useCards, useCardStoreVersion, type ActionPayload, type NewCardInput } from './card-store';
export { buildAwaiting, isLate, isOverdue, sinceVisitCount, useAwaiting, useClearedCount, useDeadlines, useMyCounts, useReadyTasks, useSession, type AwaitingCard, type AwaitingGroup, type MyCounts, type Scenario, type Session } from './session';

// The sheet's parts other pages reuse
export { CardSheet } from './card-sheet';
export { ActionPanel, Checklist, ContractChange, DecisionOptionCard, Fact, Facts, HandoffDiffList, NeedStatusStepper, NoteActionForm, sheetSections, SubHeading, type SectionProps } from './sheet-sections';
export { tabTriggerClass } from './tabs-class';

// Group C: screenshots and markdown, used by the Redesign and Docs pages and their sheet sections
export { Lightbox, type LightboxImage } from './lightbox';
export { MarkdownView, headingsOf, slugify, type MarkdownHeading } from './markdown';
export { isSourceProblem, updateAdmin, useAdmin, writeAudit, type AdminState } from './admin-store';
export { RowMenu, type RowMenuItem } from './row-menu';
export { CommandBlock, ShownOnce } from './shown-once';
export { RoleChecks } from './role-checks';
