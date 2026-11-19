import type { Character, KarmaEntry } from '../domain/schema'

/**
 * Karma reconciliation. Read-only: it compares the stored balances with the
 * manual Karma History and never changes either. Missing inputs give null
 * (shown as "needs input"), never an invented number.
 */
export type KarmaStatus = 'balanced' | 'mismatch' | 'needsInput'

export type KarmaReconciliation = {
  earned: number | null
  spent: number
  unspent: number | null
  expected: number | null
  difference: number | null
  status: KarmaStatus
  /** Entries whose Karma Spent is still empty (excluded from the sum). */
  entriesWithoutCost: number
  entries: number
}

export function totalKarmaSpent(entries: readonly KarmaEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.karmaSpent ?? 0), 0)
}

export function reconcileKarma(c: Character): KarmaReconciliation {
  const earned = c.resources.karmaTotal
  const unspent = c.resources.karma
  const spent = totalKarmaSpent(c.karmaHistory)
  const expected = earned === null ? null : earned - spent
  const difference = unspent === null || expected === null ? null : unspent - expected
  return {
    earned,
    spent,
    unspent,
    expected,
    difference,
    status: difference === null ? 'needsInput' : difference === 0 ? 'balanced' : 'mismatch',
    entriesWithoutCost: c.karmaHistory.filter((e) => e.karmaSpent === null).length,
    entries: c.karmaHistory.length,
  }
}

/** Newest first; entries without a date go last, ties keep their entry order. */
export function sortedKarmaHistory(entries: readonly KarmaEntry[]): KarmaEntry[] {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.date && b.e.date && a.e.date !== b.e.date) return a.e.date < b.e.date ? 1 : -1
      if (!a.e.date !== !b.e.date) return a.e.date ? -1 : 1
      return a.i - b.i
    })
    .map((x) => x.e)
}
