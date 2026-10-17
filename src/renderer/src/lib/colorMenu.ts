import { getFormat } from '@shared/formats'
import type { CollectionId, SavedColor } from '@shared/types'
import type { MenuItem } from '../components/Menu'
import type { AppContextValue } from './app'

export function colorMenuItems(app: AppContextValue, collection: CollectionId, color: SavedColor): MenuItem[] {
  const { data, dispatch, push, copyHex } = app
  const targets = data.palettes.filter((palette) => palette.id !== collection)
  return [
    { label: `Copy ${getFormat(data.settings.formatId).label}`, onSelect: () => copyHex(color.hex) },
    { label: 'Edit Color…', onSelect: () => push({ name: 'color', collection, colorId: color.id }) },
    { label: 'Check Contrast', onSelect: () => push({ name: 'contrast', foreground: color.hex }) },
    { type: 'separator' },
    { type: 'header', label: 'Add to Palette' },
    ...targets.map<MenuItem>((palette) => ({
      label: palette.name,
      disabled: palette.colors.some((item) => item.hex === color.hex),
      onSelect: () => dispatch({ type: 'moveColor', from: collection, to: palette.id, colorId: color.id, copy: true })
    })),
    {
      label: 'New Palette',
      onSelect: () => dispatch({ type: 'createPalette', name: '', hexes: [color.hex] })
    },
    { type: 'separator' },
    {
      label: collection === 'history' ? 'Remove from History' : 'Remove from Palette',
      danger: true,
      onSelect: () => dispatch({ type: 'deleteColors', collection, colorIds: [color.id] })
    }
  ]
}
