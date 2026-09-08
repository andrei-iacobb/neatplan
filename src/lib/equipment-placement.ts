import * as z from 'zod'

export const EQUIPMENT_TYPES = [
  'RESIDENT_AID',
  'WHEELCHAIR',
  'PATIENT_LIFT',
  'CLEANING_TROLLEY',
  'CLEANING_EQUIPMENT',
  'OTHER',
] as const

export const equipmentTypeSchema = z.enum(EQUIPMENT_TYPES)
export type EquipmentType = z.infer<typeof equipmentTypeSchema>

export const EQUIPMENT_CATEGORIES = [
  'CLEANING',
  'MOBILITY_AND_LIFTING',
  'RESIDENT_SUPPORT',
  'GENERAL',
] as const

export const equipmentCategorySchema = z.enum(EQUIPMENT_CATEGORIES)
export type EquipmentCategory = z.infer<typeof equipmentCategorySchema>

export type PlacementConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type PlacementCandidate = {
  id: string
  name: string
  description: string | null
}

export type PlacementDraft = {
  name: string
  description?: string | null
  type: EquipmentType
}

export type PlacementSuggestion = {
  suggestedType: EquipmentType
  suggestedTypeLabel: string
  category: EquipmentCategory
  categoryLabel: string
  serviceAreaId: string | null
  serviceAreaName: string | null
  confidence: PlacementConfidence
  reason: string
  requiresReview: boolean
  source: 'RULES' | 'AI'
}

const CATEGORY_BY_TYPE: Record<EquipmentType, EquipmentCategory> = {
  RESIDENT_AID: 'RESIDENT_SUPPORT',
  WHEELCHAIR: 'MOBILITY_AND_LIFTING',
  PATIENT_LIFT: 'MOBILITY_AND_LIFTING',
  CLEANING_TROLLEY: 'CLEANING',
  CLEANING_EQUIPMENT: 'CLEANING',
  OTHER: 'GENERAL',
}

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  CLEANING: 'Cleaning equipment',
  MOBILITY_AND_LIFTING: 'Mobility and lifting',
  RESIDENT_SUPPORT: 'Resident support',
  GENERAL: 'General equipment',
}

const TYPE_LABELS: Record<EquipmentType, string> = {
  RESIDENT_AID: 'Resident Aid',
  WHEELCHAIR: 'Wheelchair',
  PATIENT_LIFT: 'Patient Lift or Hoist',
  CLEANING_TROLLEY: 'Cleaning Trolley',
  CLEANING_EQUIPMENT: 'Cleaning Equipment',
  OTHER: 'Other',
}

const CATEGORY_KEYWORDS: Record<EquipmentCategory, readonly string[]> = {
  CLEANING: ['clean', 'cleaning', 'housekeeping', 'domestic', 'mop', 'trolley', 'supply', 'supplies', 'chemical', 'detergent'],
  MOBILITY_AND_LIFTING: ['wheelchair', 'hoist', 'lift', 'lifting', 'mobility', 'sling', 'transfer', 'walking', 'frame'],
  RESIDENT_SUPPORT: ['resident', 'care', 'aid', 'commode', 'support', 'mobility', 'wheelchair', 'walking'],
  GENERAL: ['equipment', 'store', 'storage', 'general'],
}

const TYPE_KEYWORDS: Record<EquipmentType, readonly string[]> = {
  RESIDENT_AID: ['aid', 'commode', 'walking', 'frame', 'resident'],
  WHEELCHAIR: ['wheelchair', 'mobility'],
  PATIENT_LIFT: ['hoist', 'lift', 'lifting', 'sling'],
  CLEANING_TROLLEY: ['cleaning', 'trolley', 'housekeeping'],
  CLEANING_EQUIPMENT: ['cleaning', 'mop', 'vacuum', 'carpet', 'floor'],
  OTHER: [],
}

export function categoryForEquipmentType(type: EquipmentType): EquipmentCategory {
  return CATEGORY_BY_TYPE[type]
}

export function categoryLabel(category: EquipmentCategory): string {
  return CATEGORY_LABELS[category]
}

export function equipmentTypeLabel(type: EquipmentType): string {
  return TYPE_LABELS[type]
}

function normalizedWords(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase('en-GB')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  )
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const normalizedHaystack = ` ${Array.from(normalizedWords(haystack)).join(' ')} `
  const normalizedKeyword = ` ${Array.from(normalizedWords(keyword)).join(' ')} `
  return normalizedKeyword.trim().length > 0 && normalizedHaystack.includes(normalizedKeyword)
}

export function inferEquipmentType(draft: PlacementDraft): EquipmentType {
  if (draft.type !== 'OTHER') return draft.type

  const text = `${draft.name} ${draft.description ?? ''}`
  if (containsKeyword(text, 'wheelchair')) return 'WHEELCHAIR'
  if (['hoist', 'lift', 'lifting', 'sling'].some((keyword) => containsKeyword(text, keyword))) return 'PATIENT_LIFT'
  if (containsKeyword(text, 'trolley')) return 'CLEANING_TROLLEY'
  if (['cleaning', 'mop', 'vacuum', 'carpet', 'floor'].some((keyword) => containsKeyword(text, keyword))) return 'CLEANING_EQUIPMENT'
  if (['aid', 'commode', 'walking', 'frame', 'resident'].some((keyword) => containsKeyword(text, keyword))) return 'RESIDENT_AID'

  return 'OTHER'
}

function scoreCandidate(draft: PlacementDraft, category: EquipmentCategory, candidate: PlacementCandidate): number {
  const candidateText = `${candidate.name} ${candidate.description ?? ''}`
  let score = 0

  for (const keyword of CATEGORY_KEYWORDS[category]) {
    if (containsKeyword(candidateText, keyword)) score += 2
  }
  for (const keyword of TYPE_KEYWORDS[draft.type]) {
    if (containsKeyword(candidateText, keyword)) score += 3
  }

  const itemWords = normalizedWords(`${draft.name} ${draft.description ?? ''}`)
  const candidateWords = normalizedWords(candidateText)
  for (const word of itemWords) {
    if (word.length >= 4 && candidateWords.has(word)) score += 2
  }

  return score
}

export function suggestPlacementByRules(
  draft: PlacementDraft,
  candidates: PlacementCandidate[],
): PlacementSuggestion {
  const suggestedType = inferEquipmentType(draft)
  const categorizedDraft = { ...draft, type: suggestedType }
  const category = categoryForEquipmentType(suggestedType)
  const base = {
    suggestedType,
    suggestedTypeLabel: equipmentTypeLabel(suggestedType),
    category,
    categoryLabel: categoryLabel(category),
    source: 'RULES' as const,
  }

  if (candidates.length === 0) {
    return {
      ...base,
      serviceAreaId: null,
      serviceAreaName: null,
      confidence: 'LOW',
      reason: 'No service areas are available at this site.',
      requiresReview: true,
    }
  }

  const ranked = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(categorizedDraft, category, candidate) }))
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name))
  const best = ranked[0]
  const runnerUp = ranked[1]
  const margin = best.score - (runnerUp?.score ?? 0)

  if (best.score < 4 || margin < 2) {
    return {
      ...base,
      serviceAreaId: null,
      serviceAreaName: null,
      confidence: 'LOW',
      reason: 'The available service areas do not provide a clear category match.',
      requiresReview: true,
    }
  }

  const confidence: PlacementConfidence = best.score >= 7 && margin >= 3 ? 'HIGH' : 'MEDIUM'
  return {
    ...base,
    serviceAreaId: best.candidate.id,
    serviceAreaName: best.candidate.name,
    confidence,
    reason: `${categoryLabel(category)} best matches ${best.candidate.name}.`,
    requiresReview: confidence !== 'HIGH',
  }
}
