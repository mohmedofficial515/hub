'use client';

/**
 * @file workspace-gate-loader.tsx
 * @description The signed-in app renders in the browser only, as the design does. All its data comes from client queries, so the server would only
 * draw an empty frame, and a query that answers while React is still hydrating makes that frame disagree with the client. The theme is already on
 * `<html>`, so the first paint is the right background.
 */
import dynamic from 'next/dynamic';

const blank = () => <div className="min-h-dvh bg-background" />;

export const WorkspaceGate = dynamic(() => import('./workspace-gate').then((m) => m.WorkspaceGate), {
  ssr: false,
  loading: blank,
});

export const ProjectsPage = dynamic(
  () => import('@/components/workspaces/projects-page').then((m) => m.ProjectsPage),
  { ssr: false, loading: blank },
);
