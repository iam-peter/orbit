import * as Popover from '@radix-ui/react-popover'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { X } from 'lucide-react'
import { useRecentColors } from './useRecentColors'

export function ColorControl({
  label,
  name,
  value,
  onChange,
}: {
  label: string
  name: string
  value: string
  onChange: (color: string) => void
}) {
  const { colors, remember } = useRecentColors()
  const change = (color: string) => {
    const normalized =
      color.length === 4
        ? `#${color
            .slice(1)
            .split('')
            .map((character) => character + character)
            .join('')}`
        : color
    if (/^#[0-9a-f]{6}$/i.test(normalized)) onChange(normalized)
  }
  return (
    <div className="color-control">
      <span>{label}</span>
      <Popover.Root
        onOpenChange={(open) => {
          if (!open) remember(value)
        }}
      >
        <Popover.Trigger asChild>
          <button className="color-trigger" type="button" aria-label={name} title={name}>
            <span style={{ backgroundColor: value }} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="color-popover"
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={16}
            aria-label={`${name} picker`}
          >
            <div className="color-popover-heading">
              <h3>{label}</h3>
              <Popover.Close
                className="icon-button"
                aria-label="Close color picker"
                title="Close color picker"
              >
                <X size={16} />
              </Popover.Close>
            </div>
            <HexColorPicker color={value} onChange={change} />
            <label className="hex-field">
              Hex
              <HexColorInput aria-label={`${name} hex`} color={value} onChange={change} prefixed />
            </label>
            <div className="recent-colors" role="group" aria-label="Recent colors">
              <span className="recent-colors-label">Recent</span>
              <div className="recent-colors-grid">
                {Array.from({ length: 12 }, (_, index) =>
                  colors[index] ? (
                    <button
                      key={colors[index]}
                      className="recent-color-swatch"
                      type="button"
                      aria-label={`Use recent color ${colors[index]}`}
                      title={colors[index]}
                      aria-pressed={value.toLowerCase() === colors[index]}
                      onClick={() => change(colors[index])}
                    >
                      <span style={{ backgroundColor: colors[index] }} />
                    </button>
                  ) : (
                    <span
                      key={`empty-${index}`}
                      className="recent-color-empty"
                      aria-hidden="true"
                    />
                  ),
                )}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
