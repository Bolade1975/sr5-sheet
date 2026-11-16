import { ATTRIBUTE_KEYS } from '../../domain/schema'
import { attributeVisible } from '../../rules/visibility'
import {
  ATTRIBUTE_LABELS,
  armorValue,
  attribute,
  conditionMonitor,
  edge,
  essence,
  initiative,
  limit,
  movement,
  overflow,
  relevantInitModes,
} from '../../rules/engine'
import { useChar } from '../../state/store'
import { Panel, Readout } from '../../ui/components'
import { Check, NumberField, TextField } from '../../ui/fields'
import { fmtSigned } from '../../ui/format'
import { ItemList } from '../../ui/ItemList'
import { NOTES_FIELD, SOURCE_FIELD } from '../../ui/fieldDefs'

export function CoreTab() {
  const { c, update } = useChar()
  const id = c.identity
  const setId = (k: keyof typeof id) => (v: string) => update((x) => void (x.identity[k] = v))

  return (
    <div className="grid">
      <Panel title="Identity">
        <div className="row" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
          <Portrait />
        </div>
        <div className="fields">
          <TextField label="Name" value={id.name} onChange={setId('name')} />
          <TextField label="Alias / street name" value={id.alias} onChange={setId('alias')} />
          <TextField label="Metatype" value={id.metatype} onChange={setId('metatype')} />
          <TextField label="Player" value={id.player} onChange={setId('player')} />
          <TextField label="Ethnicity" value={id.ethnicity} onChange={setId('ethnicity')} />
          <TextField label="Age" value={id.age} onChange={setId('age')} />
          <TextField label="Sex" value={id.sex} onChange={setId('sex')} />
          <TextField label="Height" value={id.height} onChange={setId('height')} />
          <TextField label="Weight" value={id.weight} onChange={setId('weight')} />
          <TextField
            label="Description"
            value={id.description}
            onChange={setId('description')}
            multiline
            className="full"
          />
        </div>
      </Panel>

      <Panel title="Modules" hint="Turning a module off only hides it — its data is kept.">
        <div className="stack">
          <Check
            label="Rigger / Vehicles / Drones"
            checked={c.modules.rigger}
            onChange={(v) => update((x) => void (x.modules.rigger = v))}
          />
          <Check
            label="Decker / Matrix"
            checked={c.modules.decker}
            onChange={(v) => update((x) => void (x.modules.decker = v))}
          />
          <Check
            label="Magic / Adept"
            checked={c.modules.magic}
            onChange={(v) => update((x) => void (x.modules.magic = v))}
          />
          <Check
            label="Technomancer"
            checked={c.modules.technomancer}
            onChange={(v) => update((x) => void (x.modules.technomancer = v))}
          />
        </div>
      </Panel>

      <Panel
        title="Attributes"
        hint="Base = natural rating. Augmentations come from permanent modifiers (Modifiers tab)."
      >
        <table className="attr-table">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Base</th>
              <th>Aug.</th>
              <th>Current</th>
            </tr>
          </thead>
          <tbody>
            {ATTRIBUTE_KEYS.filter((k) => attributeVisible(k, c)).map((k) => {
              const a = attribute(c, k)
              const aug = a.augmentation + a.situational + a.encumbrance
              return (
                <tr key={k}>
                  <td>
                    {ATTRIBUTE_LABELS[k]}
                    {a.capped && <div className="badge">+4 cap</div>}
                    {a.encumbrance !== 0 && <div className="badge red">encumbered</div>}
                  </td>
                  <td>
                    <NumberField
                      label={`${ATTRIBUTE_LABELS[k]} base`}
                      hideLabel
                      value={a.base}
                      onChange={(v) => update((x) => void (x.attributes[k].base = v))}
                    />
                  </td>
                  <td className="num">{aug === 0 ? '—' : fmtSigned(aug)}</td>
                  <td className="attr-current num">
                    {a.current ?? '—'}
                    {a.current !== null && a.base !== null && a.current !== a.base && (
                      <span className="hint"> ({a.base})</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 10 }}>
          <span className="hint">Edge points remaining:</span>
          <b className="num">{edge(c).remaining ?? '—'}</b>
          <span className="hint">of {edge(c).total ?? '—'}</span>
        </div>
      </Panel>

      <Panel
        title="Derived"
        hint="Tap any value for its calculation, rule reference and manual override."
      >
        <div className="readouts">
          <Readout d={limit(c, 'physical')} label="Physical Limit" />
          <Readout d={limit(c, 'mental')} label="Mental Limit" />
          <Readout d={limit(c, 'social')} label="Social Limit" />
          {c.modules.magic && <Readout d={limit(c, 'astral')} label="Astral Limit" />}
          <Readout d={essence(c)} />
          <Readout d={armorValue(c)} />
          <Readout d={conditionMonitor(c, 'physical')} label="Physical Boxes" />
          <Readout d={conditionMonitor(c, 'stun')} label="Stun Boxes" />
          <Readout d={overflow(c)} label="Overflow" />
          <Readout d={movement(c, 'walk')} label="Walk" suffix=" m" />
          <Readout d={movement(c, 'run')} label="Run" suffix=" m" />
        </div>
        <h3 style={{ margin: '14px 0 6px', fontSize: '1rem', color: 'var(--muted)' }}>
          INITIATIVE
        </h3>
        <div className="readouts">
          {relevantInitModes(c).map((m) => {
            const i = initiative(c, m)
            return (
              <div key={m} className="stack" style={{ gap: 4 }}>
                <Readout
                  d={i.score}
                  label={i.score.label}
                  display={
                    i.score.value === null
                      ? undefined
                      : `${i.score.value} + ${i.dice.value ?? '?'}D6`
                  }
                />
                <Readout d={i.dice} label="Dice" display={`${i.dice.value ?? '?'}D6`} />
              </div>
            )
          })}
        </div>
      </Panel>

      <Panel title="Qualities" className="span-all">
        <ItemList
          items={c.qualities}
          onChange={(v) => update((x) => void (x.qualities = v))}
          make={() => ({
            name: '',
            type: 'positive' as const,
            karma: null,
            rating: null,
            source: '',
            notes: '',
          })}
          title={(q) => (
            <>
              <span className={`badge ${q.type === 'positive' ? 'cyan' : 'red'}`}>
                {q.type === 'positive' ? 'P' : 'N'}
              </span>{' '}
              {q.name || 'Unnamed quality'}
            </>
          )}
          columns={[{ label: 'Karma', get: (q) => q.karma ?? '—' }]}
          addLabel="Add quality"
          fields={[
            { key: 'name', label: 'Quality', type: 'text', full: true },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { value: 'positive', label: 'Positive' },
                { value: 'negative', label: 'Negative' },
              ],
            },
            { key: 'rating', label: 'Rating / level', type: 'int' },
            { key: 'karma', label: 'Karma', type: 'int' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
        />
        <p className="hint">
          Qualities that change numbers: add a matching entry on the Modifiers tab (permanent,
          situational or conditional) so it is counted only where it applies.
        </p>
      </Panel>
    </div>
  )
}

function Portrait() {
  const { c, update } = useChar()
  const onFile = async (file: File) => {
    const url = await downscale(file, 480)
    update((x) => void (x.identity.portrait = url))
  }
  return (
    <div className="row">
      {c.identity.portrait ? (
        <img className="portrait" src={c.identity.portrait} alt="Portrait" />
      ) : (
        <div className="portrait" aria-label="No portrait" />
      )}
      <div className="stack">
        <label className="btn">
          {c.identity.portrait ? 'Change portrait' : 'Add portrait (optional)'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void onFile(f)
            }}
          />
        </label>
        {c.identity.portrait && (
          <button
            className="btn danger"
            onClick={() => update((x) => void (x.identity.portrait = ''))}
          >
            Remove portrait
          </button>
        )}
      </div>
    </div>
  )
}

/** Downscale to keep the stored character small (JPEG data URL). */
async function downscale(file: File, max: number): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}
