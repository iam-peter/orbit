import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { defaultConfig } from '../src/logo'

test('toasts expire after five seconds and repeated messages restart the timeout', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/')
  const toast = page.getByRole('status')
  await page.getByRole('button', { name: 'Randomize', exact: true }).click()
  await expect(toast).toContainText('Angles randomized')
  await page.clock.fastForward(3000)
  await page.getByRole('button', { name: 'Randomize', exact: true }).click()
  await page.clock.fastForward(3000)
  await expect(toast).toBeVisible()
  await page.clock.fastForward(2000)
  await expect(toast).toHaveCount(0)
  await page.getByRole('button', { name: 'Randomize', exact: true }).click()
  await page.getByRole('button', { name: 'Dismiss message', exact: true }).click()
  await expect(toast).toHaveCount(0)
})

test('success and error toasts share the automatic timeout', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const upload = page.locator('input[type="file"]')
  await upload.setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  })
  await expect(page.getByRole('status')).toContainText('Could not load this file')
  await page.clock.fastForward(5000)
  await expect(page.getByRole('status')).toHaveCount(0)
  await upload.setInputFiles({
    name: 'logo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(defaultConfig())),
  })
  await expect(page.getByRole('status')).toContainText('Configuration loaded')
  await page.clock.fastForward(5000)
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('selection ring stays above the logo and outside thick circle strokes', async ({
  page,
}, info) => {
  await page.goto('/')
  const ring = page.locator('.selection-ring')
  const selected = page.locator('.arm-handle').first()
  for (const width of [1, 10, 20]) {
    await page.getByRole('spinbutton', { name: 'Stroke width', exact: true }).fill(String(width))
    await expect(ring).toHaveAttribute('r', String(30 + width / 2 + 8))
    await expect(ring).toHaveAttribute('cx', (await selected.getAttribute('cx'))!)
    await expect(ring).toHaveAttribute('cy', (await selected.getAttribute('cy'))!)
  }
  expect(
    await ring.evaluate((element) => element === element.parentElement!.lastElementChild),
  ).toBe(true)
  await expect(ring).toHaveCSS('pointer-events', 'none')
  await page.locator('.artboard-wrap').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('thick-stroke-selection.png') })
  await page.getByRole('button', { name: 'Select arm 2', exact: true }).click()
  await expect(ring).toHaveAttribute(
    'cx',
    (await page.locator('.arm-handle').nth(1).getAttribute('cx'))!,
  )
  await page.getByRole('button', { name: 'Toggle guides', exact: true }).click()
  await expect(ring).toHaveCount(0)
})

test('shows the application version in the inspector without a misleading origin label', async ({
  page,
}, info) => {
  await page.goto('/')
  await expect(page.locator('.canvas-coordinate')).toHaveCount(0)
  await expect(page.locator('.artboard-wrap')).not.toContainText('0, 0')
  const version = page.getByLabel('Application version', { exact: true })
  await version.scrollIntoViewIfNeeded()
  await expect(version).toBeVisible()
  await expect(version).toContainText('v0.1.2')
  await page.screenshot({ path: info.outputPath('inspector-version.png') })
  await page.getByRole('tab', { name: 'Motion', exact: true }).click()
  await version.scrollIntoViewIfNeeded()
  await expect(version).toBeVisible()
  await expect(version).toContainText('v0.1.2')
})

test('color picker remembers two rows of shared recent colors across reloads', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('orbit-recent-colors'))
      localStorage.setItem(
        'orbit-recent-colors',
        JSON.stringify(
          Array.from({ length: 14 }, (_, index) => `#${(index + 1).toString(16).padStart(6, '0')}`),
        ),
      )
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Arm outline color', exact: true }).click()
  await expect(page.locator('.recent-color-swatch')).toHaveCount(12)
  const first = await page.locator('.recent-color-swatch').nth(0).boundingBox()
  const secondRow = await page.locator('.recent-color-swatch').nth(6).boundingBox()
  expect(secondRow!.y).toBeGreaterThan(first!.y)
  await page.getByRole('textbox', { name: 'Arm outline color hex' }).fill('#aabbcc')
  await page.getByRole('button', { name: 'Close color picker' }).click()
  await page.getByRole('button', { name: 'Circle fill color', exact: true }).click()
  await expect(page.locator('.recent-color-swatch').first()).toHaveAttribute(
    'aria-label',
    'Use recent color #aabbcc',
  )
  await page.getByRole('button', { name: 'Use recent color #aabbcc', exact: true }).click()
  await expect(page.locator('.arm-handle').first()).toHaveAttribute('fill', '#aabbcc')
  await page.getByRole('button', { name: 'Close color picker' }).click()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('orbit-recent-colors')!))
  expect(stored).toHaveLength(12)
  expect(stored.filter((color: string) => color === '#aabbcc')).toHaveLength(1)
  await page.reload()
  await page.getByRole('button', { name: 'Background color', exact: true }).click()
  await expect(page.locator('.recent-color-swatch').first()).toHaveAttribute(
    'aria-label',
    'Use recent color #aabbcc',
  )
  const popover = await page.getByRole('dialog', { name: 'Background color picker' }).boundingBox()
  expect(popover!.x).toBeGreaterThanOrEqual(0)
  expect(popover!.x + popover!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ path: info.outputPath('recent-colors.png') })
})

test('edits the logo title, defaults export names, and restores the title from JSON', async ({
  page,
}, info) => {
  await page.goto('/')
  const title = page.getByRole('textbox', { name: 'Logo title', exact: true })
  await title.fill('My orbit')
  await title.press('Enter')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(title).toHaveValue('Untitled orbit')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(title).toHaveValue('My orbit')
  await title.fill('Cancelled title')
  await title.press('Escape')
  await expect(title).toHaveValue('My orbit')
  await title.fill(' ')
  await title.press('Enter')
  await expect(title).toHaveValue('My orbit')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Filename', exact: true })).toHaveValue('My-orbit')
  await page.getByRole('textbox', { name: 'Filename', exact: true }).fill('custom-export')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(title).toHaveValue('My orbit')
  const received = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save JSON', exact: true }).click()
  const download = await received
  expect(download.suggestedFilename()).toBe('My-orbit.json')
  const path = info.outputPath('My-orbit.json')
  await download.saveAs(path)
  const { readFile } = await import('node:fs/promises')
  expect(JSON.parse(await readFile(path, 'utf8')).title).toBe('My orbit')
  await title.fill('Other design')
  await title.press('Enter')
  await page.locator('input[type="file"]').setInputFiles(path)
  await expect(title).toHaveValue('My orbit')
  await title.fill('Renamed on blur')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Filename', exact: true })).toHaveValue(
    'Renamed-on-blur',
  )
})

test('brand connects its circles and spinbox orders controls, value and unit', async ({
  page,
}, info) => {
  await page.goto('/')
  await expect(page.locator('.brand-symbol circle')).toHaveCount(3)
  await expect(page.locator('.brand-symbol path')).toHaveAttribute(
    'd',
    'M17 18V5M17 18L6 27M17 18L28 24',
  )
  const input = page.getByRole('spinbutton', { name: 'Arm length', exact: true })
  const wrapper = page.locator('.number-wrap').filter({ has: input })
  expect(
    await wrapper.evaluate((element) =>
      Array.from(element.children).map((child) => child.className || child.tagName),
    ),
  ).toEqual(['number-steppers', 'INPUT', 'number-unit'])
  const controls = await wrapper.locator('.number-steppers').boundingBox()
  const value = await input.boundingBox()
  const unit = await wrapper.locator('.number-unit').boundingBox()
  expect(controls!.x + controls!.width).toBeLessThanOrEqual(value!.x)
  expect(value!.x + value!.width).toBeLessThanOrEqual(unit!.x)
  await page.getByRole('button', { name: 'Increase Arm length', exact: true }).click()
  await expect(input).toHaveValue('211')
  await page.getByRole('button', { name: 'Decrease Arm length', exact: true }).click()
  await expect(input).toHaveValue('210')
  await input.fill('280')
  await expect(
    page.getByRole('button', { name: 'Increase Arm length', exact: true }),
  ).toBeDisabled()
  await input.fill('10')
  await expect(
    page.getByRole('button', { name: 'Decrease Arm length', exact: true }),
  ).toBeDisabled()
  await input.fill('180')
  await input.press('ArrowUp')
  await expect(input).toHaveValue('181')
  await page.screenshot({ path: info.outputPath('brand-spinbox.png'), fullPage: true })
})

test('theme follows the system without changing logo colors', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('.artboard-wrap')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('.arm-handle').first()).toHaveAttribute('fill', '#ffffff')
  expect(
    await page
      .locator('.app-header')
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe('rgb(255, 255, 255)')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('theme toggle persists and styles export dialogs', async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({ path: info.outputPath('dark-editor.png'), fullPage: true })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  expect(
    await page.getByRole('dialog').evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe('rgb(255, 255, 255)')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('color picker edits shared outlines, individual fills and background without native dialogs', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('input[type="color"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'All arms', exact: true }).click()
  await page.getByRole('button', { name: 'Arm outline color', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Arm outline color picker' })
  await expect(picker).toBeVisible()
  await picker.getByRole('slider', { name: 'Hue', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await picker.getByRole('textbox', { name: 'Arm outline color hex' }).fill('#e24a67')
  await expect(page.locator('.logo-preview g[stroke="#e24a67"]')).toHaveCount(3)
  const bounds = await picker.boundingBox()
  const viewport = page.viewportSize()!
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
  await page.screenshot({ path: info.outputPath('color-picker.png') })
  await page.keyboard.press('Escape')
  await expect(picker).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Arm outline color', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Selected arm', exact: true }).click()
  await page.getByRole('button', { name: 'Circle fill color', exact: true }).click()
  await page.getByRole('textbox', { name: 'Circle fill color hex' }).fill('#abc')
  await expect(page.locator('.arm-handle[fill="#aabbcc"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Close color picker' }).click()
  await page.getByRole('button', { name: 'Background color', exact: true }).click()
  await page.getByRole('textbox', { name: 'Background color hex' }).fill('#101820')
  await expect(page.locator('.artboard-wrap')).toHaveCSS('background-color', 'rgb(16, 24, 32)')
  await page.getByRole('button', { name: 'Close color picker' }).click()
  expect(errors).toEqual([])
})

test('edits individual and shared geometry, adds and removes arms, and undoes changes', async ({
  page,
}, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.arm-handle')).toHaveCount(3)
  await page.getByRole('spinbutton', { name: 'Arm length', exact: true }).fill('180')
  await expect(page.locator('.arm-handle').first()).toHaveAttribute('cy', '-180')
  await page.getByRole('button', { name: 'All arms', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Circle radius', exact: true }).fill('40')
  await expect(page.locator('.arm-handle[r="40"]')).toHaveCount(3)
  await page.getByRole('button', { name: 'Add arm', exact: true }).click()
  await expect(page.locator('.arm-handle')).toHaveCount(4)
  await page.getByRole('button', { name: 'Remove selected arm' }).click()
  await expect(page.locator('.arm-handle')).toHaveCount(3)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('.arm-handle')).toHaveCount(4)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.locator('.arm-handle')).toHaveCount(3)
  const artboard = await page.locator('.artboard-wrap').boundingBox()
  if (!artboard) throw new Error('Artboard is not visible')
  for (const handle of await page.locator('.arm-handle').all()) {
    const bounds = await handle.boundingBox()
    if (!bounds) throw new Error('Arm is not visible')
    expect(bounds.x).toBeGreaterThanOrEqual(artboard.x)
    expect(bounds.y).toBeGreaterThanOrEqual(artboard.y)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(artboard.x + artboard.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(artboard.y + artboard.height)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('editor.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('autoplay changes angles while preserving arm lengths', async ({ page }) => {
  await page.goto('/')
  const handle = page.locator('.arm-handle').first()
  const before = await handle.getAttribute('cx')
  await page.getByRole('button', { name: 'Start autoplay' }).click()
  await expect.poll(() => handle.getAttribute('cx')).not.toBe(before)
  await page.getByRole('button', { name: 'Pause autoplay' }).click()
  const lengths = await page
    .locator('.arm-handle')
    .evaluateAll((elements) =>
      elements.map((element) =>
        Math.hypot(Number(element.getAttribute('cx')), Number(element.getAttribute('cy'))),
      ),
    )
  lengths.forEach((length, index) => expect(length).toBeCloseTo([210, 140, 90][index], 8))
  await page.getByRole('button', { name: 'Reset playback' }).click()
  await expect(handle).toHaveAttribute('cy', '-210')
})

test('drags endpoints with angle snapping and a single undo step', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('checkbox', { name: 'Snap angles to 15 degrees' }).check()
  const handle = page.locator('.arm-handle').first()
  await handle.scrollIntoViewIfNeeded()
  const box = await handle.boundingBox()
  const canvas = await page.locator('.logo-preview').boundingBox()
  if (!box || !canvas) throw new Error('Logo geometry is not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvas.x + canvas.width * 0.8, canvas.y + canvas.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(page.getByRole('spinbutton', { name: 'Angle', exact: true })).toHaveValue('0')
  await expect(handle).toHaveAttribute('cx', '210')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(handle).toHaveAttribute('cy', '-210')
})

test('supports independent rotation and optional length animation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Motion' }).click()
  await page.getByRole('combobox', { name: 'Rotation mode' }).selectOption('independent')
  await expect(page.getByRole('checkbox', { name: 'Animate arm lengths' })).not.toBeChecked()
  await page.getByRole('checkbox', { name: 'Animate arm lengths' }).check()
  await page.getByRole('button', { name: 'Start autoplay' }).click()
  await expect
    .poll(() =>
      page
        .locator('.arm-handle')
        .first()
        .evaluate((element) =>
          Math.hypot(Number(element.getAttribute('cx')), Number(element.getAttribute('cy'))),
        ),
    )
    .toBeGreaterThan(210)
  await page.getByRole('button', { name: 'Pause autoplay' }).click()
})

for (const format of ['png', 'jpg', 'svg'] as const) {
  for (const includeJson of [false, true]) {
    test(`exports ${format} at requested dimensions ${includeJson ? 'with JSON configuration' : 'as an image by default'}`, async ({
      page,
    }, info) => {
      await page.goto('/')
      if (format !== 'svg')
        await page.getByRole('checkbox', { name: 'Transparent background' }).check()
      await page.getByRole('button', { name: 'Export', exact: true }).click()
      await expect(
        page.getByRole('checkbox', { name: 'Include JSON configuration' }),
      ).not.toBeChecked()
      if (includeJson)
        await page.getByRole('checkbox', { name: 'Include JSON configuration' }).check()
      await page
        .getByRole('button', {
          name: format === 'jpg' ? 'JPEG' : format.toUpperCase(),
          exact: true,
        })
        .click()
      await page.getByRole('checkbox', { name: 'Lock aspect ratio' }).uncheck()
      await page.getByRole('spinbutton', { name: 'Export width' }).fill('640')
      await page.getByRole('spinbutton', { name: 'Export height' }).fill('480')
      const received = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Download export' }).click()
      const download = await received
      expect(download.suggestedFilename()).toBe(
        includeJson ? `Untitled-orbit-${format}.zip` : `Untitled-orbit.${format}`,
      )
      const path = info.outputPath(download.suggestedFilename())
      await download.saveAs(path)
      const { readFile } = await import('node:fs/promises')
      const contents = await readFile(path)
      let image = contents.toString('base64')
      if (includeJson) {
        const zip = await JSZip.loadAsync(contents)
        const config = JSON.parse(await zip.file('Untitled-orbit.json')!.async('string'))
        expect(config.arms).toHaveLength(3)
        expect(config.capturedAtSeconds).toBe(0)
        image = await zip.file(`Untitled-orbit.${format}`)!.async('base64')
      }
      const pixels = await page.evaluate(
        async ({ image, format }) => {
          const blob = await (
            await fetch(
              `data:${format === 'svg' ? 'image/svg+xml' : format === 'jpg' ? 'image/jpeg' : 'image/png'};base64,${image}`,
            )
          ).blob()
          const url = URL.createObjectURL(blob)
          const bitmap = new Image()
          bitmap.src = url
          await bitmap.decode()
          URL.revokeObjectURL(url)
          const canvas = document.createElement('canvas')
          canvas.width = bitmap.width
          canvas.height = bitmap.height
          const context = canvas.getContext('2d')!
          context.drawImage(bitmap, 0, 0)
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data
          let colored = 0
          for (let index = 0; index < data.length; index += 4)
            if (data[index] < 100 && data[index + 1] > 60 && data[index + 3] > 0) colored++
          return { width: bitmap.width, height: bitmap.height, colored, cornerAlpha: data[3] }
        },
        { image, format },
      )
      expect(pixels.width).toBe(640)
      expect(pixels.height).toBe(480)
      expect(pixels.colored).toBeGreaterThan(100)
      if (format === 'png') expect(pixels.cornerAlpha).toBe(0)
      if (format === 'jpg') expect(pixels.cornerAlpha).toBe(255)
    })
  }
}

test('validates resolution and restores a saved playback pose', async ({ page }) => {
  await page.goto('/')
  const config = { ...defaultConfig(), capturedAtSeconds: 10 }
  await page.locator('input[type="file"]').setInputFiles({
    name: 'logo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(config)),
  })
  await expect(page.locator('.arm-handle').first()).toHaveAttribute('cy', '210')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Lock aspect ratio' }).uncheck()
  await page.getByRole('spinbutton', { name: 'Export width' }).fill('8192')
  await page.getByRole('spinbutton', { name: 'Export height' }).fill('8192')
  await page.getByRole('button', { name: 'Download export' }).click()
  await expect(page.getByRole('alert')).toContainText('32 million')
})

test('embed has no controls, animates, and respects reduced motion', async ({ page }) => {
  await page.goto('/')
  await page.addScriptTag({ type: 'module', url: '/orbit-embed.js' })
  await page.waitForFunction(() => !!customElements.get('orbit-logo'))
  await page.evaluate(() => {
    const logo = document.createElement('orbit-logo')
    logo.setAttribute('autoplay', '')
    logo.style.cssText =
      'display:block;height:300px;width:300px;position:fixed;inset:0;z-index:100;background:white'
    document.body.append(logo)
  })
  const embed = page.locator('orbit-logo')
  await expect(embed.locator('circle')).toHaveCount(3)
  await expect(embed.locator('button')).toHaveCount(0)
  const circle = embed.locator('circle').first()
  const before = await circle.getAttribute('cx')
  await expect.poll(() => circle.getAttribute('cx')).not.toBe(before)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const frozen = await circle.getAttribute('cx')
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      ),
  )
  expect(await circle.getAttribute('cx')).toBe(frozen)
})
