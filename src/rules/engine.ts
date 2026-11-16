import type { AttributeKey, Character, Modifier } from '../domain/schema'
import { RULES, type RuleRef } from './references'

/**
 * Pure SR5 calculation engine. No UI or storage here.
 *
 * Every derived value is returned as a `Derived` with a full breakdown so the
 * UI and PDF can show *why* a number is what it is: base parts, permanent
 * modifiers, active situational modifiers, wound modifiers, and any manual
 * override. `value === null` means required input is missing (never a fake 0).
 */

export type PartKind = 'base' | 'permanent' | 'situational' | 'wound' | 'rule' | 'override'

export type Part = { label: string; value: number; kind: PartKind }

export type ConditionalNote = { label: string; value: number; condition: string }

export type Derived = {
  id: string
  label: string
  /** Final value (override if active, else auto). */
  value: number | null
  /** Automatic value ignoring any override. */
  auto: number | null
  parts: Part[]
  missing: string[]
  overridden: boolean
  ref: RuleRef | null
  notes: string[]
  conditional: ConditionalNote[]
}

export const PHYSICAL_ATTRS: readonly AttributeKey[] = ['BOD', 'AGI', 'REA', 'STR']
export const MENTAL_ATTRS: readonly AttributeKey[] = ['WIL', 'LOG', 'INT', 'CHA']
export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  BOD: 'Body',
  AGI: 'Agility',
  REA: 'Reaction',
  STR: 'Strength',
  WIL: 'Willpower',
  LOG: 'Logic',
  INT: 'Intuition',
  CHA: 'Charisma',
  EDG: 'Edge',
  MAG: 'Magic',
  RES: 'Resonance',
}

// ---------- modifier collection ----------

export type CollectedMods = { parts: Part[]; conditional: ConditionalNote[] }

/**
 * Collects modifiers aimed at any of `targets`. Each modifier counts once even
 * if it lists several matching targets. Pass the same `used` set for every
 * collection within one pool so a modifier hitting e.g. both a skill and
 * "all tests" is never counted twice.
 */
export function collectMods(
  c: Character,
  targets: readonly string[],
  used?: Set<string>,
): CollectedMods {
  const parts: Part[] = []
  const conditional: ConditionalNote[] = []
  for (const m of c.modifiers) {
    if (!m.targets.some((t) => targets.includes(t))) continue
    if (used) {
      if (used.has(m.id)) continue
      used.add(m.id)
    }
    pushMod(m, parts, conditional)
  }
  return { parts, conditional }
}

function pushMod(m: Modifier, parts: Part[], conditional: ConditionalNote[]): void {
  const label = m.name || 'Unnamed modifier'
  if (m.kind === 'permanent') parts.push({ label, value: m.value, kind: 'permanent' })
  else if (m.kind === 'situational') {
    if (m.active) parts.push({ label, value: m.value, kind: 'situational' })
  } else conditional.push({ label, value: m.value, condition: m.condition })
}

const sum = (parts: readonly Part[]): number => parts.reduce((a, p) => a + p.value, 0)

function finish(
  c: Character,
  id: string,
  label: string,
  parts: Part[],
  missing: string[],
  ref: RuleRef | null,
  notes: string[] = [],
  conditional: ConditionalNote[] = [],
  compute: (partsTotal: number) => number = (t) => t,
): Derived {
  const auto = missing.length > 0 ? null : compute(sum(parts))
  const ov = c.overrides[id]
  const overridden = ov !== undefined
  return {
    id,
    label,
    value: overridden ? ov : auto,
    auto,
    parts,
    missing,
    overridden,
    ref,
    notes,
    conditional,
  }
}

// ---------- attributes ----------

export type AttributeResult = {
  key: AttributeKey
  base: number | null
  /** Sum of permanent augmentation bonuses (after the +4 cap where it applies). */
  augmentation: number
  situational: number
  encumbrance: number
  /** Current value used in all derived pools. */
  current: number | null
  capped: boolean
  parts: Part[]
  conditional: ConditionalNote[]
}

const AUG_CAP = 4

export function attribute(c: Character, key: AttributeKey): AttributeResult {
  const base = c.attributes[key].base
  const { parts, conditional } = collectMods(c, [`attr:${key}`])
  const perm = sum(parts.filter((p) => p.kind === 'permanent'))
  const sit = sum(parts.filter((p) => p.kind === 'situational'))
  const capApplies = PHYSICAL_ATTRS.includes(key) || MENTAL_ATTRS.includes(key)
  let augmentation = perm
  let situational = sit
  let capped = false
  if (capApplies && perm + sit > AUG_CAP) {
    capped = true
    // Keep permanent first, situational fills what's left of the cap.
    augmentation = Math.min(perm, AUG_CAP)
    situational = Math.max(0, AUG_CAP - augmentation)
  }
  const encumbrance = key === 'AGI' || key === 'REA' ? -armorEncumbrance(c) : 0
  const current = base === null ? null : base + augmentation + situational + encumbrance
  const allParts: Part[] = [
    ...(base === null ? [] : [{ label: 'Base', value: base, kind: 'base' as const }]),
    ...parts,
  ]
  if (capped)
    allParts.push({
      label: 'Augmentation cap +4 (p. 94)',
      value: augmentation + situational - (perm + sit),
      kind: 'rule',
    })
  if (encumbrance !== 0)
    allParts.push({ label: 'Armor encumbrance (p. 169)', value: encumbrance, kind: 'rule' })
  return {
    key,
    base,
    augmentation,
    situational,
    encumbrance,
    current,
    capped,
    parts: allParts,
    conditional,
  }
}

/** Current value or null; helper for formulas. */
function attr(c: Character, key: AttributeKey): number | null {
  return attribute(c, key).current
}

function attrPart(
  c: Character,
  key: AttributeKey,
  parts: Part[],
  missing: string[],
  multiplier = 1,
): number {
  const v = attr(c, key)
  if (v === null) {
    missing.push(ATTRIBUTE_LABELS[key])
    return 0
  }
  parts.push({
    label: multiplier === 1 ? ATTRIBUTE_LABELS[key] : `${ATTRIBUTE_LABELS[key]} ×${multiplier}`,
    value: v * multiplier,
    kind: 'base',
  })
  return v * multiplier
}

// ---------- essence ----------

export function essence(c: Character): Derived {
  const parts: Part[] = [{ label: 'Starting Essence', value: 6, kind: 'base' }]
  const missing: string[] = []
  for (const a of c.augmentations) {
    if (a.essence === null) missing.push(`Essence cost of ${a.name || 'augmentation'}`)
    else if (a.essence !== 0)
      parts.push({ label: a.name || 'Augmentation', value: -a.essence, kind: 'permanent' })
  }
  if (c.essenceAdjustment !== 0)
    parts.push({
      label: 'Other Essence loss/adjustment',
      value: c.essenceAdjustment,
      kind: 'permanent',
    })
  // Round to 2 decimals to avoid float noise like 5.699999.
  return finish(
    c,
    'essence',
    'Essence',
    parts,
    missing,
    RULES.essence,
    [],
    [],
    (t) => Math.round(t * 100) / 100,
  )
}

// ---------- armor ----------

export function armorBreakdown(c: Character): {
  best: number | null
  bestName: string
  accessories: number
  accessoryCounted: number
  excess: number
} {
  let best: number | null = null
  let bestName = ''
  let accessories = 0
  for (const a of c.armor) {
    if (!a.equipped || a.rating === null) continue
    if (a.accessory) accessories += a.rating
    else if (best === null || a.rating > best) {
      best = a.rating
      bestName = a.name
    }
  }
  const str = strengthForArmor(c)
  const accessoryCounted = str === null ? accessories : Math.min(accessories, str)
  const excess = str === null ? 0 : Math.max(0, accessories - str)
  return { best, bestName, accessories, accessoryCounted, excess }
}

function strengthForArmor(c: Character): number | null {
  // STR is never affected by encumbrance, so no recursion.
  const base = c.attributes.STR.base
  if (base === null) return null
  const { parts } = collectMods(c, ['attr:STR'])
  const bonus = sum(parts)
  return base + Math.min(bonus, AUG_CAP)
}

/** −1 Agility and Reaction per 2 full points of accessory bonus above Strength (p. 169). */
export function armorEncumbrance(c: Character): number {
  return Math.floor(armorBreakdown(c).excess / 2)
}

export function armorValue(c: Character): Derived {
  const b = armorBreakdown(c)
  const parts: Part[] = []
  if (b.best !== null) parts.push({ label: b.bestName || 'Armor', value: b.best, kind: 'base' })
  if (b.accessories > 0)
    parts.push({ label: 'Armor accessories (+)', value: b.accessories, kind: 'base' })
  if (b.accessoryCounted < b.accessories)
    parts.push({
      label: 'Accessory bonus limited to Strength',
      value: b.accessoryCounted - b.accessories,
      kind: 'rule',
    })
  const mods = collectMods(c, ['armor'])
  parts.push(...mods.parts)
  const notes: string[] = []
  if (b.excess > 0)
    notes.push(
      `Accessories exceed Strength by ${b.excess}: −${Math.floor(b.excess / 2)} Agility and Reaction.`,
    )
  return finish(c, 'armor', 'Armor', parts, [], RULES.armorStacking, notes, mods.conditional)
}

// ---------- limits ----------

export type LimitKey = 'physical' | 'mental' | 'social' | 'astral'

export function limit(c: Character, key: LimitKey): Derived {
  const parts: Part[] = []
  const missing: string[] = []
  let ref: RuleRef
  let label: string
  if (key === 'physical') {
    label = 'Physical Limit'
    ref = RULES.limitPhysical
    attrPart(c, 'STR', parts, missing, 2)
    attrPart(c, 'BOD', parts, missing)
    attrPart(c, 'REA', parts, missing)
  } else if (key === 'mental') {
    label = 'Mental Limit'
    ref = RULES.limitMental
    attrPart(c, 'LOG', parts, missing, 2)
    attrPart(c, 'INT', parts, missing)
    attrPart(c, 'WIL', parts, missing)
  } else if (key === 'social') {
    label = 'Social Limit'
    ref = RULES.limitSocial
    attrPart(c, 'CHA', parts, missing, 2)
    attrPart(c, 'WIL', parts, missing)
    const ess = essence(c).value
    if (ess === null) missing.push('Essence')
    else parts.push({ label: 'Essence (rounded up)', value: Math.ceil(ess), kind: 'base' })
  } else {
    const m = limit(c, 'mental')
    const s = limit(c, 'social')
    const mods = collectMods(c, ['limit:astral'])
    const miss = [...m.missing, ...s.missing]
    const higher = (m.value ?? 0) >= (s.value ?? 0) ? m : s
    const astralParts: Part[] = [
      {
        label: `${higher.label} (higher of Mental/Social)`,
        value: higher.value ?? 0,
        kind: 'base',
      },
      ...mods.parts,
    ]
    return finish(
      c,
      'limit.astral',
      'Astral Limit',
      astralParts,
      miss.length ? ['Mental/Social limit'] : [],
      RULES.limitAstral,
      [],
      mods.conditional,
    )
  }
  // Formula: ceil(sum/3); modifiers are added after the division.
  const formulaTotal = sum(parts)
  const mods = collectMods(c, [`limit:${key}`])
  const auto = missing.length ? null : Math.ceil(formulaTotal / 3)
  const shown: Part[] = [
    { label: `⌈(${parts.map((p) => p.label).join(' + ')}) / 3⌉`, value: auto ?? 0, kind: 'base' },
    ...mods.parts,
  ]
  return finish(c, `limit.${key}`, label, shown, missing, ref, [], mods.conditional)
}

// ---------- condition monitors & wounds ----------

export function conditionMonitor(c: Character, track: 'physical' | 'stun'): Derived {
  const key: AttributeKey = track === 'physical' ? 'BOD' : 'WIL'
  const missing: string[] = []
  const v = attr(c, key)
  if (v === null) missing.push(ATTRIBUTE_LABELS[key])
  const mods = collectMods(c, [`cm:${track}`])
  const parts: Part[] = [
    { label: 'Base boxes', value: 8, kind: 'base' },
    {
      label: `⌈${ATTRIBUTE_LABELS[key]} / 2⌉`,
      value: v === null ? 0 : Math.ceil(v / 2),
      kind: 'base',
    },
    ...mods.parts,
  ]
  return finish(
    c,
    `cm.${track}`,
    track === 'physical' ? 'Physical Track' : 'Stun Track',
    parts,
    missing,
    RULES.conditionMonitor,
    [],
    mods.conditional,
  )
}

export function overflow(c: Character): Derived {
  const missing: string[] = []
  const parts: Part[] = []
  attrPart(c, 'BOD', parts, missing)
  const mods = collectMods(c, ['cm:overflow'])
  parts.push(...mods.parts)
  return finish(c, 'cm.overflow', 'Overflow', parts, missing, RULES.overflow, [], mods.conditional)
}

/** Total wound modifier (≤ 0) from current damage on both tracks. */
export function woundModifier(c: Character): Derived {
  const phys = Math.floor(Math.max(0, c.play.physicalDamage) / 3)
  const stun = Math.floor(Math.max(0, c.play.stunDamage) / 3)
  const parts: Part[] = []
  if (phys)
    parts.push({ label: `Physical damage ${c.play.physicalDamage}`, value: -phys, kind: 'wound' })
  if (stun) parts.push({ label: `Stun damage ${c.play.stunDamage}`, value: -stun, kind: 'wound' })
  return finish(c, 'wound', 'Wound Modifier', parts, [], RULES.woundModifiers)
}

// ---------- initiative ----------

export type InitMode =
  | 'physical'
  | 'astral'
  | 'matrixAR'
  | 'matrixCold'
  | 'matrixHot'
  | 'riggingAR'
  | 'riggingCold'
  | 'riggingHot'

export const INIT_MODE_LABELS: Record<InitMode, string> = {
  physical: 'Physical',
  astral: 'Astral',
  matrixAR: 'Matrix AR',
  matrixCold: 'Matrix VR (cold-sim)',
  matrixHot: 'Matrix VR (hot-sim)',
  riggingAR: 'Rigging AR',
  riggingCold: 'Rigging VR (cold-sim)',
  riggingHot: 'Rigging VR (hot-sim)',
}

export type InitiativeResult = { mode: InitMode; score: Derived; dice: Derived }

const BASE_DICE: Record<InitMode, number> = {
  physical: 1,
  astral: 2,
  matrixAR: 1,
  matrixCold: 3,
  matrixHot: 4,
  riggingAR: 1,
  riggingCold: 3,
  riggingHot: 4,
}

/** Data Processing used for Matrix VR initiative: active deck/commlink, else technomancer Logic. */
export function matrixDataProcessing(c: Character): { value: number | null; label: string } {
  const dev = c.modules.decker ? c.matrix.devices.find((d) => d.active) : undefined
  if (dev) return { value: dev.dataProcessing, label: `Data Processing (${dev.name || 'device'})` }
  if (c.modules.technomancer)
    return { value: attr(c, 'LOG'), label: 'Data Processing (Living Persona = Logic)' }
  return { value: null, label: 'Data Processing (no active device)' }
}

export function initiative(c: Character, mode: InitMode): InitiativeResult {
  const parts: Part[] = []
  const missing: string[] = []
  const notes: string[] = []
  let ref: RuleRef = RULES.initiativeTable
  switch (mode) {
    case 'physical':
    case 'matrixAR':
    case 'riggingAR':
      attrPart(c, 'REA', parts, missing)
      attrPart(c, 'INT', parts, missing)
      if (mode === 'riggingAR') ref = RULES.riggingInitiative
      if (mode === 'matrixAR' && c.modules.technomancer && !c.modules.decker)
        notes.push(
          'Technomancers use their Mental and Matrix attributes for Initiative (p. 251); the exact AR formula is not spelled out — confirm with your GM and override if needed.',
        )
      break
    case 'astral':
      attrPart(c, 'INT', parts, missing, 2)
      break
    case 'matrixCold':
    case 'matrixHot': {
      const dp = matrixDataProcessing(c)
      if (dp.value === null) missing.push('Data Processing')
      else parts.push({ label: dp.label, value: dp.value, kind: 'base' })
      attrPart(c, 'INT', parts, missing)
      ref = RULES.matrixInitiative
      if (mode === 'matrixCold' && c.modules.technomancer && !c.modules.decker)
        notes.push('Technomancers can only use AR and hot-sim VR without a device (p. 251).')
      break
    }
    case 'riggingCold':
    case 'riggingHot': {
      const dp = c.rigger.rcc.dataProcessing
      if (dp === null) missing.push('RCC Data Processing')
      else parts.push({ label: 'RCC Data Processing', value: dp, kind: 'base' })
      attrPart(c, 'INT', parts, missing)
      ref = RULES.riggingInitiative
      break
    }
  }
  const mods = collectMods(c, [`init:${mode}`])
  parts.push(...mods.parts)
  const wound = woundModifier(c).value ?? 0
  if (wound !== 0) parts.push({ label: 'Wound modifier', value: wound, kind: 'wound' })
  const score = finish(
    c,
    `init.${mode}`,
    `${INIT_MODE_LABELS[mode]} Initiative`,
    parts,
    missing,
    ref,
    notes,
    mods.conditional,
  )

  const diceMods = collectMods(c, [`initDice:${mode}`])
  const diceParts: Part[] = [
    { label: 'Base Initiative Dice', value: BASE_DICE[mode], kind: 'base' },
    ...diceMods.parts,
  ]
  const dice = finish(
    c,
    `initDice.${mode}`,
    `${INIT_MODE_LABELS[mode]} Initiative Dice`,
    diceParts,
    [],
    ref,
    [],
    diceMods.conditional,
  )
  return { mode, score, dice }
}

/** Initiative modes relevant for the active modules. */
export function relevantInitModes(c: Character): InitMode[] {
  const modes: InitMode[] = ['physical']
  if (c.modules.magic) modes.push('astral')
  if (c.modules.decker || c.modules.technomancer) {
    modes.push('matrixAR')
    if (c.modules.decker) modes.push('matrixCold')
    modes.push('matrixHot')
  }
  if (c.modules.rigger) modes.push('riggingAR', 'riggingCold', 'riggingHot')
  return modes
}

// ---------- movement & edge ----------

export function movement(c: Character, kind: 'walk' | 'run'): Derived {
  const parts: Part[] = []
  const missing: string[] = []
  attrPart(c, 'AGI', parts, missing, kind === 'walk' ? 2 : 4)
  const mods = collectMods(c, [`move:${kind}`])
  parts.push(...mods.parts)
  return finish(
    c,
    `move.${kind}`,
    kind === 'walk' ? 'Walk (m/turn)' : 'Run (m/turn)',
    parts,
    missing,
    RULES.movement,
    [],
    mods.conditional,
  )
}

export function edge(c: Character): { total: number | null; remaining: number | null } {
  const total = attr(c, 'EDG')
  return { total, remaining: total === null ? null : Math.max(0, total - c.play.edgeSpent) }
}

// ---------- Matrix / vehicle condition monitors ----------

/** 8 + DR/2; odd Device Rating returns null (rounding not stated, p. 228). */
export function matrixMonitor(
  c: Character,
  id: string,
  deviceRating: number | null,
  label: string,
): Derived {
  const missing: string[] = []
  const notes: string[] = []
  const parts: Part[] = [{ label: 'Base boxes', value: 8, kind: 'base' }]
  if (deviceRating === null) missing.push('Device Rating')
  else if (deviceRating % 2 !== 0) {
    missing.push('Manual value (odd Device Rating; rounding not stated in core rules)')
    notes.push('Set an override with the value your table uses.')
  } else parts.push({ label: 'Device Rating / 2', value: deviceRating / 2, kind: 'base' })
  return finish(c, id, label, parts, missing, RULES.matrixCondition, notes)
}

export function vehicleMonitor(c: Character, v: Character['rigger']['vehicles'][number]): Derived {
  const missing: string[] = []
  const parts: Part[] = []
  if (v.body === null) missing.push('Body')
  else if (v.kind === 'vehicle') {
    parts.push(
      { label: 'Base boxes', value: 12, kind: 'base' },
      { label: '⌈Body / 2⌉', value: Math.ceil(v.body / 2), kind: 'base' },
    )
  } else if (v.body % 2 !== 0) {
    missing.push('Manual value (odd drone Body; rounding not stated in core rules)')
  } else {
    parts.push(
      { label: 'Base boxes', value: 6, kind: 'base' },
      { label: 'Body / 2', value: v.body / 2, kind: 'base' },
    )
  }
  return finish(
    c,
    `vehicle.${v.id}.cm`,
    `${v.name || 'Vehicle'} Condition Monitor`,
    parts,
    missing,
    RULES.vehicleCondition,
  )
}

export function droneInitiative(c: Character, v: Character['rigger']['vehicles'][number]): Derived {
  const missing: string[] = []
  const parts: Part[] = []
  if (v.pilot === null) missing.push('Pilot')
  else parts.push({ label: 'Pilot ×2', value: v.pilot * 2, kind: 'base' })
  return finish(
    c,
    `vehicle.${v.id}.init`,
    'Autonomous Initiative (+4D6)',
    parts,
    missing,
    RULES.droneInitiative,
  )
}

export { finish as finishDerived, sum as sumParts }
