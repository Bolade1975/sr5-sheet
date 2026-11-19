import { useState, type ReactNode } from 'react'
import { displayName } from '../../domain/factory'
import type { Modifier } from '../../domain/schema'
import { safeFilename } from '../../domain/transfer'
import {
  armorValue,
  conditionMonitor,
  edge,
  initiative,
  limit,
  matrixMonitor,
  overflow,
  relevantInitModes,
  woundModifier,
  type Derived,
} from '../../rules/engine'
import { buildLoadout, modState, type LoadoutVehicle } from '../../rules/loadout'
import { favoritePools, generalPools, type Pool } from '../../rules/pools'
import { useChar } from '../../state/store'
import { Panel, PoolCard, Readout } from '../../ui/components'
import { downloadBlob } from '../../ui/download'
import { fmtSigned, todayIso } from '../../ui/format'

const DEFENSE_IDS = [
  'pool.defense',
  'pool.fullDefense',
  'pool.dodge',
  'pool.block',
  'pool.fullDefenseDodge',
  'pool.fullDefenseBlock',
]
const RESIST_IDS = ['pool.damageResistance']

/** Compact label/value list that wraps instead of truncating. */
function Stats(props: { items: [string, ReactNode][] }) {
  return (
    <dl className="stats">
      {props.items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v === '' || v === null || v === undefined ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  )
}

function ModList(props: { mods: Modifier[] }) {
  if (!props.mods.length) return null
  return (
    <ul className="mod-list">
      {props.mods.map((m) => (
        <li key={m.id}>
          <b>{fmtSigned(m.value)}</b> {m.name || 'Unnamed modifier'}{' '}
          <span className="hint">({modState(m)})</span>
        </li>
      ))}
    </ul>
  )
}

function initDisplay(score: Derived, diceText: string) {
  return score.value === null ? undefined : `${score.value} + ${diceText}`
}

export function LoadoutTab() {
  const { c } = useChar()
  const lo = buildLoadout(c)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const general = generalPools(c)
  const defense = DEFENSE_IDS.map((id) => general.find((p) => p.id === id)).filter(
    (p): p is Pool => !!p,
  )
  const resist = general.filter((p) => RESIST_IDS.includes(p.id))
  const shown = new Set([...DEFENSE_IDS, ...RESIST_IDS])
  const other: Pool[] = []
  for (const p of [...favoritePools(c), ...general])
    if (!shown.has(p.id) && !other.some((o) => o.label === p.label)) {
      shown.add(p.id)
      other.push(p)
    }
  const e = edge(c)
  const wound = woundModifier(c)

  const exportPdf = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const { renderPdf } = await import('../../pdf/exportPdf')
      const blob = await renderPdf(c, {
        mode: 'loadout',
        includeNotes: false,
        includeHistory: false,
        exportDate: new Date(),
      })
      const name = `${safeFilename(displayName(c))}-${todayIso()}-loadout.pdf`
      downloadBlob(name, blob)
      setMsg({
        ok: true,
        text: `Saved ${name} (${Math.round(blob.size / 1024)} KB) to your downloads. Send it to your GM yourself — the app never sends anything.`,
      })
    } catch (err) {
      setMsg({
        ok: false,
        text: `PDF export failed: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid loadout">
      <Panel
        title="Current Loadout"
        className="span-all"
        actions={
          <button className="btn primary" disabled={busy} onClick={() => void exportPdf()}>
            {busy ? 'Generating…' : 'Export Current Loadout PDF'}
          </button>
        }
      >
        <p className="hint" style={{ margin: 0 }}>
          {lo.count === 0
            ? 'Nothing is marked Carried yet — tick “Carried” on the Gear & Ware, Rigger, Matrix or Magic tabs.'
            : `${lo.count} carried item${lo.count === 1 ? '' : 's'}. `}
          Carried only lists gear here; it never equips armor, activates weapons or switches on
          bonuses. Tap any value or pool for its breakdown and manual override.
        </p>
        {msg && <div className={`banner ${msg.ok ? 'info' : ''}`}>{msg.text}</div>}
        {lo.warnings.length > 0 && (
          <div className="banner warn" style={{ marginTop: 8 }}>
            {lo.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}
      </Panel>

      {/* ---------- character overview ---------- */}
      <Panel title="Defense & Damage Resistance">
        <div className="pool-list">
          {[...defense, ...resist].map((p) => (
            <PoolCard key={p.id} pool={p} />
          ))}
        </div>
        {c.play.fullDefense && <p className="hint">Full Defense is switched on (Play tab).</p>}
      </Panel>

      <Panel title="Initiative · Edge · Condition">
        <div className="readouts">
          {relevantInitModes(c).map((m) => {
            const i = initiative(c, m)
            return (
              <Readout
                key={m}
                d={i.score}
                label={i.score.label.replace(' Initiative', '')}
                display={initDisplay(i.score, `${i.dice.value ?? '?'}D6`)}
              />
            )
          })}
        </div>
        <Stats
          items={[
            ['Edge', e.total === null ? 'needs input' : `${e.remaining} of ${e.total} remaining`],
            [
              'Physical',
              `${c.play.physicalDamage} / ${conditionMonitor(c, 'physical').value ?? '?'}`,
            ],
            ['Stun', `${c.play.stunDamage} / ${conditionMonitor(c, 'stun').value ?? '?'}`],
            ['Overflow', `${c.play.overflowDamage} / ${overflow(c).value ?? '?'}`],
            [
              'Wound modifier',
              <span key="w" className={wound.value ? 'neg' : ''}>
                {fmtSigned(wound.value ?? 0)}
              </span>,
            ],
          ]}
        />
      </Panel>

      <Panel title="Limits">
        <div className="readouts">
          <Readout d={limit(c, 'physical')} label="Physical" />
          <Readout d={limit(c, 'mental')} label="Mental" />
          <Readout d={limit(c, 'social')} label="Social" />
          {c.modules.magic && <Readout d={limit(c, 'astral')} label="Astral" />}
          <Readout d={armorValue(c)} label="Armor (worn)" />
        </div>
      </Panel>

      <Panel title="Favorite & general pools" className="span-all">
        <div className="pool-list">
          {other.map((p) => (
            <PoolCard key={p.id} pool={p} />
          ))}
        </div>
      </Panel>

      {/* ---------- carried equipment ---------- */}
      {(lo.ranged.length > 0 || lo.melee.length > 0) && (
        <Panel title="Carried weapons" className="span-all">
          <div className="pool-list">
            {lo.ranged.map(({ item: w, pool, mods }) => (
              <div key={w.id} className="panel stack carried-card">
                <PoolCard pool={pool} extra={w.active ? <span>active</span> : null} />
                <Stats
                  items={[
                    ['DV', w.damage],
                    ['AP', w.ap],
                    ['Accuracy', pool.limit?.value ?? w.accuracy ?? ''],
                    ['Mode', w.mode],
                    ['RC', w.rc],
                    [
                      'Ammo',
                      `${w.ammoCurrent ?? '—'}/${w.ammoCapacity ?? '—'}${w.ammoType ? ` ${w.ammoType}` : ''}`,
                    ],
                    ['Spare', w.ammoSpare],
                  ]}
                />
                <ModList mods={mods} />
              </div>
            ))}
            {lo.melee.map(({ item: w, pool, mods }) => (
              <div key={w.id} className="panel stack carried-card">
                <PoolCard pool={pool} extra={w.active ? <span>active</span> : null} />
                <Stats
                  items={[
                    ['DV', w.damage],
                    ['AP', w.ap],
                    ['Accuracy', pool.limit?.value ?? w.accuracy ?? ''],
                    ['Reach', w.reach ?? ''],
                  ]}
                />
                <ModList mods={mods} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {lo.armor.length > 0 && (
        <Panel title="Carried armor" hint="Only worn armor counts toward Armor (p. 169).">
          <div className="items">
            {lo.armor.map(({ item: a, mods }) => (
              <div key={a.id} className="item carried-row">
                <div className="row">
                  <b className="grow">{a.name || 'Unnamed armor'}</b>
                  <span className="num">
                    {a.rating === null ? '—' : `${a.accessory ? '+' : ''}${a.rating}`}
                  </span>
                  {a.equipped ? (
                    <span className="badge cyan">worn</span>
                  ) : (
                    <span className="badge">not worn</span>
                  )}
                </div>
                {a.notes && <div className="hint">{a.notes}</div>}
                <ModList mods={mods} />
              </div>
            ))}
          </div>
          <div className="readouts" style={{ marginTop: 8 }}>
            <Readout d={armorValue(c)} label="Armor in use" />
          </div>
        </Panel>
      )}

      {(lo.gear.length > 0 || lo.devices.length > 0 || lo.foci.length > 0 || lo.rccCarried) && (
        <Panel title="Carried gear">
          <div className="items">
            {lo.gear.map(({ item: g, mods }) => (
              <div key={g.id} className="item carried-row">
                <div className="row">
                  <b className="grow">{g.name || 'Unnamed item'}</b>
                  {g.category && <span className="hint">{g.category}</span>}
                </div>
                <Stats
                  items={[
                    ['Rating', g.rating ?? ''],
                    ['Qty', g.quantity ?? ''],
                  ]}
                />
                {g.notes && <div className="hint">{g.notes}</div>}
                <ModList mods={mods} />
              </div>
            ))}
            {lo.devices.map(({ item: d, mods }) => (
              <div key={d.id} className="item carried-row">
                <div className="row">
                  <b className="grow">{d.name || 'Unnamed device'}</b>
                  <span className="badge magenta">{d.type}</span>
                  {d.active && <span className="badge cyan">active</span>}
                </div>
                <Stats
                  items={[
                    ['DR', d.deviceRating ?? ''],
                    ['ATT', d.attack ?? ''],
                    ['SLZ', d.sleaze ?? ''],
                    ['DP', d.dataProcessing ?? ''],
                    ['FW', d.firewall ?? ''],
                    [
                      'Matrix CM',
                      `${d.matrixDamage}/${matrixMonitor(c, `device.${d.id}.cm`, d.deviceRating, 'Matrix').value ?? '?'}`,
                    ],
                  ]}
                />
                <ModList mods={mods} />
              </div>
            ))}
            {lo.foci.map(({ item: f, mods }) => (
              <div key={f.id} className="item carried-row">
                <div className="row">
                  <b className="grow">{f.name || 'Unnamed focus'}</b>
                  {f.type && <span className="hint">{f.type}</span>}
                  {f.active && <span className="badge cyan">active</span>}
                </div>
                <Stats
                  items={[
                    ['Force', f.force ?? ''],
                    ['Bonded', f.bonded ? 'yes' : 'no'],
                  ]}
                />
                <ModList mods={mods} />
              </div>
            ))}
            {lo.rccCarried && (
              <div className="item carried-row">
                <div className="row">
                  <b className="grow">{c.rigger.rcc.name || 'Rigger Command Console'}</b>
                  <span className="badge magenta">RCC</span>
                </div>
                <Stats
                  items={[
                    ['DR', c.rigger.rcc.deviceRating ?? ''],
                    ['DP', c.rigger.rcc.dataProcessing ?? ''],
                    ['FW', c.rigger.rcc.firewall ?? ''],
                    ['Noise Red.', c.rigger.rcc.noiseReduction ?? ''],
                    ['Sharing', c.rigger.rcc.sharing ?? ''],
                    [
                      'Matrix CM',
                      `${c.rigger.rcc.matrixDamage}/${matrixMonitor(c, 'rcc.cm', c.rigger.rcc.deviceRating, 'RCC').value ?? '?'}`,
                    ],
                  ]}
                />
              </div>
            )}
          </div>
        </Panel>
      )}

      {lo.vehicles.map((lv) => (
        <VehicleCard key={lv.vehicle.id} lv={lv} />
      ))}
    </div>
  )
}

function VehicleCard(props: { lv: LoadoutVehicle }) {
  const { lv } = props
  const v = lv.vehicle
  return (
    <Panel
      title={`${v.kind === 'drone' ? 'Drone' : 'Vehicle'}: ${v.name || 'Unnamed'}`}
      className="span-all"
      module
    >
      <div className="stack">
        <Stats
          items={[
            ['Handling', v.handling],
            ['Speed', v.speed],
            ['Accel', v.acceleration],
            ['Body', v.body ?? ''],
            ['Armor', v.armor ?? ''],
            ['Pilot', v.pilot ?? ''],
            ['Sensor', v.sensor ?? ''],
            ['Seats', v.seats ?? ''],
            ['Device Rating', v.deviceRating ?? ''],
            ['Condition', `${v.damage} / ${lv.conditionMonitor.value ?? '?'}`],
            ['Matrix', `${v.matrixDamage} / ${lv.matrixMonitor.value ?? '?'}`],
          ]}
        />
        {lv.warnings.length > 0 && (
          <div className="banner warn">
            {lv.warnings.map((w, i) => (
              <div key={i}>{w}</div>
            ))}
          </div>
        )}
        <div className="grid">
          <div className="stack" style={{ gap: 6 }}>
            <b>Mounted weapons</b>
            {lv.weapons.length === 0 && (
              <div className="empty">
                None linked — set “Mounted on vehicle/drone” on a ranged weapon (Gear & Ware).
              </div>
            )}
            {lv.weapons.map((w) => (
              <div key={w.id}>
                <b>{w.name || 'Unnamed weapon'}</b>
                <Stats
                  items={[
                    ['DV', w.damage],
                    ['AP', w.ap],
                    ['Acc', w.accuracy ?? ''],
                    ['Mode', w.mode],
                    ['RC', w.rc],
                    [
                      'Ammo',
                      `${w.ammoCurrent ?? '—'}/${w.ammoCapacity ?? '—'}${w.ammoType ? ` ${w.ammoType}` : ''}`,
                    ],
                    ['Spare', w.ammoSpare],
                  ]}
                />
              </div>
            ))}
            {v.weapons && <div className="hint">Weapon notes: {v.weapons}</div>}
            {v.ammo && <div className="hint">Ammunition: {v.ammo}</div>}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <b>
              Autosofts{' '}
              {lv.autosoftSource && (
                <span className="hint">
                  ({lv.autosoftSource === 'drone' ? 'installed on this unit' : 'shared via RCC'})
                </span>
              )}
            </b>
            {lv.autosofts.length === 0 && <div className="empty">None.</div>}
            {lv.autosofts.map((a) => (
              <div key={a.id}>
                {a.name || 'Unnamed autosoft'} <b className="num">{a.rating ?? '—'}</b>
                {a.kind === 'other' && (
                  <span className="hint"> · type not set (not used in pools)</span>
                )}
              </div>
            ))}
            {v.sensors && <div className="hint">Sensors: {v.sensors}</div>}
            {v.mods && <div className="hint">Mods: {v.mods}</div>}
          </div>
        </div>
        <div className="pool-list">
          <PoolCard pool={lv.damageResistance} />
        </div>
        {lv.modes.map((m) => (
          <section key={m.mode} className="mode-block">
            <h3>{m.title}</h3>
            {m.message ? (
              <div className="hint">{m.message}</div>
            ) : (
              <>
                {m.initiative.length > 0 && (
                  <div className="readouts">
                    {m.initiative.map((i) => (
                      <Readout
                        key={i.label}
                        d={i.score}
                        label={i.label}
                        display={initDisplay(i.score, i.diceText)}
                      />
                    ))}
                  </div>
                )}
                <div className="pool-list">
                  {m.pools.map((p) => (
                    <PoolCard key={p.id} pool={p} />
                  ))}
                </div>
                {m.notes.map((n, i) => (
                  <div key={i} className="hint">
                    {n}
                  </div>
                ))}
              </>
            )}
          </section>
        ))}
        {v.notes && <div className="hint">Notes: {v.notes}</div>}
      </div>
    </Panel>
  )
}
