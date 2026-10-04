import JSZip from 'jszip'
import { svgMarkup, validateResolution } from './logo'
import type { LogoConfig } from './logo'

export function safeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-z0-9_-]/gi, '-')
      .slice(0, 80) || 'orbit'
  )
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function configBlob(config: LogoConfig, seconds: number) {
  return new Blob([JSON.stringify({ ...config, capturedAtSeconds: seconds }, null, 2)], {
    type: 'application/json',
  })
}

export async function exportBundle(
  config: LogoConfig,
  seconds: number,
  format: 'png' | 'jpg' | 'svg',
  width: number,
  height: number,
  filename: string,
  includeJson = false,
) {
  validateResolution(width, height)
  const svg = new Blob([svgMarkup(config, seconds, width, height, format === 'jpg')], {
    type: 'image/svg+xml',
  })
  let image: Blob = svg
  if (format !== 'svg') {
    const url = URL.createObjectURL(svg)
    try {
      const bitmap = new Image()
      await new Promise<void>((resolve, reject) => {
        bitmap.onload = () => resolve()
        bitmap.onerror = () => reject(new Error('The SVG could not be rendered.'))
        bitmap.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas rendering is unavailable.')
      context.drawImage(bitmap, 0, 0, width, height)
      image = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed.'))),
          format === 'jpg' ? 'image/jpeg' : 'image/png',
          0.95,
        ),
      )
    } finally {
      URL.revokeObjectURL(url)
    }
  }
  const name = safeFilename(filename)
  if (!includeJson) {
    download(image, `${name}.${format}`)
    return
  }
  const zip = new JSZip()
  zip.file(`${name}.${format}`, image)
  zip.file(`${name}.json`, configBlob(config, seconds))
  download(await zip.generateAsync({ type: 'blob' }), `${name}-${format}.zip`)
}
