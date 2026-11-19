import type { Character } from '../domain/schema'
import {
  armorValue,
  conditionMonitor,
  droneInitiative,
  essence,
  initiative,
  limit,
  matrixMonitor,
  movement,
  overflow,
  vehicleMonitor,
  woundModifier,
  type Derived,
  type InitMode,
} from './engine'
import { allVehiclePools } from './loadout'
import { allPools, knowledgePool, languagePool } from './pools'

/** Every derived value of a character (used for override labels and the PDF). */
export function allDerived(c: Character): Derived[] {
  const out: Derived[] = [
    limit(c, 'physical'),
    limit(c, 'mental'),
    limit(c, 'social'),
    limit(c, 'astral'),
    essence(c),
    armorValue(c),
    conditionMonitor(c, 'physical'),
    conditionMonitor(c, 'stun'),
    overflow(c),
    woundModifier(c),
    movement(c, 'walk'),
    movement(c, 'run'),
  ]
  const modes: InitMode[] = [
    'physical',
    'astral',
    'matrixAR',
    'matrixCold',
    'matrixHot',
    'riggingAR',
    'riggingCold',
    'riggingHot',
  ]
  for (const m of modes) {
    const i = initiative(c, m)
    out.push(i.score, i.dice)
  }
  out.push(...allPools(c))
  out.push(...c.knowledgeSkills.map((k) => knowledgePool(c, k)))
  for (const l of c.languages) {
    const p = languagePool(c, l)
    if (p) out.push(p)
  }
  for (const d of c.matrix.devices)
    out.push(
      matrixMonitor(c, `device.${d.id}.cm`, d.deviceRating, `${d.name || 'Device'} Matrix Monitor`),
    )
  out.push(matrixMonitor(c, 'rcc.cm', c.rigger.rcc.deviceRating, 'RCC Matrix Monitor'))
  for (const v of c.rigger.vehicles) {
    out.push(vehicleMonitor(c, v))
    out.push(
      matrixMonitor(
        c,
        `vehicle.${v.id}.matrix`,
        v.deviceRating,
        `${v.name || 'Vehicle'} Matrix Monitor`,
      ),
    )
    if (v.kind === 'drone') out.push(droneInitiative(c, v))
  }
  out.push(...allVehiclePools(c))
  return out
}

export type OverrideInfo = { id: string; label: string; value: number; auto: number | null }

export function activeOverrides(c: Character): OverrideInfo[] {
  const ids = Object.keys(c.overrides)
  if (ids.length === 0) return []
  const all = allDerived(c)
  return ids.map((id) => {
    const d = all.find((x) => x.id === id)
    return { id, label: d?.label ?? id, value: c.overrides[id]!, auto: d?.auto ?? null }
  })
}
