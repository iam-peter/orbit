import { z } from 'zod'

const color = z.string().regex(/^#[0-9a-f]{6}$/i)
export const armSchema = z.object({
  id: z.string().min(1).max(80),
  angle: z.number().finite().min(0).max(360),
  length: z.number().min(10).max(280),
  radius: z.number().min(2).max(70),
  stroke: color,
  fill: color,
  speed: z.number().min(-120).max(120),
})
export const configSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(80).default('Untitled orbit'),
  capturedAtSeconds: z.number().finite().min(0).max(1_000_000_000).optional(),
  arms: z
    .array(armSchema)
    .min(1)
    .max(24)
    .refine(
      (arms) => new Set(arms.map((arm) => arm.id)).size === arms.length,
      'Arm IDs must be unique',
    ),
  strokeWidth: z.number().min(1).max(20),
  background: color,
  transparent: z.boolean(),
  padding: z.number().min(0).max(100),
  minAngle: z.number().min(0).max(360),
  animation: z.object({
    mode: z.enum(['together', 'independent']),
    speed: z.number().min(-120).max(120),
    animateLength: z.boolean(),
    amplitude: z.number().min(0).max(0.5),
  }),
})
export type LogoConfig = z.infer<typeof configSchema>
export type Arm = z.infer<typeof armSchema>

export function defaultConfig(): LogoConfig {
  return {
    version: 1,
    title: 'Untitled orbit',
    arms: [
      {
        id: 'arm-1',
        angle: 270,
        length: 210,
        radius: 30,
        stroke: '#16776b',
        fill: '#ffffff',
        speed: 18,
      },
      {
        id: 'arm-2',
        angle: 30,
        length: 140,
        radius: 30,
        stroke: '#16776b',
        fill: '#ffffff',
        speed: -12,
      },
      {
        id: 'arm-3',
        angle: 150,
        length: 90,
        radius: 30,
        stroke: '#16776b',
        fill: '#ffffff',
        speed: 25,
      },
    ],
    strokeWidth: 5,
    background: '#ffffff',
    transparent: false,
    padding: 35,
    minAngle: 20,
    animation: { mode: 'together', speed: 18, animateLength: false, amplitude: 0.2 },
  }
}

export const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360

export function poseAt(config: LogoConfig, seconds: number): Arm[] {
  return config.arms.map((arm, index) => ({
    ...arm,
    angle: normalizeAngle(
      arm.angle +
        seconds * (config.animation.mode === 'together' ? config.animation.speed : arm.speed),
    ),
    length: config.animation.animateLength
      ? arm.length * (1 + config.animation.amplitude * Math.sin(seconds * 1.5 + index))
      : arm.length,
  }))
}

export function extent(config: LogoConfig): number {
  const scale = config.animation.animateLength ? 1 + config.animation.amplitude : 1
  return (
    Math.max(...config.arms.map((arm) => arm.length * scale + arm.radius)) +
    config.strokeWidth / 2 +
    config.padding
  )
}

export function endpoint(arm: Arm) {
  const radians = (arm.angle * Math.PI) / 180
  return { x: Math.cos(radians) * arm.length, y: Math.sin(radians) * arm.length }
}

export function randomize(config: LogoConfig): LogoConfig {
  const count = config.arms.length
  if (count * config.minAngle > 360)
    throw new Error(
      `Minimum separation must be at most ${Math.floor(360 / count)} degrees for ${count} arms.`,
    )
  const remaining = 360 - count * config.minAngle
  const weights = config.arms.map(() => -Math.log(Math.max(Number.EPSILON, Math.random())))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let angle = Math.random() * 360
  return {
    ...config,
    arms: config.arms.map((arm, index) => {
      const updated = { ...arm, angle: normalizeAngle(angle) }
      angle += config.minAngle + (remaining * weights[index]) / total
      return updated
    }),
  }
}

export function svgMarkup(
  config: LogoConfig,
  seconds = 0,
  width = 1000,
  height = 1000,
  opaque = false,
): string {
  const bound = extent(config)
  const ratio = width / height
  const viewWidth = 2 * bound * Math.max(1, ratio)
  const viewHeight = 2 * bound * Math.max(1, 1 / ratio)
  const background =
    !config.transparent || opaque
      ? `<rect x="${-viewWidth / 2}" y="${-viewHeight / 2}" width="${viewWidth}" height="${viewHeight}" fill="${config.background}"/>`
      : ''
  const arms = poseAt(config, seconds)
    .map((arm) => {
      const point = endpoint(arm)
      return `<g stroke="${arm.stroke}" stroke-width="${config.strokeWidth}" stroke-linecap="round"><line x1="0" y1="0" x2="${point.x}" y2="${point.y}"/><circle cx="${point.x}" cy="${point.y}" r="${arm.radius}" fill="${arm.fill}"/></g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${-viewWidth / 2} ${-viewHeight / 2} ${viewWidth} ${viewHeight}">${background}${arms}</svg>`
}

export function validateResolution(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 32_000_000
  ) {
    throw new Error('Use whole pixel dimensions from 1 to 8192, with at most 32 million pixels.')
  }
}
