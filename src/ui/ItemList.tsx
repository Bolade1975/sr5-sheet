import { useState, type ReactNode } from 'react'
import { newId } from '../domain/factory'
import { ConfirmButton } from './components'
import { Check, ListField, NumberField, Select, TextField } from './fields'

/**
 * Generic expandable list editor used for weapons, gear, contacts, spells…
 * Rows show a compact, fully wrapped summary; tapping a row opens its fields.
 * There is no fixed maximum number of entries.
 */
export type FieldDef =
  | { key: string; label: string; type: 'text' | 'textarea'; full?: boolean }
  | { key: string; label: string; type: 'int' | 'num' }
  | { key: string; label: string; type: 'bool' }
  | { key: string; label: string; type: 'list'; full?: boolean }
  | {
      key: string
      label: string
      type: 'select'
      options: readonly { value: string; label: string }[]
    }

export type Column<T> = { label: string; get: (item: T) => ReactNode }

type Rec = Record<string, unknown>

export function ItemList<T extends { id: string }>(props: {
  items: T[]
  onChange: (items: T[]) => void
  make: () => Omit<T, 'id'>
  fields: FieldDef[]
  title: (item: T) => ReactNode
  columns?: Column<T>[]
  addLabel?: string
  extra?: (item: T, set: (patch: Partial<T>) => void) => ReactNode
  emptyText?: string
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const set = (id: string, patch: Partial<T>) =>
    props.onChange(props.items.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  return (
    <div className="items">
      {props.items.length === 0 && (
        <div className="empty">{props.emptyText ?? 'Nothing added yet.'}</div>
      )}
      {props.items.map((it, idx) => {
        const open = openId === it.id
        return (
          <div className="item" key={it.id}>
            <button
              type="button"
              className="item-summary"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : it.id)}
            >
              <span className="item-title">{props.title(it)}</span>
              {props.columns && (
                <span className="item-cols">
                  {props.columns.map((col) => (
                    <span key={col.label}>
                      {col.label} <b>{col.get(it)}</b>
                    </span>
                  ))}
                </span>
              )}
              <span aria-hidden style={{ color: 'var(--faint)', padding: '0 6px' }}>
                {open ? '▾' : '▸'}
              </span>
            </button>
            {open && (
              <div className="item-body stack">
                <div className="fields">
                  {props.fields.map((f) => (
                    <FieldEditor
                      key={f.key}
                      def={f}
                      item={it as unknown as Rec}
                      onSet={(v) => set(it.id, { [f.key]: v } as Partial<T>)}
                    />
                  ))}
                </div>
                {props.extra?.(it, (patch) => set(it.id, patch))}
                <div className="row">
                  <button
                    className="btn small"
                    disabled={idx === 0}
                    onClick={() => {
                      const arr = [...props.items]
                      ;[arr[idx - 1], arr[idx]] = [arr[idx]!, arr[idx - 1]!]
                      props.onChange(arr)
                    }}
                  >
                    ↑ Move up
                  </button>
                  <button
                    className="btn small"
                    disabled={idx === props.items.length - 1}
                    onClick={() => {
                      const arr = [...props.items]
                      ;[arr[idx + 1], arr[idx]] = [arr[idx]!, arr[idx + 1]!]
                      props.onChange(arr)
                    }}
                  >
                    ↓ Move down
                  </button>
                  <span className="spacer" />
                  <ConfirmButton
                    label="Delete"
                    onConfirm={() => props.onChange(props.items.filter((x) => x.id !== it.id))}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
      <div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const id = newId()
            props.onChange([...props.items, { ...props.make(), id } as T])
            setOpenId(id)
          }}
        >
          + {props.addLabel ?? 'Add'}
        </button>
      </div>
    </div>
  )
}

function FieldEditor(props: { def: FieldDef; item: Rec; onSet: (v: unknown) => void }) {
  const { def, item } = props
  const v = item[def.key]
  switch (def.type) {
    case 'text':
    case 'textarea':
      return (
        <TextField
          label={def.label}
          value={typeof v === 'string' ? v : ''}
          onChange={props.onSet}
          multiline={def.type === 'textarea'}
          className={def.full || def.type === 'textarea' ? 'full' : ''}
        />
      )
    case 'int':
    case 'num':
      return (
        <NumberField
          label={def.label}
          value={typeof v === 'number' ? v : null}
          integer={def.type === 'int'}
          onChange={props.onSet}
        />
      )
    case 'bool':
      return <Check label={def.label} checked={v === true} onChange={props.onSet} />
    case 'list':
      return (
        <ListField
          label={def.label}
          value={Array.isArray(v) ? (v as string[]) : []}
          onChange={props.onSet}
          className={def.full ? 'full' : ''}
        />
      )
    case 'select':
      return (
        <Select
          label={def.label}
          value={typeof v === 'string' ? v : ''}
          options={def.options}
          onChange={props.onSet}
        />
      )
  }
}
