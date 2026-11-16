// @vitest-environment node
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { exampleCharacter } from '../domain/example'
import { newCharacter, newId } from '../domain/factory'
import type { Character } from '../domain/schema'
import { SKILL_CATALOG } from '../rules/skillCatalog'
import { makeSkillFromCatalog } from '../rules/skillFactory'
import { buildPdfDoc, pdfSections, TABLE_LAYOUTS, type PdfOptions } from './buildDoc'

const require = createRequire(import.meta.url)

/** Example character with every core skill, very long names and all modules — stress test for layout. */
function stressCharacter(): Character {
  const c = exampleCharacter()
  for (const cat of SKILL_CATALOG) {
    if (c.skills.some((s) => s.catalogKey === cat.key)) continue
    c.skills.push({
      ...makeSkillFromCatalog(cat.key),
      rating: (cat.name.length % 6) + 1,
      specializations:
        cat.name.length > 12 ? ['A rather long specialization name for wrapping'] : [],
    })
  }
  for (let i = 0; i < 25; i++)
    c.knowledgeSkills.push({
      id: newId(),
      name: `Knowledge ${i}: Extremely Long Knowledge Skill Name That Must Wrap Cleanly`,
      type: 'academic',
      rating: 3,
      specializations: [],
      notes: '',
    })
  for (let i = 0; i < 15; i++)
    c.contacts.push({
      id: newId(),
      name: `Contact number ${i} with a long descriptive name`,
      archetype: 'Fixer',
      connection: 3,
      loyalty: 2,
      favor: '',
      notes: 'Some notes that are fairly long to check wrapping in the table cell.',
    })
  for (let i = 0; i < 8; i++)
    c.rigger.vehicles.push({
      ...c.rigger.vehicles[0]!,
      id: newId(),
      name: `Drone ${i} — GM-Nissan Doberman with extended designation`,
    })
  for (let i = 0; i < 20; i++)
    c.magic.spells.push({
      ...c.magic.spells[0]!,
      id: newId(),
      name: `Spell ${i} with a long and descriptive spell name`,
    })
  c.overrides['limit.physical'] = 9
  c.ledger.push({
    id: newId(),
    date: '2026-01-01',
    currency: 'karma',
    amount: 5,
    description: 'Example run',
  })
  c.notes = 'Example notes. '.repeat(80)
  return c
}

const FULL: PdfOptions = {
  mode: 'full',
  includeNotes: true,
  includeHistory: true,
  exportDate: new Date('2026-11-16T12:00:00Z'),
}

async function render(c: Character, o: PdfOptions): Promise<Buffer> {
  const pdfmake = require('pdfmake') as {
    addFonts: (f: unknown) => void
    addTableLayouts: (l: unknown) => void
    setUrlAccessPolicy: (cb: (url: string) => boolean) => void
    createPdf: (d: unknown) => { getBuffer: () => Promise<Buffer> }
  }
  const dir = require
    .resolve('pdfmake/build/fonts/Roboto/Roboto-Regular.ttf')
    .replace(/Roboto-Regular\.ttf$/, '')
  pdfmake.addFonts({
    Roboto: {
      normal: `${dir}Roboto-Regular.ttf`,
      bold: `${dir}Roboto-Medium.ttf`,
      italics: `${dir}Roboto-Italic.ttf`,
      bolditalics: `${dir}Roboto-MediumItalic.ttf`,
    },
  })
  pdfmake.setUrlAccessPolicy(() => false)
  pdfmake.addTableLayouts(TABLE_LAYOUTS)
  return pdfmake.createPdf(buildPdfDoc(c, o)).getBuffer()
}

const pageCount = (buf: Buffer) => (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length

describe('PDF document', () => {
  it('lists sections and leaves out inactive or empty modules', () => {
    const c = newCharacter('Plain')
    c.modules.magic = true // active but empty -> omitted
    const ids = pdfSections(c, FULL).map((s) => s.id)
    expect(ids).toContain('identity')
    expect(ids).toContain('skills')
    expect(ids).not.toContain('magic')
    expect(ids).not.toContain('rigger')
    const ex = pdfSections(exampleCharacter(), FULL).map((s) => s.id)
    expect(ex).toEqual(expect.arrayContaining(['rigger', 'matrix', 'magic', 'resonance']))
  })

  it('respects notes/history options and the summary mode', () => {
    const c = stressCharacter()
    expect(
      pdfSections(c, { ...FULL, includeNotes: false, includeHistory: false }).map((s) => s.id),
    ).not.toContain('notes')
    const summary = pdfSections(c, { ...FULL, mode: 'summary' }).map((s) => s.id)
    expect(summary).not.toContain('contacts')
    expect(summary).toContain('keyPools')
  })

  it('renders a valid multi-page PDF for a large character', async () => {
    const c = stressCharacter()
    const buf = await render(c, FULL)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pageCount(buf)).toBeGreaterThan(3)
    if (process.env.PDF_OUT) {
      writeFileSync(`${process.env.PDF_OUT}/stress-full.pdf`, buf)
      writeFileSync(
        `${process.env.PDF_OUT}/stress-summary.pdf`,
        await render(c, { ...FULL, mode: 'summary' }),
      )
      writeFileSync(
        `${process.env.PDF_OUT}/example-full.pdf`,
        await render(exampleCharacter(), FULL),
      )
      writeFileSync(
        `${process.env.PDF_OUT}/blank-full.pdf`,
        await render(newCharacter('Blank Runner'), FULL),
      )
    }
  }, 60000)

  it('includes every skill even when the list is long', () => {
    const c = stressCharacter()
    const json = JSON.stringify(buildPdfDoc(c, FULL).content)
    for (const s of c.skills) expect(json).toContain(JSON.stringify(s.name).slice(1, -1))
  })
})
