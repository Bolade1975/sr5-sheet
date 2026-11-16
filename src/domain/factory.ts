import { CharacterSchema, CHARACTER_SCHEMA_VERSION, type Character } from './schema'

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** A blank character: every value is "not entered" (null), not zero. */
export function newCharacter(name = 'New Runner'): Character {
  const now = nowIso()
  return CharacterSchema.parse({
    id: newId(),
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    identity: { name },
  })
}

/** Deep copy with fresh ids for the character (sub-item ids stay unique within the copy). */
export function duplicateCharacter(c: Character, name?: string): Character {
  const now = nowIso()
  const copy = structuredClone(c)
  return {
    ...copy,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    identity: { ...copy.identity, name: name ?? `${c.identity.name || 'Runner'} (copy)` },
  }
}

export function displayName(c: Character): string {
  const n = c.identity.name.trim()
  const a = c.identity.alias.trim()
  if (n && a) return `${a} (${n})`
  return a || n || 'Unnamed runner'
}
