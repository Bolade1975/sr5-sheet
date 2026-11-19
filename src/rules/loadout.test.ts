import { describe, expect, it } from 'vitest'
import { exampleCharacter } from '../domain/example'
import { newCharacter, newId } from '../domain/factory'
import type { Character, KarmaEntry } from '../domain/schema'
import { armorValue } from './engine'
import { reconcileKarma } from './karma'
import { buildLoadout, loadoutVehicle } from './loadout'
import { rangedWeaponPool } from './pools'

function ex(): Character {
  return exampleCharacter()
}
const drone = (c: Character) => c.rigger.vehicles[0]!
const pistol = (c: Character) => c.rangedWeapons[0]!
const lmg = (c: Character) => c.rangedWeapons[1]!
const skillByKey = (c: Character, k: string) => c.skills.find((s) => s.catalogKey === k)!

describe('carried is separate from equipped/active', () => {
  it('carrying armor does not wear it, and wearing does not require carrying', () => {
    const c = ex()
    const before = armorValue(c).value
    c.armor.push({
      id: newId(),
      name: 'Spare Armor Jacket',
      rating: 12,
      accessory: false,
      equipped: false,
      carried: true,
      source: '',
      notes: '',
    })
    expect(armorValue(c).value).toBe(before)
    c.armor.forEach((a) => (a.carried = false))
    expect(armorValue(c).value).toBe(before)
  })

  it('carrying a weapon or item does not activate it or its linked modifiers', () => {
    const c = ex()
    const w = pistol(c)
    w.carried = false
    const poolBefore = rangedWeaponPool(c, w).value
    c.modifiers.push({
      id: newId(),
      name: 'Laser sight',
      value: 1,
      kind: 'situational',
      active: false,
      targets: [`weapon:${w.id}`],
      condition: '',
      source: '',
      notes: '',
      itemId: w.id,
    })
    w.carried = true
    expect(w.active).toBe(true) // unchanged from the example
    expect(rangedWeaponPool(c, w).value).toBe(poolBefore)
    const lo = buildLoadout(c)
    const entry = lo.ranged.find((r) => r.item.id === w.id)!
    expect(entry.mods.map((m) => m.name)).toEqual(['Laser sight'])
    expect(entry.pool.value).toBe(poolBefore)
  })
})

describe('Current Loadout contents', () => {
  it('lists only carried items, by reference, and reflects edits immediately', () => {
    const c = ex()
    c.meleeWeapons[0]!.carried = false
    let lo = buildLoadout(c)
    expect(lo.ranged.map((r) => r.item.name)).toEqual(['Example Heavy Pistol'])
    expect(lo.melee).toHaveLength(0)
    expect(lo.vehicles.map((v) => v.vehicle.name)).toEqual(['Example Ground Drone'])
    // mounted weapon is shown under its vehicle, not as a hand-carried weapon
    expect(lo.vehicles[0]!.weapons.map((w) => w.id)).toEqual([lmg(c).id])
    expect(lo.ranged[0]!.item).toBe(pistol(c))

    pistol(c).damage = '9P'
    skillByKey(c, 'pistols').rating = 6
    lo = buildLoadout(c)
    expect(lo.ranged[0]!.item.damage).toBe('9P')
    expect(lo.ranged[0]!.pool.value).toBe(rangedWeaponPool(c, pistol(c)).value)
  })

  it('warns when worn armor or active weapons are not marked carried', () => {
    const c = ex()
    c.armor[0]!.carried = false
    pistol(c).carried = false
    const w = buildLoadout(c).warnings.join(' ')
    expect(w).toContain('Example Armor')
    expect(w).toContain('Example Heavy Pistol')
  })

  it('handles many items and very long names', () => {
    const c = newCharacter('Long')
    for (let i = 0; i < 60; i++)
      c.gear.push({
        id: newId(),
        name: `Item ${i} — an extremely long gear name that must wrap instead of being cut off`,
        rating: i % 6,
        quantity: 1,
        category: 'Misc',
        carried: i % 2 === 0,
        source: '',
        notes: '',
      })
    const lo = buildLoadout(c)
    expect(lo.gear).toHaveLength(30)
    expect(lo.count).toBe(30)
  })
})

describe('vehicle pools per control mode (SR5 p. 183, 199, 238, 266, 270, 452)', () => {
  it('autonomous: Pilot + autosoft, limited by Sensor / Accuracy', () => {
    const c = ex()
    const lv = loadoutVehicle(c, drone(c))
    const auto = lv.modes.find((m) => m.mode === 'autonomous')!
    const perc = auto.pools.find((p) => p.id.endsWith('auto.perception'))!
    expect(perc.value).toBe(3 + 3) // Pilot 3 + Clearsight 3
    expect(perc.limit).toEqual({ label: 'Sensor', value: 3 })
    const gun = auto.pools.find((p) => p.id.includes('auto.gunnery'))!
    expect(gun.value).toBe(6) // Pilot 3 + Targeting 3
    expect(gun.limit?.value).toBe(5)
    expect(auto.initiative[0]!.score.value).toBe(6) // Pilot × 2
  })

  it('autonomous gunnery without a matching Targeting autosoft shows "missing", not a number', () => {
    const c = ex()
    c.rigger.autosofts = c.rigger.autosofts.filter((a) => a.kind !== 'targeting')
    const auto = loadoutVehicle(c, drone(c)).modes[0]!
    const gun = auto.pools.find((p) => p.id.includes('auto.gunnery'))!
    expect(gun.value).toBeNull()
    expect(gun.missing.join(' ')).toContain('Targeting autosoft')
  })

  it('jumped in: rigger skill + attribute + control rig dice, limits + control rig', () => {
    const c = ex() // control rig 1, REA 4, LOG 5, INT 5, Pilot Ground Craft 3, Gunnery 3, Perception 4
    const j = loadoutVehicle(c, drone(c)).modes.find((m) => m.mode === 'jumped')!
    expect(j.message).toBeNull()
    const control = j.pools.find((p) => p.id.endsWith('jumped.control'))!
    expect(control.value).toBe(3 + 4 + 1)
    expect(control.limit?.label).toContain('Handling 4/4')
    const gun = j.pools.find((p) => p.id.includes('jumped.gunnery'))!
    expect(gun.value).toBe(3 + 5 + 1)
    expect(gun.limit?.value).toBe(5 + 1)
    expect(gun.conditional.some((m) => m.label === 'Hot-sim VR')).toBe(true)
    const perc = j.pools.find((p) => p.id.endsWith('jumped.perception'))!
    expect(perc.value).toBe(4 + 5)
    expect(perc.limit?.value).toBe(3 + 1)
  })

  it('jumped in needs a control rig; remote limit is the lower of Accuracy and Data Processing', () => {
    const c = ex()
    c.rigger.controlRig = null
    const lv = loadoutVehicle(c, drone(c))
    expect(lv.modes.find((m) => m.mode === 'jumped')!.message).toContain('control rig')
    const remote = lv.modes.find((m) => m.mode === 'remote')!
    const gun = remote.pools.find((p) => p.id.includes('remote.gunnery'))!
    expect(gun.value).toBe(3 + 5)
    expect(gun.limit?.value).toBe(4) // min(Accuracy 5, RCC DP 4)
  })

  it('without a chosen Pilot skill the vehicle test is reported as missing', () => {
    const c = ex()
    drone(c).pilotSkillId = null
    const j = loadoutVehicle(c, drone(c)).modes.find((m) => m.mode === 'jumped')!
    const control = j.pools.find((p) => p.id.endsWith('jumped.control'))!
    expect(control.value).toBeNull()
    expect(control.missing[0]).toContain('Pilot skill')
  })

  it('wound modifiers of the rigger apply to rigger-controlled pools, not to autonomous ones', () => {
    const c = ex()
    c.play.physicalDamage = 3
    const lv = loadoutVehicle(c, drone(c))
    const jumped = lv.modes.find((m) => m.mode === 'jumped')!.pools[0]!
    const auto = lv.modes.find((m) => m.mode === 'autonomous')!.pools[0]!
    expect(jumped.value).toBe(3 + 4 + 1 - 1)
    expect(auto.value).toBe(6)
  })

  it('manual overrides work for vehicle pools', () => {
    const c = ex()
    const id = loadoutVehicle(c, drone(c)).modes[0]!.pools[0]!.id
    c.overrides[id] = 12
    const p = loadoutVehicle(c, drone(c)).modes[0]!.pools[0]!
    expect(p.value).toBe(12)
    expect(p.overridden).toBe(true)
    expect(p.auto).toBe(6)
  })
})

describe('Karma reconciliation', () => {
  const entry = (karmaSpent: number | null, extra: Partial<KarmaEntry> = {}): KarmaEntry => ({
    id: newId(),
    date: '2026-01-01',
    category: 'Skill',
    name: 'x',
    before: '1',
    after: '2',
    karmaSpent,
    entryType: 'new',
    comment: '',
    source: '',
    fromLedgerId: null,
    ...extra,
  })

  it('is balanced for the example and recalculates on add, edit and delete', () => {
    const c = ex()
    expect(reconcileKarma(c)).toMatchObject({
      earned: 12,
      spent: 8,
      unspent: 4,
      expected: 4,
      difference: 0,
      status: 'balanced',
    })
    c.karmaHistory.push(entry(5))
    expect(reconcileKarma(c)).toMatchObject({ spent: 13, expected: -1, difference: 5 })
    expect(reconcileKarma(c).status).toBe('mismatch')
    c.karmaHistory[2]!.karmaSpent = 2
    expect(reconcileKarma(c).difference).toBe(2)
    c.karmaHistory.pop()
    expect(reconcileKarma(c).status).toBe('balanced')
  })

  it('never changes the stored balances and shows the real difference for a partial log', () => {
    const c = newCharacter('Partial')
    c.resources = { nuyen: null, karma: 10, karmaTotal: 100 }
    c.karmaHistory.push(entry(20, { entryType: 'historical' }), entry(null))
    const r = reconcileKarma(c)
    expect(r).toMatchObject({ spent: 20, expected: 80, difference: -70, status: 'mismatch' })
    expect(r.entriesWithoutCost).toBe(1)
    expect(c.resources).toEqual({ nuyen: null, karma: 10, karmaTotal: 100 })
  })

  it('needs input when earned or unspent Karma is empty', () => {
    const c = newCharacter('Empty')
    c.karmaHistory.push(entry(3))
    const r = reconcileKarma(c)
    expect(r.status).toBe('needsInput')
    expect(r.expected).toBeNull()
    expect(r.difference).toBeNull()
  })
})
