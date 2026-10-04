import { configSchema, defaultConfig, svgMarkup } from './logo'
import type { LogoConfig } from './logo'

export class OrbitLogo extends HTMLElement {
  static observedAttributes = ['config', 'autoplay', 'speed']
  private design = defaultConfig()
  private seconds = 0
  private frame = 0
  private visible = true
  private observer: IntersectionObserver | undefined
  private media = matchMedia('(prefers-reduced-motion: reduce)')
  private surface = this.attachShadow({ mode: 'open' })

  get config(): LogoConfig {
    return structuredClone(this.design)
  }
  set config(value: LogoConfig) {
    this.design = configSchema.parse(value)
    this.seconds = this.design.capturedAtSeconds ?? 0
    this.render()
  }

  connectedCallback() {
    this.setAttribute('role', 'img')
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Orbit logo')
    this.observer = new IntersectionObserver((entries) => {
      this.visible = entries[0]?.isIntersecting ?? false
    })
    this.observer.observe(this)
    this.render()
    let previous: number | undefined
    const tick = (now: number) => {
      if (
        this.hasAttribute('autoplay') &&
        !this.media.matches &&
        this.visible &&
        !document.hidden
      ) {
        if (previous !== undefined) {
          this.seconds += Math.min((now - previous) / 1000, 0.1)
          this.render()
        }
        previous = now
      } else {
        previous = undefined
      }
      this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame)
    this.observer?.disconnect()
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    try {
      if (name === 'config') this.config = value ? JSON.parse(value) : defaultConfig()
      if (name === 'speed') {
        const speed = value === null ? 18 : Number(value)
        if (!Number.isFinite(speed) || Math.abs(speed) > 120)
          throw new Error('Speed must be between -120 and 120.')
        this.design = { ...this.design, animation: { ...this.design.animation, speed } }
      }
      this.render()
    } catch (error) {
      this.dispatchEvent(
        new CustomEvent('orbit-error', { detail: error, bubbles: true, composed: true }),
      )
    }
  }

  private render() {
    this.surface.innerHTML = `<style>:host{display:block}svg{display:block;width:100%;height:100%}.surface{width:100%;height:100%;background:${this.design.transparent ? 'transparent' : this.design.background}}</style><div class="surface">${svgMarkup(this.design, this.seconds)}</div>`
  }
}

if (!customElements.get('orbit-logo')) customElements.define('orbit-logo', OrbitLogo)
