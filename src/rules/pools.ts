import type {
  AttributeKey,
  Character,
  CustomPool,
  KnowledgeSkill,
  Language,
  MeleeWeapon,
  RangedWeapon,
  Skill,
} from '../domain/schema'
import {
  ATTRIBUTE_LABELS,
  armorValue,
  attribute,
  collectMods,
  finishDerived,
  limit,
  matrixDataProcessing,
  woundModifier,
  type ConditionalNote,
  type Derived,
  type LimitKey,
  type Part,
} from './engine'
import { RULES, type RuleRef } from './references'
import { catalogByKey } from './skillCatalog'

/**
 * Dice pools. A pool = Derived total + limit + specialization info.
 * Wound modifiers and the situational "all action tests" modifiers are only
 * applied to pools that are not damage/drain/fading resistance (p. 169–170).
 */
export type PoolLimit = { label: string; value: number | null } | null

export type Pool = Derived & {
  limit: PoolLimit
  /** e.g. "Spec. (Semi-Automatics) +2" — shown separately, never in the total. */
  specializations: string[]
  conditions: string
  group:
    | 'defense'
    | 'resistance'
    | 'attribute'
    | 'skill'
    | 'weapon'
    | 'magic'
    | 'matrix'
    | 'rigger'
    | 'custom'
}

type PartSpec =
  | { kind: 'attr'; key: AttributeKey; mult?: number }
  | { kind: 'skillCatalog'; key: string }
  | { kind: 'armor' }
  | { kind: 'value'; label: string; value: number | null; missingLabel: string }

type PoolSpec = {
  id: string
  label: string
  group: Pool['group']
  parts: PartSpec[]
  limit: LimitKey | null
  /** false for tests that resist damage/drain/fading. */
  actionTest: boolean
  ref: RuleRef
  conditions?: string
}

// ---------- skills ----------

export function findSkillByCatalog(c: Character, key: string): Skill | undefined {
  return c.skills.find((s) => s.catalogKey === key)
}

export function skillRating(c: Character, s: Skill): number | null {
  if (s.groupId) {
    const g = c.skillGroups.find((x) => x.id === s.groupId)
    if (g) return g.rating
  }
  return s.rating
}

type LimitSel = LimitKey | 'gear' | 'none'

function autoLimitForSkill(s: Skill): LimitSel {
  if (s.limit !== 'auto') return s.limit
  if (s.catalogKey === 'unarmed-combat') return 'physical' // p. 168
  // Assensing + Intuition [Astral] p. 312; Astral Combat + Willpower [Astral] p. 315.
  if (s.catalogKey === 'assensing' || s.catalogKey === 'astral-combat') return 'astral'
  if (
    s.category === 'combat' ||
    s.category === 'vehicle' ||
    s.category === 'magical' ||
    s.category === 'resonance'
  ) {
    if (s.attribute === 'INT' || s.attribute === 'LOG' || s.attribute === 'WIL') return 'mental'
    return 'gear'
  }
  if (
    ['computer', 'cybercombat', 'electronic-warfare', 'hacking', 'software'].includes(
      s.catalogKey ?? '',
    )
  )
    return 'gear'
  if (s.attribute === 'CHA') return 'social'
  if (['BOD', 'AGI', 'REA', 'STR'].includes(s.attribute)) return 'physical'
  if (s.attribute === 'MAG' || s.attribute === 'RES') return 'gear'
  return 'mental'
}

function gearLimitLabel(s: Skill): string {
  if (s.category === 'combat') return 'Weapon Accuracy'
  if (s.category === 'vehicle') return 'Handling / Sensor'
  if (s.category === 'magical') return 'Force'
  if (s.category === 'resonance') return 'Level'
  if (s.category === 'technical') return 'Matrix attribute'
  return 'Per test'
}

function resolveLimit(c: Character, key: LimitSel, s?: Skill): PoolLimit {
  if (key === 'none') return null
  if (key === 'gear') return { label: s ? gearLimitLabel(s) : 'Gear', value: null }
  const l = limit(c, key)
  return { label: l.label.replace(' Limit', ''), value: l.value }
}

function woundAndGlobal(
  c: Character,
  parts: Part[],
  conditional: ConditionalNote[],
  used: Set<string>,
): void {
  const w = woundModifier(c).value ?? 0
  if (w !== 0) parts.push({ label: 'Wound modifier', value: w, kind: 'wound' })
  const g = collectMods(c, ['allTests'], used)
  parts.push(...g.parts)
  conditional.push(...g.conditional)
}

/** Dice pool for one active skill, including defaulting. */
export function skillPool(c: Character, s: Skill, extraTargets: string[] = []): Pool {
  const parts: Part[] = []
  const missing: string[] = []
  const notes: string[] = []
  const conditional: ConditionalNote[] = []
  const rating = skillRating(c, s)
  const a = attribute(c, s.attribute)
  const label = s.name || 'Unnamed skill'
  const rated = rating !== null && rating > 0
  if (rating === null) missing.push('Skill rating')
  if (a.current === null) missing.push(ATTRIBUTE_LABELS[s.attribute])

  if (rated) {
    parts.push({ label: s.groupId ? `${label} (group)` : label, value: rating, kind: 'base' })
  } else if (rating === 0) {
    if (s.defaultable === false) missing.push('Cannot default (untrained)')
    else if (s.defaultable === null) {
      missing.push('Defaulting not verified for this skill')
    } else {
      parts.push({ label: 'Defaulting (p. 130)', value: -1, kind: 'rule' })
      notes.push('Untrained: attribute only, −1 die.')
    }
  }
  parts.push({ label: ATTRIBUTE_LABELS[s.attribute], value: a.current ?? 0, kind: 'base' })
  const used = new Set<string>()
  const mods = collectMods(c, [`skill:${s.id}`, ...extraTargets], used)
  parts.push(...mods.parts)
  conditional.push(...mods.conditional)
  woundAndGlobal(c, parts, conditional, used)
  const d = finishDerived(
    c,
    `skill.${s.id}`,
    label,
    parts,
    missing,
    rated ? RULES.skillList : RULES.defaulting,
    notes,
    conditional,
  )
  const lim = resolveLimit(c, autoLimitForSkill(s), s)
  const lmods = collectMods(c, [`skillLimit:${s.id}`])
  const limitVal =
    lim && lim.value !== null
      ? lim.value + lmods.parts.reduce((x, p) => x + p.value, 0)
      : (lim?.value ?? null)
  return {
    ...d,
    limit: lim ? { label: lim.label, value: limitVal } : null,
    specializations: rated ? s.specializations.filter(Boolean).map((sp) => `${sp} +2`) : [],
    conditions: '',
    group: 'skill',
  }
}

// ---------- built-in general pools ----------

function buildSpecPool(c: Character, spec: PoolSpec): Pool {
  const parts: Part[] = []
  const missing: string[] = []
  const notes: string[] = []
  const conditional: ConditionalNote[] = []
  const used = new Set<string>()
  let anySkill = false
  for (const p of spec.parts) {
    if (p.kind === 'attr') {
      const v = attribute(c, p.key).current
      const mult = p.mult ?? 1
      if (v === null) missing.push(ATTRIBUTE_LABELS[p.key])
      parts.push({
        label: mult === 1 ? ATTRIBUTE_LABELS[p.key] : `${ATTRIBUTE_LABELS[p.key]} ×${mult}`,
        value: (v ?? 0) * mult,
        kind: 'base',
      })
    } else if (p.kind === 'skillCatalog') {
      anySkill = true
      const sk = findSkillByCatalog(c, p.key)
      const name = catalogByKey(p.key)?.name ?? p.key
      const r = sk ? skillRating(c, sk) : 0
      if (sk && r === null) missing.push(`${name} rating`)
      parts.push({ label: sk ? name : `${name} (not learned)`, value: r ?? 0, kind: 'base' })
      if (sk) {
        const sm = collectMods(c, [`skill:${sk.id}`], used)
        parts.push(...sm.parts)
        conditional.push(...sm.conditional)
      }
    } else if (p.kind === 'armor') {
      const a = armorValue(c)
      parts.push({ label: 'Armor', value: a.value ?? 0, kind: 'base' })
      if (a.overridden) notes.push('Armor value is manually overridden.')
    } else {
      if (p.value === null) missing.push(p.missingLabel)
      parts.push({ label: p.label, value: p.value ?? 0, kind: 'base' })
    }
  }
  const mods = collectMods(c, [`pool:${spec.id}`], used)
  parts.push(...mods.parts)
  conditional.push(...mods.conditional)
  if (spec.actionTest) woundAndGlobal(c, parts, conditional, used)
  else notes.push('Wound modifiers do not apply (resistance test).')
  const d = finishDerived(
    c,
    `pool.${spec.id}`,
    spec.label,
    parts,
    missing,
    spec.ref,
    notes,
    conditional,
  )
  // Limits only apply to tests with a skill (p. 47).
  const lim = spec.limit && anySkill ? resolveLimit(c, spec.limit) : null
  return {
    ...d,
    limit: lim,
    specializations: [],
    conditions: spec.conditions ?? '',
    group: spec.group,
  }
}

function generalSpecs(c: Character): PoolSpec[] {
  const specs: PoolSpec[] = [
    {
      id: 'defense',
      label: 'Defense',
      group: 'defense',
      parts: [
        { kind: 'attr', key: 'REA' },
        { kind: 'attr', key: 'INT' },
      ],
      limit: null,
      actionTest: true,
      ref: RULES.defense,
    },
    {
      id: 'fullDefense',
      label: 'Full Defense',
      group: 'defense',
      parts: [
        { kind: 'attr', key: 'REA' },
        { kind: 'attr', key: 'INT' },
        { kind: 'attr', key: 'WIL' },
      ],
      limit: null,
      actionTest: true,
      ref: RULES.fullDefense,
      conditions: 'Interrupt: −10 Initiative Score, lasts the Combat Turn.',
    },
    {
      id: 'dodge',
      label: 'Dodge (melee)',
      group: 'defense',
      parts: [
        { kind: 'attr', key: 'REA' },
        { kind: 'attr', key: 'INT' },
        { kind: 'skillCatalog', key: 'gymnastics' },
      ],
      limit: 'physical',
      actionTest: true,
      ref: RULES.dodge,
      conditions: 'Interrupt: −5 Initiative Score, one Defense test.',
    },
    {
      id: 'block',
      label: 'Block (melee)',
      group: 'defense',
      parts: [
        { kind: 'attr', key: 'REA' },
        { kind: 'attr', key: 'INT' },
        { kind: 'skillCatalog', key: 'unarmed-combat' },
      ],
      limit: 'physical',
      actionTest: true,
      ref: RULES.block,
      conditions: 'Interrupt: −5 Initiative Score, one Defense test.',
    },
    {
      id: 'fullDefenseDodge',
      label: 'Full Defense + Dodge',
      group: 'defense',
      parts: [
        { kind: 'attr', key: 'REA' },
        { kind: 'attr', key: 'INT' },
        { kind: 'attr', key: 'WIL' },
        { kind: 'skillCatalog', key: 'gymnastics' },
      ],
      limit: 'physical',
      actionTest: true,
      ref: RULES.fullDefense,
      conditions: 'Full Defense active plus Dodge interrupt (cumulative, p. 168).',
    },
    {
      id: 'fullDefenseBlock',
      label: 'Full Defense + Block',
      group: 'defense',
      parts: [
        { kind: 'attr', key: 'REA' },
        { kind: 'attr', key: 'INT' },
        { kind: 'attr', key: 'WIL' },
        { kind: 'skillCatalog', key: 'unarmed-combat' },
      ],
      limit: 'physical',
      actionTest: true,
      ref: RULES.block,
      conditions: 'Full Defense active plus Block interrupt (example p. 191).',
    },
    {
      id: 'damageResistance',
      label: 'Damage Resistance',
      group: 'resistance',
      parts: [{ kind: 'attr', key: 'BOD' }, { kind: 'armor' }],
      limit: null,
      actionTest: false,
      ref: RULES.damageResistance,
      conditions: 'Armor is modified by the attack’s AP.',
    },
    {
      id: 'fatigueResistance',
      label: 'Fatigue Resistance',
      group: 'resistance',
      parts: [
        { kind: 'attr', key: 'BOD' },
        { kind: 'attr', key: 'WIL' },
      ],
      limit: null,
      actionTest: false,
      ref: RULES.fatigue,
      conditions: 'No armor.',
    },
    {
      id: 'composure',
      label: 'Composure',
      group: 'attribute',
      parts: [
        { kind: 'attr', key: 'CHA' },
        { kind: 'attr', key: 'WIL' },
      ],
      limit: null,
      actionTest: true,
      ref: RULES.composure,
    },
    {
      id: 'judgeIntentions',
      label: 'Judge Intentions',
      group: 'attribute',
      parts: [
        { kind: 'attr', key: 'CHA' },
        { kind: 'attr', key: 'INT' },
      ],
      limit: null,
      actionTest: true,
      ref: RULES.judgeIntentions,
    },
    {
      id: 'memory',
      label: 'Memory',
      group: 'attribute',
      parts: [
        { kind: 'attr', key: 'LOG' },
        { kind: 'attr', key: 'WIL' },
      ],
      limit: null,
      actionTest: true,
      ref: RULES.memory,
    },
    {
      id: 'liftCarry',
      label: 'Lift/Carry',
      group: 'attribute',
      parts: [
        { kind: 'attr', key: 'BOD' },
        { kind: 'attr', key: 'STR' },
      ],
      limit: null,
      actionTest: true,
      ref: RULES.liftCarry,
    },
  ]
  if (c.modules.magic && c.magic.awakenedType !== 'adept') {
    const da = c.magic.drainAttribute
    specs.push({
      id: 'drain',
      label: 'Drain Resistance',
      group: 'magic',
      parts: da
        ? [
            { kind: 'attr', key: 'WIL' },
            { kind: 'attr', key: da },
          ]
        : [
            { kind: 'attr', key: 'WIL' },
            {
              kind: 'value',
              label: 'Tradition attribute',
              value: null,
              missingLabel: 'Drain attribute (set tradition)',
            },
          ],
      limit: null,
      actionTest: false,
      ref: RULES.drain,
    })
  }
  if (c.modules.technomancer) {
    specs.push({
      id: 'fading',
      label: 'Fading Resistance',
      group: 'matrix',
      parts: [
        { kind: 'attr', key: 'RES' },
        { kind: 'attr', key: 'WIL' },
      ],
      limit: null,
      actionTest: false,
      ref: RULES.fading,
    })
  }
  if (c.modules.decker) {
    const dev = c.matrix.devices.find((d) => d.active)
    specs.push({
      id: 'matrixDamageResist',
      label: 'Matrix Damage Resistance',
      group: 'matrix',
      parts: [
        {
          kind: 'value',
          label: 'Device Rating',
          value: dev ? dev.deviceRating : null,
          missingLabel: 'Active device Device Rating',
        },
        {
          kind: 'value',
          label: 'Firewall',
          value: dev ? dev.firewall : null,
          missingLabel: 'Active device Firewall',
        },
      ],
      limit: null,
      actionTest: false,
      ref: RULES.matrixResist,
    })
  }
  if (c.modules.decker || c.modules.technomancer || c.modules.rigger) {
    const dev = c.modules.decker ? c.matrix.devices.find((d) => d.active) : undefined
    const fw = dev
      ? dev.firewall
      : c.modules.technomancer
        ? attribute(c, 'WIL').current
        : c.rigger.rcc.firewall
    const fwLabel = dev
      ? 'Firewall (active device)'
      : c.modules.technomancer
        ? 'Firewall (Living Persona = WIL)'
        : 'Firewall (RCC)'
    specs.push({
      id: 'biofeedback',
      label: 'Biofeedback Resistance',
      group: 'matrix',
      parts: [
        { kind: 'attr', key: 'WIL' },
        { kind: 'value', label: fwLabel, value: fw, missingLabel: 'Firewall' },
      ],
      limit: null,
      actionTest: false,
      ref: RULES.biofeedback,
      conditions: 'Only in VR. Stun in cold-sim, Physical in hot-sim.',
    })
  }
  if (c.modules.rigger) {
    specs.push({
      id: 'rccDamageResist',
      label: 'RCC Matrix Damage Resistance',
      group: 'rigger',
      parts: [
        {
          kind: 'value',
          label: 'RCC Device Rating',
          value: c.rigger.rcc.deviceRating,
          missingLabel: 'RCC Device Rating',
        },
        {
          kind: 'value',
          label: 'RCC Firewall',
          value: c.rigger.rcc.firewall,
          missingLabel: 'RCC Firewall',
        },
      ],
      limit: null,
      actionTest: false,
      ref: RULES.matrixResist,
    })
  }
  return specs
}

export function generalPools(c: Character): Pool[] {
  const pools = generalSpecs(c).map((s) => buildSpecPool(c, s))
  // Perception and Sneaking come from the skill list (or default from attribute).
  for (const key of ['perception', 'sneaking']) {
    const sk = findSkillByCatalog(c, key)
    const cat = catalogByKey(key)
    if (!cat) continue
    const skill: Skill = sk ?? {
      id: `__${key}`,
      name: cat.name,
      catalogKey: key,
      attribute: cat.attribute,
      rating: 0,
      groupId: null,
      category: cat.category,
      specializations: [],
      defaultable: cat.defaultable,
      limit: 'auto',
      favorite: false,
      source: '',
      notes: '',
    }
    const p = skillPool(c, skill, [`pool:${key}`])
    pools.push({
      ...p,
      id: `pool.${key}`,
      group: 'attribute',
      label: sk ? cat.name : `${cat.name} (untrained)`,
    })
  }
  return pools
}

// ---------- knowledge & language ----------

/** Knowledge/language linked attributes (Active Skill List, p. 151). */
export const KNOWLEDGE_ATTRIBUTE = {
  street: 'INT',
  interests: 'INT',
  academic: 'LOG',
  professional: 'LOG',
} as const

export function knowledgePool(c: Character, k: KnowledgeSkill): Pool {
  const key = KNOWLEDGE_ATTRIBUTE[k.type]
  return valuePool(c, `know.${k.id}`, k.name || 'Knowledge', k.rating, key, k.specializations)
}

export function languagePool(c: Character, l: Language): Pool | null {
  if (l.native) return null
  return valuePool(c, `lang.${l.id}`, l.name || 'Language', l.rating, 'INT', l.specializations)
}

function valuePool(
  c: Character,
  id: string,
  label: string,
  rating: number | null,
  key: AttributeKey,
  specs: string[],
): Pool {
  const parts: Part[] = []
  const missing: string[] = []
  const conditional: ConditionalNote[] = []
  const used = new Set<string>()
  if (rating === null) missing.push('Rating')
  parts.push({ label, value: rating ?? 0, kind: 'base' })
  const a = attribute(c, key).current
  if (a === null) missing.push(ATTRIBUTE_LABELS[key])
  parts.push({ label: ATTRIBUTE_LABELS[key], value: a ?? 0, kind: 'base' })
  woundAndGlobal(c, parts, conditional, used)
  const d = finishDerived(c, id, label, parts, missing, RULES.knowledgeAttributes, [], conditional)
  return {
    ...d,
    limit: resolveLimit(c, 'mental'),
    specializations: specs.filter(Boolean).map((s) => `${s} +2`),
    conditions: '',
    group: 'skill',
  }
}

// ---------- weapons ----------

export function rangedWeaponPool(c: Character, w: RangedWeapon): Pool {
  return weaponPool(c, w.id, w.name, w.skillId, w.accuracy, 'Accuracy')
}

export function meleeWeaponPool(c: Character, w: MeleeWeapon): Pool {
  return weaponPool(c, w.id, w.name, w.skillId, w.accuracy, 'Accuracy')
}

function weaponPool(
  c: Character,
  id: string,
  name: string,
  skillId: string | null,
  accuracy: number | null,
  limitLabel: string,
): Pool {
  const sk = skillId ? c.skills.find((s) => s.id === skillId) : undefined
  const label = name || 'Weapon'
  if (!sk) {
    const d = finishDerived(c, `weapon.${id}`, label, [], ['Weapon skill'], null)
    return {
      ...d,
      limit: { label: limitLabel, value: accuracy },
      specializations: [],
      conditions: '',
      group: 'weapon',
    }
  }
  const p = skillPool(c, sk, [`weapon:${id}`])
  const lmods = collectMods(c, [`weaponAcc:${id}`])
  const acc = accuracy === null ? null : accuracy + lmods.parts.reduce((x, q) => x + q.value, 0)
  const ov = c.overrides[`weapon.${id}`]
  return {
    ...p,
    id: `weapon.${id}`,
    label,
    value: ov !== undefined ? ov : p.auto,
    overridden: ov !== undefined,
    limit: { label: limitLabel, value: acc },
    group: 'weapon',
    notes: [...p.notes, `Uses ${sk.name}.`],
  }
}

// ---------- custom pools ----------

export function customPool(c: Character, cp: CustomPool): Pool {
  const parts: Part[] = []
  const missing: string[] = []
  const conditional: ConditionalNote[] = []
  const used = new Set<string>()
  let hasSkill = false
  for (const part of cp.parts) {
    if (part.kind === 'attribute') {
      const v = attribute(c, part.key).current
      if (v === null) missing.push(ATTRIBUTE_LABELS[part.key])
      parts.push({ label: ATTRIBUTE_LABELS[part.key], value: v ?? 0, kind: 'base' })
    } else if (part.kind === 'skill') {
      hasSkill = true
      const sk = c.skills.find((s) => s.id === part.skillId)
      if (!sk) {
        missing.push('Skill (deleted)')
        continue
      }
      const r = skillRating(c, sk)
      if (r === null) missing.push(`${sk.name} rating`)
      parts.push({ label: sk.name, value: r ?? 0, kind: 'base' })
      const sm = collectMods(c, [`skill:${sk.id}`], used)
      parts.push(...sm.parts)
      conditional.push(...sm.conditional)
    } else {
      parts.push({ label: part.label || 'Bonus', value: part.value, kind: 'base' })
    }
  }
  const mods = collectMods(c, [`pool:custom:${cp.id}`], used)
  parts.push(...mods.parts)
  conditional.push(...mods.conditional)
  if (cp.applyWounds) woundAndGlobal(c, parts, conditional, used)
  const d = finishDerived(
    c,
    `pool.custom.${cp.id}`,
    cp.name || 'Custom pool',
    parts,
    missing,
    null,
    [],
    conditional,
  )
  let lim: PoolLimit = null
  if (cp.limit === 'custom') lim = { label: 'Limit', value: cp.customLimit }
  else if (cp.limit !== 'none') lim = resolveLimit(c, cp.limit)
  if (!hasSkill && lim && cp.limit !== 'custom') {
    d.notes.push('Attribute-only tests normally have no limit (p. 47).')
  }
  return { ...d, limit: lim, specializations: [], conditions: cp.conditions, group: 'custom' }
}

/** Every pool the character has, keyed by Derived id; used by the dashboard & PDF favorites. */
export function allPools(c: Character): Pool[] {
  return [
    ...generalPools(c),
    ...c.skills.map((s) => skillPool(c, s)),
    ...c.rangedWeapons.map((w) => rangedWeaponPool(c, w)),
    ...c.meleeWeapons.map((w) => meleeWeaponPool(c, w)),
    ...c.customPools.map((p) => customPool(c, p)),
  ]
}

export function favoritePools(c: Character): Pool[] {
  const all = allPools(c)
  const favIds = new Set<string>([
    ...c.favoritePools.map((id) => (id.includes('.') ? id : `pool.${id}`)),
    ...c.skills.filter((s) => s.favorite).map((s) => `skill.${s.id}`),
    ...c.customPools.filter((p) => p.favorite).map((p) => `pool.custom.${p.id}`),
  ])
  return all.filter((p) => favIds.has(p.id))
}

export function activeWeaponPools(c: Character): Pool[] {
  return [
    ...c.rangedWeapons.filter((w) => w.active).map((w) => rangedWeaponPool(c, w)),
    ...c.meleeWeapons.filter((w) => w.active).map((w) => meleeWeaponPool(c, w)),
  ]
}

export { matrixDataProcessing }
