import { useState } from 'react'
import type { Modifier } from '../../domain/schema'
import { activeOverrides } from '../../rules/summary'
import { targetLabel, targetOptions } from '../../rules/targets'
import { useChar } from '../../state/store'
import { ConfirmButton, Panel, Sheet } from '../../ui/components'
import { fmtSigned } from '../../ui/format'
import { ItemList } from '../../ui/ItemList'

export function ModifiersTab() {
  const { c, update } = useChar()
  const overrides = activeOverrides(c)
  return (
    <div className="grid wide">
      <Panel
        title="Named modifiers"
        className="span-all"
        hint="Permanent = always counted (ware, qualities, powers). Situational = counted only while switched on (Play tab). Conditional = never added automatically; shown as a reminder on the pools it targets. Each modifier counts once per pool even with several targets."
      >
        <ItemList
          items={c.modifiers}
          onChange={(v) => update((x) => void (x.modifiers = v))}
          make={() => ({
            name: '',
            value: 1,
            kind: 'permanent' as const,
            active: false,
            targets: [],
            condition: '',
            source: '',
            notes: '',
          })}
          title={(m) => (
            <>
              <span
                className={`badge ${m.kind === 'permanent' ? 'cyan' : m.kind === 'situational' ? '' : 'magenta'}`}
              >
                {m.kind}
              </span>{' '}
              <b>{fmtSigned(m.value)}</b> {m.name || 'Unnamed modifier'}
              {m.kind === 'situational' && m.active && (
                <span className="badge" style={{ marginLeft: 6 }}>
                  ON
                </span>
              )}
              <div className="hint">
                → {m.targets.map((t) => targetLabel(c, t)).join(', ') || 'no target selected'}
              </div>
            </>
          )}
          addLabel="Add modifier"
          fields={[
            { key: 'name', label: 'Name', type: 'text', full: true },
            { key: 'value', label: 'Value (+/−)', type: 'int' },
            {
              key: 'kind',
              label: 'Kind',
              type: 'select',
              options: [
                { value: 'permanent', label: 'Permanent' },
                { value: 'situational', label: 'Situational (toggle)' },
                { value: 'conditional', label: 'Conditional (reminder only)' },
              ],
            },
            { key: 'active', label: 'Active now (situational)', type: 'bool' },
            { key: 'condition', label: 'Condition (when it applies)', type: 'text', full: true },
            { key: 'source', label: 'Source (gear/quality/power, page)', type: 'text' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          extra={(m, set) => <TargetPicker m={m} set={(targets) => set({ targets })} />}
        />
      </Panel>

      <Panel
        title="Active manual overrides"
        hint="Overrides replace calculated values and are marked OVERRIDE everywhere, including the PDF."
      >
        {overrides.length === 0 && (
          <div className="empty">No overrides — all derived values are automatic.</div>
        )}
        <div className="items">
          {overrides.map((o) => (
            <div className="item row" key={o.id} style={{ padding: '4px 4px 4px 12px' }}>
              <span style={{ flex: 1, overflowWrap: 'anywhere' }}>
                <span className="badge">OVERRIDE</span> {o.label}{' '}
                <span className="hint">(automatic: {o.auto ?? '—'})</span>
              </span>
              <b className="num">{o.value}</b>
              <ConfirmButton
                label="Back to automatic"
                confirmLabel="Tap to confirm"
                onConfirm={() => update((x) => void delete x.overrides[o.id])}
              />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function TargetPicker(props: { m: Modifier; set: (t: string[]) => void }) {
  const { c } = useChar()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const opts = targetOptions(c)
  const groups = [...new Set(opts.map((o) => o.group))]
  const toggle = (k: string) =>
    props.set(
      props.m.targets.includes(k)
        ? props.m.targets.filter((t) => t !== k)
        : [...props.m.targets, k],
    )
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row">
        <b>Applies to:</b>
        {props.m.targets.map((t) => (
          <button
            key={t}
            className="btn small on"
            onClick={() => toggle(t)}
            aria-label={`Remove target ${targetLabel(c, t)}`}
          >
            {targetLabel(c, t)} ✕
          </button>
        ))}
        <button className="btn small" onClick={() => setOpen(true)}>
          + Choose targets
        </button>
      </div>
      {open && (
        <Sheet title="Modifier targets" onClose={() => setOpen(false)}>
          <input
            className="input"
            placeholder="Filter…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter targets"
          />
          {groups.map((g) => {
            const list = opts.filter(
              (o) => o.group === g && o.label.toLowerCase().includes(q.toLowerCase()),
            )
            if (!list.length) return null
            return (
              <div key={g} style={{ marginTop: 10 }}>
                <div className="hint" style={{ textTransform: 'uppercase' }}>
                  {g}
                </div>
                <div className="chips">
                  {list.map((o) => (
                    <button
                      key={o.key}
                      className={`btn small ${props.m.targets.includes(o.key) ? 'on' : ''}`}
                      aria-pressed={props.m.targets.includes(o.key)}
                      onClick={() => toggle(o.key)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
