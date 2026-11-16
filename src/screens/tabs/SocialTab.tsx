import { useChar } from '../../state/store'
import { Panel } from '../../ui/components'
import { NumberField } from '../../ui/fields'
import { fmtNuyen } from '../../ui/format'
import { ItemList } from '../../ui/ItemList'
import { NOTES_FIELD } from '../../ui/fieldDefs'

export function SocialTab() {
  const { c, update } = useChar()
  return (
    <div className="grid wide">
      <Panel title="Contacts" className="span-all">
        <ItemList
          items={c.contacts}
          onChange={(v) => update((x) => void (x.contacts = v))}
          make={() => ({
            name: '',
            archetype: '',
            connection: null,
            loyalty: null,
            favor: '',
            notes: '',
          })}
          title={(k) => (
            <>
              {k.name || 'Unnamed contact'}{' '}
              {k.archetype && <span className="hint">({k.archetype})</span>}
            </>
          )}
          columns={[
            { label: 'Connection', get: (k) => k.connection ?? '—' },
            { label: 'Loyalty', get: (k) => k.loyalty ?? '—' },
          ]}
          addLabel="Add contact"
          fields={[
            { key: 'name', label: 'Name', type: 'text', full: true },
            { key: 'archetype', label: 'Archetype / role', type: 'text' },
            { key: 'connection', label: 'Connection', type: 'int' },
            { key: 'loyalty', label: 'Loyalty', type: 'int' },
            { key: 'favor', label: 'Favors / chips', type: 'text' },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Reputation">
        <div className="fields">
          <NumberField
            label="Street Cred"
            value={c.reputation.streetCred}
            onChange={(v) => update((x) => void (x.reputation.streetCred = v))}
          />
          <NumberField
            label="Notoriety"
            value={c.reputation.notoriety}
            onChange={(v) => update((x) => void (x.reputation.notoriety = v))}
          />
          <NumberField
            label="Public Awareness"
            value={c.reputation.publicAwareness}
            onChange={(v) => update((x) => void (x.reputation.publicAwareness = v))}
          />
        </div>
      </Panel>

      <Panel title="SINs">
        <ItemList
          items={c.sins}
          onChange={(v) => update((x) => void (x.sins = v))}
          make={() => ({ name: '', rating: null, fake: true, notes: '' })}
          title={(s) => (
            <>
              {s.name || 'Unnamed SIN'}{' '}
              {s.fake ? (
                <span className="badge">fake</span>
              ) : (
                <span className="badge cyan">real</span>
              )}
            </>
          )}
          columns={[{ label: 'Rating', get: (s) => s.rating ?? '—' }]}
          addLabel="Add SIN"
          fields={[
            { key: 'name', label: 'Identity / SIN', type: 'text', full: true },
            { key: 'rating', label: 'Rating', type: 'int' },
            { key: 'fake', label: 'Fake SIN', type: 'bool' },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Licenses">
        <ItemList
          items={c.licenses}
          onChange={(v) => update((x) => void (x.licenses = v))}
          make={() => ({ name: '', rating: null, sinId: null, notes: '' })}
          title={(l) => (
            <>
              {l.name || 'Unnamed license'}{' '}
              {l.sinId && (
                <span className="hint">
                  ({c.sins.find((s) => s.id === l.sinId)?.name ?? 'SIN'})
                </span>
              )}
            </>
          )}
          columns={[{ label: 'Rating', get: (l) => l.rating ?? '—' }]}
          addLabel="Add license"
          fields={[
            { key: 'name', label: 'License', type: 'text', full: true },
            { key: 'rating', label: 'Rating', type: 'int' },
            {
              key: 'sinId',
              label: 'Tied to SIN',
              type: 'select',
              options: [
                { value: '', label: '— none —' },
                ...c.sins.map((s) => ({ value: s.id, label: s.name || 'SIN' })),
              ],
            },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Lifestyles">
        <ItemList
          items={c.lifestyles}
          onChange={(v) => update((x) => void (x.lifestyles = v))}
          make={() => ({
            name: '',
            level: '',
            monthlyCost: null,
            monthsPaid: null,
            primary: false,
            notes: '',
          })}
          title={(l) => (
            <>
              {l.primary && <span className="badge cyan">primary</span>}{' '}
              {l.name || 'Unnamed lifestyle'} {l.level && <span className="hint">({l.level})</span>}
            </>
          )}
          columns={[
            { label: 'Cost/mo', get: (l) => fmtNuyen(l.monthlyCost) },
            { label: 'Months paid', get: (l) => l.monthsPaid ?? '—' },
          ]}
          addLabel="Add lifestyle"
          fields={[
            { key: 'name', label: 'Lifestyle / location', type: 'text', full: true },
            { key: 'level', label: 'Level (Street…Luxury)', type: 'text' },
            { key: 'monthlyCost', label: 'Monthly cost (¥)', type: 'int' },
            { key: 'monthsPaid', label: 'Months prepaid', type: 'int' },
            { key: 'primary', label: 'Primary lifestyle', type: 'bool' },
            NOTES_FIELD,
          ]}
        />
      </Panel>
    </div>
  )
}
