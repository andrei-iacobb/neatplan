import { describe, expect, it } from 'vitest'
import { suggestPlacementByRules } from '@/lib/equipment-placement'

const serviceAreas = [
  { id: 'cleaning', name: 'Cleaning Cupboard', description: 'Mops, trolleys and cleaning supplies' },
  { id: 'mobility', name: 'Wheelchair & Hoist Cupboard', description: 'Wheelchairs, slings and mobility equipment' },
]

describe('equipment placement suggestions', () => {
  it('places cleaning equipment in the cleaning cupboard', () => {
    const result = suggestPlacementByRules(
      { name: 'Mop system', type: 'CLEANING_EQUIPMENT' },
      serviceAreas,
    )

    expect(result).toMatchObject({
      suggestedType: 'CLEANING_EQUIPMENT',
      category: 'CLEANING',
      serviceAreaId: 'cleaning',
      confidence: 'HIGH',
      requiresReview: false,
    })
  })

  it('places a patient lift with the hoists', () => {
    const result = suggestPlacementByRules(
      { name: 'Mobile hoist', type: 'PATIENT_LIFT' },
      serviceAreas,
    )

    expect(result).toMatchObject({
      suggestedType: 'PATIENT_LIFT',
      category: 'MOBILITY_AND_LIFTING',
      serviceAreaId: 'mobility',
      confidence: 'HIGH',
    })
  })

  it('classifies an imported wheelchair whose category started unknown', () => {
    const result = suggestPlacementByRules(
      { name: 'Transit wheelchair', type: 'OTHER' },
      serviceAreas,
    )

    expect(result).toMatchObject({
      suggestedType: 'WHEELCHAIR',
      serviceAreaId: 'mobility',
      confidence: 'HIGH',
    })
  })

  it('leaves an ambiguous item unassigned for review', () => {
    const result = suggestPlacementByRules(
      { name: 'Portable device', type: 'OTHER' },
      serviceAreas,
    )

    expect(result).toMatchObject({
      category: 'GENERAL',
      serviceAreaId: null,
      confidence: 'LOW',
      requiresReview: true,
    })
  })

  it('does not force an item into an unrelated sole service area', () => {
    const result = suggestPlacementByRules(
      { name: 'Wheelchair', type: 'WHEELCHAIR' },
      [{ id: 'cleaning', name: 'Cleaning Cupboard', description: null }],
    )

    expect(result.serviceAreaId).toBeNull()
    expect(result.requiresReview).toBe(true)
  })
})
