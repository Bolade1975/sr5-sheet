import { attribute, initiative } from '../../rules/engine'
import { generalPools } from '../../rules/pools'
import { RULES, formatRef } from '../../rules/references'
import { useChar } from '../../state/store'
import { Panel, PoolCard, Readout } from '../../ui/components'
import { NumberField, TextField } from '../../ui/fields'
import { ItemList } from '../../ui/ItemList'
import { NOTES_FIELD, SOURCE_FIELD } from '../../ui/fieldDefs'

export function ResonanceTab() {
  const { c, update } = useChar()
  const t = c.technomancer
  const persona: [string, number | null][] = [
    ['Device Rating (RES)', attribute(c, 'RES').current],
    ['Attack (CHA)', attribute(c, 'CHA').current],
    ['Sleaze (INT)', attribute(c, 'INT').current],
    ['Data Processing (LOG)', attribute(c, 'LOG').current],
    ['Firewall (WIL)', attribute(c, 'WIL').current],
  ]
  return (
    <div className="grid wide">
      <Panel
        title="Living Persona"
        module
        hint={`${RULES.livingPersona.title} — ${formatRef(RULES.livingPersona)}`}
      >
        <div className="readouts">
          {persona.map(([label, v]) => (
            <div key={label} className="readout" style={{ cursor: 'default' }}>
              <span className="lbl">{label}</span>
              <span className={`val num ${v === null ? 'missing' : ''}`}>
                {v ?? '— needs input'}
              </span>
            </div>
          ))}
        </div>
        <p className="hint">
          Technomancers have no separate Matrix condition monitor: Matrix damage is taken as Stun
          (p. 251).
        </p>
        <div className="readouts" style={{ marginTop: 10 }}>
          {(['matrixAR', 'matrixHot'] as const).map((mode) => {
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
        <div className="pool-list" style={{ marginTop: 10 }}>
          {generalPools(c)
            .filter((p) => p.id === 'pool.fading' || p.id === 'pool.biofeedback')
            .map((p) => (
              <PoolCard key={p.id} pool={p} />
            ))}
        </div>
      </Panel>

      <Panel title="Submersion" module>
        <div className="fields">
          <NumberField
            label="Submersion grade"
            value={t.submersionGrade}
            onChange={(v) => update((x) => void (x.technomancer.submersionGrade = v))}
          />
          <TextField
            label="Echoes"
            value={t.echoes}
            onChange={(v) => update((x) => void (x.technomancer.echoes = v))}
            multiline
            className="full"
          />
        </div>
      </Panel>

      <Panel title="Complex Forms" module>
        <ItemList
          items={t.complexForms}
          onChange={(v) => update((x) => void (x.technomancer.complexForms = v))}
          make={() => ({ name: '', target: '', duration: '', fading: '', source: '', notes: '' })}
          title={(f) => f.name || 'Unnamed complex form'}
          columns={[
            { label: 'Target', get: (f) => f.target || '—' },
            { label: 'Dur', get: (f) => f.duration || '—' },
            { label: 'FV', get: (f) => f.fading || '—' },
          ]}
          addLabel="Add complex form"
          fields={[
            { key: 'name', label: 'Complex form', type: 'text', full: true },
            { key: 'target', label: 'Target', type: 'text' },
            { key: 'duration', label: 'Duration', type: 'text' },
            { key: 'fading', label: 'Fading value', type: 'text' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Sprites" module>
        <ItemList
          items={t.sprites}
          onChange={(v) => update((x) => void (x.technomancer.sprites = v))}
          make={() => ({ type: '', level: null, tasks: null, registered: false, notes: '' })}
          title={(s) => (
            <>
              {s.registered && <span className="badge">registered</span>}{' '}
              {s.type || 'Unnamed sprite'}
            </>
          )}
          columns={[
            { label: 'Level', get: (s) => s.level ?? '—' },
            { label: 'Tasks', get: (s) => s.tasks ?? '—' },
          ]}
          addLabel="Add sprite"
          fields={[
            { key: 'type', label: 'Sprite type', type: 'text', full: true },
            { key: 'level', label: 'Level', type: 'int' },
            { key: 'tasks', label: 'Tasks owed', type: 'int' },
            { key: 'registered', label: 'Registered', type: 'bool' },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Resonance notes" module>
        <TextField
          label="Notes"
          value={t.notes}
          onChange={(v) => update((x) => void (x.technomancer.notes = v))}
          multiline
        />
      </Panel>
    </div>
  )
}
