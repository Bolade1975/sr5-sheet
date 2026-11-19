import { droneInitiative, initiative, matrixMonitor, vehicleMonitor } from '../../rules/engine'
import { generalPools } from '../../rules/pools'
import { useChar } from '../../state/store'
import { Panel, PoolCard, Readout } from '../../ui/components'
import { Check, NumberField, TextField } from '../../ui/fields'
import { ItemList } from '../../ui/ItemList'
import { NOTES_FIELD, SOURCE_FIELD } from '../../ui/fieldDefs'
import { Track } from './PlayTab'

const AUTOSOFT_KIND_LABEL = {
  clearsight: 'Clearsight',
  targeting: 'Targeting',
  maneuvering: 'Maneuvering',
  stealth: 'Stealth',
  evasion: 'Evasion',
  electronicWarfare: 'Electronic Warfare',
  other: 'Other',
} as const

const AUTOSOFT_KIND_OPTIONS = (
  Object.keys(AUTOSOFT_KIND_LABEL) as (keyof typeof AUTOSOFT_KIND_LABEL)[]
).map((k) => ({ value: k, label: AUTOSOFT_KIND_LABEL[k] }))

export function RiggerTab() {
  const { c, update } = useChar()
  const r = c.rigger
  const setRcc = <K extends keyof typeof r.rcc>(k: K, v: (typeof r.rcc)[K]) =>
    update((x) => void (x.rigger.rcc[k] = v))
  const pilotSkillOptions = [
    { value: '', label: '— choose Pilot skill —' },
    ...c.skills
      .filter((s) => s.category === 'vehicle' && s.catalogKey !== 'gunnery')
      .map((s) => ({ value: s.id, label: s.name || 'Unnamed skill' })),
    ...c.skills
      .filter((s) => s.category !== 'vehicle')
      .map((s) => ({ value: s.id, label: `${s.name || 'Unnamed skill'} (non-vehicle)` })),
  ]
  const weaponOptions = [
    { value: '', label: '— weapon —' },
    ...c.rangedWeapons.map((w) => ({
      value: w.id,
      label: `${w.name || 'Unnamed weapon'}${w.mountedOn ? ` (on ${r.vehicles.find((v) => v.id === w.mountedOn)?.name || 'vehicle'})` : ''}`,
    })),
  ]
  return (
    <div className="grid wide">
      <Panel title="Control Rig & Initiative" module>
        <div className="fields" style={{ marginBottom: 10 }}>
          <NumberField
            label="Control rig rating"
            value={r.controlRig}
            onChange={(v) => update((x) => void (x.rigger.controlRig = v))}
          />
        </div>
        <div className="readouts">
          {(['riggingAR', 'riggingCold', 'riggingHot'] as const).map((m) => {
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
        <p className="hint">
          Control rig bonuses (dice pool / threshold effects) depend on the test; add them as
          permanent or conditional modifiers.
        </p>
      </Panel>

      <Panel title="Rigger Command Console" module>
        <div className="fields">
          <TextField
            label="RCC model"
            value={r.rcc.name}
            onChange={(v) => setRcc('name', v)}
            className="full"
          />
          <NumberField
            label="Device Rating"
            value={r.rcc.deviceRating}
            onChange={(v) => setRcc('deviceRating', v)}
          />
          <NumberField
            label="Data Processing"
            value={r.rcc.dataProcessing}
            onChange={(v) => setRcc('dataProcessing', v)}
          />
          <NumberField
            label="Firewall"
            value={r.rcc.firewall}
            onChange={(v) => setRcc('firewall', v)}
          />
          <NumberField
            label="Noise Reduction"
            value={r.rcc.noiseReduction}
            onChange={(v) => setRcc('noiseReduction', v)}
          />
          <NumberField
            label="Sharing"
            value={r.rcc.sharing}
            onChange={(v) => setRcc('sharing', v)}
          />
          <Check
            label="Carried (Current Loadout)"
            checked={r.rcc.carried}
            onChange={(v) => setRcc('carried', v)}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <Track
            label="RCC Matrix damage"
            kind="matrix"
            boxes={matrixMonitor(c, 'rcc.cm', r.rcc.deviceRating, 'RCC').value}
            damage={r.rcc.matrixDamage}
            onChange={(n) => setRcc('matrixDamage', n)}
          />
        </div>
        <div className="pool-list" style={{ marginTop: 10 }}>
          {generalPools(c)
            .filter((p) => p.group === 'rigger')
            .map((p) => (
              <PoolCard key={p.id} pool={p} />
            ))}
        </div>
        <TextField
          label="RCC notes"
          value={r.rcc.notes}
          onChange={(v) => setRcc('notes', v)}
          multiline
        />
      </Panel>

      <Panel title="Vehicles & Drones" module className="span-all">
        <ItemList
          items={r.vehicles}
          onChange={(v) => update((x) => void (x.rigger.vehicles = v))}
          make={() => ({
            name: '',
            kind: 'drone' as const,
            handling: '',
            speed: '',
            acceleration: '',
            body: null,
            armor: null,
            pilot: null,
            sensor: null,
            seats: null,
            damage: 0,
            matrixDamage: 0,
            deviceRating: null,
            mods: '',
            weapons: '',
            sensors: '',
            ammo: '',
            active: false,
            carried: false,
            pilotSkillId: null,
            source: '',
            notes: '',
          })}
          title={(v) => (
            <>
              <span className="badge magenta">{v.kind}</span>{' '}
              {v.active && <span className="badge cyan">active</span>} {v.name || 'Unnamed'}
            </>
          )}
          columns={[
            { label: 'Hand', get: (v) => v.handling || '—' },
            { label: 'Spd', get: (v) => v.speed || '—' },
            { label: 'Acc', get: (v) => v.acceleration || '—' },
            { label: 'Bod', get: (v) => v.body ?? '—' },
            { label: 'Arm', get: (v) => v.armor ?? '—' },
            { label: 'Pil', get: (v) => v.pilot ?? '—' },
            { label: 'Sen', get: (v) => v.sensor ?? '—' },
            { label: 'CM', get: (v) => `${v.damage}/${vehicleMonitor(c, v).value ?? '?'}` },
          ]}
          carried
          addLabel="Add vehicle or drone"
          fields={[
            { key: 'name', label: 'Name / model', type: 'text', full: true },
            {
              key: 'kind',
              label: 'Type',
              type: 'select',
              options: [
                { value: 'drone', label: 'Drone' },
                { value: 'vehicle', label: 'Vehicle' },
              ],
            },
            { key: 'handling', label: 'Handling', type: 'text' },
            { key: 'speed', label: 'Speed', type: 'text' },
            { key: 'acceleration', label: 'Acceleration', type: 'text' },
            { key: 'body', label: 'Body', type: 'int' },
            { key: 'armor', label: 'Armor', type: 'int' },
            { key: 'pilot', label: 'Pilot', type: 'int' },
            { key: 'sensor', label: 'Sensor', type: 'int' },
            { key: 'seats', label: 'Seats', type: 'int' },
            { key: 'deviceRating', label: 'Device Rating', type: 'int' },
            {
              key: 'pilotSkillId',
              label: 'Your Pilot skill for it',
              type: 'select',
              options: pilotSkillOptions,
              nullable: true,
            },
            { key: 'active', label: 'Active (Play dashboard)', type: 'bool' },
            { key: 'mods', label: 'Modifications', type: 'textarea' },
            { key: 'weapons', label: 'Weapons / mounts (notes)', type: 'textarea' },
            { key: 'sensors', label: 'Sensors', type: 'textarea' },
            { key: 'ammo', label: 'Ammunition', type: 'textarea' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
          extra={(v, set) => (
            <div className="grid">
              <Track
                label="Physical damage"
                kind="phys"
                boxes={vehicleMonitor(c, v).value}
                damage={v.damage}
                onChange={(n) => set({ damage: n })}
              />
              <Track
                label="Matrix damage"
                kind="matrix"
                boxes={matrixMonitor(c, `vehicle.${v.id}.matrix`, v.deviceRating, 'Matrix').value}
                damage={v.matrixDamage}
                onChange={(n) => set({ matrixDamage: n })}
              />
              <div className="readouts">
                <Readout d={vehicleMonitor(c, v)} label="Condition boxes" />
                {v.kind === 'drone' && (
                  <Readout
                    d={droneInitiative(c, v)}
                    label="Autonomous Init."
                    display={
                      droneInitiative(c, v).value === null
                        ? undefined
                        : `${droneInitiative(c, v).value} + 4D6`
                    }
                  />
                )}
              </div>
            </div>
          )}
        />
      </Panel>

      <Panel title="Autosofts" module className="span-all">
        <ItemList
          items={r.autosofts}
          onChange={(v) => update((x) => void (x.rigger.autosofts = v))}
          make={() => ({
            name: '',
            rating: null,
            skill: '',
            kind: 'other' as const,
            weaponId: null,
            vehicleIds: [],
            sharedOnRcc: false,
            notes: '',
          })}
          title={(a) => (
            <>
              {a.kind !== 'other' && <span className="badge">{AUTOSOFT_KIND_LABEL[a.kind]}</span>}{' '}
              {a.name || 'Unnamed autosoft'}
            </>
          )}
          columns={[
            { label: 'Rtg', get: (a) => a.rating ?? '—' },
            {
              label: 'On',
              get: (a) =>
                a.sharedOnRcc
                  ? 'RCC (shared)'
                  : a.vehicleIds
                      .map((id) => r.vehicles.find((v) => v.id === id)?.name ?? '?')
                      .join(', ') || '—',
            },
          ]}
          addLabel="Add autosoft"
          fields={[
            { key: 'name', label: 'Autosoft', type: 'text', full: true },
            { key: 'rating', label: 'Rating', type: 'int' },
            {
              key: 'kind',
              label: 'Type (used in pools)',
              type: 'select',
              options: AUTOSOFT_KIND_OPTIONS,
            },
            {
              key: 'weaponId',
              label: 'Targeting: for weapon',
              type: 'select',
              options: weaponOptions,
              nullable: true,
            },
            { key: 'skill', label: 'Skill / weapon it replaces', type: 'text' },
            { key: 'sharedOnRcc', label: 'Shared via RCC', type: 'bool' },
            NOTES_FIELD,
          ]}
          extra={(a, set) => (
            <div className="stack" style={{ gap: 4 }}>
              <b>Installed on</b>
              {r.vehicles.map((v) => (
                <label key={v.id} className="check">
                  <input
                    type="checkbox"
                    checked={a.vehicleIds.includes(v.id)}
                    onChange={(e) =>
                      set({
                        vehicleIds: e.target.checked
                          ? [...a.vehicleIds, v.id]
                          : a.vehicleIds.filter((id) => id !== v.id),
                      })
                    }
                  />
                  <span>{v.name || 'Unnamed'}</span>
                </label>
              ))}
              {r.vehicles.length === 0 && <div className="empty">Add vehicles first.</div>}
            </div>
          )}
        />
      </Panel>

      <Panel title="Rigger notes" module className="span-all">
        <TextField
          label="Notes"
          value={r.notes}
          onChange={(v) => update((x) => void (x.rigger.notes = v))}
          multiline
        />
      </Panel>
    </div>
  )
}
