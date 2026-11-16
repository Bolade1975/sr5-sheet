import { useMemo } from 'react'
import type { Character } from '../domain/schema'
import { displayName } from '../domain/factory'
import { CharacterContext, useCharacterStore, type SaveStatus } from '../state/store'
import { CoreTab } from './tabs/CoreTab'
import { ExportTab } from './tabs/ExportTab'
import { GearTab } from './tabs/GearTab'
import { LedgerTab } from './tabs/LedgerTab'
import { MagicTab } from './tabs/MagicTab'
import { MatrixTab } from './tabs/MatrixTab'
import { ModifiersTab } from './tabs/ModifiersTab'
import { NotesTab } from './tabs/NotesTab'
import { PlayTab } from './tabs/PlayTab'
import { PoolsTab } from './tabs/PoolsTab'
import { ResonanceTab } from './tabs/ResonanceTab'
import { RiggerTab } from './tabs/RiggerTab'
import { SkillsTab } from './tabs/SkillsTab'
import { SocialTab } from './tabs/SocialTab'

export type TabKey =
  | 'play'
  | 'core'
  | 'skills'
  | 'pools'
  | 'gear'
  | 'mods'
  | 'social'
  | 'karma'
  | 'rigger'
  | 'matrix'
  | 'magic'
  | 'resonance'
  | 'notes'
  | 'export'

type TabDef = { key: TabKey; label: string; module?: keyof Character['modules'] }

const TABS: TabDef[] = [
  { key: 'play', label: 'Play' },
  { key: 'core', label: 'Core' },
  { key: 'skills', label: 'Skills' },
  { key: 'pools', label: 'Pools' },
  { key: 'gear', label: 'Gear & Ware' },
  { key: 'mods', label: 'Modifiers' },
  { key: 'social', label: 'Social' },
  { key: 'karma', label: 'Karma & ¥' },
  { key: 'rigger', label: 'Rigger', module: 'rigger' },
  { key: 'matrix', label: 'Matrix', module: 'decker' },
  { key: 'magic', label: 'Magic', module: 'magic' },
  { key: 'resonance', label: 'Resonance', module: 'technomancer' },
  { key: 'notes', label: 'Notes' },
  { key: 'export', label: 'Export' },
]

const STATUS_TEXT: Record<SaveStatus, string> = {
  loading: 'Loading…',
  saved: '✓ Saved',
  pending: 'Unsaved…',
  saving: 'Saving…',
  error: '⚠ Save failed',
}

export function CharacterScreen(props: {
  id: string
  tab: TabKey
  setTab: (t: TabKey) => void
  back: () => void
}) {
  const store = useCharacterStore(props.id)
  const { character: c, update } = store
  const ctx = useMemo(() => (c ? { c, update } : null), [c, update])

  if (store.loadError)
    return (
      <main>
        <div className="banner">Could not open this character: {store.loadError}</div>
        <button className="btn" onClick={props.back}>
          ← Back to roster
        </button>
      </main>
    )
  if (!c || !ctx) return <main className="empty">Loading…</main>

  const visible = TABS.filter((t) => !t.module || c.modules[t.module])
  const tab = visible.some((t) => t.key === props.tab) ? props.tab : 'play'

  return (
    <CharacterContext.Provider value={ctx}>
      <header className="topbar">
        <div className="topbar-row">
          <button
            className="btn small ghost"
            onClick={() => void store.flush().then(props.back)}
            aria-label="Back to roster"
          >
            ← Roster
          </button>
          <div className="topbar-title">
            {displayName(c)}
            <small>
              {[c.identity.metatype, c.isExample ? 'EXAMPLE DATA' : '']
                .filter(Boolean)
                .join(' · ') || 'Shadowrun 5th Edition'}
            </small>
          </div>
          <span className={`status ${store.status}`} role="status" aria-live="polite">
            {STATUS_TEXT[store.status]}
          </span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {visible.map((t) => (
            <button
              key={t.key}
              className={`tab ${t.module ? 'module' : ''}`}
              aria-current={t.key === tab ? 'page' : undefined}
              onClick={() => {
                props.setTab(t.key)
                window.scrollTo({ top: 0 })
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {store.status === 'error' && (
          <div className="banner">
            <b>Your latest changes are NOT saved.</b> {store.saveError} — the app will retry on the
            next change.{' '}
            <button className="btn small" onClick={() => void store.flush()}>
              Retry now
            </button>
          </div>
        )}
        {tab === 'play' && <PlayTab />}
        {tab === 'core' && <CoreTab />}
        {tab === 'skills' && <SkillsTab />}
        {tab === 'pools' && <PoolsTab />}
        {tab === 'gear' && <GearTab />}
        {tab === 'mods' && <ModifiersTab />}
        {tab === 'social' && <SocialTab />}
        {tab === 'karma' && <LedgerTab />}
        {tab === 'rigger' && <RiggerTab />}
        {tab === 'matrix' && <MatrixTab />}
        {tab === 'magic' && <MagicTab />}
        {tab === 'resonance' && <ResonanceTab />}
        {tab === 'notes' && <NotesTab />}
        {tab === 'export' && <ExportTab />}
      </main>
    </CharacterContext.Provider>
  )
}
