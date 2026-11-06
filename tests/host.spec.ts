import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { defaultConfig } from '../src/logo'
import type { LogoConfig } from '../src/logo'

type HostWindow = Window & { saved: LogoConfig[]; dirty: boolean[] }
const recorded = <K extends 'saved' | 'dirty'>(page: Page, key: K) =>
  page.evaluate((name) => (window as unknown as HostWindow)[name], key)

// A host page on the editor's own origin, holding the editor in an iframe
// and recording what the editor tells it
const hostPage = (design: object) => `<!doctype html>
<iframe src="/?host=1" style="width:1200px;height:800px;border:0"></iframe>
<script>
  window.saved = []
  window.dirty = []
  const frame = document.querySelector('iframe')
  addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return
    const data = event.data
    if (data.type === 'orbit:ready')
      frame.contentWindow.postMessage({ type: 'orbit:load', config: ${JSON.stringify(design)}, saveLabel: 'Save to site' }, location.origin)
    if (data.type === 'orbit:dirty') window.dirty.push(data.dirty)
    if (data.type === 'orbit:save') {
      window.saved.push(data.config)
      frame.contentWindow.postMessage({ type: 'orbit:saved', ok: true, message: 'Saved to site' }, location.origin)
    }
  })
</script>`

test.skip(({ isMobile }) => isMobile, 'host mode is the same on every viewport')

test('a host page loads a design, sees unsaved changes and receives saves', async ({ page }) => {
  const design = { ...defaultConfig(), title: 'Hosted logo' }
  await page.route('**/host-test.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: hostPage(design) }),
  )
  await page.goto('/host-test.html')
  const editor = page.frameLocator('iframe')

  await expect(editor.getByRole('textbox', { name: 'Logo title', exact: true })).toHaveValue(
    'Hosted logo',
  )
  await expect(editor.getByRole('button', { name: 'Embed logo', exact: true })).toHaveCount(0)

  await editor.getByRole('button', { name: 'Add arm', exact: true }).click()
  await expect.poll(() => recorded(page, 'dirty')).toEqual([true])

  await editor.getByRole('button', { name: 'Save to site', exact: true }).click()
  await expect(editor.getByRole('status')).toContainText('Saved to site')
  const saved = await recorded(page, 'saved')
  expect(saved).toHaveLength(1)
  expect(saved[0].title).toBe('Hosted logo')
  expect(saved[0].arms).toHaveLength(design.arms.length + 1)
  await expect.poll(() => recorded(page, 'dirty')).toEqual([true, false])
})

test('designs from another window are ignored, and the editor alone has no save button', async ({
  page,
}) => {
  await page.goto('/?host=1')
  // Not in an iframe: host mode stays off
  await expect(page.getByRole('button', { name: 'Embed logo', exact: true })).toBeVisible()
  await page.evaluate(() =>
    window.postMessage(
      { type: 'orbit:load', config: { version: 1, title: 'Intruder', arms: [] } },
      '*',
    ),
  )
  await expect(page.getByRole('textbox', { name: 'Logo title', exact: true })).not.toHaveValue(
    'Intruder',
  )
})
