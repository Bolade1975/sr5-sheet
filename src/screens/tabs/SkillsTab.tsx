import { useMemo, useState } from 'react'
import { newId } from '../../domain/factory'
import { ATTRIBUTE_KEYS, type Skill, type SkillCategory } from '../../domain/schema'
import { ATTRIBUTE_LABELS } from '../../rules/engine'
import {
  KNOWLEDGE_ATTRIBUTE,
  knowledgePool,
  languagePool,
  skillPool,
  skillRating,
} from '../../rules/pools'
import { SKILL_CATALOG, SKILL_GROUPS, groupMembers } from '../../rules/skillCatalog'
import { makeSkillFromCatalog } from '../../rules/skillFactory'
import { useChar } from '../../state/store'
import { Breakdown, ConfirmButton, Panel, Sheet } from '../../ui/components'
import { Check, ListField, NumberField, Select, TextField } from '../../ui/fields'
import { ItemList } from '../../ui/ItemList'
import { NOTES_FIELD } from '../../ui/fieldDefs'

const CATEGORIES: { value: SkillCategory | 'all' | 'fav'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fav', label: '★ Favorites' },
  { value: 'combat', label: 'Combat' },
  { value: 'physical', label: 'Physical' },
  { value: 'social', label: 'Social' },
  { value: 'technical', label: 'Technical' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'magical', label: 'Magical' },
  { value: 'resonance', label: 'Resonance' },
  { value: 'other', label: 'Other' },
]

type Sort = 'name' | 'rating' | 'pool' | 'attribute'

export function SkillsTab() {
  const { c, update } = useChar()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<SkillCategory | 'all' | 'fav'>('all')
  const [sort, setSort] = useState<Sort>('name')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => {
    const list = c.skills
      .filter((s) => (cat === 'all' ? true : cat === 'fav' ? s.favorite : s.category === cat))
      .filter((s) => {
        const t = q.trim().toLowerCase()
        return (
          !t ||
          s.name.toLowerCase().includes(t) ||
          s.specializations.some((x) => x.toLowerCase().includes(t))
        )
      })
      .map((s) => ({ s, pool: skillPool(c, s), rating: skillRating(c, s) }))
    list.sort((a, b) => {
      if (sort === 'rating')
        return (b.rating ?? -1) - (a.rating ?? -1) || a.s.name.localeCompare(b.s.name)
      if (sort === 'pool')
        return (b.pool.value ?? -99) - (a.pool.value ?? -99) || a.s.name.localeCompare(b.s.name)
      if (sort === 'attribute')
        return a.s.attribute.localeCompare(b.s.attribute) || a.s.name.localeCompare(b.s.name)
      return a.s.name.localeCompare(b.s.name)
    })
    return list
  }, [c, q, cat, sort])

  const setSkill = (id: string, patch: Partial<Skill>) =>
    update((x) => {
      x.skills = x.skills.map((s) => (s.id === id ? { ...s, ...patch } : s))
    })

  return (
    <div className="grid wide">
      <Panel
        title={`Active Skills (${c.skills.length})`}
        className="span-all"
        actions={
          <button className="btn primary" onClick={() => setAdding(true)}>
            + Add skill
          </button>
        }
        hint="Pool = rating + current attribute + modifiers − wounds. Specializations are shown separately (+2 only when relevant). Limit in [brackets]."
      >
        <div className="row" style={{ marginBottom: 10 }}>
          <input
            className="input"
            style={{ flex: '1 1 220px' }}
            placeholder="Search skills or specializations…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search skills"
          />
          <Select
            label="Sort by"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'rating', label: 'Rating' },
              { value: 'pool', label: 'Dice pool' },
              { value: 'attribute', label: 'Attribute' },
            ]}
          />
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {CATEGORIES.map((k) => (
            <button
              key={k.value}
              className={`btn small ${cat === k.value ? 'on' : ''}`}
              aria-pressed={cat === k.value}
              onClick={() => setCat(k.value)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="items">
          {rows.length === 0 && <div className="empty">No skills match.</div>}
          {rows.map(({ s, pool, rating }) => {
            const open = openId === s.id
            return (
              <div className="item" key={s.id}>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <button
                    className="btn small ghost"
                    aria-label={s.favorite ? 'Remove favorite' : 'Mark favorite'}
                    aria-pressed={s.favorite}
                    style={{
                      color: s.favorite ? 'var(--amber)' : 'var(--faint)',
                      fontSize: '1.2rem',
                      minWidth: 44,
                    }}
                    onClick={() => setSkill(s.id, { favorite: !s.favorite })}
                  >
                    {s.favorite ? '★' : '☆'}
                  </button>
                  <button
                    type="button"
                    className="item-summary"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : s.id)}
                  >
                    <span className="item-title">
                      {s.name || 'Unnamed skill'}
                      {s.specializations.length > 0 && (
                        <span className="hint"> ({s.specializations.join(', ')})</span>
                      )}
                      {s.defaultable === false && (
                        <span className="badge red" style={{ marginLeft: 6 }}>
                          no default
                        </span>
                      )}
                      {s.defaultable === null && (
                        <span className="badge" style={{ marginLeft: 6 }}>
                          default: verify
                        </span>
                      )}
                      {pool.overridden && (
                        <span className="badge" style={{ marginLeft: 6 }}>
                          OVERRIDE
                        </span>
                      )}
                    </span>
                    <span className="item-cols">
                      <span>
                        Rtg <b>{rating ?? '—'}</b>
                      </span>
                      <span>
                        <b>{s.attribute}</b>
                      </span>
                      <span>
                        Pool{' '}
                        <b style={{ color: 'var(--cyan)', fontSize: '1.15rem' }}>
                          {pool.value ?? '—'}
                        </b>
                        {pool.limit && <span> [{pool.limit.value ?? pool.limit.label}]</span>}
                      </span>
                    </span>
                  </button>
                </div>
                {open && (
                  <SkillEditor
                    skill={s}
                    onSet={(p) => setSkill(s.id, p)}
                    onDelete={() =>
                      update((x) => void (x.skills = x.skills.filter((y) => y.id !== s.id)))
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      <SkillGroupsPanel />

      <Panel title="Knowledge Skills">
        <ItemList
          items={c.knowledgeSkills}
          onChange={(v) => update((x) => void (x.knowledgeSkills = v))}
          make={() => ({
            name: '',
            type: 'street' as const,
            rating: null,
            specializations: [],
            notes: '',
          })}
          title={(k) => (
            <>
              {k.name || 'Unnamed knowledge'}{' '}
              <span className="hint">
                ({k.type}, {KNOWLEDGE_ATTRIBUTE[k.type]})
              </span>
            </>
          )}
          columns={[
            { label: 'Rtg', get: (k) => k.rating ?? '—' },
            { label: 'Pool', get: (k) => knowledgePool(c, k).value ?? '—' },
          ]}
          addLabel="Add knowledge skill"
          fields={[
            { key: 'name', label: 'Knowledge skill', type: 'text', full: true },
            {
              key: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { value: 'street', label: 'Street (INT)' },
                { value: 'academic', label: 'Academic (LOG)' },
                { value: 'professional', label: 'Professional (LOG)' },
                { value: 'interests', label: 'Interests (INT)' },
              ],
            },
            { key: 'rating', label: 'Rating', type: 'int' },
            { key: 'specializations', label: 'Specializations', type: 'list', full: true },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      <Panel title="Language Skills">
        <ItemList
          items={c.languages}
          onChange={(v) => update((x) => void (x.languages = v))}
          make={() => ({ name: '', native: false, rating: null, specializations: [], notes: '' })}
          title={(l) => l.name || 'Unnamed language'}
          columns={[
            { label: 'Rtg', get: (l) => (l.native ? 'N' : (l.rating ?? '—')) },
            { label: 'Pool', get: (l) => (l.native ? '—' : (languagePool(c, l)?.value ?? '—')) },
          ]}
          addLabel="Add language"
          fields={[
            { key: 'name', label: 'Language', type: 'text', full: true },
            { key: 'native', label: 'Native language (N)', type: 'bool' },
            { key: 'rating', label: 'Rating', type: 'int' },
            { key: 'specializations', label: 'Specializations', type: 'list', full: true },
            NOTES_FIELD,
          ]}
        />
      </Panel>

      {adding && <AddSkillSheet onClose={() => setAdding(false)} onOpen={(id) => setOpenId(id)} />}
    </div>
  )
}

function SkillEditor(props: {
  skill: Skill
  onSet: (p: Partial<Skill>) => void
  onDelete: () => void
}) {
  const { c } = useChar()
  const s = props.skill
  const [showCalc, setShowCalc] = useState(false)
  const pool = skillPool(c, s)
  return (
    <div className="item-body stack">
      <div className="fields">
        <TextField
          label="Skill name"
          value={s.name}
          onChange={(v) => props.onSet({ name: v })}
          className="full"
        />
        <NumberField
          label="Rating (0 = untrained)"
          value={s.rating}
          onChange={(v) => props.onSet({ rating: v })}
        />
        <Select
          label="Linked attribute"
          value={s.attribute}
          onChange={(v) => props.onSet({ attribute: v })}
          options={ATTRIBUTE_KEYS.map((k) => ({ value: k, label: ATTRIBUTE_LABELS[k] }))}
        />
        <Select
          label="Category"
          value={s.category}
          onChange={(v) => props.onSet({ category: v })}
          options={
            CATEGORIES.filter((k) => k.value !== 'all' && k.value !== 'fav') as {
              value: SkillCategory
              label: string
            }[]
          }
        />
        <Select
          label="Limit"
          value={s.limit}
          onChange={(v) => props.onSet({ limit: v })}
          options={[
            { value: 'auto', label: 'Automatic' },
            { value: 'physical', label: 'Physical' },
            { value: 'mental', label: 'Mental' },
            { value: 'social', label: 'Social' },
            { value: 'astral', label: 'Astral' },
            { value: 'gear', label: 'Gear / Force / Accuracy' },
            { value: 'none', label: 'No limit' },
          ]}
        />
        <Select
          label="Skill group"
          value={s.groupId ?? ''}
          onChange={(v) => props.onSet({ groupId: v || null })}
          options={[
            { value: '', label: '— none (own rating) —' },
            ...c.skillGroups.map((g) => ({ value: g.id, label: `${g.name} (${g.rating ?? '—'})` })),
          ]}
        />
        <Select
          label="Can default?"
          value={s.defaultable === null ? 'unknown' : s.defaultable ? 'yes' : 'no'}
          onChange={(v) => props.onSet({ defaultable: v === 'unknown' ? null : v === 'yes' })}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'unknown', label: 'Not verified' },
          ]}
        />
        <ListField
          label="Specializations"
          value={s.specializations}
          onChange={(v) => props.onSet({ specializations: v })}
          className="full"
        />
        <TextField
          label="Source / page"
          value={s.source}
          onChange={(v) => props.onSet({ source: v })}
        />
        <TextField
          label="Notes"
          value={s.notes}
          onChange={(v) => props.onSet({ notes: v })}
          multiline
          className="full"
        />
      </div>
      <div className="row">
        <Check
          label="Favorite (Play dashboard)"
          checked={s.favorite}
          onChange={(v) => props.onSet({ favorite: v })}
        />
        <span className="spacer" />
        <button className="btn" onClick={() => setShowCalc(true)}>
          Pool calculation
        </button>
        <ConfirmButton label="Delete skill" onConfirm={props.onDelete} />
      </div>
      {showCalc && (
        <Sheet title={s.name} onClose={() => setShowCalc(false)}>
          <Breakdown d={pool} limit={pool.limit} specs={pool.specializations} />
        </Sheet>
      )}
    </div>
  )
}

function AddSkillSheet(props: { onClose: () => void; onOpen: (id: string) => void }) {
  const { c, update } = useChar()
  const [q, setQ] = useState('')
  const owned = new Set(c.skills.map((s) => s.catalogKey))
  const list = SKILL_CATALOG.filter((s) => !owned.has(s.key) || s.key.startsWith('exotic')).filter(
    (s) => s.name.toLowerCase().includes(q.toLowerCase()),
  )
  const add = (sk: Skill) => {
    update((x) => void x.skills.push(sk))
    props.onOpen(sk.id)
    props.onClose()
  }
  return (
    <Sheet title="Add active skill" onClose={props.onClose}>
      <div className="stack">
        <input
          className="input"
          placeholder="Search core skills…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search core skills"
          autoFocus
        />
        <button
          className="btn"
          onClick={() =>
            add({
              ...makeSkillFromCatalog('archery'),
              name: q.trim() || 'Custom skill',
              catalogKey: null,
              category: 'other',
              defaultable: null,
              source: '',
            })
          }
        >
          + Custom skill{q.trim() ? `: “${q.trim()}”` : ''}
        </button>
        <div className="items">
          {list.map((s) => (
            <button
              key={s.key}
              className="item item-summary"
              onClick={() => add(makeSkillFromCatalog(s.key))}
            >
              <span className="item-title">{s.name}</span>
              <span className="item-cols">
                <span>{s.attribute}</span>
                <span>{s.category}</span>
                {s.group && <span>{s.group}</span>}
                <span>
                  {s.defaultable === null
                    ? 'default: verify'
                    : s.defaultable
                      ? 'can default'
                      : 'no default'}
                </span>
                <span className="ref">p. {s.page}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}

function SkillGroupsPanel() {
  const { c, update } = useChar()
  const [pick, setPick] = useState('')
  return (
    <Panel
      title="Skill Groups"
      hint="Skills linked to a group use the group's rating. Specializations are not allowed for groups (p. 130)."
    >
      <div className="items">
        {c.skillGroups.length === 0 && <div className="empty">No skill groups.</div>}
        {c.skillGroups.map((g) => {
          const members = c.skills.filter((s) => s.groupId === g.id)
          return (
            <div className="item" key={g.id}>
              <div className="item-body stack" style={{ borderTop: 0 }}>
                <div className="row">
                  <b style={{ flex: 1 }}>{g.name}</b>
                  <NumberField
                    label="Group rating"
                    value={g.rating}
                    onChange={(v) =>
                      update(
                        (x) =>
                          void (x.skillGroups = x.skillGroups.map((y) =>
                            y.id === g.id ? { ...y, rating: v } : y,
                          )),
                      )
                    }
                  />
                </div>
                <div className="hint">
                  Members: {members.map((m) => m.name).join(', ') || 'none linked'}
                </div>
                <div className="row">
                  <ConfirmButton
                    label="Remove group"
                    onConfirm={() =>
                      update((x) => {
                        // Members keep the group's rating as their own so nothing is lost.
                        x.skills = x.skills.map((s) =>
                          s.groupId === g.id
                            ? { ...s, groupId: null, rating: s.rating ?? g.rating }
                            : s,
                        )
                        x.skillGroups = x.skillGroups.filter((y) => y.id !== g.id)
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <Select
          label="Core skill group"
          value={pick}
          onChange={setPick}
          options={[
            { value: '', label: '— choose —' },
            ...SKILL_GROUPS.filter((g) => !c.skillGroups.some((x) => x.name === g)).map((g) => ({
              value: g,
              label: g,
            })),
          ]}
        />
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="btn"
          disabled={!pick}
          onClick={() => {
            update((x) => {
              const gid = newId()
              x.skillGroups.push({ id: gid, name: pick, rating: null, notes: '' })
              for (const m of groupMembers(pick)) {
                const existing = x.skills.find((s) => s.catalogKey === m.key)
                if (existing) existing.groupId = gid
                else x.skills.push({ ...makeSkillFromCatalog(m.key), groupId: gid })
              }
            })
            setPick('')
          }}
        >
          + Add group{pick ? ` “${pick}”` : ''} and link its skills
        </button>
      </div>
    </Panel>
  )
}
