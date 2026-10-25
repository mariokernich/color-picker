import type { ReactNode } from 'react'
import { COLOR_FORMATS } from '@shared/formats'
import { PRODUCT } from '@shared/product'
import type { Settings } from '@shared/types'
import { Segmented, Toggle, ViewHeader } from '../components/controls'
import { ShortcutRecorder } from '../components/ShortcutRecorder'
import { api } from '../lib/api'
import { useApp } from '../lib/app'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <div className="settings-row__label">{label}</div>
        {hint && <div className="settings-row__hint">{hint}</div>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  )
}

export function SettingsView() {
  const { data, dispatch, back, isMac, platform } = useApp()
  const settings = data.settings
  const set = (patch: Partial<Settings>): void => dispatch({ type: 'updateSettings', patch })
  const trayName = isMac ? 'menu bar icon' : 'tray icon'

  return (
    <div className="view">
      <ViewHeader onBack={back} title="Settings" />
      <div className="view__body settings">
        <div className="settings-group">
          <h2 className="section__title">General</h2>
          <Row label="Copy format" hint="Used when picking and clicking colors">
            <select className="select" value={settings.formatId} onChange={(event) => set({ formatId: event.target.value })}>
              {COLOR_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.group} · {format.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Copy picked colors" hint="Put the picked color on the clipboard">
            <Toggle label="Copy picked colors" checked={settings.copyOnPick} onChange={(copyOnPick) => set({ copyOnPick })} />
          </Row>
          <Row label="Watch clipboard" hint="Add colors copied in other apps to the history">
            <Toggle
              label="Watch clipboard"
              checked={settings.watchClipboard}
              onChange={(watchClipboard) => set({ watchClipboard })}
            />
          </Row>
          <Row label="Freeze screen while picking" hint="Pick from a still image, e.g. hover effects">
            <Toggle
              label="Freeze screen while picking"
              checked={settings.freezeScreen}
              onChange={(freezeScreen) => set({ freezeScreen })}
            />
          </Row>
          <Row label={`Clicking the ${trayName}`} hint="A right click does the other">
            <Segmented
              label={`Clicking the ${trayName}`}
              value={settings.trayClickAction}
              onChange={(trayClickAction) => set({ trayClickAction })}
              options={[
                { value: 'popover', label: 'Opens app' },
                { value: 'picker', label: 'Picks color' }
              ]}
            />
          </Row>
          <Row label="Appearance">
            <Segmented
              label="Appearance"
              value={settings.theme}
              onChange={(theme) => set({ theme })}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' }
              ]}
            />
          </Row>
          <Row label="History size">
            <select
              className="select select--narrow"
              value={settings.historyLimit}
              onChange={(event) => set({ historyLimit: Number(event.target.value) })}
            >
              {[50, 100, 200, 500, 1000].map((limit) => (
                <option key={limit} value={limit}>
                  {limit} colors
                </option>
              ))}
            </select>
          </Row>
          {platform.supportsLoginItem && (
            <Row label="Open at login">
              <Toggle label="Open at login" checked={settings.launchAtLogin} onChange={(launchAtLogin) => set({ launchAtLogin })} />
            </Row>
          )}
        </div>

        <div className="settings-group">
          <h2 className="section__title">Shortcuts</h2>
          <Row label="Pick color" hint="Works from any app">
            <ShortcutRecorder kind="picker" label="Pick color" value={settings.pickerShortcut} isMac={isMac} />
          </Row>
          <Row label={`Show ${PRODUCT.name}`}>
            <ShortcutRecorder kind="popover" label="Show window" value={settings.popoverShortcut} isMac={isMac} />
          </Row>
        </div>

        <div className="settings-group settings-about">
          <div>
            {PRODUCT.name} {platform.version}
          </div>
          <div className="settings-about__links">
            <button type="button" className="link-button" onClick={() => void api.openExternal(`mailto:${PRODUCT.supportEmail}`)}>
              Support
            </button>
            <button type="button" className="link-button" onClick={() => void api.openExternal(PRODUCT.privacyUrl)}>
              Privacy
            </button>
            <button type="button" className="link-button link-button--danger" onClick={() => api.quit()}>
              Quit {PRODUCT.name}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
