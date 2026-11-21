import '../../today/v5-peacock-app/tokens.css';
import './core/workbench.css';
import { WorkbenchRoot } from './core/shell';
import { EdgeStripLayout } from './parts/layout';

/** Lab entry. v5's kit and pages are imported, not copied: see README.md. */
export default function Page() {
  return <WorkbenchRoot>{(controls, ready) => <EdgeStripLayout controls={controls} ready={ready} />}</WorkbenchRoot>;
}
