import { initiative, matrixMonitor } from '../../rules/engine'
import { generalPools } from '../../rules/pools'
import { useChar } from '../../state/store'
import { Panel, PoolCard, Readout } from '../../ui/components'
import { Segmented, TextField } from '../../ui/fields'
import { ItemList } from '../../ui/ItemList'
import { NOTES_FIELD } from '../../ui/fieldDefs'
import { Track } from './PlayTab'

export function MatrixTab() {
  const { c, update } = useChar()
  const m = c.matrix
  return (
    <div className="grid wide">
      <Panel title="Matrix state" module>
        <Segmented
          label="Matrix mode"
          value={c.play.matrixMode}
          onChange={(v) => update((x) => void (x.play.matrixMode = v))}
          options={[
            { value: 'ar', label: 'AR' },
            { value: 'coldVR', label: 'Cold-sim VR' },
            { value: 'hotVR', label: 'Hot-sim VR' },
          ]}
        />
        <div className="readouts" style={{ marginTop: 10 }}>
          {(['matrixAR', 'matrixCold', 'matrixHot'] as const).map((mode) => {
            const i = initiative(c, mode)
            return (
              <Readout
                key={mode}
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
          VR initiative uses the Data Processing of the device marked active below (p. 159).
        </p>
        <div className="pool-list" style={{ marginTop: 10 }}>
          {generalPools(c)
            .filter((p) => p.group === 'matrix')
            .map((p) => (
              <PoolCard key={p.id} pool={p} />
            ))}
        </div>
      </Panel>

      <Panel title="Commlinks & Cyberdecks" module>
        <ItemList
          items={m.devices}
          onChange={(v) => update((x) => void (x.matrix.devices = v))}
          make={() => ({
            name: '',
            type: 'cyberdeck' as const,
            deviceRating: null,
            attack: null,
            sleaze: null,
            dataProcessing: null,
            firewall: null,
            programSlots: null,
            matrixDamage: 0,
            active: m.devices.length === 0,
            notes: '',
          })}
          title={(d) => (
            <>
              <span className="badge magenta">{d.type}</span>{' '}
              {d.active && <span className="badge cyan">active</span>} {d.name || 'Unnamed device'}
            </>
          )}
          columns={[
            { label: 'DR', get: (d) => d.deviceRating ?? '—' },
            { label: 'A', get: (d) => d.attack ?? '—' },
            { label: 'S', get: (d) => d.sleaze ?? '—' },
            { label: 'DP', get: (d) => d.dataProcessing ?? '—' },
            { label: 'F', get: (d) => d.firewall ?? '—' },
          ]}
          addLabel="Add device"
          fields={[
            { key: 'name', label: 'Model', type: 'text', full: true },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { value: 'cyberdeck', label: 'Cyberdeck' },
                { value: 'commlink', label: 'Commlink' },
                { value: 'other', label: 'Other' },
              ],
            },
            { key: 'deviceRating', label: 'Device Rating', type: 'int' },
            { key: 'attack', label: 'Attack', type: 'int' },
            { key: 'sleaze', label: 'Sleaze', type: 'int' },
            { key: 'dataProcessing', label: 'Data Processing', type: 'int' },
            { key: 'firewall', label: 'Firewall', type: 'int' },
            { key: 'programSlots', label: 'Program slots', type: 'int' },
            NOTES_FIELD,
          ]}
          extra={(d, set) => (
            <div className="stack">
              <label className="check">
                <input
                  type="checkbox"
                  checked={d.active}
                  onChange={(e) =>
                    update((x) => {
                      // Only one active persona device at a time.
                      x.matrix.devices = x.matrix.devices.map((y) => ({
                        ...y,
                        active:
                          y.id === d.id ? e.target.checked : e.target.checked ? false : y.active,
                      }))
                    })
                  }
                />
                <span>Active device (used for initiative and resistance)</span>
              </label>
              <Track
                label="Matrix damage"
                kind="matrix"
                boxes={matrixMonitor(c, `device.${d.id}.cm`, d.deviceRating, d.name).value}
                damage={d.matrixDamage}
                onChange={(n) => set({ matrixDamage: n })}
              />
              <Readout
                d={matrixMonitor(
                  c,
                  `device.${d.id}.cm`,
                  d.deviceRating,
                  `${d.name || 'Device'} Matrix Monitor`,
                )}
                label="Matrix boxes"
              />
            </div>
          )}
        />
        <p className="hint">
          Cyberdeck attributes can be reassigned in play; edit Attack/Sleaze/DP/Firewall here to
          reflect the current configuration.
        </p>
      </Panel>

      <Panel title="Programs" module>
        <ItemList
          items={m.programs}
          onChange={(v) => update((x) => void (x.matrix.programs = v))}
          make={() => ({ name: '', type: 'common' as const, loaded: false, notes: '' })}
          title={(p) => (
            <>
              {p.loaded && <span className="badge cyan">running</span>}{' '}
              {p.name || 'Unnamed program'} <span className="hint">({p.type})</span>
            </>
          )}
          addLabel="Add program"
          fields={[
            { key: 'name', label: 'Program', type: 'text', full: true },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { value: 'common', label: 'Common' },
                { value: 'hacking', label: 'Hacking' },
                { value: 'other', label: 'Other' },
              ],
            },
            { key: 'loaded', label: 'Running', type: 'bool' },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Matrix notes" module>
        <TextField
          label="Notes (marks, Overwatch, PAN…)"
          value={m.notes}
          onChange={(v) => update((x) => void (x.matrix.notes = v))}
          multiline
        />
      </Panel>
    </div>
  )
}
