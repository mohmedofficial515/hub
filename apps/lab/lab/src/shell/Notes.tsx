import { marked } from 'marked';
import { field } from '../core/frontmatter';
import { findVersion, registry, type App } from '../core/registry';
import { StatusBadge } from './status';

const META_KEYS = ['base', 'created', 'tokens', 'touches-components', 'ported'];

export function Notes({ app, page, versions }: { app: App; page: string; versions: string[] }) {
  const entry = registry.find((p) => p.app === app && p.slug === page);

  return (
    <aside className="w-96 shrink-0 overflow-y-auto border-s border-white/10 bg-zinc-950 p-5 text-sm text-zinc-300">
      {versions.map((id) => {
        const v = findVersion(app, page, id);
        if (!v) return null;
        return (
          <article key={id} className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="font-semibold text-zinc-50">{v.title}</h2>
              <StatusBadge status={v.status} />
            </div>
            <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {META_KEYS.filter((k) => field(v.meta, k)).map((k) => (
                <div key={k} className="contents">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="text-zinc-300">{field(v.meta, k)}</dd>
                </div>
              ))}
            </dl>
            <Markdown source={v.notes} />
          </article>
        );
      })}

      {entry?.brief && (
        <article className="border-t border-white/10 pt-5">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">Page brief</h2>
          <Markdown source={entry.brief} />
        </article>
      )}
    </aside>
  );
}

function Markdown({ source }: { source: string }) {
  return (
    <div
      className="space-y-2 leading-relaxed [&_code]:text-zinc-200 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-zinc-100 [&_h2]:mt-4 [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_li]:ms-4 [&_li]:list-disc [&_table]:text-xs [&_td]:pe-3 [&_th]:pe-3 [&_th]:text-start"
      // Content is the lab's own README files.
      dangerouslySetInnerHTML={{ __html: marked.parse(source, { async: false }) }}
    />
  );
}
