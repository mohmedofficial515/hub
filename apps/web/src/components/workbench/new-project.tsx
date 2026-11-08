'use client';

/**
 * @file new-project.tsx
 * @description New project from the panel (docs/16 §11): the Projects page's own wizard, which creates through the route `create_project` stands for and links the folder in its
 * last step. Once made, Hub opens the new project's Today.
 */
import { useQueryClient } from '@tanstack/react-query';

import { goTo, useLocale } from '@/components/kit';
import { NewProjectWizard } from '@/components/workspaces/new-project-wizard';
import { qk } from '@/features/cards/keys';

export function PanelNewProject({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useLocale();
  const client = useQueryClient();
  return (
    <NewProjectWizard
      open={open}
      onOpenChange={onOpenChange}
      onCreated={(slug) => {
        void client.invalidateQueries({ queryKey: qk.workspaces });
        void client.invalidateQueries({ queryKey: qk.me });
        goTo(`/${locale}/${slug}/today`);
      }}
    />
  );
}
