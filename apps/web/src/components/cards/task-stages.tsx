'use client';

/**
 * @file task-stages.tsx
 * @description The stages an agent reports with `report_stage` while it works a task (`/hub:work`), as the live checklist the panel shows, so a
 * task opened from the board or a link says which stage the work is at. It reads the chat the panel has open on this task, else the chat of
 * the task's running run, else the chat of its last report. Reads only: nothing here starts or moves anything.
 */
import { ProtocolCard } from '@/components/workbench/protocol';
import { useMaybeWb } from '@/components/workbench/store';
import { useChat, useWorkReports } from '@/features/chat/queries';
import { type Item, itemsOf } from '@/features/chat/thread-items';
import { useQueue } from '@/features/queue/queries';

type Protocol = Extract<Item, { kind: 'protocol' }>;

/** The last work checklist on this card in a chat's items. */
export function workStagesOf(items: readonly Item[], cardKey: string): Protocol | undefined {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item?.kind === 'protocol' && item.protocol === 'work' && item.target === cardKey) return item;
  }
  return undefined;
}

export function TaskStages({ cardKey }: { cardKey: string }) {
  const wb = useMaybeWb();
  const open = wb?.chat ? workStagesOf(wb.chat.items, cardKey) : undefined;
  // Shares its query with `CardRuns`, so it asks nothing more.
  const runs = useQueue({ card: cardKey }).data?.runs ?? [];
  const running = runs.find((r) => (r.state === 'running' || r.state === 'waiting') && r.chatId)?.chatId;
  const reported = useWorkReports(cardKey).data?.[0]?.chatId;
  const chatId = open ? null : (running ?? reported ?? null);
  const chat = useChat(chatId);
  const item = open ?? (chat.data && !chat.isError ? workStagesOf(itemsOf(chat.data), cardKey) : undefined);
  if (!item) return null;
  return <ProtocolCard item={item} />;
}
