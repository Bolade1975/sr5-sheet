import { describe, expect, it } from 'vitest'
import { SheetDb, getCharacter, saveCharacter } from '../db/db'
import { exampleCharacter } from './example'
import { migrateCharacter } from './migrations'
import { CHARACTER_SCHEMA_VERSION, type Character } from './schema'
import { BACKUP_FORMAT, parseImport } from './transfer'

const V2_ONLY_KEYS = ['carried', 'mountedOn', 'pilotSkillId', 'itemId', 'weaponId', 'karmaHistory']

/** Strips everything added in data model v2, giving a record as v0.1.0 saved it. */
function asV1(c: Character): Record<string, unknown> {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v)) {
        if (V2_ONLY_KEYS.includes(k)) continue
        out[k] = strip(x)
      }
      return out
    }
    return v
  }
  const raw = strip(JSON.parse(JSON.stringify(c))) as Record<string, unknown>
  for (const a of (raw.rigger as { autosofts: Record<string, unknown>[] }).autosofts) delete a.kind
  raw.schemaVersion = 1
  return raw
}

function v1Character(): Record<string, unknown> {
  const c = exampleCharacter()
  c.resources = { nuyen: 2500, karma: 6, karmaTotal: 31 }
  c.ledger = [
    { id: 'l1', date: '2025-05-01', currency: 'karma', amount: 10, description: 'Run reward' },
    { id: 'l2', date: '2025-05-02', currency: 'karma', amount: -8, description: 'Pistols 4→5' },
    { id: 'l3', date: '2025-05-03', currency: 'nuyen', amount: -500, description: 'Ammo' },
    { id: 'l4', date: '2025-05-04', currency: 'karma', amount: -7, description: 'Spec' },
  ]
  return asV1(c)
}

describe('data model v2 migration', () => {
  it('upgrades a v1 character without changing equipment, character or Karma values', () => {
    const raw = v1Character()
    const r = migrateCharacter(raw)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const c = r.character
    expect(r.migratedFrom).toBe(1)
    expect(c.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
    // balances untouched
    expect(c.resources).toEqual({ nuyen: 2500, karma: 6, karmaTotal: 31 })
    // equipment untouched, nothing silently marked carried
    const before = raw as unknown as Character
    expect(c.rangedWeapons.map((w) => [w.name, w.accuracy, w.active])).toEqual(
      before.rangedWeapons.map((w) => [w.name, w.accuracy, w.active]),
    )
    expect(c.armor.map((a) => [a.name, a.rating, a.equipped])).toEqual(
      before.armor.map((a) => [a.name, a.rating, a.equipped]),
    )
    for (const x of [
      ...c.rangedWeapons,
      ...c.meleeWeapons,
      ...c.armor,
      ...c.gear,
      ...c.rigger.vehicles,
      ...c.matrix.devices,
      ...c.magic.foci,
    ])
      expect(x.carried).toBe(false)
    expect(c.rigger.rcc.carried).toBe(false)
    expect(c.rangedWeapons.every((w) => w.mountedOn === null)).toBe(true)
    expect(c.rigger.autosofts.every((a) => a.kind === 'other' && a.weaponId === null)).toBe(true)
    expect(c.modifiers.every((m) => m.itemId === null)).toBe(true)
  })

  it('moves Karma spending from the old history into Karma History exactly once', () => {
    const r = migrateCharacter(v1Character())
    if (!r.ok) throw new Error(r.error)
    const c = r.character
    expect(c.ledger.map((e) => e.id)).toEqual(['l1', 'l3'])
    expect(c.karmaHistory).toHaveLength(2)
    expect(c.karmaHistory.map((e) => [e.name, e.karmaSpent, e.date, e.entryType])).toEqual([
      ['Pistols 4→5', 8, '2025-05-02', 'historical'],
      ['Spec', 7, '2025-05-04', 'historical'],
    ])
    expect(c.karmaHistory[0]!.fromLedgerId).toBe('l2')
    // Migrating the migrated record again changes nothing (no double registration).
    const again = migrateCharacter(JSON.parse(JSON.stringify(c)))
    expect(again.ok && again.character).toEqual(c)
  })

  it('imports an old (v1) backup file', () => {
    const file = {
      format: BACKUP_FORMAT,
      formatVersion: 1,
      exportedAt: '2026-11-16T10:00:00Z',
      characters: [v1Character()],
    }
    const parsed = parseImport(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.errors).toEqual([])
    expect(parsed.value.characters[0]!.schemaVersion).toBe(2)
    expect(parsed.value.characters[0]!.karmaHistory).toHaveLength(2)
  })

  it('keeps carried flags per character through save, reload and JSON export', async () => {
    const db = new SheetDb(`test-${Math.random()}`)
    const a = exampleCharacter()
    const b = exampleCharacter()
    a.gear.push({
      id: 'g',
      name: 'Medkit',
      rating: 3,
      quantity: 1,
      category: 'Medical',
      carried: true,
      source: '',
      notes: '',
    })
    b.armor.forEach((x) => (x.carried = false))
    await saveCharacter(a, db)
    await saveCharacter(b, db)
    const ra = await getCharacter(a.id, db)
    const rb = await getCharacter(b.id, db)
    expect(ra?.gear.find((g) => g.id === 'g')?.carried).toBe(true)
    expect(ra?.armor.every((x) => x.carried)).toBe(true)
    expect(rb?.armor.every((x) => !x.carried)).toBe(true)
    const viaJson = migrateCharacter(JSON.parse(JSON.stringify(ra)))
    expect(viaJson.ok && viaJson.character).toEqual(ra)
  })
})
