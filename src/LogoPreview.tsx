import { useRef } from 'react'
import type { PointerEvent } from 'react'
import { endpoint, extent, normalizeAngle, poseAt } from './logo'
import type { LogoConfig } from './logo'

type Props = {
  config: LogoConfig
  seconds: number
  selected: string
  guides: boolean
  snap: boolean
  onSelect: (id: string) => void
  onDragStart: () => void
  onAngle: (id: string, angle: number) => void
}

export function LogoPreview({
  config,
  seconds,
  selected,
  guides,
  onSelect,
  onDragStart,
  onAngle,
  snap,
}: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef<string | null>(null)
  const bound = extent(config)
  const arms = poseAt(config, seconds)
  const selectedArm = arms.find((arm) => arm.id === selected)
  const selectedPoint = selectedArm ? endpoint(selectedArm) : undefined
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current || !svg.current) return
    const matrix = svg.current.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const angle = normalizeAngle((Math.atan2(point.y, point.x) * 180) / Math.PI)
    onAngle(dragging.current, snap ? normalizeAngle(Math.round(angle / 15) * 15) : angle)
  }
  return (
    <svg
      ref={svg}
      className="logo-preview"
      viewBox={`${-bound} ${-bound} ${bound * 2} ${bound * 2}`}
      role="img"
      aria-label="Editable orbit logo"
      onPointerMove={move}
      onPointerUp={() => {
        dragging.current = null
      }}
      onPointerCancel={() => {
        dragging.current = null
      }}
    >
      <title>Orbit logo</title>
      {guides && (
        <g className="guides" fill="none" stroke="#d5dddb" strokeWidth="0.7" strokeDasharray="3 5">
          <circle r={bound - config.padding} />
          <line x1={-bound} x2={bound} />
          <line y1={-bound} y2={bound} />
        </g>
      )}
      {arms.map((arm, index) => {
        const point = endpoint(arm)
        return (
          <g
            key={arm.id}
            stroke={arm.stroke}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          >
            <line x1="0" y1="0" x2={point.x} y2={point.y} />
            <circle
              className="arm-handle"
              data-arm={arm.id}
              cx={point.x}
              cy={point.y}
              r={arm.radius}
              fill={arm.fill}
              role="button"
              tabIndex={0}
              aria-label={`Select arm ${index + 1}`}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(arm.id)
                }
              }}
              onPointerDown={(event) => {
                event.preventDefault()
                onSelect(arm.id)
                onDragStart()
                dragging.current = arm.id
                svg.current?.setPointerCapture(event.pointerId)
              }}
            />
          </g>
        )
      })}
      {guides && selectedArm && selectedPoint && (
        <circle
          className="selection-ring"
          cx={selectedPoint.x}
          cy={selectedPoint.y}
          r={selectedArm.radius + config.strokeWidth / 2 + 8}
          fill="none"
          stroke="#879590"
          strokeWidth="1"
          strokeDasharray="3 4"
          pointerEvents="none"
          aria-hidden="true"
        />
      )}
    </svg>
  )
}
