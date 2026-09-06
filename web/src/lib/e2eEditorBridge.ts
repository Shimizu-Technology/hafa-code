export type E2EEditorAction = {
  run: () => Promise<void> | void
}

export type E2EEditor = {
  getAction: (actionId: string) => E2EEditorAction | null
  hasTextFocus: () => boolean
  setValue: (value: string) => void
}

function selectedEditor(editors: readonly E2EEditor[]) {
  return editors.find((candidate) => candidate.hasTextFocus()) ?? editors.at(-1)
}

export async function runE2EEditorAction(editors: readonly E2EEditor[], actionId: string): Promise<boolean> {
  const editor = selectedEditor(editors)
  const action = editor?.getAction(actionId)
  if (!action) return false

  await action.run()
  return true
}

export function setE2EEditorValue(editors: readonly E2EEditor[], value: string): boolean {
  const editor = selectedEditor(editors)
  if (!editor) return false
  editor.setValue(value)
  return true
}
