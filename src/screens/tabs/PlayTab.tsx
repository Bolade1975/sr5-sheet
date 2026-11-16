import { useState } from 'react'
import { newId } from '../../domain/factory'
import type { Modifier } from '../../domain/schema'
import {
  armorBreakdown,
  armorValue,
  conditionMonitor,
  edge,
  initiative,
  matrixMonitor,
  overflow,
  relevantInitModes,
  vehicleMonitor,
  woundModifier,
} from '../../rules/engine'
import {
  activeWeaponPools,
  favoritePools,
  meleeWeaponPool,
  rangedWeaponPool,
} from '../../rules/pools'
import { targetLabel } from '../../rules/targets'
import { useChar } from '../../state/store'
import { Panel, PoolCard, Readout } from '../../ui/components'
import { NumberField, TextField } from '../../ui/fields'
import { fmtSigned } from '../../ui/format'

/** A condition track of tappable boxes. Tap box n to fill up to n; tap the last filled box to clear it. */
export function Track(props: {
  boxes: number | null
  damage: number
  onChange: (n: number) => void
  kind: 'phys' | 'stun' | 'over' | 'matrix'
  label: string
  woundMarks?: boolean
}) {
  if (props.boxes === null)
    return <div className="hint">{props.label}: box count needs input (see Core tab).</div>
  const n = Math.max(0, props.boxes)
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row">
        <b style={{ flex: 1 }}>{props.label}</b>
        <span className="num">
          {props.damage}/{n}
        </span>
        <button
          className="btn small"
          aria-label={`Heal one ${props.label} box`}
          onClick={() => props.onChange(Math.max(0, props.damage - 1))}
        >
          −1
        </button>
        <button
          className="btn small"
          aria-label={`Take one ${props.label} box`}
          onClick={() => props.onChange(Math.min(n, props.damage + 1))}
        >
          +1
        </button>
      </div>
      <div className="track" role="group" aria-label={props.label}>
        {Array.from({ length: n }, (_, i) => {
          const filled = i < props.damage
          const mark = props.woundMarks && (i + 1) % 3 === 0 ? `−${(i + 1) / 3}` : ''
          return (
            <button
              key={i}
              className={`box ${props.kind === 'stun' ? 'stun' : props.kind === 'over' ? 'over' : ''} ${filled ? 'filled' : ''} ${mark ? 'mark' : ''}`}
              data-mark={mark}
              aria-label={`${props.label} box ${i + 1}${filled ? ' (filled)' : ''}`}
              onClick={() => props.onChange(props.damage === i + 1 ? i : i + 1)}
            />
          )
        })}
      </div>
    </div>
  )
}

export function PlayTab() {
  const { c, update } = useChar()
  const e = edge(c)
  const wound = woundModifier(c)
  const favs = favoritePools(c)
  const situational = c.modifiers.filter((m) => m.kind === 'situational')
  const physBoxes = conditionMonitor(c, 'physical').value
  const stunBoxes = conditionMonitor(c, 'stun').value
  const overBoxes = overflow(c).value

  return (
    <div className="grid">
      <Panel title="Initiative">
        <div className="readouts">
          {relevantInitModes(c).map((m) => {
            const i = initiative(c, m)
            return (
              <Readout
                key={m}
                d={i.score}
                label={i.score.label.replace(' Initiative', '')}
                display={
                  i.score.value === null ? undefined : `${i.score.value} + ${i.dice.value ?? '?'}D6`
                }
              />
            )
          })}
        </div>
        {wound.value !== null && wound.value !== 0 && (
          <p className="hint">Includes wound modifier {fmtSigned(wound.value)}.</p>
        )}
      </Panel>

      <Panel
        title="Edge"
        actions={
          <button className="btn small" onClick={() => update((x) => void (x.play.edgeSpent = 0))}>
            Refresh all
          </button>
        }
      >
        {e.total === null ? (
          <div className="hint">Enter Edge on the Core tab.</div>
        ) : (
          <>
            <div className="pips" role="group" aria-label="Edge points">
              {Array.from({ length: e.total }, (_, i) => {
                const spent = i >= (e.remaining ?? 0)
                return (
                  <button
                    key={i}
                    className={`pip ${spent ? 'spent' : ''}`}
                    aria-label={spent ? `Regain Edge point ${i + 1}` : `Spend Edge point ${i + 1}`}
                    onClick={() =>
                      update(
                        (x) =>
                          void (x.play.edgeSpent = spent
                            ? Math.max(0, x.play.edgeSpent - 1)
                            : Math.min(e.total ?? 0, x.play.edgeSpent + 1)),
                      )
                    }
                  />
                )
              })}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <span>
                Remaining <b className="num">{e.remaining}</b> / {e.total}
              </span>
              <span className="spacer" />
              <button
                className="btn"
                disabled={(e.remaining ?? 0) === 0}
                onClick={() => update((x) => void (x.play.edgeSpent += 1))}
              >
                Spend 1 Edge
              </button>
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Condition Monitor"
        className="span-all"
        actions={
          <span className={`badge ${wound.value ? 'red' : 'cyan'}`}>
            Wound modifier {fmtSigned(wound.value ?? 0)}
          </span>
        }
      >
        <div className="grid">
          <Track
            label="Physical"
            kind="phys"
            woundMarks
            boxes={physBoxes}
            damage={c.play.physicalDamage}
            onChange={(n) => update((x) => void (x.play.physicalDamage = n))}
          />
          <Track
            label="Stun"
            kind="stun"
            woundMarks
            boxes={stunBoxes}
            damage={c.play.stunDamage}
            onChange={(n) => update((x) => void (x.play.stunDamage = n))}
          />
          <Track
            label="Overflow"
            kind="over"
            boxes={overBoxes}
            damage={c.play.overflowDamage}
            onChange={(n) => update((x) => void (x.play.overflowDamage = n))}
          />
        </div>
        <p className="hint">
          Excess Stun carries over as 1 Physical box per 2 full Stun boxes; overflow beyond Body
          means death (p. 170). Wound modifiers are not applied to damage resistance.
        </p>
      </Panel>

      <Panel
        title="Favorite pools"
        className="span-all"
        hint="Pin pools on the Pools tab (★) or skills on the Skills tab."
      >
        <div className="pool-list">
          {favs.map((p) => (
            <PoolCard key={p.id} pool={p} />
          ))}
          {favs.length === 0 && <div className="empty">No favorites pinned.</div>}
        </div>
      </Panel>

      <Panel title="Weapons & ammo" className="span-all">
        <div className="grid">
          {c.rangedWeapons
            .filter((w) => w.active)
            .map((w) => (
              <div key={w.id} className="panel stack">
                <PoolCard
                  pool={rangedWeaponPool(c, w)}
                  extra={
                    <span>
                      DV {w.damage || '—'} · AP {w.ap || '—'} · {w.mode || '—'} · RC {w.rc || '—'}
                    </span>
                  }
                />
                <div className="row">
                  <span>
                    Ammo{' '}
                    <b className="num" style={{ fontSize: '1.4rem' }}>
                      {w.ammoCurrent ?? '—'}
                    </b>{' '}
                    / {w.ammoCapacity ?? '—'}
                  </span>
                  <span className="hint">{w.ammoType}</span>
                  <span className="spacer" />
                  {[1, 3, 6, 10].map((n) => (
                    <button
                      key={n}
                      className="btn small"
                      disabled={(w.ammoCurrent ?? 0) < n}
                      onClick={() =>
                        update(
                          (x) =>
                            void (x.rangedWeapons = x.rangedWeapons.map((y) =>
                              y.id === w.id
                                ? { ...y, ammoCurrent: Math.max(0, (y.ammoCurrent ?? 0) - n) }
                                : y,
                            )),
                        )
                      }
                    >
                      −{n}
                    </button>
                  ))}
                  <button
                    className="btn small primary"
                    disabled={w.ammoCapacity === null}
                    onClick={() =>
                      update(
                        (x) =>
                          void (x.rangedWeapons = x.rangedWeapons.map((y) =>
                            y.id === w.id ? { ...y, ammoCurrent: y.ammoCapacity } : y,
                          )),
                      )
                    }
                  >
                    Reload
                  </button>
                </div>
                <div className="fields">
                  <TextField
                    label="Loaded ammo type"
                    value={w.ammoType}
                    onChange={(v) =>
                      update(
                        (x) =>
                          void (x.rangedWeapons = x.rangedWeapons.map((y) =>
                            y.id === w.id ? { ...y, ammoType: v } : y,
                          )),
                      )
                    }
                  />
                  <TextField
                    label="Spare ammo"
                    value={w.ammoSpare}
                    onChange={(v) =>
                      update(
                        (x) =>
                          void (x.rangedWeapons = x.rangedWeapons.map((y) =>
                            y.id === w.id ? { ...y, ammoSpare: v } : y,
                          )),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          {c.meleeWeapons
            .filter((w) => w.active)
            .map((w) => (
              <div key={w.id} className="panel">
                <PoolCard
                  pool={meleeWeaponPool(c, w)}
                  extra={
                    <span>
                      Reach {w.reach ?? '—'} · DV {w.damage || '—'} · AP {w.ap || '—'}
                    </span>
                  }
                />
              </div>
            ))}
          {activeWeaponPools(c).length === 0 && (
            <div className="empty">No active weapons — mark weapons as active on the Gear tab.</div>
          )}
        </div>
      </Panel>

      <ArmorPanel />
      <SituationalPanel situational={situational} />
      <ActiveEffectsPanel />
    </div>
  )
}

function ArmorPanel() {
  const { c, update } = useChar()
  const a = armorValue(c)
  const b = armorBreakdown(c)
  return (
    <Panel title="Armor">
      <div className="readouts" style={{ marginBottom: 8 }}>
        <Readout d={a} label="Armor value" />
      </div>
      {b.excess > 0 && (
        <div className="banner warn">
          Accessories exceed Strength: −{Math.floor(b.excess / 2)} Agility & Reaction.
        </div>
      )}
      <div className="stack" style={{ gap: 4 }}>
        {c.armor.map((ar) => (
          <label key={ar.id} className="check">
            <input
              type="checkbox"
              checked={ar.equipped}
              onChange={(e) =>
                update(
                  (x) =>
                    void (x.armor = x.armor.map((y) =>
                      y.id === ar.id ? { ...y, equipped: e.target.checked } : y,
                    )),
                )
              }
            />
            <span>
              {ar.name || 'Armor'} ({ar.accessory ? '+' : ''}
              {ar.rating ?? '—'})
            </span>
          </label>
        ))}
        {c.armor.length === 0 && <div className="empty">No armor on the Gear tab.</div>}
      </div>
    </Panel>
  )
}

function SituationalPanel(props: { situational: Modifier[] }) {
  const { c, update } = useChar()
  const [name, setName] = useState('')
  const [value, setValue] = useState<number | null>(-2)
  return (
    <Panel
      title="Temporary modifiers"
      hint="Toggling these never changes the character's base data."
      actions={
        <button
          className="btn small"
          onClick={() =>
            update(
              (x) =>
                void x.modifiers.forEach((m) => m.kind === 'situational' && (m.active = false)),
            )
          }
        >
          All off
        </button>
      }
    >
      <div className="stack" style={{ gap: 4 }}>
        {props.situational.map((m) => (
          <label key={m.id} className="check" style={{ alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={m.active}
              onChange={(e) =>
                update(
                  (x) =>
                    void (x.modifiers = x.modifiers.map((y) =>
                      y.id === m.id ? { ...y, active: e.target.checked } : y,
                    )),
                )
              }
            />
            <span>
              <b>{fmtSigned(m.value)}</b> {m.name || 'Modifier'}
              <span className="hint">
                {' '}
                → {m.targets.map((t) => targetLabel(c, t)).join(', ') || 'no target'}
              </span>
            </span>
          </label>
        ))}
        {props.situational.length === 0 && <div className="empty">None defined.</div>}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <TextField
          label="Quick modifier (all action tests)"
          value={name}
          onChange={setName}
          className="spacer"
        />
        <NumberField label="Dice" value={value} onChange={setValue} />
        <button
          className="btn"
          style={{ alignSelf: 'flex-end' }}
          disabled={value === null || !name.trim()}
          onClick={() => {
            update(
              (x) =>
                void x.modifiers.push({
                  id: newId(),
                  name: name.trim(),
                  value: value ?? 0,
                  kind: 'situational',
                  active: true,
                  targets: ['allTests'],
                  condition: '',
                  source: 'Play dashboard',
                  notes: '',
                }),
            )
            setName('')
          }}
        >
          Add & activate
        </button>
      </div>
    </Panel>
  )
}

function ActiveEffectsPanel() {
  const { c, update } = useChar()
  const devices = c.modules.decker ? c.matrix.devices.filter((d) => d.active) : []
  const vehicles = c.modules.rigger ? c.rigger.vehicles.filter((v) => v.active) : []
  const foci = c.modules.magic ? c.magic.foci : []
  const spirits = c.modules.magic ? c.magic.spirits : []
  const sprites = c.modules.technomancer ? c.technomancer.sprites : []
  if (
    !devices.length &&
    !vehicles.length &&
    !foci.length &&
    !spirits.length &&
    !sprites.length &&
    !c.modules.rigger
  )
    return null
  return (
    <Panel title="Active devices & effects" module className="span-all">
      <div className="grid">
        {devices.map((d) => (
          <Track
            key={d.id}
            label={`${d.name || 'Device'} — Matrix`}
            kind="matrix"
            boxes={matrixMonitor(c, `device.${d.id}.cm`, d.deviceRating, d.name).value}
            damage={d.matrixDamage}
            onChange={(n) =>
              update(
                (x) =>
                  void (x.matrix.devices = x.matrix.devices.map((y) =>
                    y.id === d.id ? { ...y, matrixDamage: n } : y,
                  )),
              )
            }
          />
        ))}
        {c.modules.rigger && c.rigger.rcc.name && (
          <Track
            label={`${c.rigger.rcc.name} (RCC) — Matrix`}
            kind="matrix"
            boxes={matrixMonitor(c, 'rcc.cm', c.rigger.rcc.deviceRating, 'RCC').value}
            damage={c.rigger.rcc.matrixDamage}
            onChange={(n) => update((x) => void (x.rigger.rcc.matrixDamage = n))}
          />
        )}
        {vehicles.map((v) => (
          <Track
            key={v.id}
            label={`${v.name || 'Vehicle'} — Physical`}
            kind="phys"
            boxes={vehicleMonitor(c, v).value}
            damage={v.damage}
            onChange={(n) =>
              update(
                (x) =>
                  void (x.rigger.vehicles = x.rigger.vehicles.map((y) =>
                    y.id === v.id ? { ...y, damage: n } : y,
                  )),
              )
            }
          />
        ))}
        {foci.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            <b>Foci</b>
            {foci.map((f) => (
              <label key={f.id} className="check">
                <input
                  type="checkbox"
                  checked={f.active}
                  onChange={(e) =>
                    update(
                      (x) =>
                        void (x.magic.foci = x.magic.foci.map((y) =>
                          y.id === f.id ? { ...y, active: e.target.checked } : y,
                        )),
                    )
                  }
                />
                <span>
                  {f.name || f.type || 'Focus'} (Force {f.force ?? '—'}){' '}
                  {f.active ? <span className="badge cyan">active</span> : null}
                </span>
              </label>
            ))}
          </div>
        )}
        {spirits.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            <b>Spirits</b>
            {spirits.map((s) => (
              <div key={s.id} className="row">
                <span style={{ flex: 1 }}>
                  {s.type || 'Spirit'} F{s.force ?? '—'}{' '}
                  {s.bound && <span className="badge">bound</span>}
                </span>
                <span className="num">Services {s.services ?? '—'}</span>
                <button
                  className="btn small"
                  disabled={(s.services ?? 0) <= 0}
                  onClick={() =>
                    update(
                      (x) =>
                        void (x.magic.spirits = x.magic.spirits.map((y) =>
                          y.id === s.id
                            ? { ...y, services: Math.max(0, (y.services ?? 0) - 1) }
                            : y,
                        )),
                    )
                  }
                >
                  −1
                </button>
              </div>
            ))}
          </div>
        )}
        {sprites.length > 0 && (
          <div className="stack" style={{ gap: 4 }}>
            <b>Sprites</b>
            {sprites.map((s) => (
              <div key={s.id} className="row">
                <span style={{ flex: 1 }}>
                  {s.type || 'Sprite'} L{s.level ?? '—'}{' '}
                  {s.registered && <span className="badge">registered</span>}
                </span>
                <span className="num">Tasks {s.tasks ?? '—'}</span>
                <button
                  className="btn small"
                  disabled={(s.tasks ?? 0) <= 0}
                  onClick={() =>
                    update(
                      (x) =>
                        void (x.technomancer.sprites = x.technomancer.sprites.map((y) =>
                          y.id === s.id ? { ...y, tasks: Math.max(0, (y.tasks ?? 0) - 1) } : y,
                        )),
                    )
                  }
                >
                  −1
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
