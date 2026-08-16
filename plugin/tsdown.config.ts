import { clientBundle } from '../packages/client/tsdown.client.ts'

// The libEntry points at the node-half source: one tsdown run emits both
// lib/index.js (empty host apply) and lib/client.js (browser occupant)
// without a separate tsc step.
export default clientBundle('dsh-workspace-picker-plus', ['src/index.ts'])
