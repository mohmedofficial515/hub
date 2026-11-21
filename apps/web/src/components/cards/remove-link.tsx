'use client';

/**
 * @file remove-link.tsx
 * @description Remove one link from a card. A blocker added by mistake holds a task back, so the sheet offers this beside each link; the API
 * answers for who may, and a refusal says why.
 */
import { X } from 'lucide-react';

import { fmt } from '@/components/common/text';
import { showToast } from '@/components/common/toast';
import { IconButton } from '@/components/ui/button';
import { removeLink } from '@/features/cards/store';
import type { CardLink } from '@/features/cards/types';
import { isHubError } from '@/lib/api/errors';
import { kitMessages, useT } from '@/lib/i18n';

export function RemoveLink({ cardKey, link }: { cardKey: string; link: Pick<CardLink, 'kind' | 'key'> }) {
  const t = useT(kitMessages);
  return (
    <IconButton
      label={fmt(t.sections.task.removeLink, { key: link.key })}
      data-remove-link={link.key}
      onClick={() =>
        void removeLink(cardKey, link.kind, link.key).catch((e: unknown) =>
          showToast({ tone: 'error', message: isHubError(e) ? e.message : t.actionFailed }),
        )
      }
    >
      <X aria-hidden className="size-3.5" strokeWidth={1.75} />
    </IconButton>
  );
}
