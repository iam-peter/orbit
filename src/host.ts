import { configSchema } from './logo'
import type { LogoConfig } from './logo'

/**
 * Host mode: a page that shows the editor in an iframe, such as a CMS
 * settings screen, loads a design into it and receives the design when
 * the user saves. Enabled with `?host=1`; `host-origin` names the host
 * page's origin and defaults to the editor's own.
 *
 * Editor to host:
 * - `{ type: 'orbit:ready' }` once the editor listens
 * - `{ type: 'orbit:dirty', dirty }` when the design starts or stops
 *   differing from the last loaded or saved one
 * - `{ type: 'orbit:save', config }` when the user saves
 *
 * Host to editor:
 * - `{ type: 'orbit:load', config, saveLabel? }` with the design to edit
 * - `{ type: 'orbit:saved', ok, message? }` as the answer to a save
 *
 * Messages from any other window or origin are ignored.
 */

export type SaveResult = { ok: boolean; message?: string }

export type HostLink = {
  save: (config: LogoConfig) => Promise<SaveResult>
  dirty: (dirty: boolean) => void
  disconnect: () => void
}

export function hostOrigin(): string | null {
  const params = new URLSearchParams(window.location.search)
  if (!params.has('host') || window.parent === window) return null
  return params.get('host-origin') || window.location.origin
}

export function connectHost(
  onLoad: (config: LogoConfig, saveLabel: string) => void,
  onError: (message: string) => void,
): HostLink | null {
  const origin = hostOrigin()
  if (!origin) return null

  const post = (message: object) => window.parent.postMessage(message, origin)
  let pending: ((result: SaveResult) => void) | null = null

  const listener = (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== origin) return
    const data = event.data as Record<string, unknown> | null
    if (data?.type === 'orbit:load') {
      const parsed = configSchema.safeParse(data.config)
      if (!parsed.success) {
        onError('The host sent a design this editor cannot read.')
        return
      }
      onLoad(parsed.data, typeof data.saveLabel === 'string' ? data.saveLabel : 'Save')
    } else if (data?.type === 'orbit:saved' && pending) {
      pending({
        ok: data.ok === true,
        message: typeof data.message === 'string' ? data.message : undefined,
      })
      pending = null
    }
  }
  window.addEventListener('message', listener)
  post({ type: 'orbit:ready' })

  return {
    save: (config) =>
      new Promise((resolve) => {
        pending?.({ ok: false, message: 'Superseded by a newer save.' })
        pending = resolve
        post({ type: 'orbit:save', config })
      }),
    dirty: (dirty) => post({ type: 'orbit:dirty', dirty }),
    disconnect: () => {
      window.removeEventListener('message', listener)
      pending = null
    },
  }
}
