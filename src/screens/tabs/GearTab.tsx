import { armorValue, essence } from '../../rules/engine'
import { meleeWeaponPool, rangedWeaponPool } from '../../rules/pools'
import { useChar } from '../../state/store'
import { Panel, Readout } from '../../ui/components'
import { NumberField } from '../../ui/fields'
import { ItemList } from '../../ui/ItemList'
import { NOTES_FIELD, SOURCE_FIELD } from '../../ui/fieldDefs'

export function GearTab() {
  const { c, update } = useChar()
  const weaponSkills = [
    { value: '', label: '— choose skill —' },
    ...c.skills.map((s) => ({ value: s.id, label: s.name })),
  ]
  return (
    <div className="grid wide">
      <Panel
        title="Ranged Weapons"
        className="span-all"
        hint="Active weapons appear on the Play dashboard. Attack pool = skill + Agility; Accuracy is the limit."
      >
        <ItemList
          items={c.rangedWeapons}
          onChange={(v) => update((x) => void (x.rangedWeapons = v))}
          make={() => ({
            name: '',
            skillId: null,
            accuracy: null,
            damage: '',
            ap: '',
            mode: '',
            rc: '',
            ammoCapacity: null,
            ammoCurrent: null,
            ammoType: '',
            ammoSpare: '',
            active: false,
            source: '',
            notes: '',
          })}
          title={(w) => (
            <>
              {w.active && <span className="badge cyan">active</span>} {w.name || 'Unnamed weapon'}
            </>
          )}
          columns={[
            { label: 'Acc', get: (w) => w.accuracy ?? '—' },
            { label: 'DV', get: (w) => w.damage || '—' },
            { label: 'AP', get: (w) => w.ap || '—' },
            { label: 'Mode', get: (w) => w.mode || '—' },
            { label: 'RC', get: (w) => w.rc || '—' },
            { label: 'Ammo', get: (w) => `${w.ammoCurrent ?? '—'}/${w.ammoCapacity ?? '—'}` },
            { label: 'Pool', get: (w) => rangedWeaponPool(c, w).value ?? '—' },
          ]}
          addLabel="Add ranged weapon"
          fields={[
            { key: 'name', label: 'Weapon', type: 'text', full: true },
            { key: 'skillId', label: 'Skill', type: 'select', options: weaponSkills },
            { key: 'accuracy', label: 'Accuracy', type: 'int' },
            { key: 'damage', label: 'Damage (DV)', type: 'text' },
            { key: 'ap', label: 'AP', type: 'text' },
            { key: 'mode', label: 'Mode', type: 'text' },
            { key: 'rc', label: 'RC', type: 'text' },
            { key: 'ammoCapacity', label: 'Ammo capacity', type: 'int' },
            { key: 'ammoCurrent', label: 'Rounds loaded', type: 'int' },
            { key: 'ammoType', label: 'Ammo type', type: 'text' },
            { key: 'ammoSpare', label: 'Spare ammo', type: 'text' },
            { key: 'active', label: 'Active (Play dashboard)', type: 'bool' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Melee Weapons" className="span-all">
        <ItemList
          items={c.meleeWeapons}
          onChange={(v) => update((x) => void (x.meleeWeapons = v))}
          make={() => ({
            name: '',
            skillId: null,
            reach: null,
            accuracy: null,
            damage: '',
            ap: '',
            active: false,
            source: '',
            notes: '',
          })}
          title={(w) => (
            <>
              {w.active && <span className="badge cyan">active</span>} {w.name || 'Unnamed weapon'}
            </>
          )}
          columns={[
            { label: 'Reach', get: (w) => w.reach ?? '—' },
            { label: 'Acc', get: (w) => w.accuracy ?? '—' },
            { label: 'DV', get: (w) => w.damage || '—' },
            { label: 'AP', get: (w) => w.ap || '—' },
            { label: 'Pool', get: (w) => meleeWeaponPool(c, w).value ?? '—' },
          ]}
          addLabel="Add melee weapon"
          fields={[
            { key: 'name', label: 'Weapon', type: 'text', full: true },
            { key: 'skillId', label: 'Skill', type: 'select', options: weaponSkills },
            { key: 'reach', label: 'Reach', type: 'int' },
            { key: 'accuracy', label: 'Accuracy', type: 'int' },
            { key: 'damage', label: 'Damage (DV)', type: 'text' },
            { key: 'ap', label: 'AP', type: 'text' },
            { key: 'active', label: 'Active (Play dashboard)', type: 'bool' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel
        title="Armor"
        hint="Only the highest worn armor counts; '+' accessories add up to your Strength (p. 169)."
      >
        <div className="readouts" style={{ marginBottom: 10 }}>
          <Readout d={armorValue(c)} label="Current armor" />
        </div>
        <ItemList
          items={c.armor}
          onChange={(v) => update((x) => void (x.armor = v))}
          make={() => ({
            name: '',
            rating: null,
            accessory: false,
            equipped: false,
            source: '',
            notes: '',
          })}
          title={(a) => (
            <>
              {a.equipped && <span className="badge cyan">worn</span>} {a.name || 'Unnamed armor'}
            </>
          )}
          columns={[
            {
              label: 'Rating',
              get: (a) => (a.rating === null ? '—' : `${a.accessory ? '+' : ''}${a.rating}`),
            },
          ]}
          addLabel="Add armor"
          fields={[
            { key: 'name', label: 'Armor', type: 'text', full: true },
            { key: 'rating', label: 'Rating', type: 'int' },
            { key: 'accessory', label: 'Accessory (+ rating)', type: 'bool' },
            { key: 'equipped', label: 'Worn', type: 'bool' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Cyberware & Bioware">
        <div className="readouts" style={{ marginBottom: 10 }}>
          <Readout d={essence(c)} />
        </div>
        <ItemList
          items={c.augmentations}
          onChange={(v) => update((x) => void (x.augmentations = v))}
          make={() => ({
            name: '',
            type: 'cyberware' as const,
            grade: '',
            rating: null,
            essence: null,
            source: '',
            notes: '',
          })}
          title={(a) => (
            <>
              <span className="badge">
                {a.type === 'cyberware' ? 'Cyber' : a.type === 'bioware' ? 'Bio' : 'Other'}
              </span>{' '}
              {a.name || 'Unnamed augmentation'}
              {a.grade && <span className="hint"> ({a.grade})</span>}
            </>
          )}
          columns={[
            { label: 'Rtg', get: (a) => a.rating ?? '—' },
            { label: 'Ess', get: (a) => a.essence ?? '—' },
          ]}
          addLabel="Add augmentation"
          fields={[
            { key: 'name', label: 'Augmentation', type: 'text', full: true },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { value: 'cyberware', label: 'Cyberware' },
                { value: 'bioware', label: 'Bioware' },
                { value: 'other', label: 'Other' },
              ],
            },
            { key: 'grade', label: 'Grade', type: 'text' },
            { key: 'rating', label: 'Rating', type: 'int' },
            { key: 'essence', label: 'Essence cost', type: 'num' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
        />
        <div style={{ marginTop: 10 }}>
          <NumberField
            label="Other Essence adjustment (e.g. −0.5)"
            integer={false}
            value={c.essenceAdjustment}
            allowNull={false}
            onChange={(v) => update((x) => void (x.essenceAdjustment = v ?? 0))}
          />
        </div>
        <p className="hint">
          Attribute or initiative bonuses from ware are entered as permanent modifiers on the
          Modifiers tab, so they are counted exactly once. Magic/Resonance loss from Essence is not
          calculated — enter the current rating on the Core tab.
        </p>
      </Panel>

      <Panel title="Gear" className="span-all">
        <ItemList
          items={c.gear}
          onChange={(v) => update((x) => void (x.gear = v))}
          make={() => ({
            name: '',
            rating: null,
            quantity: null,
            category: '',
            source: '',
            notes: '',
          })}
          title={(g) => (
            <>
              {g.name || 'Unnamed item'}{' '}
              {g.category && <span className="hint">({g.category})</span>}
            </>
          )}
          columns={[
            { label: 'Rtg', get: (g) => g.rating ?? '—' },
            { label: 'Qty', get: (g) => g.quantity ?? '—' },
          ]}
          addLabel="Add gear"
          fields={[
            { key: 'name', label: 'Item', type: 'text', full: true },
            { key: 'category', label: 'Category', type: 'text' },
            { key: 'rating', label: 'Rating', type: 'int' },
            { key: 'quantity', label: 'Quantity', type: 'int' },
            SOURCE_FIELD,
            NOTES_FIELD,
          ]}
        />
      </Panel>
    </div>
  )
}
