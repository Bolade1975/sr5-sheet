import { CharacterSchema, CHARACTER_SCHEMA_VERSION, type Character } from './schema'

/**
 * Versioned migrations. Each step takes a raw object at version N and returns
 * it at version N+1. After the last step the object is parsed with zod, which
 * fills defaults for any field added since. Steps must never drop user data.
 */
type Raw = Record<string, unknown>

const STEPS: Record<number, (raw: Raw) => Raw> = {
  // v0: hypothetical pre-release format with top-level name/metatype.
  0: (raw) => {
    const identity = (isObj(raw.identity) ? raw.identity : {}) as Raw
    const out: Raw = { ...raw, identity: { ...identity } }
    for (const k of ['name', 'alias', 'metatype'] as const) {
      if (typeof raw[k] === 'string' && !(identity[k] as string | undefined)) {
        ;(out.identity as Raw)[k] = raw[k]
      }
      delete out[k]
    }
    out.schemaVersion = 1
    return out
  },
  // v1 → v2: "carried" flags, equipment links and the Karma History log.
  // New fields get their defaults from the schema (carried = false, links =
  // null). Karma *spending* entries (negative Karma) of the older combined
  // Karma & ¥ history are moved — not copied — into the Karma History so
  // they are reused without being counted twice. Balances are never touched.
  1: (raw) => {
    const out: Raw = { ...raw }
    const ledger = Array.isArray(raw.ledger) ? (raw.ledger as unknown[]) : []
    const keep: unknown[] = []
    const moved: Raw[] = []
    for (const e of ledger) {
      if (
        isObj(e) &&
        e.currency === 'karma' &&
        typeof e.amount === 'number' &&
        Number.isInteger(e.amount) &&
        e.amount < 0
      ) {
        moved.push({
          id: typeof e.id === 'string' && e.id ? e.id : `ledger-${moved.length + 1}`,
          date: typeof e.date === 'string' ? e.date : '',
          category: 'Other',
          name: typeof e.description === 'string' ? e.description : '',
          before: '',
          after: '',
          karmaSpent: -e.amount,
          entryType: 'historical',
          comment: 'Moved from the Karma & ¥ history.',
          source: '',
          fromLedgerId: typeof e.id === 'string' ? e.id : null,
        })
      } else keep.push(e)
    }
    if (moved.length) {
      out.ledger = keep
      const existing = Array.isArray(raw.karmaHistory) ? (raw.karmaHistory as unknown[]) : []
      out.karmaHistory = [...existing, ...moved]
    }
    out.schemaVersion = 2
    return out
  },
}

function isObj(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export type MigrationResult =
  { ok: true; character: Character; migratedFrom: number | null } | { ok: false; error: string }

export function migrateCharacter(input: unknown): MigrationResult {
  if (!isObj(input)) return { ok: false, error: 'Not a character object.' }
  let raw: Raw = { ...input }
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0
  const start = version
  if (version > CHARACTER_SCHEMA_VERSION)
    return {
      ok: false,
      error: `Character was saved by a newer app version (data model v${version}; this app supports v${CHARACTER_SCHEMA_VERSION}). Update the app first.`,
    }
  while (version < CHARACTER_SCHEMA_VERSION) {
    const step = STEPS[version]
    if (!step) return { ok: false, error: `No migration from data model v${version}.` }
    raw = step(raw)
    version += 1
  }
  const parsed = CharacterSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return { ok: false, error: `Invalid character data — ${first}` }
  }
  return {
    ok: true,
    character: { ...parsed.data, schemaVersion: CHARACTER_SCHEMA_VERSION },
    migratedFrom: start === CHARACTER_SCHEMA_VERSION ? null : start,
  }
}
