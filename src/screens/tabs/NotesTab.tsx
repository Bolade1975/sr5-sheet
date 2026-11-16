import { useChar } from '../../state/store'
import { Panel } from '../../ui/components'
import { TextField } from '../../ui/fields'

export function NotesTab() {
  const { c, update } = useChar()
  return (
    <div className="grid wide">
      <Panel title="Background">
        <TextField
          label="Background"
          value={c.background}
          onChange={(v) => update((x) => void (x.background = v))}
          multiline
        />
      </Panel>
      <Panel title="Notes">
        <TextField
          label="Free notes"
          value={c.notes}
          onChange={(v) => update((x) => void (x.notes = v))}
          multiline
        />
      </Panel>
    </div>
  )
}
