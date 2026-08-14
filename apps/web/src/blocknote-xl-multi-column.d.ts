// Ambient declaration for @blocknote/xl-multi-column.
// The published 0.25.1 package points its `types` at a file that isn't shipped, so
// TypeScript can't resolve it. We only need a handful of exports; type them loosely.
declare module '@blocknote/xl-multi-column' {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  // Identity-preserving at the type level: it adds column blocks at runtime, but
  // returning the same schema type keeps the app's strong `weftSchema` typing (and
  // thus typed inserts like `mention`). The extra column blocks are inserted via
  // untyped BlockNote calls, so they don't need to appear in the static type.
  export function withMultiColumn<T>(schema: T): T;
  export const multiColumnDropCursor: any;
  export const locales: Record<string, any>;
  export const multiColumnSchema: any;
  export const getMultiColumnSlashMenuItems: any;
  export const getMultiColumnDictionary: any;
  export const checkMultiColumnBlocksInSchema: any;
  export const ColumnBlock: any;
  export const ColumnListBlock: any;
}
