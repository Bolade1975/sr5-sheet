import { ATTRIBUTE_KEYS } from '../../domain/schema'
import { ATTRIBUTE_LABELS, attribute, initiative, limit } from '../../rules/engine'
import { generalPools } from '../../rules/pools'
import { useChar } from '../../state/store'
import { Panel, PoolCard, Readout } from '../../ui/components'
import { NumberField, Select, TextField } from '../../ui/fields'
import { ItemList } from '../../ui/ItemList'
import { NOTES_FIELD, SOURCE_FIELD } from '../../ui/fieldDefs'

export function MagicTab() {
  const { c, update } = useChar()
  const m = c.magic
  const set = <K extends keyof typeof m>(k: K, v: (typeof m)[K]) =>
    update((x) => void (x.magic[k] = v))
  const isAdept = m.awakenedType === 'adept' || m.awakenedType === 'mysticAdept'
  const usedPP = m.adeptPowers.reduce((a, p) => a + (p.powerPoints ?? 0), 0)
  const astral = initiative(c, 'astral')
  return (
    <div className="grid wide">
      <Panel title="Tradition & Drain" module>
        <div className="fields">
          <Select
            label="Awakened type"
            value={m.awakenedType}
            onChange={(v) => set('awakenedType', v)}
            options={[
              { value: 'magician', label: 'Magician' },
              { value: 'aspectedMagician', label: 'Aspected magician' },
              { value: 'mysticAdept', label: 'Mystic adept' },
              { value: 'adept', label: 'Adept' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <TextField label="Tradition" value={m.tradition} onChange={(v) => set('tradition', v)} />
          <Select
            label="Drain attribute (with Willpower)"
            value={m.drainAttribute ?? ''}
            onChange={(v) => set('drainAttribute', v === '' ? null : v)}
            options={[
              { value: '', label: '— set from your tradition —' },
              ...ATTRIBUTE_KEYS.filter((k) => k !== 'WIL').map((k) => ({
                value: k,
                label: ATTRIBUTE_LABELS[k],
              })),
            ]}
          />
          <TextField
            label="Mentor spirit"
            value={m.mentorSpirit}
            onChange={(v) => set('mentorSpirit', v)}
          />
          <NumberField
            label="Initiate grade"
            value={m.initiateGrade}
            onChange={(v) => set('initiateGrade', v)}
          />
          <TextField
            label="Metamagics"
            value={m.metamagics}
            onChange={(v) => set('metamagics', v)}
            className="full"
          />
        </div>
        <p className="hint">
          Each tradition defines its Drain attribute (e.g. Hermetic: Logic + Willpower, p. 279).
        </p>
        <div className="readouts" style={{ marginTop: 10 }}>
          <Readout d={limit(c, 'astral')} label="Astral Limit" />
          <Readout
            d={astral.score}
            label="Astral Initiative"
            display={
              astral.score.value === null
                ? undefined
                : `${astral.score.value} + ${astral.dice.value ?? '?'}D6`
            }
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="hint">Magic:</span>{' '}
          <b className="num">{attribute(c, 'MAG').current ?? '—'}</b>
        </div>
        <div className="pool-list" style={{ marginTop: 10 }}>
          {generalPools(c)
            .filter((p) => p.group === 'magic')
            .map((p) => (
              <PoolCard key={p.id} pool={p} />
            ))}
        </div>
      </Panel>

      <Panel title="Spells & Rituals" module>
        <ItemList
          items={m.spells}
          onChange={(v) => update((x) => void (x.magic.spells = v))}
          make={() => ({
            name: '',
            category: '',
            type: '' as const,
            range: '',
            duration: '',
            drain: '',
            isRitual: false,
            source: '',
            notes: '',
          })}
          title={(s) => (
            <>
              {s.isRitual && <span className="badge magenta">ritual</span>}{' '}
              {s.name || 'Unnamed spell'}{' '}
              {s.category && <span className="hint">({s.category})</span>}
            </>
          )}
          columns={[
            { label: 'T', get: (s) => s.type || '—' },
            { label: 'R', get: (s) => s.range || '—' },
            { label: 'D', get: (s) => s.duration || '—' },
            { label: 'DV', get: (s) => s.drain || '—' },
          ]}
          addLabel="Add spell / ritual"
          fields={[
            { key: 'name', label: 'Name', type: 'text', full: true },
            { key: 'category', label: 'Category', type: 'text' },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { value: '', label: '—' },
                { value: 'P', label: 'Physical (P)' },
                { value: 'M', label: 'Mana (M)' },
              ],
            },
            { key: 'range', label: 'Range', type: 'text' },
            { key: 'duration', label: 'Duration', type: 'text' },
            { key: 'drain', label: 'Drain value', type: 'text' },
            { key: 'isRitual', label: 'Ritual', type: 'bool' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Preparations (alchemy)" module>
        <ItemList
          items={m.preparations}
          onChange={(v) => update((x) => void (x.magic.preparations = v))}
          make={() => ({ name: '', force: null, trigger: '', potency: null, notes: '' })}
          title={(p) => p.name || 'Unnamed preparation'}
          columns={[
            { label: 'Force', get: (p) => p.force ?? '—' },
            { label: 'Potency', get: (p) => p.potency ?? '—' },
            { label: 'Trigger', get: (p) => p.trigger || '—' },
          ]}
          addLabel="Add preparation"
          fields={[
            { key: 'name', label: 'Spell / preparation', type: 'text', full: true },
            { key: 'force', label: 'Force', type: 'int' },
            { key: 'potency', label: 'Potency', type: 'int' },
            { key: 'trigger', label: 'Trigger', type: 'text' },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      {(isAdept || m.adeptPowers.length > 0) && (
        <Panel title="Adept Powers" module>
          <div className="fields" style={{ marginBottom: 8 }}>
            <NumberField
              label="Power Points available"
              integer={false}
              value={m.powerPointsTotal}
              onChange={(v) => set('powerPointsTotal', v)}
            />
            <div className="field">
              <span>Power Points used</span>
              <b className="num" style={{ fontSize: '1.3rem' }}>
                {usedPP}
                {m.powerPointsTotal !== null && usedPP > m.powerPointsTotal && (
                  <span className="badge red" style={{ marginLeft: 6 }}>
                    over
                  </span>
                )}
              </b>
            </div>
          </div>
          <ItemList
            items={m.adeptPowers}
            onChange={(v) => update((x) => void (x.magic.adeptPowers = v))}
            make={() => ({ name: '', level: null, powerPoints: null, source: '', notes: '' })}
            title={(p) => p.name || 'Unnamed power'}
            columns={[
              { label: 'Lvl', get: (p) => p.level ?? '—' },
              { label: 'PP', get: (p) => p.powerPoints ?? '—' },
            ]}
            addLabel="Add adept power"
            fields={[
              { key: 'name', label: 'Power', type: 'text', full: true },
              { key: 'level', label: 'Level', type: 'int' },
              { key: 'powerPoints', label: 'Power Point cost (total)', type: 'num' },
              SOURCE_FIELD,
              NOTES_FIELD,
            ]}
          />
          <p className="hint">
            Powers that change numbers (e.g. Improved Reflexes) belong on the Modifiers tab as
            permanent modifiers.
          </p>
        </Panel>
      )}

      <Panel title="Foci" module>
        <ItemList
          items={m.foci}
          onChange={(v) => update((x) => void (x.magic.foci = v))}
          make={() => ({ name: '', type: '', force: null, bonded: true, active: false, notes: '' })}
          title={(f) => (
            <>
              {f.active && <span className="badge cyan">active</span>} {f.name || 'Unnamed focus'}{' '}
              {f.type && <span className="hint">({f.type})</span>}
            </>
          )}
          columns={[
            { label: 'Force', get: (f) => f.force ?? '—' },
            { label: 'Bonded', get: (f) => (f.bonded ? 'yes' : 'no') },
          ]}
          addLabel="Add focus"
          fields={[
            { key: 'name', label: 'Focus', type: 'text', full: true },
            { key: 'type', label: 'Type', type: 'text' },
            { key: 'force', label: 'Force', type: 'int' },
            { key: 'bonded', label: 'Bonded', type: 'bool' },
            { key: 'active', label: 'Active', type: 'bool' },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Spirits" module>
        <ItemList
          items={m.spirits}
          onChange={(v) => update((x) => void (x.magic.spirits = v))}
          make={() => ({ type: '', force: null, services: null, bound: false, notes: '' })}
          title={(s) => (
            <>
              {s.bound && <span className="badge">bound</span>} {s.type || 'Unnamed spirit'}
            </>
          )}
          columns={[
            { label: 'Force', get: (s) => s.force ?? '—' },
            { label: 'Services', get: (s) => s.services ?? '—' },
          ]}
          addLabel="Add spirit"
          fields={[
            { key: 'type', label: 'Spirit type', type: 'text', full: true },
            { key: 'force', label: 'Force', type: 'int' },
            { key: 'services', label: 'Services owed', type: 'int' },
            { key: 'bound', label: 'Bound', type: 'bool' },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Magic notes" module>
        <TextField label="Notes" value={m.notes} onChange={(v) => set('notes', v)} multiline />
      </Panel>
    </div>
  )
}
