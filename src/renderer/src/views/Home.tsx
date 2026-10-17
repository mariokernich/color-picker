import { DragEvent, useState } from 'react'
import { ChevronRight, Contrast, MoreHorizontal, Pipette, Plus, Settings, ShieldAlert } from 'lucide-react'
import { COLOR_FORMATS } from '@shared/formats'
import type { Palette } from '@shared/types'
import { Button, IconButton, Section } from '../components/controls'
import { useConfirm } from '../components/Confirm'
import { useMenu } from '../components/Menu'
import { isColorDrag, readDraggedColor, Swatch } from '../components/Swatch'
import { formatAccelerator } from '../lib/accelerator'
import { api } from '../lib/api'
import { useApp } from '../lib/app'
import { colorMenuItems } from '../lib/colorMenu'
import { paletteMenuItems } from '../lib/paletteMenu'
import { LicenseBadge } from './Paywall'

const HISTORY_PREVIEW = 24

export function Home() {
  const app = useApp()
  const { data, dispatch, push, isMac, platform, copyHex } = app
  const openMenu = useMenu()
  const [showAllHistory, setShowAllHistory] = useState(false)
  const formatGroups = [...new Set(COLOR_FORMATS.map((format) => format.group))]
  const history = showAllHistory ? data.history : data.history.slice(0, HISTORY_PREVIEW)
  const shortcut = formatAccelerator(data.settings.pickerShortcut, isMac)

  return (
    <div className="view home">
      <header className="toolbar">
        <button type="button" className="pick-button" onClick={() => void api.startPicker()}>
          <span className="pick-button__icon">
            <Pipette size={17} strokeWidth={2.2} />
          </span>
          <span className="pick-button__text">
            <span className="pick-button__title">Pick Color</span>
            {shortcut && <span className="pick-button__shortcut">{shortcut}</span>}
          </span>
        </button>
        <IconButton label="Contrast Checker" onClick={() => push({ name: 'contrast' })}>
          <Contrast size={17} />
        </IconButton>
        <IconButton label="Settings" onClick={() => push({ name: 'settings' })}>
          <Settings size={17} />
        </IconButton>
      </header>

      <div className="format-bar">
        <label htmlFor="format">Copy as</label>
        <select
          id="format"
          className="select"
          value={data.settings.formatId}
          onChange={(event) => dispatch({ type: 'updateSettings', patch: { formatId: event.target.value } })}
        >
          {formatGroups.map((group) => (
            <optgroup key={group} label={group}>
              {COLOR_FORMATS.filter((format) => format.group === group).map((format) => (
                <option key={format.id} value={format.id}>
                  {group === 'CSS' || group === 'Design' ? format.label : `${group} ${format.label}`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="view__body">
        {platform.platform === 'darwin' && platform.screenAccess === 'denied' && (
          <div className="banner">
            <ShieldAlert size={18} />
            <div>
              <strong>Screen access needed</strong>
              <p>Allow Color Picker under Screen &amp; System Audio Recording to pick colors from other apps.</p>
              <Button size="sm" onClick={() => void api.openScreenSettings()}>
                Open System Settings
              </Button>
            </div>
          </div>
        )}

        <Section
          title="History"
          action={
            data.history.length > 0 && (
              <button type="button" className="link-button" onClick={() => dispatch({ type: 'clearHistory' })}>
                Clear
              </button>
            )
          }
        >
          {data.history.length === 0 ? (
            <div className="empty">
              <Pipette size={20} />
              <p>
                Colors you pick appear here and are copied automatically.
                {shortcut && (
                  <>
                    {' '}
                    Press <kbd>{shortcut}</kbd> anywhere.
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="swatch-grid">
                {history.map((color) => (
                  <Swatch
                    key={color.id}
                    hex={color.hex}
                    size={30}
                    title={`${color.name ? `${color.name} · ` : ''}${color.hex}\nClick to copy · Double-click to edit`}
                    drag={{ collection: 'history', colorId: color.id }}
                    onClick={() => copyHex(color.hex)}
                    onDoubleClick={() => push({ name: 'color', collection: 'history', colorId: color.id })}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      openMenu({ x: event.clientX, y: event.clientY }, colorMenuItems(app, 'history', color))
                    }}
                  />
                ))}
              </div>
              {data.history.length > HISTORY_PREVIEW && (
                <button type="button" className="link-button show-more" onClick={() => setShowAllHistory(!showAllHistory)}>
                  {showAllHistory ? 'Show less' : `Show all ${data.history.length}`}
                </button>
              )}
            </>
          )}
        </Section>

        <Section
          title="Palettes"
          action={
            <IconButton
              label="New Palette"
              className="icon-button--sm"
              onClick={() => dispatch({ type: 'createPalette', name: '' })}
            >
              <Plus size={15} />
            </IconButton>
          }
        >
          {data.palettes.length === 0 ? (
            <div className="empty">
              <p>Group colors into palettes. Drag colors from the history onto a palette to add them.</p>
              <Button size="sm" onClick={() => dispatch({ type: 'createPalette', name: '', activate: true })}>
                Create Palette
              </Button>
            </div>
          ) : (
            <ul className="palette-list">
              {data.palettes.map((palette) => (
                <PaletteRow key={palette.id} palette={palette} />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <footer className="footer">
        <LicenseBadge />
      </footer>
    </div>
  )
}

function PaletteRow({ palette }: { palette: Palette }) {
  const app = useApp()
  const { data, dispatch, push } = app
  const openMenu = useMenu()
  const confirm = useConfirm()
  const [dropActive, setDropActive] = useState(false)
  const active = data.activePaletteId === palette.id

  const onDrop = (event: DragEvent): void => {
    event.preventDefault()
    setDropActive(false)
    const dragged = readDraggedColor(event)
    if (!dragged) return
    dispatch({ type: 'moveColor', from: dragged.collection, to: palette.id, colorId: dragged.colorId, copy: event.altKey })
  }

  return (
    <li
      className={['palette-row', active && 'palette-row--active', dropActive && 'palette-row--drop'].filter(Boolean).join(' ')}
      onDragOver={(event) => {
        if (!isColorDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = event.altKey ? 'copy' : 'move'
        setDropActive(true)
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={onDrop}
    >
      <button
        type="button"
        className="palette-row__main"
        onClick={() => push({ name: 'palette', id: palette.id })}
        onContextMenu={(event) => {
          event.preventDefault()
          openMenu({ x: event.clientX, y: event.clientY }, paletteMenuItems(app, confirm, palette))
        }}
      >
        <span className="palette-row__name">
          {palette.name}
          {active && (
            <span className="palette-row__badge" title="Picked colors are added to this palette">
              Collecting
            </span>
          )}
        </span>
        <span className="palette-row__strip">
          {palette.colors.length === 0 ? (
            <span className="palette-row__empty">Empty</span>
          ) : (
            palette.colors.slice(0, 12).map((color) => <span key={color.id} style={{ background: color.hex }} />)
          )}
        </span>
      </button>
      <IconButton
        label="Palette Actions"
        className="icon-button--sm palette-row__more"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          openMenu({ x: rect.right - 180, y: rect.bottom + 4 }, paletteMenuItems(app, confirm, palette))
        }}
      >
        <MoreHorizontal size={15} />
      </IconButton>
      <ChevronRight size={14} className="palette-row__chevron" aria-hidden="true" />
    </li>
  )
}
