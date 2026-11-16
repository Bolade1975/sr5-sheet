import { useEffect, useState, type ReactNode } from 'react'
import type { Derived } from '../rules/engine'
import type { Pool } from '../rules/pools'
import { formatRef } from '../rules/references'
import { useChar } from '../state/store'
import { NumberField } from './fields'
import { fmtSigned } from './format'

export function Panel(props: {
  title: string
  children: ReactNode
  actions?: ReactNode
  module?: boolean
  className?: string
  hint?: ReactNode
}) {
  return (
    <section className={`panel ${props.module ? 'module' : ''} ${props.className ?? ''}`}>
      <div className="panel-head">
        <h2>{props.title}</h2>
        {props.actions}
      </div>
      {props.hint && (
        <p className="hint" style={{ marginTop: -4 }}>
          {props.hint}
        </p>
      )}
      {props.children}
    </section>
  )
}

export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [props])
  return (
    <div className="backdrop" onClick={props.onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ marginBottom: 6 }}>
          <h3 style={{ flex: 1 }}>{props.title}</h3>
          <button className="btn small" onClick={props.onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {props.children}
      </div>
    </div>
  )
}

/** Two-step delete/confirm button; no hover required. */
export function ConfirmButton(props: {
  label: string
  confirmLabel?: string
  onConfirm: () => void
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={`btn danger ${props.className ?? ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false)
          props.onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? (props.confirmLabel ?? 'Tap again to confirm') : props.label}
    </button>
  )
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'permanent':
      return 'permanent'
    case 'situational':
      return 'situational'
    case 'wound':
      return 'wounds'
    case 'rule':
      return 'rule'
    default:
      return ''
  }
}

/** Breakdown of any derived value with override controls. */
export function Breakdown(props: {
  d: Derived
  limit?: Pool['limit']
  specs?: string[]
  conditions?: string
  allowOverride?: boolean
}) {
  const { c, update } = useChar()
  const { d } = props
  const [draft, setDraft] = useState<number | null>(d.overridden ? d.value : d.auto)
  return (
    <div className="stack">
      {d.missing.length > 0 && (
        <div className="banner warn">
          <b>Incomplete:</b> {d.missing.join(', ')}. The automatic value is shown as “—” until this
          is filled in.
        </div>
      )}
      <table className="breakdown">
        <tbody>
          {d.parts.map((p, i) => (
            <tr key={i}>
              <td>
                {p.label}
                {kindLabel(p.kind) && <span className="kind">{kindLabel(p.kind)}</span>}
              </td>
              <td className="v">{i === 0 && p.kind === 'base' ? p.value : fmtSigned(p.value)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Automatic total</td>
            <td className="v">{d.auto ?? '—'}</td>
          </tr>
          {d.overridden && (
            <tr className="total">
              <td>
                <span className="badge">OVERRIDE</span> Manual value
              </td>
              <td className="v">{d.value}</td>
            </tr>
          )}
        </tbody>
      </table>
      {props.limit && (
        <div>
          <b>Limit:</b> {props.limit.label}{' '}
          {props.limit.value !== null ? `[${props.limit.value}]` : ''}
          <div className="hint">Limits cap hits, they are never extra dice.</div>
        </div>
      )}
      {props.specs && props.specs.length > 0 && (
        <div>
          <b>Specializations</b> (only when relevant, one at a time): {props.specs.join(', ')}
        </div>
      )}
      {props.conditions && (
        <div>
          <b>Conditions:</b> {props.conditions}
        </div>
      )}
      {d.conditional.length > 0 && (
        <div>
          <b>Conditional (not included):</b>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {d.conditional.map((m, i) => (
              <li key={i}>
                {fmtSigned(m.value)} {m.label}
                {m.condition ? ` — ${m.condition}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.notes.map((n, i) => (
        <div key={i} className="hint">
          {n}
        </div>
      ))}
      {d.ref && (
        <div className="ref">
          Rule: {d.ref.title} — {formatRef(d.ref)}
          {d.ref.note ? ` · ${d.ref.note}` : ''}
        </div>
      )}
      {props.allowOverride !== false && (
        <div className="panel" style={{ marginTop: 6 }}>
          <div className="row">
            <NumberField
              label="Manual override"
              value={draft}
              onChange={setDraft}
              className="spacer"
            />
            <button
              className="btn primary"
              disabled={draft === null}
              onClick={() =>
                update((x) => {
                  if (draft !== null) x.overrides[d.id] = draft
                })
              }
            >
              Set override
            </button>
            {c.overrides[d.id] !== undefined && (
              <button
                className="btn"
                onClick={() =>
                  update((x) => {
                    delete x.overrides[d.id]
                  })
                }
              >
                Back to automatic
              </button>
            )}
          </div>
          <div className="hint">
            Overrides replace the calculated value everywhere (including the PDF) until removed.
          </div>
        </div>
      )}
    </div>
  )
}

/** Compact tappable readout of a derived value. */
export function Readout(props: {
  d: Derived
  label?: string
  suffix?: string
  display?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { d } = props
  return (
    <>
      <button
        type="button"
        className={`readout ${d.overridden ? 'overridden' : ''}`}
        onClick={() => setOpen(true)}
      >
        <span className="lbl">
          {props.label ?? d.label} {d.overridden && <span className="badge">OVERRIDE</span>}
        </span>
        {d.value === null ? (
          <span className="val missing">— needs input</span>
        ) : (
          <span className="val num">
            {props.display ?? d.value}
            {props.suffix}
          </span>
        )}
      </button>
      {open && (
        <Sheet title={props.label ?? d.label} onClose={() => setOpen(false)}>
          <Breakdown d={d} />
        </Sheet>
      )}
    </>
  )
}

export function PoolCard(props: { pool: Pool; extra?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const p = props.pool
  return (
    <>
      <button
        type="button"
        className={`pool ${p.overridden ? 'overridden' : ''}`}
        onClick={() => setOpen(true)}
      >
        <span className="pool-name">
          {p.label} {p.overridden && <span className="badge">OVERRIDE</span>}
        </span>
        <span className="pool-total num">
          {p.value ?? '—'}
          {p.limit && <small>[{p.limit.value ?? p.limit.label}]</small>}
        </span>
        <span className="pool-meta">
          {p.missing.length > 0 && <span className="badge red">needs: {p.missing.join(', ')}</span>}
          {p.specializations.map((s) => (
            <span key={s} className="badge cyan">
              {s}
            </span>
          ))}
          {p.conditional.map((m, i) => (
            <span key={i} className="badge magenta">
              {fmtSigned(m.value)} if {m.condition || m.label}
            </span>
          ))}
          {p.parts.some((x) => x.kind === 'wound') && <span>incl. wounds</span>}
          {p.parts.some((x) => x.kind === 'situational') && <span>incl. situational</span>}
          {props.extra}
        </span>
      </button>
      {open && (
        <Sheet title={p.label} onClose={() => setOpen(false)}>
          <Breakdown d={p} limit={p.limit} specs={p.specializations} conditions={p.conditions} />
        </Sheet>
      )}
    </>
  )
}
