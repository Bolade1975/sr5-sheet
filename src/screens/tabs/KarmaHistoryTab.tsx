import { KARMA_CATEGORIES, type KarmaEntry } from '../../domain/schema'
import { reconcileKarma, sortedKarmaHistory, totalKarmaSpent } from '../../rules/karma'
import { useChar } from '../../state/store'
import { Panel } from '../../ui/components'
import { fmtSigned, todayIso } from '../../ui/format'
import { ItemList } from '../../ui/ItemList'

const STATUS_TEXT = {
  balanced: 'Balanced',
  mismatch: 'Mismatch',
  needsInput: 'Needs input',
} as const

/**
 * Manual log of what Karma was spent on, with automatic totals and a
 * reconciliation against the stored balances. Nothing here changes the
 * character: no skills/attributes are raised and no Karma is deducted.
 */
export function KarmaHistoryTab() {
  const { c, update } = useChar()
  const r = reconcileKarma(c)
  const byCategory = KARMA_CATEGORIES.map((cat) => ({
    cat,
    sum: totalKarmaSpent(c.karmaHistory.filter((e) => e.category === cat)),
    n: c.karmaHistory.filter((e) => e.category === cat).length,
  })).filter((x) => x.n > 0)

  return (
    <div className="grid wide">
      <Panel
        title="Karma reconciliation"
        className="span-all"
        actions={<span className={`recon-status ${r.status}`}>{STATUS_TEXT[r.status]}</span>}
      >
        <div className="recon">
          <Cell label="Total Karma Earned" value={r.earned} />
          <Cell
            label="Total Karma Spent"
            value={r.spent}
            note={`${r.entries} ${r.entries === 1 ? 'entry' : 'entries'}`}
          />
          <Cell label="Unspent Karma" value={r.unspent} />
          <Cell label="Expected Unspent" value={r.expected} note="Earned − Spent" />
          <Cell
            label="Difference"
            value={r.difference === null ? null : fmtSigned(r.difference)}
            note="Unspent − Expected"
            tone={r.difference === null ? '' : r.difference === 0 ? 'ok' : 'bad'}
          />
        </div>
        {r.status === 'needsInput' && (
          <div className="banner warn" style={{ marginTop: 8 }}>
            Enter {r.earned === null ? 'Total Karma earned' : ''}
            {r.earned === null && r.unspent === null ? ' and ' : ''}
            {r.unspent === null ? 'Available (unspent) Karma' : ''} on the Karma & ¥ tab to
            reconcile.
          </div>
        )}
        {r.entriesWithoutCost > 0 && (
          <div className="banner warn" style={{ marginTop: 8 }}>
            {r.entriesWithoutCost} entr{r.entriesWithoutCost === 1 ? 'y has' : 'ies have'} no Karma
            Spent yet and {r.entriesWithoutCost === 1 ? 'is' : 'are'} not included in the total.
          </div>
        )}
        <p className="hint">
          Earned and Unspent are the character’s stored values (edit them on the Karma & ¥ tab).
          This log never changes them, never deducts Karma and never upgrades skills or attributes —
          a difference simply shows what is not logged (or not yet updated) so far.
        </p>
        {byCategory.length > 0 && (
          <dl className="stats">
            {byCategory.map((x) => (
              <div key={x.cat}>
                <dt>{x.cat}</dt>
                <dd>{x.sum}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <Panel
        title="Karma History"
        className="span-all"
        actions={
          c.karmaHistory.length > 1 ? (
            <button
              className="btn small"
              onClick={() =>
                update((x) => void (x.karmaHistory = sortedKarmaHistory(x.karmaHistory)))
              }
            >
              Sort by date (newest first)
            </button>
          ) : null
        }
        hint="Log purchases one at a time — both new ones and earlier ones you back-enter. “Earlier purchase” only labels the entry; no entry ever deducts Karma."
      >
        <ItemList<KarmaEntry>
          items={c.karmaHistory}
          onChange={(v) => update((x) => void (x.karmaHistory = v))}
          make={() => ({
            date: todayIso(),
            category: 'Skill',
            name: '',
            before: '',
            after: '',
            karmaSpent: null,
            entryType: 'new',
            comment: '',
            source: '',
            fromLedgerId: null,
          })}
          emptyText="No Karma spending logged yet."
          addLabel="Add Karma entry"
          title={(e) => (
            <>
              <span className="hint num">{e.date || 'no date'}</span>{' '}
              <span className="badge magenta">{e.category}</span>{' '}
              {e.entryType === 'historical' && <span className="badge">earlier</span>}{' '}
              {e.name || 'Unnamed entry'}
            </>
          )}
          columns={[
            {
              label: '',
              get: (e) => (e.before || e.after ? `${e.before || '—'} → ${e.after || '—'}` : '—'),
            },
            {
              label: 'Karma',
              get: (e) =>
                e.karmaSpent === null ? <span className="neg">missing</span> : e.karmaSpent,
            },
          ]}
          fields={[
            { key: 'date', label: 'Date (YYYY-MM-DD)', type: 'text' },
            {
              key: 'category',
              label: 'Category',
              type: 'select',
              options: KARMA_CATEGORIES.map((k) => ({ value: k, label: k })),
            },
            { key: 'name', label: 'Purchased / improved', type: 'text', full: true },
            { key: 'before', label: 'Before (number or text)', type: 'text' },
            { key: 'after', label: 'After (number or text)', type: 'text' },
            { key: 'karmaSpent', label: 'Karma Spent', type: 'int' },
            {
              key: 'entryType',
              label: 'Recorded as',
              type: 'select',
              options: [
                { value: 'new', label: 'New purchase' },
                { value: 'historical', label: 'Earlier purchase (back-entered)' },
              ],
            },
            { key: 'source', label: 'Source / page', type: 'text' },
            { key: 'comment', label: 'Comment', type: 'textarea' },
          ]}
        />
      </Panel>
    </div>
  )
}

function Cell(props: {
  label: string
  value: number | string | null
  note?: string
  tone?: '' | 'ok' | 'bad'
}) {
  return (
    <div className="cell">
      <span className="lbl">{props.label}</span>
      <span
        className="val"
        style={{
          color:
            props.tone === 'ok' ? 'var(--green)' : props.tone === 'bad' ? 'var(--red)' : undefined,
        }}
      >
        {props.value === null ? <span className="hint">needs input</span> : props.value}
      </span>
      {props.note && <span className="hint"> {props.note}</span>}
    </div>
  )
}
