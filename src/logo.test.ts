import { describe, expect, it } from 'vitest'
import {
  configSchema,
  defaultConfig,
  endpoint,
  extent,
  poseAt,
  randomize,
  svgMarkup,
  validateResolution,
} from './logo'

describe('logo geometry', () => {
  it('rotates without changing lengths, radii, or the base configuration', () => {
    const config = defaultConfig()
    const original = structuredClone(config)
    const pose = poseAt(config, 10)
    expect(pose[0].angle).toBe(90)
    expect(pose.map((arm) => arm.length)).toEqual(config.arms.map((arm) => arm.length))
    expect(pose.map((arm) => arm.radius)).toEqual(config.arms.map((arm) => arm.radius))
    expect(config).toEqual(original)
  })
  it('supports independent motion and optional length animation within stable bounds', () => {
    const config = defaultConfig()
    config.animation.mode = 'independent'
    config.animation.animateLength = true
    for (let seconds = 0; seconds < 20; seconds += 0.1) {
      poseAt(config, seconds).forEach((arm) => {
        const point = endpoint(arm)
        expect(
          Math.hypot(point.x, point.y) + arm.radius + config.strokeWidth / 2,
        ).toBeLessThanOrEqual(extent(config))
      })
    }
    expect(poseAt(config, 1)[1].angle).toBe(18)
  })
  it('enforces angular separation including the wraparound gap', () => {
    const config = defaultConfig()
    config.minAngle = 100
    for (let attempt = 0; attempt < 100; attempt++) {
      const angles = randomize(config)
        .arms.map((arm) => arm.angle)
        .sort((left, right) => left - right)
      angles.forEach((angle, index) =>
        expect((angles[(index + 1) % angles.length] - angle + 360) % 360).toBeGreaterThanOrEqual(
          100 - 1e-9,
        ),
      )
    }
    config.minAngle = 121
    expect(() => randomize(config)).toThrow('Minimum separation')
  })
  it('roundtrips JSON and rejects malformed or unsafe configuration', () => {
    const config = defaultConfig()
    expect(configSchema.parse(JSON.parse(JSON.stringify(config)))).toEqual(config)
    expect(configSchema.safeParse({ ...config, arms: [] }).success).toBe(false)
    expect(configSchema.safeParse({ ...config, background: '<script>' }).success).toBe(false)
    expect(
      configSchema.safeParse({ ...config, arms: [config.arms[0], config.arms[0]] }).success,
    ).toBe(false)
  })
  it('exports vector geometry without editor elements and preserves aspect ratio', () => {
    const config = defaultConfig()
    const svg = svgMarkup(config, 0, 2000, 1000)
    expect(svg.match(/<circle /g)).toHaveLength(3)
    expect(svg).toContain('viewBox=')
    expect(svg).not.toContain('selected')
    config.transparent = true
    expect(svgMarkup(config)).not.toContain('<rect')
    expect(svgMarkup(config, 0, 1000, 1000, true)).toContain('<rect')
  })
  it('stores titles and accepts older configurations without one', () => {
    const config = defaultConfig()
    const legacy = { ...config } as Partial<typeof config>
    delete legacy.title
    expect(configSchema.parse(legacy).title).toBe('Untitled orbit')
    expect(configSchema.parse({ ...config, title: '  My orbit  ' }).title).toBe('My orbit')
    expect(configSchema.safeParse({ ...config, title: ' ' }).success).toBe(false)
    expect(configSchema.safeParse({ ...config, title: 'x'.repeat(81) }).success).toBe(false)
  })
  it('limits raster allocations', () => {
    expect(() => validateResolution(4096, 4096)).not.toThrow()
    expect(() => validateResolution(8192, 8192)).toThrow()
    expect(() => validateResolution(0, 100)).toThrow()
    expect(() => validateResolution(1.5, 100)).toThrow()
  })
})
