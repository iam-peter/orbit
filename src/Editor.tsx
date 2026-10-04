import { useRef, useState } from 'react'
import { version as appVersion } from '../package.json'
import type { ChangeEvent, ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowDownToLine,
  ChevronDown,
  ChevronUp,
  Code,
  Copy,
  Download,
  Eye,
  FileJson,
  FolderOpen,
  Grid2X2,
  Moon,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Shuffle,
  Sun,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { configSchema, defaultConfig, normalizeAngle, poseAt, randomize } from './logo'
import type { Arm, LogoConfig } from './logo'
import { configBlob, download, exportBundle, safeFilename } from './exports'
import { LogoPreview } from './LogoPreview'
import { usePlayback } from './usePlayback'
import { useTheme } from './useTheme'
import { ColorControl } from './ColorControl'
import './App.css'

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function NumberControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}) {
  const accept = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.valueAsNumber
    if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
  }
  return (
    <div className="number-control">
      <div className="control-heading">
        <label htmlFor={`number-${label}`}>{label}</label>
        <span className="number-wrap">
          <span className="number-steppers">
            <button
              type="button"
              aria-label={`Increase ${label}`}
              title={`Increase ${label}`}
              disabled={value >= max}
              onClick={() => onChange(Math.min(max, Number((value + step).toFixed(6))))}
            >
              <ChevronUp size={12} />
            </button>
            <button
              type="button"
              aria-label={`Decrease ${label}`}
              title={`Decrease ${label}`}
              disabled={value <= min}
              onClick={() => onChange(Math.max(min, Number((value - step).toFixed(6))))}
            >
              <ChevronDown size={12} />
            </button>
          </span>
          <input
            id={`number-${label}`}
            aria-label={label}
            type="number"
            min={min}
            max={max}
            step={step}
            value={Math.round(value * 10) / 10}
            onChange={accept}
          />
          <span className="number-unit">{unit}</span>
        </span>
      </div>
      <input
        aria-label={`${label} slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={accept}
      />
    </div>
  )
}

function DocumentTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  return (
    <input
      key={title}
      className="document-title"
      type="text"
      aria-label="Logo title"
      title="Rename logo"
      defaultValue={title}
      maxLength={80}
      onBlur={(event) => {
        const next = event.currentTarget.value.trim() || title
        event.currentTarget.value = next
        onRename(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.currentTarget.value = title
          event.currentTarget.blur()
        }
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}

export default function Editor() {
  const { dark, toggle } = useTheme()
  const [history, setHistory] = useState<{
    past: LogoConfig[]
    present: LogoConfig
    future: LogoConfig[]
  }>({ past: [], present: defaultConfig(), future: [] })
  const config = history.present
  const [selected, setSelected] = useState('arm-1')
  const [scope, setScope] = useState<'selected' | 'all'>('selected')
  const [playing, setPlaying] = useState(false)
  const { seconds, seek } = usePlayback(playing)
  const [guides, setGuides] = useState(true)
  const [snap, setSnap] = useState(false)
  const [tab, setTab] = useState<'design' | 'motion'>('design')
  const [message, setMessage] = useState('')
  const [modal, setModal] = useState<'export' | 'embed' | null>(null)
  const [snapshot, setSnapshot] = useState({ config, seconds: 0 })
  const [format, setFormat] = useState<'png' | 'jpg' | 'svg'>('png')
  const [width, setWidth] = useState(2000)
  const [height, setHeight] = useState(2000)
  const [locked, setLocked] = useState(true)
  const [includeJson, setIncludeJson] = useState(false)
  const [filename, setFilename] = useState('orbit-logo')
  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const dragSaved = useRef(false)
  const arm = config.arms.find((item) => item.id === selected) ?? config.arms[0]

  const update = (transform: (current: LogoConfig) => LogoConfig, record = true) => {
    setPlaying(false)
    const elapsed = seconds
    seek()
    setHistory((current) => {
      const visible = elapsed
        ? {
            ...current.present,
            arms: poseAt(current.present, elapsed).map((pose, index) => ({
              ...current.present.arms[index],
              angle: pose.angle,
            })),
          }
        : current.present
      return {
        past: record ? [...current.past.slice(-79), current.present] : current.past,
        present: transform(visible),
        future: [],
      }
    })
  }
  const updateArm = (patch: Partial<Arm>) =>
    update((current) => ({
      ...current,
      arms: current.arms.map((item) =>
        scope === 'all' || item.id === arm.id ? { ...item, ...patch } : item,
      ),
    }))
  const motion = (patch: Partial<LogoConfig['animation']>) =>
    update((current) => ({ ...current, animation: { ...current.animation, ...patch } }))
  const undo = (redo = false) => {
    setPlaying(false)
    seek()
    setHistory((current) => {
      if (redo && current.future.length)
        return {
          past: [...current.past, current.present],
          present: current.future[0],
          future: current.future.slice(1),
        }
      if (!redo && current.past.length)
        return {
          past: current.past.slice(0, -1),
          present: current.past[current.past.length - 1],
          future: [current.present, ...current.future],
        }
      return current
    })
  }
  const open = (kind: 'export' | 'embed') => {
    setSnapshot({ config: structuredClone(config), seconds })
    if (kind === 'export') setFilename(safeFilename(config.title))
    setExportError('')
    setModal(kind)
  }
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      if (file.size > 1_000_000) throw new Error('Configuration files must be smaller than 1 MB.')
      const imported = configSchema.parse(JSON.parse(await file.text()))
      update(() => imported)
      setSelected(imported.arms[0].id)
      seek(imported.capturedAtSeconds ?? 0)
      setMessage('Configuration loaded')
    } catch {
      setMessage('Could not load this file. Choose a valid Orbit JSON configuration.')
    }
  }
  const exportNow = async () => {
    setBusy(true)
    setExportError('')
    try {
      await exportBundle(
        snapshot.config,
        snapshot.seconds,
        format,
        width,
        height,
        filename,
        includeJson,
      )
      setModal(null)
      setMessage(includeJson ? 'Export downloaded with JSON configuration' : 'Image downloaded')
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }
  const embedConfig = JSON.stringify({ ...snapshot.config, capturedAtSeconds: snapshot.seconds })
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const embedUrl = new URL('orbit-embed.js', document.baseURI).href
  const embedCode = `<script type="module" src="${embedUrl}"></script>\n<orbit-logo autoplay style="display:block;width:100%;height:400px" config='${embedConfig}'></orbit-logo>`

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <svg
            className="brand-symbol"
            viewBox="0 0 34 34"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M17 18V5M17 18L6 27M17 18L28 24" />
            <g fill="var(--surface)">
              <circle cx="17" cy="5" r="4" />
              <circle cx="6" cy="27" r="4" />
              <circle cx="28" cy="24" r="4" />
            </g>
          </svg>
          <h1>
            orbit<span> / logo studio</span>
          </h1>
        </div>
        <div className="header-actions">
          <IconButton
            label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggle}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
          <IconButton label="Import JSON" onClick={() => upload.current?.click()}>
            <FolderOpen size={18} />
          </IconButton>
          <IconButton
            label="Save JSON"
            onClick={() =>
              download(configBlob(config, seconds), `${safeFilename(config.title)}.json`)
            }
          >
            <FileJson size={18} />
          </IconButton>
          <IconButton label="Embed logo" onClick={() => open('embed')}>
            <Code size={18} />
          </IconButton>
          <button className="primary" onClick={() => open('export')}>
            <Download size={16} />
            Export
          </button>
        </div>
        <input ref={upload} hidden type="file" accept=".json,application/json" onChange={load} />
      </header>
      <main className="workspace">
        <section className="canvas-area" aria-label="Logo workspace">
          <div className="workspace-toolbar">
            <div className="document-label">
              <span className="status-dot" />
              <DocumentTitle
                title={config.title}
                onRename={(title) =>
                  setHistory((current) =>
                    title === current.present.title
                      ? current
                      : {
                          past: [...current.past.slice(-79), current.present],
                          present: { ...current.present, title },
                          future: [],
                        },
                  )
                }
              />
              <span className="muted">{config.arms.length} arms</span>
            </div>
            <div className="toolbar-actions">
              <IconButton label="Undo" disabled={!history.past.length} onClick={() => undo()}>
                <Undo2 size={17} />
              </IconButton>
              <IconButton label="Redo" disabled={!history.future.length} onClick={() => undo(true)}>
                <Redo2 size={17} />
              </IconButton>
              <span className="toolbar-divider" />
              <IconButton label="Toggle guides" active={guides} onClick={() => setGuides(!guides)}>
                <Grid2X2 size={17} />
              </IconButton>
            </div>
          </div>
          <div
            className={`artboard-wrap ${config.transparent ? 'checker' : ''}`}
            style={{ backgroundColor: config.transparent ? undefined : config.background }}
          >
            <span className="artboard-label">LIVE CANVAS</span>
            <LogoPreview
              config={config}
              seconds={seconds}
              selected={arm.id}
              guides={guides}
              snap={snap}
              onSelect={setSelected}
              onDragStart={() => {
                setPlaying(false)
                dragSaved.current = false
              }}
              onAngle={(id, angle) => {
                update(
                  (current) => ({
                    ...current,
                    arms: current.arms.map((item) => (item.id === id ? { ...item, angle } : item)),
                  }),
                  !dragSaved.current,
                )
                dragSaved.current = true
              }}
            />
          </div>
          <div className="playback-bar">
            <div className="playback-left">
              <IconButton
                label={playing ? 'Pause autoplay' : 'Start autoplay'}
                active={playing}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause size={19} /> : <Play size={19} />}
              </IconButton>
              <IconButton
                label="Reset playback"
                onClick={() => {
                  setPlaying(false)
                  seek()
                }}
              >
                <RotateCcw size={17} />
              </IconButton>
              <span className="playback-state">
                {playing ? 'Playing' : 'Paused'}
                <small>{seconds.toFixed(1)} s</small>
              </span>
            </div>
            <span className="motion-label">
              {config.animation.mode === 'together'
                ? 'Whole-logo rotation'
                : 'Independent rotation'}
            </span>
            <span className="speed-label">{config.animation.speed} deg/s</span>
          </div>
          <div className="workspace-footer">
            <span>SVG workspace</span>
            <span>
              {config.transparent ? 'Transparent' : config.background.toUpperCase()}
              <span className="footer-dot" />
              Vector
            </span>
          </div>
        </section>
        <aside className="inspector">
          <div className="inspector-title">
            <h2>Inspector</h2>
            <Eye size={17} />
          </div>
          <div className="tabs" role="tablist" aria-label="Inspector">
            <button role="tab" aria-selected={tab === 'design'} onClick={() => setTab('design')}>
              Design
            </button>
            <button role="tab" aria-selected={tab === 'motion'} onClick={() => setTab('motion')}>
              Motion
            </button>
          </div>
          {tab === 'design' ? (
            <>
              <section className="inspector-section">
                <div className="section-heading">
                  <h3>
                    Arms <span>{config.arms.length.toString().padStart(2, '0')}</span>
                  </h3>
                  <div className="mini-actions">
                    <IconButton
                      label="Add arm"
                      disabled={config.arms.length >= 24}
                      onClick={() => {
                        const id = crypto.randomUUID()
                        update((current) => ({
                          ...current,
                          arms: [
                            ...current.arms,
                            { ...arm, id, angle: normalizeAngle(arm.angle + 45) },
                          ],
                        }))
                        setSelected(id)
                      }}
                    >
                      <Plus size={16} />
                    </IconButton>
                    <IconButton
                      label="Remove selected arm"
                      disabled={config.arms.length <= 1}
                      onClick={() => {
                        update((current) => ({
                          ...current,
                          arms: current.arms.filter((item) => item.id !== arm.id),
                        }))
                        setSelected(config.arms.find((item) => item.id !== arm.id)!.id)
                      }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
                <div className="arm-list">
                  {config.arms.map((item, index) => (
                    <button
                      key={item.id}
                      className={`arm-item ${arm.id === item.id ? 'selected' : ''}`}
                      onClick={() => setSelected(item.id)}
                    >
                      <span
                        className="arm-swatch"
                        style={{ borderColor: item.stroke, background: item.fill }}
                      />
                      <span>Arm {String(index + 1).padStart(2, '0')}</span>
                      <span className="arm-value">{Math.round(item.angle)} deg</span>
                    </button>
                  ))}
                </div>
                <div className="segmented" aria-label="Editing scope">
                  <button aria-pressed={scope === 'selected'} onClick={() => setScope('selected')}>
                    Selected arm
                  </button>
                  <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
                    All arms
                  </button>
                </div>
                <NumberControl
                  label="Angle"
                  value={arm.angle}
                  min={0}
                  max={359}
                  unit="deg"
                  onChange={(angle) => updateArm({ angle })}
                />
                <NumberControl
                  label="Arm length"
                  value={arm.length}
                  min={10}
                  max={280}
                  unit="u"
                  onChange={(length) => updateArm({ length })}
                />
                <NumberControl
                  label="Circle radius"
                  value={arm.radius}
                  min={2}
                  max={70}
                  unit="u"
                  onChange={(radius) => updateArm({ radius })}
                />
                <div className="color-row">
                  <ColorControl
                    label="Outline"
                    name="Arm outline color"
                    value={arm.stroke}
                    onChange={(stroke) => updateArm({ stroke })}
                  />
                  <ColorControl
                    label="Circle fill"
                    name="Circle fill color"
                    value={arm.fill}
                    onChange={(fill) => updateArm({ fill })}
                  />
                </div>
                <label className="toggle-row">
                  Snap angles to 15 degrees
                  <input
                    type="checkbox"
                    checked={snap}
                    onChange={(event) => setSnap(event.target.checked)}
                  />
                </label>
              </section>
              <section className="inspector-section">
                <div className="section-heading">
                  <h3>Composition</h3>
                </div>
                <NumberControl
                  label="Stroke width"
                  value={config.strokeWidth}
                  min={1}
                  max={20}
                  unit="u"
                  onChange={(strokeWidth) => update((current) => ({ ...current, strokeWidth }))}
                />
                <NumberControl
                  label="Padding"
                  value={config.padding}
                  min={0}
                  max={100}
                  unit="u"
                  onChange={(padding) => update((current) => ({ ...current, padding }))}
                />
                <ColorControl
                  label="Background"
                  name="Background color"
                  value={config.background}
                  onChange={(background) => update((current) => ({ ...current, background }))}
                />
                <label className="toggle-row">
                  Transparent background
                  <input
                    type="checkbox"
                    checked={config.transparent}
                    onChange={(event) =>
                      update((current) => ({ ...current, transparent: event.target.checked }))
                    }
                  />
                </label>
              </section>
              <section className="inspector-section">
                <div className="section-heading">
                  <h3>Arrange</h3>
                </div>
                <NumberControl
                  label="Minimum separation"
                  value={config.minAngle}
                  min={0}
                  max={Math.floor(360 / config.arms.length)}
                  unit="deg"
                  onChange={(minAngle) => update((current) => ({ ...current, minAngle }))}
                />
                <div className="arrange-actions">
                  <button
                    onClick={() => {
                      try {
                        const next = randomize(config)
                        update(() => next)
                        setMessage('Angles randomized')
                      } catch (error) {
                        setMessage((error as Error).message)
                      }
                    }}
                  >
                    <Shuffle size={15} />
                    Randomize
                  </button>
                  <button
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        arms: current.arms.map((item, index) => ({
                          ...item,
                          angle: (index * 360) / current.arms.length,
                        })),
                      }))
                    }
                  >
                    Distribute
                  </button>
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="inspector-section">
                <div className="section-heading">
                  <h3>Rotation</h3>
                </div>
                <label className="select-label">
                  Mode
                  <select
                    aria-label="Rotation mode"
                    value={config.animation.mode}
                    onChange={(event) =>
                      motion({ mode: event.target.value as 'together' | 'independent' })
                    }
                  >
                    <option value="together">Whole logo</option>
                    <option value="independent">Independent arms</option>
                  </select>
                </label>
                <NumberControl
                  label="Rotation speed"
                  value={config.animation.speed}
                  min={-120}
                  max={120}
                  unit="deg/s"
                  onChange={(speed) => motion({ speed })}
                />
                {config.animation.mode === 'independent' &&
                  config.arms.map((item, index) => (
                    <NumberControl
                      key={item.id}
                      label={`Arm ${index + 1} speed`}
                      value={item.speed}
                      min={-120}
                      max={120}
                      unit="deg/s"
                      onChange={(speed) =>
                        update((current) => ({
                          ...current,
                          arms: current.arms.map((candidate) =>
                            candidate.id === item.id ? { ...candidate, speed } : candidate,
                          ),
                        }))
                      }
                    />
                  ))}
              </section>
              <section className="inspector-section">
                <div className="section-heading">
                  <h3>Length</h3>
                </div>
                <label className="toggle-row">
                  Animate arm lengths
                  <input
                    type="checkbox"
                    checked={config.animation.animateLength}
                    onChange={(event) => motion({ animateLength: event.target.checked })}
                  />
                </label>
                {config.animation.animateLength && (
                  <NumberControl
                    label="Length amplitude"
                    value={config.animation.amplitude * 100}
                    min={0}
                    max={50}
                    unit="%"
                    onChange={(value) => motion({ amplitude: value / 100 })}
                  />
                )}
              </section>
            </>
          )}
          <footer className="inspector-version" aria-label="Application version">
            <span>Orbit</span>
            <span>v{appVersion}</span>
          </footer>
        </aside>
      </main>
      {message && (
        <div className="toast" role="status">
          {message}
          <IconButton label="Dismiss message" onClick={() => setMessage('')}>
            <X size={14} />
          </IconButton>
        </div>
      )}
      <Dialog.Root
        open={modal !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setModal(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="modal-content" aria-describedby={undefined}>
            <div className="modal-heading">
              <Dialog.Title>{modal === 'embed' ? 'Embed logo' : 'Export logo'}</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="icon-button"
                  title="Close dialog"
                  aria-label="Close dialog"
                  disabled={busy}
                >
                  <X size={19} />
                </button>
              </Dialog.Close>
            </div>
            {modal === 'export' ? (
              <>
                <label className="field-label">
                  Filename
                  <input value={filename} onChange={(event) => setFilename(event.target.value)} />
                </label>
                <div className="segmented export-formats">
                  {(['png', 'jpg', 'svg'] as const).map((item) => (
                    <button
                      key={item}
                      aria-pressed={format === item}
                      onClick={() => setFormat(item)}
                    >
                      {item === 'jpg' ? 'JPEG' : item.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="resolution-fields">
                  <label>
                    Width (px)
                    <input
                      aria-label="Export width"
                      type="number"
                      min="1"
                      max="8192"
                      value={width}
                      onChange={(event) => {
                        const value = event.target.valueAsNumber
                        setWidth(Number.isFinite(value) ? value : 0)
                        if (locked)
                          setHeight(
                            Number.isFinite(value)
                              ? Math.round((value * height) / Math.max(1, width))
                              : 0,
                          )
                      }}
                    />
                  </label>
                  <label>
                    Height (px)
                    <input
                      aria-label="Export height"
                      type="number"
                      min="1"
                      max="8192"
                      value={height}
                      onChange={(event) => {
                        const value = event.target.valueAsNumber
                        setHeight(Number.isFinite(value) ? value : 0)
                        if (locked)
                          setWidth(
                            Number.isFinite(value)
                              ? Math.round((value * width) / Math.max(1, height))
                              : 0,
                          )
                      }}
                    />
                  </label>
                </div>
                <label className="toggle-row">
                  Lock aspect ratio
                  <input
                    type="checkbox"
                    checked={locked}
                    onChange={(event) => setLocked(event.target.checked)}
                  />
                </label>
                <label className="toggle-row">
                  Include JSON configuration
                  <input
                    type="checkbox"
                    checked={includeJson}
                    disabled={busy}
                    onChange={(event) => setIncludeJson(event.target.checked)}
                  />
                </label>
                <div className="export-summary">
                  {includeJson ? <FileJson size={16} /> : <Download size={16} />}
                  <span>
                    {format.toUpperCase()}
                    {includeJson ? ' + JSON configuration' : ' image'}
                  </span>
                  <span>{includeJson ? 'ZIP' : format.toUpperCase()}</span>
                </div>
                {format === 'jpg' && (
                  <p className="format-note">JPEG uses the configured background color.</p>
                )}
                {exportError && (
                  <p role="alert" className="error">
                    {exportError}
                  </p>
                )}
                <button className="primary export-submit" disabled={busy} onClick={exportNow}>
                  <ArrowDownToLine size={17} />
                  {busy ? 'Exporting...' : 'Download export'}
                </button>
              </>
            ) : (
              <>
                <pre className="embed-code">
                  <code>{embedCode}</code>
                </pre>
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(embedCode)
                      setMessage('Embed code copied')
                    } catch {
                      setMessage('Clipboard unavailable. Select the embed code to copy it.')
                    }
                  }}
                >
                  <Copy size={16} />
                  Copy embed code
                </button>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
