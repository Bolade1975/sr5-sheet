import type { Column, Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { displayName } from '../domain/factory'
import { ATTRIBUTE_KEYS, type Character } from '../domain/schema'
import {
  ATTRIBUTE_LABELS,
  armorBreakdown,
  armorValue,
  attribute,
  conditionMonitor,
  edge,
  essence,
  initiative,
  limit,
  matrixMonitor,
  movement,
  overflow,
  relevantInitModes,
  vehicleMonitor,
  woundModifier,
  type Derived,
} from '../rules/engine'
import {
  KNOWLEDGE_ATTRIBUTE,
  customPool,
  favoritePools,
  generalPools,
  knowledgePool,
  languagePool,
  meleeWeaponPool,
  rangedWeaponPool,
  skillPool,
  skillRating,
  type Pool,
} from '../rules/pools'
import { reconcileKarma } from '../rules/karma'
import { buildLoadout, modState, type LoadoutVehicle } from '../rules/loadout'
import { activeOverrides } from '../rules/summary'
import { targetLabel } from '../rules/targets'
import { attributeVisible } from '../rules/visibility'

/**
 * Pure builder for the GM PDF (pdfmake document definition). A separate,
 * light, print-friendly A4 layout — not a screenshot of the dark app.
 * Tables repeat their header row on continuation pages, and text wraps
 * instead of being truncated or scaled down.
 */

export type PdfMode = 'full' | 'summary' | 'loadout'
export type PdfOptions = {
  mode: PdfMode
  includeNotes: boolean
  includeHistory: boolean
  exportDate: Date
}

const C = {
  ink: '#1b2430',
  muted: '#5b6676',
  accent: '#0e7480',
  accent2: '#9b2f78',
  line: '#c9d3dd',
  head: '#e6eef3',
  zebra: '#f6f9fb',
  amber: '#a35f00',
  red: '#b3261e',
}

export type SectionInfo = { id: string; title: string }

// ---------- helpers ----------

const dash = (v: number | string | null | undefined): string =>
  v === null || v === undefined || v === '' ? '—' : String(v)

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'
}

function val(d: Derived): Content {
  if (d.value === null) return { text: '—', color: C.muted }
  if (d.overridden)
    return {
      text: [
        { text: String(d.value), bold: true },
        { text: ' OVR', color: C.amber, bold: true, fontSize: 7 },
      ],
    }
  return { text: String(d.value), bold: true }
}

function initText(c: Character, mode: Parameters<typeof initiative>[1]): Content {
  const i = initiative(c, mode)
  if (i.score.value === null) return { text: '—', color: C.muted }
  const ovr = i.score.overridden || i.dice.overridden
  return {
    text: [
      { text: `${i.score.value} + ${i.dice.value ?? '?'}D6`, bold: true },
      ...(ovr ? [{ text: ' OVR', color: C.amber, bold: true, fontSize: 7 }] : []),
    ],
  }
}

/** "Reaction 3 + Intuition 5 − Wound modifier 1" */
export function basis(d: Derived): string {
  if (d.parts.length === 0) return d.missing.length ? `needs ${d.missing.join(', ')}` : '—'
  return d.parts
    .map((p, i) =>
      i === 0
        ? `${p.label} ${p.value}`
        : `${p.value < 0 ? '−' : '+'} ${p.label} ${Math.abs(p.value)}`,
    )
    .join(' ')
}

function poolTotal(p: Pool): Content {
  const base = val(p)
  return base
}

function poolNotes(p: Pool): string {
  const bits: string[] = []
  if (p.specializations.length) bits.push(`Spec: ${p.specializations.join(', ')}`)
  for (const m of p.conditional) bits.push(`${signed(m.value)} if ${m.condition || m.label}`)
  if (p.conditions) bits.push(p.conditions)
  if (p.missing.length) bits.push(`Needs: ${p.missing.join(', ')}`)
  return bits.join(' · ')
}

function limitText(p: Pool): string {
  if (!p.limit) return '—'
  return p.limit.value !== null ? `${p.limit.label} ${p.limit.value}` : p.limit.label
}

function sectionTitle(text: string, module = false): Content {
  return {
    stack: [
      { text: text.toUpperCase(), style: 'section', color: module ? C.accent2 : C.accent },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 1,
            x2: 523,
            y2: 1,
            lineWidth: 1,
            lineColor: module ? C.accent2 : C.accent,
          },
        ],
      },
    ],
    margin: [0, 10, 0, 5],
    // Used by pageBreakBefore to avoid a heading stranded at the page bottom.
    headlineLevel: 1,
  }
}

function table(
  headers: string[],
  rows: TableCell[][],
  widths: (string | number)[],
  opts: { fontSize?: number } = {},
): Content {
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths,
      body: [headers.map((h) => ({ text: h, style: 'th' })), ...rows],
    },
    layout: 'sr',
    fontSize: opts.fontSize ?? 8.5,
    margin: [0, 0, 0, 4],
  }
}

function kv(
  rows: [string, Content | string][],
  widths: (string | number)[] = ['auto', '*'],
): Content {
  return {
    table: {
      widths,
      body: rows.map(([k, v]) => [
        { text: k, color: C.muted, fontSize: 7.5 },
        typeof v === 'string' ? { text: v } : v,
      ]),
    },
    layout: 'noBordersTight',
    fontSize: 8.5,
  }
}

function boxes(total: number | null, filled: number, color: string, perRow = 12): Content {
  if (total === null) return { text: 'box count needs input', color: C.muted, fontSize: 8 }
  const size = 11
  const gap = 3
  const shapes = Array.from({ length: total }, (_, i) => {
    const col = i % perRow
    const row = Math.floor(i / perRow)
    return {
      type: 'rect' as const,
      x: col * (size + gap),
      y: row * (size + gap),
      w: size,
      h: size,
      lineWidth: 0.8,
      lineColor: '#4a5563',
      color: i < filled ? color : '#ffffff',
    }
  })
  return { canvas: shapes, margin: [0, 2, 0, 2] }
}

// ---------- sections ----------

function identity(c: Character): Content {
  const id = c.identity
  const left = kv([
    ['Name', id.name || '—'],
    ['Alias', id.alias || '—'],
    ['Metatype', id.metatype || '—'],
    ['Player', id.player || '—'],
  ])
  const right = kv([
    ['Ethnicity', id.ethnicity || '—'],
    ['Age / Sex', `${dash(id.age)} / ${dash(id.sex)}`],
    ['Height / Weight', `${dash(id.height)} / ${dash(id.weight)}`],
    [
      'Street Cred / Notoriety / PA',
      `${dash(c.reputation.streetCred)} / ${dash(c.reputation.notoriety)} / ${dash(c.reputation.publicAwareness)}`,
    ],
  ])
  const cols: Column[] = [
    { width: '*', stack: [left] },
    { width: '*', stack: [right] },
  ]
  if (id.portrait.startsWith('data:image'))
    cols.push({ width: 70, image: id.portrait, fit: [70, 88] })
  const out: Content[] = [{ columns: cols, columnGap: 12 }]
  if (c.isExample)
    out.push({
      text: 'EXAMPLE DATA — not a real character',
      color: C.accent2,
      bold: true,
      fontSize: 8,
      margin: [0, 4, 0, 0],
    })
  if (id.description)
    out.push({ text: id.description, fontSize: 8.5, margin: [0, 4, 0, 0], color: C.ink })
  return { stack: out }
}

function attributesTable(c: Character): Content {
  const rows = ATTRIBUTE_KEYS.filter((k) => attributeVisible(k, c)).map((k): TableCell[] => {
    const a = attribute(c, k)
    const aug = a.augmentation + a.situational + a.encumbrance
    return [
      { text: ATTRIBUTE_LABELS[k] },
      { text: dash(a.base), alignment: 'center' },
      { text: aug === 0 ? '—' : signed(aug), alignment: 'center' },
      { text: dash(a.current), alignment: 'center', bold: true },
    ]
  })
  return table(['Attribute', 'Base', 'Aug.', 'Current'], rows, ['*', 32, 32, 40])
}

function derivedBlock(c: Character): Content {
  const e = edge(c)
  const ess = essence(c)
  const rows: [string, Content | string][] = [
    ['Physical Limit', val(limit(c, 'physical'))],
    ['Mental Limit', val(limit(c, 'mental'))],
    ['Social Limit', val(limit(c, 'social'))],
  ]
  if (c.modules.magic) rows.push(['Astral Limit', val(limit(c, 'astral'))])
  rows.push(
    ['Essence', val(ess)],
    ['Edge', `${dash(e.remaining)} of ${dash(e.total)} remaining`],
    ['Armor', val(armorValue(c))],
  )
  rows.push([
    'Walk / Run',
    { text: [val(movement(c, 'walk')) as never, ' / ', val(movement(c, 'run')) as never, ' m'] },
  ])
  for (const m of relevantInitModes(c)) rows.push([initiative(c, m).score.label, initText(c, m)])
  return kv(rows)
}

function conditionBlock(c: Character): Content {
  const w = woundModifier(c).value ?? 0
  return {
    stack: [
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: `Physical ${c.play.physicalDamage}/${dash(conditionMonitor(c, 'physical').value)}`,
                bold: true,
                fontSize: 8.5,
              },
              boxes(conditionMonitor(c, 'physical').value, c.play.physicalDamage, '#d9534f'),
            ],
          },
          {
            width: '*',
            stack: [
              {
                text: `Stun ${c.play.stunDamage}/${dash(conditionMonitor(c, 'stun').value)}`,
                bold: true,
                fontSize: 8.5,
              },
              boxes(conditionMonitor(c, 'stun').value, c.play.stunDamage, '#e0a030'),
            ],
          },
        ],
        columnGap: 10,
      },
      {
        text: `Overflow ${c.play.overflowDamage}/${dash(overflow(c).value)} · Current wound modifier ${signed(w)} (−1 per 3 boxes per track; not applied to damage resistance)`,
        fontSize: 7.5,
        color: C.muted,
        margin: [0, 2, 0, 0],
      },
    ],
  }
}

function poolTable(pools: Pool[], opts: { ruleNotes?: boolean; wide?: boolean } = {}): Content {
  return table(
    ['Pool', 'Dice', 'Limit', 'Basis', 'Notes'],
    pools.map((p) => [
      { text: p.label, bold: true },
      { ...(poolTotal(p) as object), alignment: 'center' } as TableCell,
      { text: limitText(p) },
      { text: basis(p), fontSize: 7, color: C.muted },
      {
        text: [poolNotes(p), ...(opts.ruleNotes ? p.notes : [])].filter(Boolean).join(' · '),
        fontSize: 7,
      },
    ]),
    opts.wide ? [92, 28, 78, '*', 140] : [92, 28, 50, '*', 120],
  )
}

function weaponsTables(c: Character, onlyActive: boolean): Content[] {
  const out: Content[] = []
  const ranged = c.rangedWeapons.filter((w) => !onlyActive || w.active)
  const melee = c.meleeWeapons.filter((w) => !onlyActive || w.active)
  if (ranged.length)
    out.push(
      table(
        ['Ranged weapon', 'Pool', 'Acc', 'DV', 'AP', 'Mode', 'RC', 'Ammo'],
        ranged.map((w) => {
          const p = rangedWeaponPool(c, w)
          return [
            {
              text: [
                w.name || '—',
                w.active ? { text: '  active', color: C.accent, fontSize: 7 } : '',
              ],
            },
            { ...(val(p) as object), alignment: 'center' } as TableCell,
            { text: dash(p.limit?.value ?? w.accuracy), alignment: 'center' },
            { text: dash(w.damage) },
            { text: dash(w.ap) },
            { text: dash(w.mode) },
            { text: dash(w.rc) },
            {
              text:
                `${dash(w.ammoCurrent)}/${dash(w.ammoCapacity)} ${w.ammoType}`.trim() +
                (w.ammoSpare ? ` · spare: ${w.ammoSpare}` : ''),
            },
          ]
        }),
        ['*', 28, 24, 40, 26, 34, 26, 110],
      ),
    )
  if (melee.length)
    out.push(
      table(
        ['Melee weapon', 'Pool', 'Reach', 'Acc', 'DV', 'AP'],
        melee.map((w) => {
          const p = meleeWeaponPool(c, w)
          return [
            { text: w.name || '—' },
            { ...(val(p) as object), alignment: 'center' } as TableCell,
            { text: dash(w.reach), alignment: 'center' },
            { text: dash(p.limit?.value ?? w.accuracy), alignment: 'center' },
            { text: dash(w.damage) },
            { text: dash(w.ap) },
          ]
        }),
        ['*', 30, 34, 30, 60, 34],
      ),
    )
  return out
}

function armorTable(c: Character, onlyWorn: boolean): Content | null {
  const list = c.armor.filter((a) => !onlyWorn || a.equipped)
  if (!list.length) return null
  const b = armorBreakdown(c)
  return {
    stack: [
      table(
        ['Armor', 'Rating', 'Worn', 'Notes'],
        list.map((a) => [
          { text: a.name || '—' },
          {
            text: a.rating === null ? '—' : `${a.accessory ? '+' : ''}${a.rating}`,
            alignment: 'center',
          },
          { text: a.equipped ? 'yes' : '', alignment: 'center' },
          { text: a.notes, fontSize: 7 },
        ]),
        ['*', 40, 30, 180],
      ),
      ...(b.excess > 0
        ? [
            {
              text: `Accessory bonus exceeds Strength: −${Math.floor(b.excess / 2)} Agility & Reaction.`,
              color: C.red,
              fontSize: 7.5,
            } as Content,
          ]
        : []),
    ],
  }
}

function skillsTable(c: Character): Content {
  const rows = [...c.skills]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s): TableCell[] => {
      const p = skillPool(c, s)
      return [
        { text: [s.name || '—', s.favorite ? { text: ' ★', color: C.amber } : ''] },
        { text: dash(skillRating(c, s)), alignment: 'center' },
        { text: s.attribute, alignment: 'center' },
        { text: s.specializations.join(', ') || '—' },
        { ...(val(p) as object), alignment: 'center' } as TableCell,
        { text: limitText(p) },
        {
          text: [
            s.defaultable === false
              ? 'no default'
              : s.defaultable === null
                ? 'default: verify'
                : '',
            p.missing.length ? ` needs: ${p.missing.join(', ')}` : '',
          ].join(''),
          fontSize: 7,
          color: C.muted,
        },
      ]
    })
  return table(
    ['Active skill', 'Rtg', 'Attr', 'Specialization (+2)', 'Pool', 'Limit', 'Notes'],
    rows,
    ['*', 24, 26, 110, 28, 60, 70],
  )
}

function listTable<T>(
  headers: string[],
  items: T[],
  row: (t: T) => (string | number | null)[],
  widths: (string | number)[],
): Content {
  return table(
    headers,
    items.map((t) => row(t).map((v) => ({ text: dash(v) }))),
    widths,
  )
}

function modifiersTable(c: Character): Content | null {
  const shown = c.modifiers.filter((m) => m.kind !== 'situational' || m.active)
  if (!shown.length) return null
  return table(
    ['Modifier', 'Value', 'Type', 'Applies to', 'Condition / source'],
    shown.map((m) => [
      { text: m.name || '—' },
      { text: signed(m.value), alignment: 'center' },
      { text: m.kind === 'situational' ? 'situational (active)' : m.kind },
      { text: m.targets.map((t) => targetLabel(c, t)).join(', ') || '—', fontSize: 7 },
      { text: [m.condition, m.source].filter(Boolean).join(' · ') || '—', fontSize: 7 },
    ]),
    [100, 30, 60, '*', 110],
  )
}

function overridesBlock(c: Character): Content | null {
  const o = activeOverrides(c)
  if (!o.length) return null
  return {
    stack: [
      {
        text: 'ACTIVE MANUAL OVERRIDES (marked OVR)',
        bold: true,
        color: C.amber,
        fontSize: 8.5,
        margin: [0, 6, 0, 2],
      },
      table(
        ['Value', 'Manual', 'Automatic'],
        o.map((x) => [
          { text: x.label },
          { text: String(x.value), bold: true, alignment: 'center' },
          { text: dash(x.auto), alignment: 'center' },
        ]),
        ['*', 50, 60],
      ),
    ],
  }
}

// ---------- module sections ----------

function moduleHasData(c: Character, m: keyof Character['modules']): boolean {
  if (!c.modules[m]) return false
  if (m === 'rigger')
    return (
      c.rigger.vehicles.length > 0 ||
      c.rigger.autosofts.length > 0 ||
      c.rigger.rcc.name !== '' ||
      c.rigger.controlRig !== null ||
      c.rigger.notes !== ''
    )
  if (m === 'decker')
    return c.matrix.devices.length > 0 || c.matrix.programs.length > 0 || c.matrix.notes !== ''
  if (m === 'magic')
    return (
      c.magic.spells.length > 0 ||
      c.magic.adeptPowers.length > 0 ||
      c.magic.foci.length > 0 ||
      c.magic.spirits.length > 0 ||
      c.magic.preparations.length > 0 ||
      c.magic.tradition !== '' ||
      c.attributes.MAG.base !== null
    )
  return (
    c.technomancer.complexForms.length > 0 ||
    c.technomancer.sprites.length > 0 ||
    c.attributes.RES.base !== null ||
    c.technomancer.submersionGrade !== null
  )
}

function riggerSection(c: Character): Content[] {
  const r = c.rigger
  const out: Content[] = [sectionTitle('Rigger — vehicles & drones', true)]
  out.push(
    kv([
      ['Control rig', dash(r.controlRig)],
      [
        'RCC',
        `${r.rcc.name || '—'} · DR ${dash(r.rcc.deviceRating)} · DP ${dash(r.rcc.dataProcessing)} · FW ${dash(r.rcc.firewall)} · Noise Red. ${dash(r.rcc.noiseReduction)} · Sharing ${dash(r.rcc.sharing)} · Matrix dmg ${r.rcc.matrixDamage}/${dash(matrixMonitor(c, 'rcc.cm', r.rcc.deviceRating, 'RCC').value)}`,
      ],
      [
        'Rigging init.',
        {
          text: [
            initText(c, 'riggingAR') as never,
            ' AR · ',
            initText(c, 'riggingCold') as never,
            ' cold · ',
            initText(c, 'riggingHot') as never,
            ' hot',
          ],
        },
      ],
    ]),
  )
  if (r.vehicles.length)
    out.push(
      table(
        ['Vehicle / drone', 'Hand', 'Spd', 'Acc', 'Bod', 'Arm', 'Pil', 'Sen', 'CM', 'Equipment'],
        r.vehicles.map((v) => [
          {
            text: [
              v.name || '—',
              { text: `  ${v.kind}${v.active ? ', active' : ''}`, color: C.muted, fontSize: 7 },
            ],
          },
          { text: dash(v.handling) },
          { text: dash(v.speed) },
          { text: dash(v.acceleration) },
          { text: dash(v.body) },
          { text: dash(v.armor) },
          { text: dash(v.pilot) },
          { text: dash(v.sensor) },
          { text: `${v.damage}/${dash(vehicleMonitor(c, v).value)}` },
          {
            text:
              [
                v.weapons && `Weapons: ${v.weapons}`,
                v.mods && `Mods: ${v.mods}`,
                v.sensors && `Sensors: ${v.sensors}`,
                v.ammo && `Ammo: ${v.ammo}`,
              ]
                .filter(Boolean)
                .join(' · ') || '—',
            fontSize: 7,
          },
        ]),
        ['*', 28, 22, 22, 22, 22, 22, 22, 30, 130],
      ),
    )
  if (r.autosofts.length)
    out.push(
      listTable(
        ['Autosoft', 'Rating', 'Skill', 'Installed on'],
        r.autosofts,
        (a) => [
          a.name,
          a.rating,
          a.skill,
          a.sharedOnRcc
            ? 'RCC (shared)'
            : a.vehicleIds.map((id) => r.vehicles.find((v) => v.id === id)?.name ?? '?').join(', '),
        ],
        ['*', 36, 90, 150],
      ),
    )
  if (r.notes) out.push({ text: r.notes, fontSize: 8 })
  return out
}

function matrixSection(c: Character): Content[] {
  const m = c.matrix
  const out: Content[] = [sectionTitle('Decker — Matrix', true)]
  out.push(
    kv([
      [
        'Matrix init.',
        {
          text: [
            initText(c, 'matrixAR') as never,
            ' AR · ',
            initText(c, 'matrixCold') as never,
            ' cold-sim · ',
            initText(c, 'matrixHot') as never,
            ' hot-sim',
          ],
        },
      ],
    ]),
  )
  if (m.devices.length)
    out.push(
      table(
        ['Device', 'DR', 'Attack', 'Sleaze', 'DP', 'Firewall', 'Slots', 'Matrix CM'],
        m.devices.map((d) => [
          {
            text: [
              d.name || '—',
              { text: `  ${d.type}${d.active ? ', active' : ''}`, color: C.muted, fontSize: 7 },
            ],
          },
          { text: dash(d.deviceRating) },
          { text: dash(d.attack) },
          { text: dash(d.sleaze) },
          { text: dash(d.dataProcessing) },
          { text: dash(d.firewall) },
          { text: dash(d.programSlots) },
          {
            text: `${d.matrixDamage}/${dash(matrixMonitor(c, `device.${d.id}.cm`, d.deviceRating, d.name).value)}`,
          },
        ]),
        ['*', 24, 34, 34, 24, 40, 28, 50],
      ),
    )
  if (m.programs.length)
    out.push(
      listTable(
        ['Program', 'Type', 'Running', 'Notes'],
        m.programs,
        (p) => [p.name, p.type, p.loaded ? 'yes' : '', p.notes],
        ['*', 60, 44, 180],
      ),
    )
  if (m.notes) out.push({ text: m.notes, fontSize: 8 })
  return out
}

function magicSection(c: Character): Content[] {
  const m = c.magic
  const out: Content[] = [sectionTitle('Magic', true)]
  out.push(
    kv([
      ['Type / Tradition', `${m.awakenedType} · ${m.tradition || '—'}`],
      [
        'Drain attributes',
        m.drainAttribute ? `Willpower + ${ATTRIBUTE_LABELS[m.drainAttribute]}` : '—',
      ],
      ['Mentor spirit', m.mentorSpirit || '—'],
      ['Initiate grade / Metamagics', `${dash(m.initiateGrade)} · ${m.metamagics || '—'}`],
      [
        'Astral initiative / limit',
        { text: [initText(c, 'astral') as never, ' · limit ', val(limit(c, 'astral')) as never] },
      ],
    ]),
  )
  if (m.spells.length)
    out.push(
      listTable(
        ['Spell / ritual', 'Category', 'Type', 'Range', 'Duration', 'Drain'],
        m.spells,
        (s) => [
          `${s.name}${s.isRitual ? ' (ritual)' : ''}`,
          s.category,
          s.type,
          s.range,
          s.duration,
          s.drain,
        ],
        ['*', 70, 30, 40, 44, 40],
      ),
    )
  if (m.preparations.length)
    out.push(
      listTable(
        ['Preparation', 'Force', 'Potency', 'Trigger'],
        m.preparations,
        (p) => [p.name, p.force, p.potency, p.trigger],
        ['*', 36, 40, 120],
      ),
    )
  if (m.adeptPowers.length)
    out.push(
      listTable(
        ['Adept power', 'Level', 'PP', 'Notes'],
        m.adeptPowers,
        (p) => [p.name, p.level, p.powerPoints, p.notes],
        ['*', 36, 30, 180],
      ),
    )
  if (m.foci.length)
    out.push(
      listTable(
        ['Focus', 'Type', 'Force', 'Bonded', 'Active'],
        m.foci,
        (f) => [f.name, f.type, f.force, f.bonded ? 'yes' : 'no', f.active ? 'yes' : ''],
        ['*', 80, 36, 40, 36],
      ),
    )
  if (m.spirits.length)
    out.push(
      listTable(
        ['Spirit', 'Force', 'Services', 'Bound'],
        m.spirits,
        (s) => [s.type, s.force, s.services, s.bound ? 'yes' : ''],
        ['*', 36, 44, 36],
      ),
    )
  if (m.notes) out.push({ text: m.notes, fontSize: 8 })
  return out
}

function resonanceSection(c: Character): Content[] {
  const t = c.technomancer
  const out: Content[] = [sectionTitle('Technomancer — Resonance', true)]
  out.push(
    kv([
      [
        'Living Persona',
        `DR ${dash(attribute(c, 'RES').current)} · Attack ${dash(attribute(c, 'CHA').current)} · Sleaze ${dash(attribute(c, 'INT').current)} · DP ${dash(attribute(c, 'LOG').current)} · Firewall ${dash(attribute(c, 'WIL').current)}`,
      ],
      ['Submersion / Echoes', `${dash(t.submersionGrade)} · ${t.echoes || '—'}`],
      ['Matrix damage', 'Taken as Stun (no separate Matrix monitor)'],
    ]),
  )
  if (t.complexForms.length)
    out.push(
      listTable(
        ['Complex form', 'Target', 'Duration', 'Fading'],
        t.complexForms,
        (f) => [f.name, f.target, f.duration, f.fading],
        ['*', 70, 50, 50],
      ),
    )
  if (t.sprites.length)
    out.push(
      listTable(
        ['Sprite', 'Level', 'Tasks', 'Registered'],
        t.sprites,
        (s) => [s.type, s.level, s.tasks, s.registered ? 'yes' : ''],
        ['*', 36, 36, 56],
      ),
    )
  if (t.notes) out.push({ text: t.notes, fontSize: 8 })
  return out
}

// ---------- assembly ----------

type Section = SectionInfo & { content: () => Content[] }

function sections(c: Character, o: PdfOptions): Section[] {
  if (o.mode === 'loadout') return loadoutSections(c)
  const full = o.mode === 'full'
  const s: Section[] = []
  const favs = favoritePools(c)
  const general = generalPools(c)
  const core = general.filter((p) =>
    [
      'pool.defense',
      'pool.fullDefense',
      'pool.damageResistance',
      'pool.perception',
      'pool.composure',
      'pool.judgeIntentions',
    ].includes(p.id),
  )
  const keyPools: Pool[] = []
  for (const p of [...favs, ...core])
    if (!keyPools.some((k) => k.id === p.id || k.label === p.label)) keyPools.push(p)

  s.push({
    id: 'identity',
    title: 'Identity',
    content: () => [sectionTitle('Identity'), identity(c)],
  })
  s.push({
    id: 'core',
    title: 'Attributes, limits & initiative',
    content: () => [
      sectionTitle('Attributes · Limits · Initiative'),
      {
        columns: [
          { width: '45%', stack: [attributesTable(c)] },
          { width: '*', stack: [derivedBlock(c)] },
        ],
        columnGap: 14,
      },
    ],
  })
  s.push({
    id: 'condition',
    title: 'Condition monitor',
    content: () => [sectionTitle('Condition Monitor'), conditionBlock(c)],
  })
  s.push({
    id: 'keyPools',
    title: 'Key dice pools & favorites',
    content: () => [sectionTitle('Key Dice Pools'), poolTable(keyPools)],
  })
  s.push({
    id: 'combat',
    title: full ? 'Combat (all weapons & armor)' : 'Combat (active weapons & worn armor)',
    content: () => {
      const w = weaponsTables(c, !full)
      const a = armorTable(c, !full)
      return [
        sectionTitle('Combat'),
        ...(w.length
          ? w
          : [{ text: 'No weapons listed.', color: C.muted, fontSize: 8 } as Content]),
        ...(a ? [a] : []),
      ]
    },
  })
  const ov = overridesBlock(c)
  if (ov) s.push({ id: 'overrides', title: 'Manual overrides', content: () => [ov] })

  if (full) {
    s.push({
      id: 'skills',
      title: `Active skills (${c.skills.length})`,
      content: () => [
        sectionTitle('Active Skills'),
        c.skills.length ? skillsTable(c) : { text: 'None.', fontSize: 8 },
      ],
    })
    if (c.skillGroups.length)
      s.push({
        id: 'groups',
        title: 'Skill groups',
        content: () => [
          sectionTitle('Skill Groups'),
          listTable(
            ['Group', 'Rating', 'Members'],
            c.skillGroups,
            (g) => [
              g.name,
              g.rating,
              c.skills
                .filter((x) => x.groupId === g.id)
                .map((x) => x.name)
                .join(', '),
            ],
            ['*', 40, 260],
          ),
        ],
      })
    if (c.knowledgeSkills.length || c.languages.length)
      s.push({
        id: 'knowledge',
        title: 'Knowledge & language skills',
        content: () => [
          sectionTitle('Knowledge & Language Skills'),
          table(
            ['Skill', 'Type', 'Rtg', 'Pool', 'Specialization (+2)'],
            [
              ...c.knowledgeSkills.map((k): TableCell[] => [
                { text: k.name || '—' },
                { text: `${k.type} (${KNOWLEDGE_ATTRIBUTE[k.type]})` },
                { text: dash(k.rating), alignment: 'center' },
                { ...(val(knowledgePool(c, k)) as object), alignment: 'center' } as TableCell,
                { text: k.specializations.join(', ') || '—' },
              ]),
              ...c.languages.map((l): TableCell[] => {
                const p = languagePool(c, l)
                return [
                  { text: l.name || '—' },
                  { text: 'language (INT)' },
                  { text: l.native ? 'N' : dash(l.rating), alignment: 'center' },
                  p
                    ? ({ ...(val(p) as object), alignment: 'center' } as TableCell)
                    : { text: '—', alignment: 'center' },
                  { text: l.specializations.join(', ') || '—' },
                ]
              }),
            ],
            ['*', 90, 26, 30, 130],
          ),
        ],
      })
    if (c.qualities.length)
      s.push({
        id: 'qualities',
        title: 'Qualities',
        content: () => [
          sectionTitle('Qualities'),
          listTable(
            ['Quality', 'P/N', 'Rating', 'Karma', 'Notes'],
            c.qualities,
            (q) => [
              q.name,
              q.type === 'positive' ? 'P' : 'N',
              q.rating,
              q.karma,
              [q.notes, q.source].filter(Boolean).join(' · '),
            ],
            ['*', 26, 36, 36, 180],
          ),
        ],
      })
    s.push({
      id: 'pools',
      title: 'All general dice pools',
      content: () => [
        sectionTitle('General Dice Pools'),
        poolTable([...general, ...c.customPools.map((p) => customPool(c, p))]),
      ],
    })
    const mods = modifiersTable(c)
    if (mods)
      s.push({
        id: 'modifiers',
        title: 'Modifiers in effect',
        content: () => [sectionTitle('Modifiers'), mods],
      })
    if (c.augmentations.length)
      s.push({
        id: 'augs',
        title: 'Cyberware & bioware',
        content: () => [
          sectionTitle('Augmentations'),
          listTable(
            ['Augmentation', 'Type', 'Grade', 'Rtg', 'Essence', 'Notes'],
            c.augmentations,
            (a) => [a.name, a.type, a.grade, a.rating, a.essence, a.notes],
            ['*', 50, 50, 26, 40, 140],
          ),
          { text: `Essence: ${dash(essence(c).value)}`, bold: true, fontSize: 8.5 },
        ],
      })
    if (c.gear.length)
      s.push({
        id: 'gear',
        title: 'Gear',
        content: () => [
          sectionTitle('Gear'),
          listTable(
            ['Item', 'Category', 'Rtg', 'Qty', 'Notes'],
            c.gear,
            (g) => [g.name, g.category, g.rating, g.quantity, g.notes],
            ['*', 70, 26, 26, 170],
          ),
        ],
      })
    if (c.contacts.length)
      s.push({
        id: 'contacts',
        title: 'Contacts',
        content: () => [
          sectionTitle('Contacts'),
          listTable(
            ['Contact', 'Role', 'Connection', 'Loyalty', 'Notes'],
            c.contacts,
            (k) => [
              k.name,
              k.archetype,
              k.connection,
              k.loyalty,
              [k.favor, k.notes].filter(Boolean).join(' · '),
            ],
            ['*', 70, 50, 40, 160],
          ),
        ],
      })
    s.push({
      id: 'ids',
      title: 'SINs, licenses, lifestyles & resources',
      content: () => [
        sectionTitle('IDs · Lifestyles · Resources'),
        kv([
          [
            'Nuyen',
            c.resources.nuyen === null ? '—' : `${c.resources.nuyen.toLocaleString('en-US')}¥`,
          ],
          [
            'Karma (available / total)',
            `${dash(c.resources.karma)} / ${dash(c.resources.karmaTotal)}`,
          ],
          [
            'Street Cred / Notoriety / Public Awareness',
            `${dash(c.reputation.streetCred)} / ${dash(c.reputation.notoriety)} / ${dash(c.reputation.publicAwareness)}`,
          ],
        ]),
        ...(c.sins.length
          ? [
              listTable(
                ['SIN', 'Rating', 'Fake', 'Notes'],
                c.sins,
                (x) => [x.name, x.rating, x.fake ? 'yes' : 'no', x.notes],
                ['*', 40, 30, 200],
              ),
            ]
          : []),
        ...(c.licenses.length
          ? [
              listTable(
                ['License', 'Rating', 'SIN', 'Notes'],
                c.licenses,
                (l) => [
                  l.name,
                  l.rating,
                  c.sins.find((x) => x.id === l.sinId)?.name ?? '',
                  l.notes,
                ],
                ['*', 40, 100, 150],
              ),
            ]
          : []),
        ...(c.lifestyles.length
          ? [
              listTable(
                ['Lifestyle', 'Level', '¥/month', 'Months', 'Notes'],
                c.lifestyles,
                (l) => [
                  `${l.name}${l.primary ? ' (primary)' : ''}`,
                  l.level,
                  l.monthlyCost,
                  l.monthsPaid,
                  l.notes,
                ],
                ['*', 60, 50, 40, 150],
              ),
            ]
          : []),
      ],
    })
  } else {
    if (c.skills.some((x) => x.favorite) || c.skills.length)
      s.push({
        id: 'skills',
        title: `Active skills (${c.skills.length}, compact)`,
        content: () => [
          sectionTitle('Active Skills'),
          c.skills.length ? skillsTable(c) : { text: 'None.', fontSize: 8 },
        ],
      })
  }

  if (moduleHasData(c, 'rigger'))
    s.push({ id: 'rigger', title: 'Rigger module', content: () => riggerSection(c) })
  if (moduleHasData(c, 'decker'))
    s.push({ id: 'matrix', title: 'Matrix module', content: () => matrixSection(c) })
  if (moduleHasData(c, 'magic'))
    s.push({ id: 'magic', title: 'Magic module', content: () => magicSection(c) })
  if (moduleHasData(c, 'technomancer'))
    s.push({ id: 'resonance', title: 'Resonance module', content: () => resonanceSection(c) })

  if (o.includeNotes && (c.background || c.notes))
    s.push({
      id: 'notes',
      title: 'Background & notes',
      content: () => [
        sectionTitle('Background & Notes'),
        ...(c.background
          ? [
              { text: 'Background', bold: true, fontSize: 8.5 } as Content,
              { text: c.background, fontSize: 8.5, margin: [0, 0, 0, 6] } as Content,
            ]
          : []),
        ...(c.notes
          ? [
              { text: 'Notes', bold: true, fontSize: 8.5 } as Content,
              { text: c.notes, fontSize: 8.5 } as Content,
            ]
          : []),
      ],
    })
  if (o.includeHistory && c.ledger.length)
    s.push({
      id: 'history',
      title: `Karma & nuyen history (${c.ledger.length})`,
      content: () => [
        sectionTitle('Karma & Nuyen History'),
        listTable(
          ['Date', 'Currency', 'Change', 'Description'],
          c.ledger,
          (e) => [
            e.date,
            e.currency === 'karma' ? 'Karma' : 'Nuyen',
            signed(e.amount),
            e.description,
          ],
          [60, 50, 50, '*'],
        ),
      ],
    })
  if (o.includeHistory && c.karmaHistory.length)
    s.push({
      id: 'karmaHistory',
      title: `Karma History (${c.karmaHistory.length})`,
      content: () => [sectionTitle('Karma History'), ...karmaHistoryBlock(c)],
    })
  return s
}

function karmaHistoryBlock(c: Character): Content[] {
  const r = reconcileKarma(c)
  const status =
    r.status === 'balanced' ? 'Balanced' : r.status === 'mismatch' ? 'Mismatch' : 'Needs input'
  return [
    kv([
      ['Total Karma Earned', dash(r.earned)],
      ['Total Karma Spent (log)', String(r.spent)],
      ['Unspent Karma', dash(r.unspent)],
      ['Expected Unspent', dash(r.expected)],
      [
        'Difference',
        {
          text: `${r.difference === null ? '—' : signed(r.difference)}  ${status}`,
          bold: true,
          color: r.status === 'balanced' ? C.accent : r.status === 'mismatch' ? C.red : C.amber,
        },
      ],
    ]),
    table(
      ['Date', 'Category', 'Purchased / improved', 'Before', 'After', 'Karma', 'Comment / source'],
      c.karmaHistory.map((e) => [
        { text: dash(e.date) },
        { text: e.category },
        {
          text: [
            e.name || '—',
            e.entryType === 'historical' ? { text: '  earlier', color: C.muted, fontSize: 7 } : '',
          ],
        },
        { text: dash(e.before) },
        { text: dash(e.after) },
        { text: dash(e.karmaSpent), alignment: 'center', bold: true },
        { text: [e.comment, e.source].filter(Boolean).join(' · ') || '—', fontSize: 7 },
      ]),
      [52, 62, '*', 40, 40, 32, 110],
    ),
  ]
}

// ---------- Current Loadout PDF ----------

function linkedText(mods: Character['modifiers']): string {
  return mods.map((m) => `${signed(m.value)} ${m.name || 'modifier'} (${modState(m)})`).join('; ')
}

function ammoText(w: Character['rangedWeapons'][number]): string {
  return (
    `${dash(w.ammoCurrent)}/${dash(w.ammoCapacity)} ${w.ammoType}`.trim() +
    (w.ammoSpare ? ` · spare: ${w.ammoSpare}` : '')
  )
}

function vehicleBlock(lv: LoadoutVehicle): Content[] {
  const v = lv.vehicle
  const out: Content[] = [
    sectionTitle(`${v.kind === 'drone' ? 'Drone' : 'Vehicle'}: ${v.name || 'Unnamed'}`, true),
    table(
      ['Hand', 'Speed', 'Accel', 'Body', 'Armor', 'Pilot', 'Sensor', 'DR', 'Condition', 'Matrix'],
      [
        [
          { text: dash(v.handling) },
          { text: dash(v.speed) },
          { text: dash(v.acceleration) },
          { text: dash(v.body) },
          { text: dash(v.armor) },
          { text: dash(v.pilot) },
          { text: dash(v.sensor) },
          { text: dash(v.deviceRating) },
          { text: `${v.damage}/${dash(lv.conditionMonitor.value)}` },
          { text: `${v.matrixDamage}/${dash(lv.matrixMonitor.value)}` },
        ],
      ],
      [44, 40, 36, 32, 34, 32, 36, 28, '*', '*'],
    ),
  ]
  if (lv.weapons.length)
    out.push(
      table(
        ['Mounted weapon', 'Acc', 'DV', 'AP', 'Mode', 'RC', 'Ammo'],
        lv.weapons.map((w) => [
          { text: w.name || '—', bold: true },
          { text: dash(w.accuracy), alignment: 'center' },
          { text: dash(w.damage) },
          { text: dash(w.ap) },
          { text: dash(w.mode) },
          { text: dash(w.rc) },
          { text: ammoText(w) },
        ]),
        ['*', 26, 40, 30, 40, 26, 120],
      ),
    )
  const extras: [string, string][] = []
  if (lv.autosofts.length)
    extras.push([
      `Autosofts (${lv.autosoftSource === 'drone' ? 'installed' : 'shared via RCC'})`,
      lv.autosofts
        .map(
          (a) =>
            `${a.name || 'Autosoft'} ${dash(a.rating)}${a.kind === 'other' ? ' (type not set)' : ''}`,
        )
        .join(', '),
    ])
  if (v.weapons) extras.push(['Weapon notes', v.weapons])
  if (v.ammo) extras.push(['Ammunition', v.ammo])
  if (v.sensors) extras.push(['Sensors', v.sensors])
  if (v.mods) extras.push(['Mods', v.mods])
  if (v.notes) extras.push(['Notes', v.notes])
  for (const w of lv.warnings) extras.push(['Check', w])
  if (extras.length) out.push(kv(extras))
  out.push(poolTable([lv.damageResistance], { ruleNotes: true, wide: true }))
  for (const m of lv.modes) {
    out.push({
      text: m.title.toUpperCase(),
      bold: true,
      fontSize: 8,
      color: C.accent2,
      margin: [0, 4, 0, 2],
    })
    if (m.message) {
      out.push({ text: m.message, fontSize: 8, color: C.muted })
      continue
    }
    if (m.initiative.length)
      out.push({
        text: m.initiative
          .map((i) => {
            const v =
              i.score.value === null
                ? `needs ${i.score.missing.join(', ')}`
                : `${i.score.value} + ${i.diceText}`
            return `${i.label}: ${v}${i.score.overridden ? ' OVR' : ''}`
          })
          .join('   ·   '),
        fontSize: 8,
        margin: [0, 0, 0, 2],
      })
    if (m.pools.length) out.push(poolTable(m.pools, { ruleNotes: true, wide: true }))
    for (const n of m.notes) out.push({ text: n, fontSize: 7, color: C.muted })
  }
  return out
}

function loadoutSections(c: Character): Section[] {
  const lo = buildLoadout(c)
  const general = generalPools(c)
  const pick = (ids: string[]) =>
    ids.map((id) => general.find((p) => p.id === id)).filter((p): p is Pool => !!p)
  const defense = pick([
    'pool.defense',
    'pool.fullDefense',
    'pool.dodge',
    'pool.block',
    'pool.fullDefenseDodge',
    'pool.fullDefenseBlock',
    'pool.damageResistance',
  ])
  const shown = new Set(defense.map((p) => p.id))
  const other: Pool[] = []
  for (const p of [...favoritePools(c), ...general])
    if (!shown.has(p.id) && !other.some((o) => o.label === p.label)) {
      shown.add(p.id)
      other.push(p)
    }
  const s: Section[] = []
  s.push({
    id: 'lo-overview',
    title: 'Character overview',
    content: () => {
      const e = edge(c)
      const who =
        [c.identity.name, c.identity.alias && `“${c.identity.alias}”`, c.identity.metatype]
          .filter(Boolean)
          .join(' · ') || '—'
      const limits: Content[] = [
        'Physical ',
        val(limit(c, 'physical')),
        '   Mental ',
        val(limit(c, 'mental')),
        '   Social ',
        val(limit(c, 'social')),
      ]
      if (c.modules.magic) limits.push('   Astral ', val(limit(c, 'astral')))
      const rows: [string, Content | string][] = [
        ['Character', who],
        ['Limits', { text: limits as never }],
        ['Armor in use', val(armorValue(c))],
        ['Edge', `${dash(e.remaining)} of ${dash(e.total)} remaining`],
      ]
      for (const m of relevantInitModes(c))
        rows.push([initiative(c, m).score.label, initText(c, m)])
      const out: Content[] = [
        sectionTitle('Character overview'),
        kv(rows),
        { stack: [conditionBlock(c)], margin: [0, 6, 0, 0] },
      ]
      if (c.isExample)
        out.push({
          text: 'EXAMPLE DATA — not a real character',
          color: C.accent2,
          bold: true,
          fontSize: 8,
        })
      return out
    },
  })
  s.push({
    id: 'lo-defense',
    title: 'Defense & damage resistance',
    content: () => [sectionTitle('Defense & Damage Resistance'), poolTable(defense)],
  })
  if (lo.count === 0)
    s.push({
      id: 'lo-empty',
      title: 'No carried items',
      content: () => [
        { text: 'No items are marked Carried.', fontSize: 9, color: C.muted, margin: [0, 6, 0, 0] },
      ],
    })
  if (lo.ranged.length || lo.melee.length)
    s.push({
      id: 'lo-weapons',
      title: `Carried weapons (${lo.ranged.length + lo.melee.length})`,
      content: () => {
        const out: Content[] = [sectionTitle('Carried weapons')]
        const notes = (pool: Pool, mods: Character['modifiers']): TableCell => ({
          text: [poolNotes(pool), linkedText(mods), basis(pool)].filter(Boolean).join(' · '),
          fontSize: 6.8,
          color: C.muted,
        })
        if (lo.ranged.length)
          out.push(
            table(
              ['Ranged weapon', 'Pool', 'Acc', 'DV', 'AP', 'Mode', 'RC', 'Ammo', 'Notes'],
              lo.ranged.map(({ item: w, pool, mods }) => [
                { text: w.name || '—', bold: true },
                { ...(val(pool) as object), alignment: 'center' } as TableCell,
                { text: dash(pool.limit?.value ?? w.accuracy), alignment: 'center' },
                { text: dash(w.damage) },
                { text: dash(w.ap) },
                { text: dash(w.mode) },
                { text: dash(w.rc) },
                { text: ammoText(w), fontSize: 7.5 },
                notes(pool, mods),
              ]),
              [70, 26, 22, 34, 24, 30, 22, 62, '*'],
            ),
          )
        if (lo.melee.length)
          out.push(
            table(
              ['Melee weapon', 'Pool', 'Acc', 'Reach', 'DV', 'AP', 'Notes'],
              lo.melee.map(({ item: w, pool, mods }) => [
                { text: w.name || '—', bold: true },
                { ...(val(pool) as object), alignment: 'center' } as TableCell,
                { text: dash(pool.limit?.value ?? w.accuracy), alignment: 'center' },
                { text: dash(w.reach), alignment: 'center' },
                { text: dash(w.damage) },
                { text: dash(w.ap) },
                notes(pool, mods),
              ]),
              [80, 26, 22, 30, 50, 26, '*'],
            ),
          )
        return out
      },
    })
  if (lo.armor.length)
    s.push({
      id: 'lo-armor',
      title: `Carried armor (${lo.armor.length})`,
      content: () => [
        sectionTitle('Carried armor'),
        table(
          ['Armor', 'Rating', 'Worn', 'Notes / linked modifiers'],
          lo.armor.map(({ item: a, mods }) => [
            { text: a.name || '—', bold: true },
            {
              text: a.rating === null ? '—' : `${a.accessory ? '+' : ''}${a.rating}`,
              alignment: 'center',
            },
            { text: a.equipped ? 'worn' : 'not worn', alignment: 'center' },
            {
              text: [a.notes, linkedText(mods)].filter(Boolean).join(' · ') || '—',
              fontSize: 7.5,
            },
          ]),
          [130, 40, 46, '*'],
        ),
        {
          text: ['Armor in use (worn only, p. 169): ', val(armorValue(c))] as never,
          fontSize: 8.5,
        },
      ],
    })
  const rcc = c.rigger.rcc
  const gearRows: TableCell[][] = [
    ...lo.gear.map(({ item: g, mods }): TableCell[] => [
      { text: g.name || '—', bold: true },
      { text: dash(g.category) },
      { text: dash(g.rating), alignment: 'center' },
      { text: dash(g.quantity), alignment: 'center' },
      { text: [g.notes, linkedText(mods)].filter(Boolean).join(' · ') || '—', fontSize: 7.5 },
    ]),
    ...lo.devices.map(({ item: d, mods }): TableCell[] => [
      { text: d.name || '—', bold: true },
      { text: `${d.type}${d.active ? ' (active)' : ''}` },
      { text: dash(d.deviceRating), alignment: 'center' },
      { text: '—', alignment: 'center' },
      {
        text: [
          `ATT ${dash(d.attack)} · SLZ ${dash(d.sleaze)} · DP ${dash(d.dataProcessing)} · FW ${dash(d.firewall)} · Matrix ${d.matrixDamage}/${dash(matrixMonitor(c, `device.${d.id}.cm`, d.deviceRating, 'Matrix').value)}`,
          linkedText(mods),
        ]
          .filter(Boolean)
          .join(' · '),
        fontSize: 7.5,
      },
    ]),
    ...lo.foci.map(({ item: f, mods }): TableCell[] => [
      { text: f.name || '—', bold: true },
      { text: `Focus${f.type ? ` (${f.type})` : ''}${f.active ? ', active' : ''}` },
      { text: dash(f.force), alignment: 'center' },
      { text: '—', alignment: 'center' },
      {
        text: [f.bonded ? 'bonded' : 'not bonded', linkedText(mods)].filter(Boolean).join(' · '),
        fontSize: 7.5,
      },
    ]),
  ]
  if (lo.rccCarried)
    gearRows.push([
      { text: rcc.name || 'Rigger Command Console', bold: true },
      { text: 'RCC' },
      { text: dash(rcc.deviceRating), alignment: 'center' },
      { text: '—', alignment: 'center' },
      {
        text: `DP ${dash(rcc.dataProcessing)} · FW ${dash(rcc.firewall)} · Noise Red. ${dash(rcc.noiseReduction)} · Sharing ${dash(rcc.sharing)} · Matrix ${rcc.matrixDamage}/${dash(matrixMonitor(c, 'rcc.cm', rcc.deviceRating, 'RCC').value)}`,
        fontSize: 7.5,
      },
    ])
  if (gearRows.length)
    s.push({
      id: 'lo-gear',
      title: `Carried gear (${gearRows.length})`,
      content: () => [
        sectionTitle('Carried gear'),
        table(['Item', 'Category / type', 'Rating', 'Qty', 'Details'], gearRows, [
          120,
          80,
          36,
          26,
          '*',
        ]),
      ],
    })
  for (const lv of lo.vehicles)
    s.push({
      id: `lo-vehicle-${lv.vehicle.id}`,
      title: `${lv.vehicle.kind === 'drone' ? 'Drone' : 'Vehicle'}: ${lv.vehicle.name || 'Unnamed'}`,
      content: () => vehicleBlock(lv),
    })
  if (other.length)
    s.push({
      id: 'lo-pools',
      title: 'Favorite & general pools',
      content: () => [sectionTitle('Favorite & general pools'), poolTable(other)],
    })
  s.push({
    id: 'lo-mods',
    title: 'Active modifiers & manual overrides',
    content: () => {
      const out: Content[] = [sectionTitle('Active modifiers & manual overrides')]
      const mt = modifiersTable(c)
      const ob = overridesBlock(c)
      if (mt) out.push(mt)
      if (ob) out.push(ob)
      if (!mt && !ob)
        out.push({ text: 'No active modifiers or overrides.', fontSize: 8, color: C.muted })
      if (lo.warnings.length)
        out.push({
          text: lo.warnings.join('  ·  '),
          fontSize: 7.5,
          color: C.amber,
          margin: [0, 4, 0, 0],
        })
      out.push({
        text: '“Carried” lists what is brought on the mission; it does not equip or activate anything. Pools use the sheet’s own worn/active state.',
        fontSize: 7,
        color: C.muted,
        margin: [0, 4, 0, 0],
      })
      return out
    },
  })
  return s
}

export function pdfSections(c: Character, o: PdfOptions): SectionInfo[] {
  return sections(c, o).map(({ id, title }) => ({ id, title }))
}

export function buildPdfDoc(c: Character, o: PdfOptions): TDocumentDefinitions {
  const name = displayName(c)
  const date = o.exportDate.toISOString().slice(0, 10)
  const content: Content[] = sections(c, o).flatMap((s) => s.content())
  return {
    pageSize: 'A4',
    pageMargins: [36, 46, 36, 40],
    info: {
      title: `${name} — SR5 ${o.mode === 'loadout' ? 'Current Loadout' : 'Character Sheet'}`,
      subject: 'Shadowrun 5th Edition character sheet',
      creator: 'SR5 Runner Sheet',
    },
    header: (): Content => ({
      margin: [36, 16, 36, 0],
      columns: [
        { text: name, bold: true, fontSize: 11, color: C.ink },
        {
          text:
            o.mode === 'full'
              ? 'SHADOWRUN 5E · FULL CHARACTER SHEET'
              : o.mode === 'loadout'
                ? 'SHADOWRUN 5E · CURRENT LOADOUT'
                : 'SHADOWRUN 5E · PLAY SUMMARY',
          alignment: 'right',
          fontSize: 8,
          color: C.accent,
          bold: true,
          characterSpacing: 0.5,
        },
      ],
    }),
    footer: (currentPage: number, pageCount: number): Content => ({
      margin: [36, 10, 36, 0],
      columns: [
        {
          text: `Exported ${date}${c.isExample ? ' · EXAMPLE DATA' : ''}`,
          fontSize: 7.5,
          color: C.muted,
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: 'right',
          fontSize: 7.5,
          color: C.muted,
        },
      ],
    }),
    content,
    // The heading itself contributes ~2 child nodes; fewer than 4 following nodes means nothing of the section fits.
    pageBreakBefore: (node, queries) =>
      node.headlineLevel === 1 && queries.getFollowingNodesOnPage().length < 4,
    defaultStyle: { font: 'Roboto', fontSize: 9, color: C.ink, lineHeight: 1.1 },
    styles: {
      section: { fontSize: 10.5, bold: true, characterSpacing: 0.8 },
      th: { bold: true, fontSize: 7.5, color: C.ink, fillColor: C.head },
    },
  }
}

/** Table layout registered with pdfmake (thin rules, zebra rows). */
export const TABLE_LAYOUTS = {
  sr: {
    hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
      i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4,
    vLineWidth: () => 0,
    hLineColor: (i: number) => (i <= 1 ? C.accent : C.line),
    fillColor: (row: number) => (row > 0 && row % 2 === 0 ? C.zebra : null),
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 2.5,
    paddingBottom: () => 2.5,
  },
  noBordersTight: {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 0,
    paddingRight: () => 8,
    paddingTop: () => 1.5,
    paddingBottom: () => 1.5,
  },
}
