import { useState } from 'react'
import { newId } from '../../domain/factory'
import { ATTRIBUTE_KEYS, type CustomPool, type PoolPart } from '../../domain/schema'
import { ATTRIBUTE_LABELS } from '../../rules/engine'
import { activeWeaponPools, customPool, generalPools, type Pool } from '../../rules/pools'
import { useChar } from '../../state/store'
import { ConfirmButton, Panel, PoolCard } from '../../ui/components'
import { Check, NumberField, Select, TextField } from '../../ui/fields'

const GROUP_TITLES: Record<Pool['group'], string> = {
  defense: 'Defense',
  resistance: 'Resistance',
  attribute: 'Attribute & Perception tests',
  skill: 'Skills',
  weapon: 'Weapons',
  magic: 'Magic',
  matrix: 'Matrix / Resonance',
  rigger: 'Rigging',
  custom: 'Custom',
}

export function PoolsTab() {
  const { c, update } = useChar()
  const pools = generalPools(c)
  const groups = [...new Set(pools.map((p) => p.group))]
  const isFav = (p: Pool) => c.favoritePools.includes(p.id.replace(/^pool\./, ''))
  const toggleFav = (p: Pool) =>
    update((x) => {
      const key = p.id.replace(/^pool\./, '')
      x.favoritePools = x.favoritePools.includes(key)
        ? x.favoritePools.filter((k) => k !== key)
        : [...x.favoritePools, key]
    })

  return (
    <div className="grid wide">
      {groups.map((g) => (
        <Panel
          key={g}
          title={GROUP_TITLES[g]}
          module={g === 'magic' || g === 'matrix' || g === 'rigger'}
        >
          <div className="pool-list">
            {pools
              .filter((p) => p.group === g)
              .map((p) => (
                <div
                  key={p.id}
                  className="row"
                  style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <PoolCard pool={p} />
                  </div>
                  <button
                    className="btn small ghost"
                    aria-pressed={isFav(p)}
                    aria-label="Pin to Play dashboard"
                    style={{
                      color: isFav(p) ? 'var(--amber)' : 'var(--faint)',
                      fontSize: '1.2rem',
                    }}
                    onClick={() => toggleFav(p)}
                  >
                    {isFav(p) ? '★' : '☆'}
                  </button>
                </div>
              ))}
          </div>
        </Panel>
      ))}

      <Panel title="Weapon attacks (active weapons)">
        <div className="pool-list">
          {activeWeaponPools(c).map((p) => (
            <PoolCard key={p.id} pool={p} />
          ))}
          {activeWeaponPools(c).length === 0 && (
            <div className="empty">Mark weapons as active on the Gear tab.</div>
          )}
        </div>
      </Panel>

      <Panel
        title="Custom pools"
        className="span-all"
        hint="Built from attributes, skills and fixed bonuses — no free-text formulas. Mark ★ to show on the Play dashboard."
        actions={
          <button
            className="btn primary"
            onClick={() =>
              update(
                (x) =>
                  void x.customPools.push({
                    id: newId(),
                    name: 'New pool',
                    parts: [],
                    limit: 'none',
                    customLimit: null,
                    applyWounds: true,
                    conditions: '',
                    favorite: true,
                  }),
              )
            }
          >
            + New pool
          </button>
        }
      >
        <div className="grid">
          {c.customPools.map((cp) => (
            <CustomPoolEditor key={cp.id} cp={cp} />
          ))}
          {c.customPools.length === 0 && <div className="empty">No custom pools yet.</div>}
        </div>
      </Panel>
    </div>
  )
}

function CustomPoolEditor(props: { cp: CustomPool }) {
  const { c, update } = useChar()
  const { cp } = props
  const [addKind, setAddKind] = useState<PoolPart['kind']>('attribute')
  const set = (patch: Partial<CustomPool>) =>
    update(
      (x) =>
        void (x.customPools = x.customPools.map((p) => (p.id === cp.id ? { ...p, ...patch } : p))),
    )
  const setPart = (i: number, part: PoolPart) =>
    set({ parts: cp.parts.map((p, j) => (j === i ? part : p)) })
  return (
    <div className="panel stack">
      <PoolCard pool={customPool(c, cp)} />
      <TextField label="Pool name" value={cp.name} onChange={(v) => set({ name: v })} />
      {cp.parts.map((part, i) => (
        <div className="row" key={i}>
          {part.kind === 'attribute' && (
            <Select
              label="Attribute"
              value={part.key}
              onChange={(v) => setPart(i, { kind: 'attribute', key: v })}
              options={ATTRIBUTE_KEYS.map((k) => ({ value: k, label: ATTRIBUTE_LABELS[k] }))}
              className="spacer"
            />
          )}
          {part.kind === 'skill' && (
            <Select
              label="Skill"
              value={part.skillId}
              onChange={(v) => setPart(i, { kind: 'skill', skillId: v })}
              options={[
                { value: '', label: '— choose —' },
                ...c.skills.map((s) => ({ value: s.id, label: s.name })),
              ]}
              className="spacer"
            />
          )}
          {part.kind === 'constant' && (
            <>
              <TextField
                label="Label"
                value={part.label}
                onChange={(v) => setPart(i, { ...part, label: v })}
                className="spacer"
              />
              <NumberField
                label="Dice"
                value={part.value}
                allowNull={false}
                onChange={(v) => setPart(i, { ...part, value: v ?? 0 })}
              />
            </>
          )}
          <button
            className="btn small danger"
            aria-label="Remove part"
            onClick={() => set({ parts: cp.parts.filter((_, j) => j !== i) })}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="row">
        <Select
          label="Add part"
          value={addKind}
          onChange={setAddKind}
          options={[
            { value: 'attribute', label: 'Attribute' },
            { value: 'skill', label: 'Skill' },
            { value: 'constant', label: 'Fixed bonus/penalty' },
          ]}
        />
        <button
          className="btn"
          style={{ alignSelf: 'flex-end' }}
          onClick={() => {
            const part: PoolPart =
              addKind === 'attribute'
                ? { kind: 'attribute', key: 'AGI' }
                : addKind === 'skill'
                  ? { kind: 'skill', skillId: c.skills[0]?.id ?? '' }
                  : { kind: 'constant', value: 0, label: 'Bonus' }
            set({ parts: [...cp.parts, part] })
          }}
        >
          + Add
        </button>
      </div>
      <div className="fields">
        <Select
          label="Limit"
          value={cp.limit}
          onChange={(v) => set({ limit: v })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'physical', label: 'Physical' },
            { value: 'mental', label: 'Mental' },
            { value: 'social', label: 'Social' },
            { value: 'astral', label: 'Astral' },
            { value: 'custom', label: 'Custom value' },
          ]}
        />
        {cp.limit === 'custom' && (
          <NumberField
            label="Limit value"
            value={cp.customLimit}
            onChange={(v) => set({ customLimit: v })}
          />
        )}
        <TextField
          label="Conditions / when it applies"
          value={cp.conditions}
          onChange={(v) => set({ conditions: v })}
          className="full"
        />
      </div>
      <div className="row">
        <Check
          label="Apply wound & all-test modifiers"
          checked={cp.applyWounds}
          onChange={(v) => set({ applyWounds: v })}
        />
        <Check
          label="★ Play dashboard"
          checked={cp.favorite}
          onChange={(v) => set({ favorite: v })}
        />
        <span className="spacer" />
        <ConfirmButton
          label="Delete pool"
          onConfirm={() =>
            update((x) => void (x.customPools = x.customPools.filter((p) => p.id !== cp.id)))
          }
        />
      </div>
    </div>
  )
}
