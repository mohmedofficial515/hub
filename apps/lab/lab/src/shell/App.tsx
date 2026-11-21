import { registry } from '../core/registry';
import { Notes } from './Notes';
import { Pane } from './Pane';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { useRoute } from './route';

export function App() {
  const [route, go] = useRoute();
  const ready = route.app && route.page && route.a;
  const shown = [...new Set([route.a, route.b])].filter((v): v is string => !!v && v !== 'live');

  return (
    <div className="flex h-dvh bg-zinc-900 text-zinc-100">
      <Sidebar route={route} go={go} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar route={route} go={go} />
        <div className="flex min-h-0 flex-1">
          {ready ? (
            <div className="flex min-w-0 flex-1 divide-x divide-white/10">
              <Pane route={route} app={route.app!} page={route.page!} version={route.a!} label={!!route.b} />
              {route.b && <Pane route={route} app={route.app!} page={route.page!} version={route.b} label />}
            </div>
          ) : (
            <Welcome />
          )}
          {ready && route.notes && route.page !== '_tokens' && <Notes app={route.app!} page={route.page!} versions={shown} />}
        </div>
      </div>
    </div>
  );
}

function Welcome() {
  const versions = registry.reduce((n, p) => n + p.versions.length, 0);
  return (
    <div className="grid flex-1 place-items-center p-8 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-lg font-semibold">Redesign Lab</p>
        <p className="text-sm text-zinc-400">
          {registry.length} pages · {versions} versions. Pick a page or the token preview from the sidebar.
        </p>
      </div>
    </div>
  );
}
