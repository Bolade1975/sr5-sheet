import { useState } from 'react'
import { newId } from '../../domain/factory'
import { useChar } from '../../state/store'
import { ConfirmButton, Panel } from '../../ui/components'
import { NumberField, Segmented, TextField } from '../../ui/fields'
import { fmtNuyen, fmtSigned, todayIso } from '../../ui/format'

/**
 * Karma & Nuyen. Balances are stored values; adding a history entry also
 * adjusts the balance (positive Karma also raises Total Karma earned).
 * Deleting an entry does NOT change balances — it only removes the record.
 */
export function LedgerTab() {
  const { c, update } = useChar()
  const [currency, setCurrency] = useState<'karma' | 'nuyen'>('karma')
  const [amount, setAmount] = useState<number | null>(null)
  const [desc, setDesc] = useState('')
  const [date, setDate] = useState(todayIso())
  const [applyBalance, setApplyBalance] = useState(true)

  const add = () => {
    if (amount === null || amount === 0) return
    update((x) => {
      x.ledger.unshift({ id: newId(), date, currency, amount, description: desc.trim() })
      if (applyBalance) {
        if (currency === 'nuyen') x.resources.nuyen = (x.resources.nuyen ?? 0) + amount
        else {
          x.resources.karma = (x.resources.karma ?? 0) + amount
          if (amount > 0) x.resources.karmaTotal = (x.resources.karmaTotal ?? 0) + amount
        }
      }
    })
    setAmount(null)
    setDesc('')
  }

  return (
    <div className="grid">
      <Panel title="Resources">
        <div className="fields">
          <NumberField
            label="Nuyen (¥)"
            value={c.resources.nuyen}
            onChange={(v) => update((x) => void (x.resources.nuyen = v))}
          />
          <NumberField
            label="Available Karma"
            value={c.resources.karma}
            onChange={(v) => update((x) => void (x.resources.karma = v))}
          />
          <NumberField
            label="Total Karma earned"
            value={c.resources.karmaTotal}
            onChange={(v) => update((x) => void (x.resources.karmaTotal = v))}
          />
        </div>
      </Panel>

      <Panel title="Add history entry">
        <div className="stack">
          <Segmented
            label="Currency"
            value={currency}
            onChange={setCurrency}
            options={[
              { value: 'karma', label: 'Karma' },
              { value: 'nuyen', label: 'Nuyen' },
            ]}
          />
          <div className="fields">
            <TextField label="Date" value={date} onChange={setDate} />
            <NumberField label="Change (+/−)" value={amount} onChange={setAmount} />
            <TextField label="Description" value={desc} onChange={setDesc} className="full" />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={applyBalance}
              onChange={(e) => setApplyBalance(e.target.checked)}
            />
            <span>Also adjust the balance above</span>
          </label>
          <div>
            <button
              className="btn primary"
              disabled={amount === null || amount === 0}
              onClick={add}
            >
              Add entry
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="History" className="span-all">
        {c.ledger.length === 0 && <div className="empty">No entries yet.</div>}
        <div className="items">
          {c.ledger.map((e) => (
            <div key={e.id} className="item row" style={{ padding: '4px 4px 4px 12px' }}>
              <span className="num hint" style={{ minWidth: 92 }}>
                {e.date}
              </span>
              <span className={`badge ${e.currency === 'karma' ? 'magenta' : 'cyan'}`}>
                {e.currency === 'karma' ? 'Karma' : '¥'}
              </span>
              <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{e.description || '—'}</span>
              <b className="num" style={{ color: e.amount < 0 ? 'var(--red)' : 'var(--green)' }}>
                {e.currency === 'nuyen' ? fmtNuyen(e.amount) : fmtSigned(e.amount)}
              </b>
              <ConfirmButton
                label="✕"
                confirmLabel="Delete?"
                onConfirm={() =>
                  update((x) => void (x.ledger = x.ledger.filter((y) => y.id !== e.id)))
                }
              />
            </div>
          ))}
        </div>
        <p className="hint">Deleting an entry only removes the record; balances are not changed.</p>
      </Panel>
    </div>
  )
}
