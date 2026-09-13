import 'server-only'

import type { SessionUser } from '@/lib/authz'
import { DATASET_MIN_ROLE, isDatasetId, roleCanExport, type DatasetId } from './permissions'
import {
  equipmentDataset,
  floorPlansDataset,
  roomsDataset,
  sitesDataset,
  usersDataset,
} from './datasets/inventory'
import {
  completionsDataset,
  diaryDataset,
  schedulesDataset,
  worklistDataset,
} from './datasets/work'
import type { DatasetDefinition, ExportDataset } from './types'

/**
 * Every exportable surface in one place. Adding a dataset here makes it
 * available as both CSV and a printable document with no further wiring, which
 * is why "everything is exportable" can be checked by reading one file.
 */
// Columns are contravariant in the row type, so no single concrete parameter
// accepts every definition at once. The row type is erased here and nowhere
// else: `resolveDataset` only ever hands a definition's own rows back to its own
// columns, so the erasure cannot mix two datasets up.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DATASETS: Record<string, DatasetDefinition<any>> = {
  rooms: roomsDataset,
  equipment: equipmentDataset,
  sites: sitesDataset,
  people: usersDataset,
  'floor-plans': floorPlansDataset,
  completions: completionsDataset,
  diary: diaryDataset,
  schedules: schedulesDataset,
  worklist: worklistDataset,
}

/**
 * Every id with a permission entry must have a definition, and vice versa. A
 * mismatch would mean either an unreachable dataset or - worse - one whose
 * permission the client cannot evaluate. Checked at module load so it fails at
 * boot rather than on someone's export.
 */
const permissionIds = Object.keys(DATASET_MIN_ROLE).sort()
const definitionIds = Object.keys(DATASETS).sort()
if (permissionIds.join(',') !== definitionIds.join(',')) {
  throw new Error(
    `Export registry mismatch: permissions [${permissionIds}] vs definitions [${definitionIds}]`
  )
}

export { isDatasetId }
export type { DatasetId }

export type ResolveFailure =
  | { kind: 'not-found' }
  | { kind: 'forbidden' }

export type ResolveResult<T> =
  | { ok: true; dataset: ExportDataset<T> }
  | { ok: false; failure: ResolveFailure }

/**
 * Whether this caller may export this dataset at all. Kept separate from
 * `resolveDataset` so a UI can hide an entrypoint without running the query.
 */
export function canExport(datasetId: string, user: SessionUser): boolean {
  const definition = DATASETS[datasetId]
  if (!definition) return false
  if (!roleCanExport(datasetId, user.role)) return false
  if (definition.authorize && !definition.authorize(user)) return false
  return true
}

/** The dataset ids this caller may see, for rendering menus. */
export function exportableDatasets(user: SessionUser): string[] {
  return Object.keys(DATASETS).filter((id) => canExport(id, user))
}

/**
 * Run a dataset for a caller. Authorisation is checked before the query runs, so
 * an unauthorised caller never touches the database, and a refusal is always a
 * 403 rather than an empty document.
 */
export async function resolveDataset(
  datasetId: string,
  user: SessionUser,
  params: URLSearchParams
): Promise<ResolveResult<unknown>> {
  const definition = DATASETS[datasetId]
  if (!definition) return { ok: false, failure: { kind: 'not-found' } }
  if (!canExport(datasetId, user)) return { ok: false, failure: { kind: 'forbidden' } }

  const cap = definition.cap
  const result = await definition.load({ user, params }, cap)

  return {
    ok: true,
    dataset: {
      slug: definition.slug,
      title: definition.title,
      subtitle: result.subtitle,
      filters: result.filters,
      summary: result.summary,
      columns: definition.columns,
      rows: result.rows,
      note: result.note,
      truncated:
        result.total > result.rows.length
          ? { cap, total: result.total }
          : undefined,
    },
  }
}
