import { forwardRef, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path className="logo__body" d="M18 0h28a18 18 0 0 1 18 18v28L46 64H18A18 18 0 0 1 0 46V18A18 18 0 0 1 18 0Z" />
      <path className="logo__peel" d="M46 64V54a8 8 0 0 1 8-8h10Z" />
      <path className="logo__s" d="M44 18c-3.5-3.5-7.8-5-13-5-7.6 0-13 4.2-13 10 0 5.4 4.3 8.2 13.5 10.5C40.2 35.7 44 38.6 44 43.6 44 49.4 38.6 53 31.5 53c-6.1 0-11.2-2.1-14.5-5.5" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

export function Tip({ label, children, side = 'top' }: { label?: string; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!label) return <>{children}</>
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="tip" side={side} sideOffset={6} collisionPadding={8}>
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tip?: string; tipSide?: 'top' | 'bottom' | 'left' | 'right' }

/** Icon-only control: the accessible name is the visible tooltip's operational text. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tip, tipSide, className = '', children, ...props }, ref,
) {
  const button = (
    <button ref={ref} type="button" aria-label={label} className={`icon-btn ${className}`} {...props}>
      {children}
    </button>
  )
  return props.disabled ? button : <Tip label={tip ?? label} side={tipSide}>{button}</Tip>
})

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  id?: string
  title?: string
}

interface SegmentedProps<T extends string> {
  value: T
  options: readonly SegmentOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
  id?: string
  size?: 'sm' | 'md'
}

/** Single-choice radio group: one tab stop, arrow keys move and select. */
export function Segmented<T extends string>({ value, options, onChange, label, className = '', id, size = 'md' }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const index = options.findIndex((option) => option.value === value)
    const next = (index + delta + options.length) % options.length
    onChange(options[next]!.value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} id={id} className={`seg seg--${size} ${className}`} onKeyDown={onKeyDown}
      style={{ ['--seg-count' as string]: options.length, ['--seg-index' as string]: Math.max(0, options.findIndex((o) => o.value === value)) }}>
      <span className="seg__thumb" aria-hidden="true" />
      {options.map((option, index) => (
        <button key={option.value} ref={(node) => { refs.current[index] = node }} type="button" role="radio"
          id={option.id} title={option.title} aria-checked={option.value === value} tabIndex={option.value === value ? 0 : -1}
          className="seg__item" onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
