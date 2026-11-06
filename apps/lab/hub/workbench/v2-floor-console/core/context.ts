import { useLocale, useT } from '@lab/i18n';
import { messages as shellMessages } from '../../../today/v5-peacock-app/i18n';
import { useCard, useRoute, fmt, showToast } from './kit';
import { wbMessages } from './strings';
import { getWb, send, useWb } from './store';
import { PROJECTS, type ScriptId } from './mock';

export type AskAction = 'explain' | 'plan' | 'redesign';

/** What the panel knows from where the owner is: project, page and open card (docs/16 §7). */
export function useWorkContext() {
  const route = useRoute();
  const locale = useLocale();
  const shell = useT(shellMessages);
  const card = useCard(route.cardKey ?? '');
  const wb = useWb();
  const project = PROJECTS.find((p) => p.id === wb.project)!;
  return {
    project,
    view: route.view,
    pageName: shell.nav[route.view],
    cardKey: card?.key ?? null,
    card: card ?? null,
    targetLabel: card ? card.key : shell.nav[route.view],
    cardTitle: card ? card.title[locale] : null,
  };
}

/** "Explain this" and friends, for the open card or the page. No retyping. A busy chat keeps its turn, so this opens a new one. */
export function useAsk() {
  const t = useT(wbMessages);
  const ctx = useWorkContext();
  return (action: AskAction, key?: string | null) => {
    const cardKey = key === undefined ? ctx.cardKey : key;
    const pages = { ar: shellMessages.ar.nav[ctx.view], en: shellMessages.en.nav[ctx.view] };
    const s = getWb();
    const active = s.chats.find((c) => c.id === s.activeId);
    if (active && active.status !== 'idle' && active.status !== 'stopped') showToast({ message: t.context.busy });
    send({
      text: {
        ar: fmt(wbMessages.ar.context.prompt[action], { target: cardKey ?? pages.ar }),
        en: fmt(wbMessages.en.context.prompt[action], { target: cardKey ?? pages.en }),
      },
      script: action as ScriptId,
      context: { view: cardKey ? undefined : ctx.pageName, cardKey: cardKey ?? undefined, action },
      fresh: true,
    });
  };
}
