import { useState } from 'react'
import { displayName } from '../../domain/factory'
import { exportCharacter, safeFilename } from '../../domain/transfer'
import { pdfSections, type PdfMode } from '../../pdf/buildDoc'
import { useChar } from '../../state/store'
import { Panel } from '../../ui/components'
import { downloadBlob, downloadJson } from '../../ui/download'
import { Check, Segmented } from '../../ui/fields'
import { todayIso } from '../../ui/format'

export function ExportTab() {
  const { c } = useChar()
  const [mode, setMode] = useState<PdfMode>('full')
  const [includeNotes, setIncludeNotes] = useState(false)
  const [includeHistory, setIncludeHistory] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const opts = { mode, includeNotes, includeHistory, exportDate: new Date() }
  const sections = pdfSections(c, opts)
  const base = `${safeFilename(displayName(c))}-${todayIso()}`

  const exportPdf = async () => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const { renderPdf } = await import('../../pdf/exportPdf')
      const blob = await renderPdf(c, { ...opts, exportDate: new Date() })
      const name = `${base}-${mode === 'full' ? 'sheet' : 'summary'}.pdf`
      downloadBlob(name, blob)
      setDone(
        `Saved ${name} (${Math.round(blob.size / 1024)} KB). Send it to your GM yourself — the app never sends anything.`,
      )
    } catch (e) {
      setError(`PDF export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid">
      <Panel
        title="PDF for the GM"
        hint="A light, print-friendly A4 document generated on this device (works offline)."
      >
        <div className="stack">
          <Segmented
            label="PDF type"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'full', label: 'Full Character Sheet' },
              { value: 'summary', label: 'Play Summary' },
            ]}
          />
          <Check
            label="Include background & notes"
            checked={includeNotes}
            onChange={setIncludeNotes}
          />
          <Check
            label="Include Karma & nuyen history"
            checked={includeHistory}
            onChange={setIncludeHistory}
          />
          <div>
            <button className="btn primary" disabled={busy} onClick={() => void exportPdf()}>
              {busy ? 'Generating…' : 'Export PDF'}
            </button>
          </div>
          {error && <div className="banner">{error}</div>}
          {done && <div className="banner info">{done}</div>}
        </div>
      </Panel>

      <Panel title="Sections included">
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          {sections.map((s) => (
            <li key={s.id} style={{ padding: '3px 0' }}>
              {s.title}
            </li>
          ))}
        </ol>
        <p className="hint">
          Inactive or empty special modules are left out. Manual overrides are marked “OVR” and
          listed. Page numbers, character name and export date appear on every page.
        </p>
      </Panel>

      <Panel
        title="JSON (your own backup)"
        hint="For moving between devices or backup — not for the GM."
      >
        <button
          className="btn"
          onClick={() => downloadJson(`${base}.sr5.json`, exportCharacter(c))}
        >
          Download character JSON
        </button>
      </Panel>
    </div>
  )
}
