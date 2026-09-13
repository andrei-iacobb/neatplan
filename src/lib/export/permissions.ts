import { hasMinRole, type Role } from '@/lib/roles'

/**
 * The minimum role for every exportable dataset.
 *
 * This lives apart from the dataset definitions - which import Prisma and are
 * server-only - so the client can decide whether to render an export control
 * without a round trip, and without a second copy of the rule drifting out of
 * step with the server's.
 */
export const DATASET_MIN_ROLE = {
  rooms: 'HEAD_OF_HOUSEKEEPING',
  equipment: 'HEAD_OF_HOUSEKEEPING',
  sites: 'HEAD_OF_HOUSEKEEPING',
  // Personnel records sit above the housekeeping line: a Head of Housekeeping
  // runs cleaning, not the staff roster.
  people: 'MANAGER',
  'floor-plans': 'HEAD_OF_HOUSEKEEPING',
  completions: 'HEAD_OF_HOUSEKEEPING',
  diary: 'HEAD_OF_HOUSEKEEPING',
  schedules: 'HEAD_OF_HOUSEKEEPING',
  // A cleaner pulls their own site worklist; that is what it is for.
  worklist: 'CLEANER',
} as const satisfies Record<string, Role>

export type DatasetId = keyof typeof DATASET_MIN_ROLE

export const DATASET_IDS = Object.keys(DATASET_MIN_ROLE) as DatasetId[]

export function isDatasetId(value: string): value is DatasetId {
  return Object.prototype.hasOwnProperty.call(DATASET_MIN_ROLE, value)
}

/**
 * Whether a role may export a dataset. The server re-checks this before running
 * any query; the client uses it only to decide whether to draw the control.
 */
export function roleCanExport(datasetId: string, role: string | null | undefined): boolean {
  if (!isDatasetId(datasetId)) return false
  return hasMinRole(role, DATASET_MIN_ROLE[datasetId])
}
