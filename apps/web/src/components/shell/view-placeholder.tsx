'use client';

/**
 * @file view-placeholder.tsx
 * @description The honest state of a view whose page has not been ported: its title and one sentence. No sample data (brief, docs/15 §3).
 */
import { Hammer } from 'lucide-react';

import { EmptyState, PageContainer, PageHeader, useRoute } from '@/components/kit';
import { messages, useT } from '@/lib/i18n';

export function ViewPlaceholder() {
  const t = useT(messages);
  const { view } = useRoute();
  return (
    <PageContainer>
      <PageHeader title={t.nav[view]} />
      <EmptyState icon={Hammer} size="page" title={t.placeholder.title}>
        {t.placeholder.body}
      </EmptyState>
    </PageContainer>
  );
}
