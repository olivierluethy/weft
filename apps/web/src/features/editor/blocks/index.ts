// Barrel for Weft's custom BlockNote block/inline specs. Registered into
// `weftSchema` (mention.tsx). Each is exercised by the shared block-type
// registry (blockTypes.tsx), so all appear in both the "/" and "+" menus.
import { Equation, InlineEquation, Mermaid, Bookmark, ActionButton } from './richBlocks';
import { Chart } from './chartBlock';
import {
  Divider,
  Quote,
  Callout,
  Toggle,
  TableOfContents,
  Breadcrumb,
  SyncedBlock,
  SmartNotes,
} from './contentBlocks';
import { DataView, DatabaseBlock, FormBlock, Tabs, Columns } from './dataBlocks';

export const weftCustomBlockSpecs = {
  divider: Divider,
  quote: Quote,
  callout: Callout,
  toggle: Toggle,
  tableOfContents: TableOfContents,
  breadcrumb: Breadcrumb,
  syncedBlock: SyncedBlock,
  smartNotes: SmartNotes,
  equation: Equation,
  mermaid: Mermaid,
  bookmark: Bookmark,
  weftButton: ActionButton,
  chart: Chart,
  dataView: DataView,
  database: DatabaseBlock,
  weftForm: FormBlock,
  tabs: Tabs,
  columns: Columns,
} as const;

export const weftCustomInlineSpecs = {
  inlineEquation: InlineEquation,
} as const;
