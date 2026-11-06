import '../../today/v5-peacock-app/tokens.css';
import './core/workbench.css';
import { WorkbenchRoot } from './core/shell';
import { ConversationDeskLayout } from './parts/layout';

/** Lab entry. v5's kit and pages are imported, not copied: see README.md. */
export default function Page() {
  return <WorkbenchRoot>{(controls, ready) => <ConversationDeskLayout controls={controls} ready={ready} />}</WorkbenchRoot>;
}
