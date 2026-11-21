import type { HubCard } from '@lab/mocks/hub-app';
import { useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { openCard } from '../shell/router';
import { Button, type ButtonProps } from './button';
import { actionsFor, usePerformAction } from './card-actions';
import { actionName, kitMessages, type CardAction } from './i18n';
import { focusRing } from './meta';
import { useSession } from './session';
import { fmt } from './text';
import { Tooltip } from './tooltip';

const messages = {
  ar: { needsRole: 'هذا الإجراء لدور {role}' },
  en: { needsRole: 'This is for the {role} role' },
};

/**
 * A row's button for one card action, following `actionsFor`: absent if the status has no such action, a form action
 * opens the sheet on it, an action with no form runs here, and a missing role gives a disabled button with a tooltip naming
 * the role (08 §5.6). `denied` overrides that tooltip, with `{role}` filled in.
 */
export function RowAction({ card, action, denied, className, ...rest }: { card: HubCard; action: CardAction; denied?: string } & Omit<ButtonProps, 'onClick' | 'children' | 'disabled'>) {
  const t = useT(kitMessages);
  const m = useT(messages);
  const { roles, me } = useSession();
  const perform = usePerformAction();
  const available = actionsFor(card, roles, me.id).find((a) => a.action === action);
  if (!available) return null;
  const label = actionName(t, card.type, action);
  if (!available.enabled) {
    const role = available.needsRole ? t.roles[available.needsRole] : '';
    const reason = fmt(denied ?? m.needsRole, { role });
    return (
      <Tooltip content={reason}>
        <span tabIndex={0} role="button" aria-disabled="true" aria-label={`${label}: ${reason}`} className={cn('relative z-10 inline-flex rounded-md', focusRing, className)}>
          <Button {...rest} variant="outline" disabled tabIndex={-1} aria-hidden className="w-full">
            {label}
          </Button>
        </span>
      </Tooltip>
    );
  }
  return (
    <Button {...rest} className={className} onClick={() => (available.mode === 'form' ? openCard(card.key, { action }) : perform(card.key, action))}>
      {label}
    </Button>
  );
}
