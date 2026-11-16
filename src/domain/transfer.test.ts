import { describe, expect, it } from 'vitest'
import { exampleCharacter } from './example'
import { newCharacter } from './factory'
import { migrateCharacter } from './migrations'
import { CHARACTER_SCHEMA_VERSION } from './schema'
import { exportBackup, exportCharacter, parseImport, planImport, resolveImport } from './transfer'
import { SheetDb, getCharacter, listCharacters, saveCharacter, saveMany } from '../db/db'

describe('migrations', () => {
  it('upgrades a v0 record and fills defaults without losing data', () => {
    const r = migrateCharacter({ id: 'a', name: 'Old Name', metatype: 'Ork', skills: [] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.migratedFrom).toBe(0)
    expect(r.character.identity.name).toBe('Old Name')
    expect(r.character.identity.metatype).toBe('Ork')
    expect(r.character.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
    expect(r.character.attributes.BOD.base).toBeNull()
    expect(r.character.modules.magic).toBe(false)
  })

  it('rejects data from a newer model version', () => {
    const r = migrateCharacter({ id: 'a', schemaVersion: CHARACTER_SCHEMA_VERSION + 1 })
    expect(r.ok).toBe(false)
  })

  it('rejects malformed data with a readable message', () => {
    const r = migrateCharacter({ id: 'a', schemaVersion: 1, attributes: { BOD: { base: 'four' } } })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('attributes.BOD.base')
  })

  it('round-trips a full character unchanged', () => {
    const c = exampleCharacter()
    const r = migrateCharacter(JSON.parse(JSON.stringify(c)))
    expect(r.ok && r.character).toEqual(c)
  })
})

describe('import/export', () => {
  it('validates a character file before anything is written', () => {
    const c = exampleCharacter()
    const parsed = parseImport(JSON.stringify(exportCharacter(c)))
    expect(parsed.ok).toBe(true)
    expect(parseImport('{nope').ok).toBe(false)
    expect(parseImport(JSON.stringify({ format: 'other' })).ok).toBe(false)
  })

  it('imports valid backup entries and reports invalid ones', () => {
    const a = newCharacter('A')
    const file = exportBackup([a])
    const raw = JSON.parse(JSON.stringify(file))
    raw.characters.push({ id: 'bad', schemaVersion: 1, skills: 'not a list' })
    const parsed = parseImport(JSON.stringify(raw))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.characters).toHaveLength(1)
    expect(parsed.value.errors).toHaveLength(1)
  })

  it('defaults conflicts to "copy" so nothing is overwritten by accident', () => {
    const a = newCharacter('A')
    const plan = planImport([a], [a])
    expect(plan[0]!.choice).toBe('copy')
    const out = resolveImport(plan)
    expect(out[0]!.id).not.toBe(a.id)
    expect(out[0]!.identity.name).toBe('A (imported)')
    plan[0]!.choice = 'replace'
    expect(resolveImport(plan)[0]!.id).toBe(a.id)
    plan[0]!.choice = 'skip'
    expect(resolveImport(plan)).toHaveLength(0)
  })
})

describe('IndexedDB storage', () => {
  it('persists and reloads characters, migrating old rows on read', async () => {
    const db = new SheetDb(`test-${Math.random()}`)
    const c = exampleCharacter()
    await saveCharacter(c, db)
    expect(await getCharacter(c.id, db)).toEqual(c)
    await db.characters.put({
      id: 'old',
      name: 'Legacy',
      updatedAt: '2020',
      data: { id: 'old', name: 'Legacy' },
    })
    const list = await listCharacters(db)
    expect(list).toHaveLength(2)
    const legacy = list.find((l) => 'character' in l && l.character.id === 'old')
    expect(legacy && 'character' in legacy && legacy.character.identity.name).toBe('Legacy')
    await saveMany([newCharacter('X'), newCharacter('Y')], db)
    expect(await db.characters.count()).toBe(4)
  })
})
