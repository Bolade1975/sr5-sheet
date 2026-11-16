import { ATTRIBUTE_KEYS, type Character } from '../domain/schema'
import { ATTRIBUTE_LABELS, INIT_MODE_LABELS, type InitMode } from './engine'
import { generalPools } from './pools'

/** Human-readable catalog of modifier targets for the modifier editor. */
export type TargetOption = { key: string; label: string; group: string }

export function targetOptions(c: Character): TargetOption[] {
  const out: TargetOption[] = []
  for (const k of ATTRIBUTE_KEYS)
    out.push({ key: `attr:${k}`, label: `${ATTRIBUTE_LABELS[k]} (attribute)`, group: 'Attributes' })
  for (const l of ['physical', 'mental', 'social', 'astral'] as const)
    out.push({
      key: `limit:${l}`,
      label: `${l[0]!.toUpperCase()}${l.slice(1)} limit`,
      group: 'Limits',
    })
  for (const m of Object.keys(INIT_MODE_LABELS) as InitMode[]) {
    out.push({
      key: `init:${m}`,
      label: `${INIT_MODE_LABELS[m]} Initiative score`,
      group: 'Initiative',
    })
    out.push({
      key: `initDice:${m}`,
      label: `${INIT_MODE_LABELS[m]} Initiative Dice`,
      group: 'Initiative',
    })
  }
  out.push(
    { key: 'cm:physical', label: 'Physical condition monitor boxes', group: 'Condition' },
    { key: 'cm:stun', label: 'Stun condition monitor boxes', group: 'Condition' },
    { key: 'cm:overflow', label: 'Overflow boxes', group: 'Condition' },
    { key: 'armor', label: 'Armor value', group: 'Combat' },
    { key: 'move:walk', label: 'Walk rate', group: 'Movement' },
    { key: 'move:run', label: 'Run rate', group: 'Movement' },
    {
      key: 'allTests',
      label: 'All action tests (not resistance tests)',
      group: 'General',
    },
  )
  for (const p of generalPools(c))
    out.push({
      key: `pool:${p.id.replace(/^pool\./, '')}`,
      label: `${p.label} pool`,
      group: 'General pools',
    })
  for (const s of c.skills) {
    out.push({ key: `skill:${s.id}`, label: `${s.name || 'Skill'} (dice)`, group: 'Skills' })
    out.push({ key: `skillLimit:${s.id}`, label: `${s.name || 'Skill'} (limit)`, group: 'Skills' })
  }
  for (const w of [...c.rangedWeapons, ...c.meleeWeapons]) {
    out.push({
      key: `weapon:${w.id}`,
      label: `${w.name || 'Weapon'} (attack dice)`,
      group: 'Weapons',
    })
    out.push({
      key: `weaponAcc:${w.id}`,
      label: `${w.name || 'Weapon'} (Accuracy)`,
      group: 'Weapons',
    })
  }
  for (const p of c.customPools)
    out.push({
      key: `pool:custom:${p.id}`,
      label: `${p.name || 'Custom pool'}`,
      group: 'Custom pools',
    })
  return out
}

export function targetLabel(c: Character, key: string): string {
  return targetOptions(c).find((t) => t.key === key)?.label ?? key
}
