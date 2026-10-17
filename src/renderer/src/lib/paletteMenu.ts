import { EXPORT_FORMATS } from '@shared/export'
import type { Palette } from '@shared/types'
import type { MenuItem } from '../components/Menu'
import { api } from './api'
import type { AppContextValue } from './app'

type Confirm = (options: { title: string; message?: string; confirmLabel?: string }) => Promise<boolean>

export function paletteMenuItems(
  app: AppContextValue,
  confirm: Confirm,
  palette: Palette,
  onRename?: () => void
): MenuItem[] {
  const { data, dispatch, back, view, toast } = app
  const active = data.activePaletteId === palette.id
  return [
    {
      label: active ? 'Stop Collecting Picked Colors' : 'Collect Picked Colors Here',
      onSelect: () => dispatch({ type: 'setActivePalette', paletteId: active ? null : palette.id })
    },
    ...(onRename ? [{ label: 'Rename…', onSelect: onRename }] : []),
    { label: 'Duplicate', onSelect: () => dispatch({ type: 'duplicatePalette', paletteId: palette.id }) },
    { type: 'separator' },
    { type: 'header', label: 'Export' },
    ...EXPORT_FORMATS.map<MenuItem>((format) => ({
      label: format.label,
      disabled: palette.colors.length === 0,
      onSelect: () =>
        void api.exportCollection(palette.id, format.id).then((saved) => saved && toast(`Exported ${palette.name}`))
    })),
    { type: 'separator' },
    {
      label: 'Delete Palette',
      danger: true,
      onSelect: async () => {
        const confirmed = await confirm({
          title: `Delete “${palette.name}”?`,
          message: `${palette.colors.length} colors will be removed. This cannot be undone.`
        })
        if (!confirmed) return
        dispatch({ type: 'deletePalette', paletteId: palette.id })
        if (view.name === 'palette') back()
      }
    }
  ]
}
