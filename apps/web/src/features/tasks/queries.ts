'use client';

/**
 * @file queries.ts
 * @description The Tasks page's data: `GET /tasks` with detail and blockers, and the edit that spans `PATCH /cards/{key}` and `PATCH /tasks/{key}`.
 */
import type { UpdateCardInput } from '@hub/contracts';
import { useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { patch } from '@/lib/api/client';

import { qk } from '../cards/keys';
import type { CardFullDto } from '../cards/map';
import { fetchDetailRows } from '../cards/rows';
import { writeCard } from '../cards/store';
import type { TaskCard, TaskDetail } from '../cards/types';

type TaskRowDto = CardFullDto & { blockedBy?: string[] };

export function useTasksQuery() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'tasks' }),
    enabled: !!ws,
    queryFn: () =>
      fetchDetailRows<TaskRowDto, TaskCard>(`workspaces/${ws}/tasks`, {}, (card, dto) => ({
        ...card,
        links: (dto.blockedBy ?? []).map((key) => ({ kind: 'blocked_by' as const, key })),
      })),
  });
}

export interface TaskDetailPatch {
  specialty?: TaskDetail['specialty'];
  effort?: NonNullable<TaskDetail['effort']> | null;
  acceptance?: string | null;
  prompt?: string | null;
  branch?: string | null;
  prUrl?: string | null;
}

/** What each field is on the card the kit reads, once saved. Null is how the API says "cleared"; the kit reads that as absent. */
function predictedHeader(header: UpdateCardInput): Partial<TaskCard> {
  const { assignee, ...rest } = header;
  const fields = Object.fromEntries(
    Object.entries(rest).map(([name, value]) => [name, value ?? undefined]),
  ) as Partial<TaskCard>;
  return assignee === undefined ? fields : { ...fields, assigneeId: assignee ?? undefined };
}

/** One save of the sheet's form. The header and the detail are two endpoints with two permission rows; only what changed is sent. */
export function saveTask(ws: string, key: string, header: UpdateCardInput, detail: TaskDetailPatch) {
  const hasHeader = Object.keys(header).length > 0;
  const hasDetail = Object.keys(detail).length > 0;
  return writeCard(
    {
      key,
      fields: predictedHeader(header),
      card: (card) =>
        card.type === 'task'
          ? {
              ...card,
              task: {
                ...card.task,
                ...(Object.fromEntries(
                  Object.entries(detail).map(([name, value]) => [name, value ?? undefined]),
                ) as Partial<TaskDetail>),
              },
            }
          : card,
    },
    async () => {
      if (hasHeader) await patch(`workspaces/${ws}/cards/${key}`, header);
      if (hasDetail) await patch(`workspaces/${ws}/tasks/${key}`, detail);
    },
    ws,
  );
}
