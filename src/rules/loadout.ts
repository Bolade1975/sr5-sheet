import type {
  Armor,
  AttributeKey,
  Character,
  Gear,
  MatrixDevice,
  MeleeWeapon,
  Modifier,
  RangedWeapon,
  Skill,
} from '../domain/schema'
import {
  droneInitiative,
  finishDerived,
  initiative,
  matrixMonitor,
  vehicleMonitor,
  type ConditionalNote,
  type Derived,
  type InitiativeResult,
  type Part,
} from './engine'
import {
  findSkillByCatalog,
  meleeWeaponPool,
  rangedWeaponPool,
  skillPool,
  type Pool,
  type PoolLimit,
} from './pools'
import { RULES, type RuleRef } from './references'
import { catalogByKey } from './skillCatalog'

/**
 * Current Loadout: everything marked "Carried" plus the pools that go with it.
 *
 * "Carried" only selects what is listed here. It never equips armor, activates
 * weapons or switches on modifiers — every number below comes from the same
 * engine as the rest of the sheet, using the items' own equipped/active state.
 * All entries are references to the original items, so edits show up at once.
 */

type Vehicle = Character['rigger']['vehicles'][number]
type Autosoft = Character['rigger']['autosofts'][number]
type Focus = Character['magic']['foci'][number]

export type VehicleMode = 'autonomous' | 'jumped' | 'remote'

export const VEHICLE_MODE_LABELS: Record<VehicleMode, string> = {
  autonomous: 'Autonomous (Pilot + autosofts)',
  jumped: 'Rigger control (jumped in)',
  remote: 'Remote control (Control Device)',
}

export type VehicleModeBlock = {
  mode: VehicleMode
  title: string
  /** Shown instead of pools when the mode cannot be used/calculated. */
  message: string | null
  pools: Pool[]
  initiative: { label: string; score: Derived; diceText: string }[]
  notes: string[]
}

export type LoadoutVehicle = {
  vehicle: Vehicle
  conditionMonitor: Derived
  matrixMonitor: Derived
  damageResistance: Pool
  weapons: RangedWeapon[]
  autosofts: Autosoft[]
  autosoftSource: 'drone' | 'rcc' | null
  modes: VehicleModeBlock[]
  warnings: string[]
}

export type LoadoutItem<T> = { item: T; mods: Modifier[] }

export type Loadout = {
  ranged: (LoadoutItem<RangedWeapon> & { pool: Pool })[]
  melee: (LoadoutItem<MeleeWeapon> & { pool: Pool })[]
  armor: LoadoutItem<Armor>[]
  gear: LoadoutItem<Gear>[]
  devices: LoadoutItem<MatrixDevice>[]
  foci: LoadoutItem<Focus>[]
  rccCarried: boolean
  vehicles: LoadoutVehicle[]
  /** Hints such as "worn armor is not marked carried" — informational only. */
  warnings: string[]
  count: number
}

// ---------- helpers ----------

export function linkedMods(c: Character, itemId: string): Modifier[] {
  return c.modifiers.filter((m) => m.itemId === itemId)
}

/** The character's skill for a catalog key, or an unlearned stand-in (rating 0 → defaulting). */
function catalogSkill(c: Character, key: string): Skill | null {
  const sk = findSkillByCatalog(c, key)
  if (sk) return sk
  const cat = catalogByKey(key)
  if (!cat) return null
  return {
    id: `__${key}`,
    name: `${cat.name} (not learned)`,
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
}

function mkPool(
  c: Character,
  id: string,
  label: string,
  parts: Part[],
  missing: string[],
  ref: RuleRef | null,
  lim: PoolLimit,
  opts: { notes?: string[]; conditional?: ConditionalNote[]; specs?: string[] } = {},
): Pool {
  const d = finishDerived(
    c,
    id,
    label,
    parts,
    missing,
    ref,
    opts.notes ?? [],
    opts.conditional ?? [],
  )
  return {
    ...d,
    limit: lim,
    specializations: opts.specs ?? [],
    conditions: '',
    group: 'rigger',
  }
}

/**
 * A rigger's own test (skill + attribute, including defaulting, the skill's
 * modifiers, wound modifiers and "all tests" modifiers) re-labelled for a
 * vehicle mode, with optional rule parts such as the control rig bonus.
 */
function riggerPool(
  c: Character,
  skill: Skill | null,
  missingSkill: string,
  attr: AttributeKey,
  id: string,
  label: string,
  ref: RuleRef,
  lim: PoolLimit,
  opts: {
    extra?: Part[]
    targets?: string[]
    notes?: string[]
    conditional?: ConditionalNote[]
  } = {},
): Pool {
  if (!skill) return mkPool(c, id, label, [], [missingSkill], ref, lim, { notes: opts.notes ?? [] })
  const base = skillPool(c, { ...skill, attribute: attr }, opts.targets ?? [])
  return mkPool(c, id, label, [...base.parts, ...(opts.extra ?? [])], base.missing, ref, lim, {
    notes: [...base.notes, ...(opts.notes ?? [])],
    conditional: [...base.conditional, ...(opts.conditional ?? [])],
    specs: base.specializations,
  })
}

const HOT_SIM: ConditionalNote = {
  label: 'Hot-sim VR',
  value: 1,
  condition: 'rigging in hot-sim (p. 266)',
}

function plus(n: number | null, label: string, add: number, addLabel: string): PoolLimit {
  return n === null
    ? { label: `${label} (not entered) + ${addLabel} ${add}`, value: null }
    : { label: `${label} ${n} + ${addLabel} ${add} =`, value: n + add }
}

// ---------- vehicles ----------

export function vehicleAutosofts(
  c: Character,
  v: Vehicle,
): { list: Autosoft[]; source: 'drone' | 'rcc' | null } {
  const own = c.rigger.autosofts.filter((a) => a.vehicleIds.includes(v.id))
  if (own.length) return { list: own, source: 'drone' }
  const shared = c.rigger.autosofts.filter((a) => a.sharedOnRcc)
  return { list: shared, source: shared.length ? 'rcc' : null }
}

export function mountedWeapons(c: Character, v: Vehicle): RangedWeapon[] {
  return c.rangedWeapons.filter((w) => w.mountedOn === v.id)
}

function bestAutosoft(list: Autosoft[], pred: (a: Autosoft) => boolean): Autosoft | undefined {
  return list
    .filter(pred)
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1))
    .at(0)
}

function autonomousBlock(c: Character, v: Vehicle, weapons: RangedWeapon[]): VehicleModeBlock {
  const { list } = vehicleAutosofts(c, v)
  const pools: Pool[] = []
  const pilotPart = (parts: Part[], missing: string[]) => {
    if (v.pilot === null) missing.push('Pilot rating')
    parts.push({ label: 'Pilot', value: v.pilot ?? 0, kind: 'base' })
  }
  const softPart = (a: Autosoft | undefined, name: string, parts: Part[], missing: string[]) => {
    if (!a) missing.push(`${name} autosoft (none installed)`)
    else {
      if (a.rating === null) missing.push(`${a.name || name} rating`)
      parts.push({ label: a.name || name, value: a.rating ?? 0, kind: 'base' })
    }
  }
  // Perception (Sensor test): Pilot + Clearsight [Sensor], p. 270 / 184.
  {
    const parts: Part[] = []
    const missing: string[] = []
    pilotPart(parts, missing)
    softPart(
      bestAutosoft(list, (a) => a.kind === 'clearsight'),
      'Clearsight',
      parts,
      missing,
    )
    pools.push(
      mkPool(
        c,
        `vehicle.${v.id}.auto.perception`,
        'Perception (autonomous)',
        parts,
        missing,
        RULES.dronePerception,
        { label: 'Sensor', value: v.sensor },
      ),
    )
  }
  // Gunnery: Pilot + [Weapon] Targeting [Accuracy], p. 183.
  for (const w of weapons) {
    const parts: Part[] = []
    const missing: string[] = []
    pilotPart(parts, missing)
    const soft = bestAutosoft(list, (a) => a.kind === 'targeting' && a.weaponId === w.id)
    if (!soft) missing.push('Targeting autosoft for this weapon (no untrained attacks, p. 183)')
    else softPart(soft, 'Targeting', parts, missing)
    pools.push(
      mkPool(
        c,
        `vehicle.${v.id}.auto.gunnery.${w.id}`,
        `${w.name || 'Weapon'} (autonomous)`,
        parts,
        missing,
        RULES.droneGunnery,
        { label: 'Accuracy', value: w.accuracy },
      ),
    )
  }
  const init: VehicleModeBlock['initiative'] = []
  if (v.kind === 'drone') {
    const d = droneInitiative(c, v)
    init.push({ label: 'Autonomous Initiative', score: d, diceText: '4D6' })
  }
  return {
    mode: 'autonomous',
    title: VEHICLE_MODE_LABELS.autonomous,
    message: null,
    pools,
    initiative: init,
    notes: [
      'Other autonomous tests (e.g. Vehicle tests, defense) depend on the autosoft — add a custom pool if your table uses one.',
    ],
  }
}

function jumpedBlock(
  c: Character,
  v: Vehicle,
  weapons: RangedWeapon[],
  pilotSkill: Skill | null,
): VehicleModeBlock {
  const cr = c.rigger.controlRig
  const base = {
    mode: 'jumped' as const,
    title: VEHICLE_MODE_LABELS.jumped,
    pools: [] as Pool[],
    initiative: [] as VehicleModeBlock['initiative'],
    notes: [] as string[],
  }
  if (cr === null)
    return { ...base, message: 'Enter the control rig rating on the Rigger tab to calculate.' }
  if (cr <= 0) return { ...base, message: 'Jumping in requires a control rig (p. 265–266).' }
  const crPart: Part = { label: 'Control rig (jumped in)', value: cr, kind: 'rule' }
  const pools: Pool[] = []
  pools.push(
    riggerPool(
      c,
      pilotSkill,
      'Pilot skill for this vehicle (choose on the Rigger tab)',
      'REA',
      `vehicle.${v.id}.jumped.control`,
      'Vehicle test (jumped in)',
      RULES.vehicleTest,
      { label: `Handling ${v.handling || '(not entered)'} + control rig ${cr}`, value: null },
      {
        extra: [crPart],
        conditional: [HOT_SIM],
        notes: [`Vehicle Test thresholds −${cr} (min 1) while jumped in (p. 452).`],
      },
    ),
  )
  const gunnery = catalogSkill(c, 'gunnery')
  for (const w of weapons)
    pools.push(
      riggerPool(
        c,
        gunnery,
        'Gunnery skill',
        'LOG',
        `vehicle.${v.id}.jumped.gunnery.${w.id}`,
        `${w.name || 'Weapon'} (jumped in)`,
        RULES.mountedWeapons,
        plus(w.accuracy, 'Accuracy', cr, 'control rig'),
        { extra: [crPart], targets: [`weapon:${w.id}`], conditional: [HOT_SIM] },
      ),
    )
  pools.push(
    riggerPool(
      c,
      catalogSkill(c, 'perception'),
      'Perception skill',
      'INT',
      `vehicle.${v.id}.jumped.perception`,
      'Perception (jumped in)',
      RULES.dronePerception,
      plus(v.sensor, 'Sensor', cr, 'control rig'),
      { conditional: [HOT_SIM], notes: ['Uses the vehicle’s sensor suite (p. 270).'] },
    ),
  )
  const init = (['riggingCold', 'riggingHot'] as const).map((m) => {
    const i: InitiativeResult = initiative(c, m)
    return {
      label: m === 'riggingCold' ? 'Rigging VR cold-sim' : 'Rigging VR hot-sim',
      score: i.score,
      diceText: `${i.dice.value ?? '?'}D6`,
    }
  })
  return {
    ...base,
    message: null,
    pools,
    initiative: init,
    notes: ['Jumped in, the vehicle uses your VR Initiative (p. 270).'],
  }
}

function remoteBlock(
  c: Character,
  v: Vehicle,
  weapons: RangedWeapon[],
  pilotSkill: Skill | null,
): VehicleModeBlock {
  const dp = c.rigger.rcc.dataProcessing
  const dpText = dp === null ? 'RCC Data Processing (not entered)' : `RCC Data Processing ${dp}`
  const pools: Pool[] = []
  pools.push(
    riggerPool(
      c,
      pilotSkill,
      'Pilot skill for this vehicle (choose on the Rigger tab)',
      'REA',
      `vehicle.${v.id}.remote.control`,
      'Vehicle test (remote)',
      RULES.controlDevice,
      { label: `lower of Handling ${v.handling || '(not entered)'} and ${dpText}`, value: null },
      { notes: ['Vehicle test = Vehicle skill + Reaction [Handling] (p. 199).'] },
    ),
  )
  const gunnery = catalogSkill(c, 'gunnery')
  for (const w of weapons) {
    const lim: PoolLimit =
      w.accuracy !== null && dp !== null
        ? {
            label: `lower of Accuracy ${w.accuracy} / DP ${dp} =`,
            value: Math.min(w.accuracy, dp),
          }
        : { label: `lower of Accuracy ${w.accuracy ?? '(not entered)'} and ${dpText}`, value: null }
    const alt = gunnery
      ? skillPool(c, { ...gunnery, attribute: 'AGI' }, [`weapon:${w.id}`]).auto
      : null
    pools.push(
      riggerPool(
        c,
        gunnery,
        'Gunnery skill',
        'LOG',
        `vehicle.${v.id}.remote.gunnery.${w.id}`,
        `${w.name || 'Weapon'} (remote)`,
        RULES.controlDevice,
        lim,
        {
          targets: [`weapon:${w.id}`],
          notes: [
            `Gunnery + Logic for remote-operated systems (p. 183). The p. 238 example uses Gunnery + Agility instead (${alt ?? '—'} dice) — confirm with your GM.`,
          ],
        },
      ),
    )
  }
  return {
    mode: 'remote',
    title: VEHICLE_MODE_LABELS.remote,
    message: null,
    pools,
    initiative: [],
    notes: ['Remote control uses your own Initiative (Physical/Matrix AR or VR).'],
  }
}

export function loadoutVehicle(c: Character, v: Vehicle): LoadoutVehicle {
  const weapons = mountedWeapons(c, v)
  const { list, source } = vehicleAutosofts(c, v)
  const pilotSkill = v.pilotSkillId ? (c.skills.find((s) => s.id === v.pilotSkillId) ?? null) : null
  const warnings: string[] = []
  if (v.pilotSkillId && !pilotSkill) warnings.push('The chosen Pilot skill no longer exists.')
  const shared = c.rigger.autosofts.filter((a) => a.sharedOnRcc).length
  if (source === 'rcc' && c.rigger.rcc.sharing !== null && shared > c.rigger.rcc.sharing)
    warnings.push(
      `${shared} autosofts are marked shared, but the RCC Sharing rating is ${c.rigger.rcc.sharing} (p. 267).`,
    )
  if (source === 'rcc' && !c.rigger.rcc.carried)
    warnings.push('Uses RCC-shared autosofts, but the RCC is not marked carried.')
  for (const a of list)
    if (a.kind === 'targeting' && a.weaponId && !weapons.some((w) => w.id === a.weaponId))
      warnings.push(`${a.name || 'Targeting autosoft'}: its weapon is not mounted on this vehicle.`)

  const dr: Part[] = []
  const drMissing: string[] = []
  if (v.body === null) drMissing.push('Body')
  dr.push({ label: 'Body', value: v.body ?? 0, kind: 'base' })
  if (v.armor === null) drMissing.push('Armor')
  dr.push({ label: 'Armor', value: v.armor ?? 0, kind: 'base' })

  const modes: VehicleModeBlock[] = [autonomousBlock(c, v, weapons)]
  if (c.modules.rigger) {
    modes.push(jumpedBlock(c, v, weapons, pilotSkill))
    modes.push(remoteBlock(c, v, weapons, pilotSkill))
  }
  return {
    vehicle: v,
    conditionMonitor: vehicleMonitor(c, v),
    matrixMonitor: matrixMonitor(
      c,
      `vehicle.${v.id}.matrix`,
      v.deviceRating,
      `${v.name || 'Vehicle'} Matrix Monitor`,
    ),
    damageResistance: mkPool(
      c,
      `vehicle.${v.id}.damageResist`,
      'Damage Resistance (Body + Armor)',
      dr,
      drMissing,
      RULES.vehicleDamage,
      null,
      { notes: ['Armor is modified by the attack’s AP.'] },
    ),
    weapons,
    autosofts: list,
    autosoftSource: source,
    modes,
    warnings,
  }
}

/** Every vehicle pool (for override labels). */
export function allVehiclePools(c: Character): Derived[] {
  return c.rigger.vehicles.flatMap((v) => {
    const lv = loadoutVehicle(c, v)
    return [lv.damageResistance, ...lv.modes.flatMap((m) => m.pools)]
  })
}

// ---------- whole loadout ----------

export function buildLoadout(c: Character): Loadout {
  const withMods = <T extends { id: string }>(item: T): LoadoutItem<T> => ({
    item,
    mods: linkedMods(c, item.id),
  })
  const ranged = c.rangedWeapons
    .filter((w) => w.carried && !w.mountedOn)
    .map((w) => ({ ...withMods(w), pool: rangedWeaponPool(c, w) }))
  const melee = c.meleeWeapons
    .filter((w) => w.carried)
    .map((w) => ({ ...withMods(w), pool: meleeWeaponPool(c, w) }))
  const armor = c.armor.filter((a) => a.carried).map(withMods)
  const gear = c.gear.filter((g) => g.carried).map(withMods)
  const devices = c.matrix.devices.filter((d) => d.carried).map(withMods)
  const foci = c.magic.foci.filter((f) => f.carried).map(withMods)
  const vehicles = c.rigger.vehicles.filter((v) => v.carried).map((v) => loadoutVehicle(c, v))

  const warnings: string[] = []
  for (const a of c.armor)
    if (a.equipped && !a.carried)
      warnings.push(`${a.name || 'Armor'} is worn (counts for Armor) but not marked carried.`)
  for (const w of [...c.rangedWeapons, ...c.meleeWeapons])
    if (w.active && !w.carried && !('mountedOn' in w && w.mountedOn))
      warnings.push(`${w.name || 'Weapon'} is active on the Play tab but not marked carried.`)
  for (const w of c.rangedWeapons)
    if (w.mountedOn && !c.rigger.vehicles.some((v) => v.id === w.mountedOn))
      warnings.push(`${w.name || 'Weapon'} is mounted on a vehicle that no longer exists.`)

  return {
    ranged,
    melee,
    armor,
    gear,
    devices,
    foci,
    rccCarried: c.rigger.rcc.carried,
    vehicles,
    warnings,
    count:
      ranged.length +
      melee.length +
      armor.length +
      gear.length +
      devices.length +
      foci.length +
      vehicles.length +
      (c.rigger.rcc.carried ? 1 : 0),
  }
}

/** Short human description of a linked modifier's state (carried never changes it). */
export function modState(m: Modifier): string {
  if (m.kind === 'permanent') return 'permanent — always counted'
  if (m.kind === 'situational') return m.active ? 'situational — ON' : 'situational — off'
  return `conditional — ${m.condition || 'not added automatically'}`
}

/** All equipment a modifier can be linked to (for the "Linked item" picker). */
export function equipmentIndex(c: Character): { id: string; label: string }[] {
  const n = (name: string, fallback: string) => name || fallback
  return [
    ...c.rangedWeapons.map((w) => ({ id: w.id, label: `Ranged: ${n(w.name, 'weapon')}` })),
    ...c.meleeWeapons.map((w) => ({ id: w.id, label: `Melee: ${n(w.name, 'weapon')}` })),
    ...c.armor.map((a) => ({ id: a.id, label: `Armor: ${n(a.name, 'armor')}` })),
    ...c.gear.map((g) => ({ id: g.id, label: `Gear: ${n(g.name, 'item')}` })),
    ...c.augmentations.map((a) => ({ id: a.id, label: `Ware: ${n(a.name, 'augmentation')}` })),
    ...c.matrix.devices.map((d) => ({ id: d.id, label: `Device: ${n(d.name, 'device')}` })),
    ...c.magic.foci.map((f) => ({ id: f.id, label: `Focus: ${n(f.name, 'focus')}` })),
    ...c.rigger.vehicles.map((v) => ({ id: v.id, label: `Vehicle: ${n(v.name, 'vehicle')}` })),
  ]
}
