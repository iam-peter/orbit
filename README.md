# Orbit Logo Studio

A browser-based logo studio for creating and animating radial logos. Customize arms, circles, and colors; export resolution-aware PNG/JPEG or SVG; and embed animated logos without editor controls. Built with React, TypeScript, and SVG. No backend is required.

[Open Orbit on GitHub Pages](https://iam-peter.github.io/orbit/)

## Development

Use Node 22.12 or newer (Node 22 is specified in `.nvmrc`).

```sh
npm ci
npm run dev
```

The editor runs at the URL printed by Vite. To run all checks:

```sh
npx playwright install chromium firefox
npm run check
```

`npm test` runs geometry tests, and `npm run test:e2e` runs desktop/mobile browser tests. `npm run format` formats source files.

## Editor

- Edit the title above the canvas. Enter or clicking away commits the name; Escape cancels. The title is saved in JSON and supplies the default export filename, which can still be overridden per export. Older JSON files without a title load as "Untitled orbit".
- Add or remove arms (1-24), and drag endpoints to adjust angles.
- Edit angle, arm length, circle radius, outline color, and circle fill for a selected arm or all arms. Shared controls show the selected arm's value; changing a value applies it to every arm.
- Adjust stroke width, padding, background color, and transparency.
- Use the in-page `react-colorful` picker or hex input for colors; no OS color dialog is opened. Two rows hold the twelve most recent colors, shared across pickers and remembered locally. Final selections are recorded when a picker closes. Pickers support keyboard editing and Escape to close.
- Toggle light/dark mode from the header. The initial theme follows the system; an explicit choice is remembered locally. Theme changes never change logo or export colors.
- Snap dragged angles to 15-degree increments, distribute arms evenly, or randomize angles with a minimum separation. Randomization preserves lengths and colors and rejects impossible separation constraints.
- Undo/redo design changes. Each endpoint drag is one undo step.
- Play whole-logo or independent-arm rotation, including reverse motion through negative speeds. Lengths stay fixed by default; optional length animation has an adjustable amplitude.

Playback does not mutate the base design. Editing pauses playback and commits visible angles before applying the edit; optional length oscillations are not committed. Reset playback returns to the current base pose. Editor playback pauses its clock while the page is hidden.

## Export and Configuration

PNG, JPEG, and SVG exports download directly as image files by default. Enable **Include JSON configuration** in the export dialog to download a ZIP containing the image and a versioned JSON configuration. Export captures the visible pose when the dialog opens, even if playback continues underneath it.

Choose width and height in pixels and optionally lock their ratio. Export fits the whole logo without stretching and reserves room for its complete animation range. Dimensions must be positive integers up to 8192, with a maximum of 32 million pixels. PNG supports transparency; JPEG uses the configured opaque background. SVG has a proper `viewBox` and remains resolution independent. Selection handles and guides never appear in exported images.

Save JSON separately through the header, and import it to restore geometry, styles, animation settings, and the paused captured pose. Configuration files are validated with Zod; invalid versions, duplicate arm IDs, unsupported colors, and out-of-range values are rejected. `capturedAtSeconds` stores the playback position without altering base angles or lengths. Configuration import is limited to 1 MB.

## GitHub Pages

The app is static and can be hosted on GitHub Pages without a backend. The `Nightly GitHub Pages` workflow builds and deploys the default branch every night at **02:17 UTC**, and supports manual runs. GitHub schedules are best-effort and may be delayed; inactive public repositories can have scheduled workflows disabled after 60 days.

One-time repository setup:

1. Push this project, including `.github/workflows/pages.yml`, to the repository's default branch.
2. Open **Settings > Pages**, and choose **GitHub Actions** as the build/deployment source.
3. Open **Actions > Nightly GitHub Pages > Run workflow**, selecting the default branch, for the first deployment.

The workflow installs dependencies on Node 22, runs unit tests, lint, and Chromium/Firefox browser checks, builds the site, and deploys the Pages artifact. Deployment only runs from the default branch. It uses `GITHUB_TOKEN` with Pages permissions and does not require a personal token or a `gh-pages` branch. Check repository/organization Pages policies and plan eligibility if the repository is private.

The build reads `BASE_PATH` and the workflow sets it from GitHub's Pages configuration, supporting both repository sites (`/orbit/`) and root/custom-domain sites. To reproduce a repository-site build locally:

```sh
BASE_PATH=/orbit/ npm run build
BASE_PATH=/orbit/ npm run preview
```

Open the preview URL with `/orbit/` appended. No live deployment is performed by local builds. GitHub Pages hosts the entire output, including the standalone embed module and its shared chunks.

## Website Embedding

Run `npm run build` and serve the entire `dist` directory over HTTP(S). It contains the editor, `orbit-embed.js`, and shared assets. Do not copy the embed entry alone: it imports a shared chunk from `assets`.

For a static logo, use the exported SVG directly. For an animated logo:

```html
<script type="module" src="https://your-site.example/orbit-embed.js"></script>
<orbit-logo autoplay style="display:block;width:100%;height:400px"></orbit-logo>
```

The editor's embed dialog generates markup for the current design using the page's deployed path. Replace any local development URL with the deployed URL. For subdirectory hosting outside the workflow, set `BASE_PATH` before building.

The `config` attribute accepts the same JSON as an exported configuration, with HTML attribute characters escaped. Alternatively, assign the parsed configuration through JavaScript after the component is defined:

```js
await customElements.whenDefined('orbit-logo')
const logo = document.querySelector('orbit-logo')
logo.config = configuration
```

Remove `autoplay` for a static representation. The optional `speed` attribute overrides whole-logo rotation speed in degrees per second (-120 to 120). Independent motion uses each arm's stored speed. The component renders in a shadow root with no editor controls or React dependency. Autoplay pauses offscreen or in a hidden tab, and respects `prefers-reduced-motion`. Invalid attributes dispatch an `orbit-error` event and retain the last valid design.

## Scope

This first version exports still images and stores animation settings, not video/GIF or animated SVG. Presets, property locks, proportional scaling, and automatic design persistence are possible follow-up features. Browser checks cover Chromium desktop/mobile workflows and Firefox theme/color-picker smoke tests. Full Firefox workflow and Safari certification remain outstanding.
