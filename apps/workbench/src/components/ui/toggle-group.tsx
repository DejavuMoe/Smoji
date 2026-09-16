import type { ComponentProps } from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'
import { cn } from '../../lib/utils'

export function ToggleGroup({ className, value, onValueChange, ...props }: Omit<Extract<ComponentProps<typeof ToggleGroupPrimitive.Root>, { type: 'single' }>, 'type' | 'value' | 'onValueChange'> & {
  value: string
  onValueChange: (value: string) => void
}) {
  return <ToggleGroupPrimitive.Root data-slot="toggle-group" type="single" value={value}
    onValueChange={next => { if (next) onValueChange(next) }}
    className={cn('inline-flex min-h-8 min-w-0 max-w-full flex-wrap gap-0.5 rounded-lg bg-muted p-0.5 text-xs', className)} {...props} />
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return <ToggleGroupPrimitive.Item data-slot="toggle-group-item" className={cn(
    'min-h-7 flex-[1_0_auto] whitespace-nowrap rounded-md px-2 py-1 text-xs leading-4 font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-xs disabled:opacity-50', className,
  )} {...props} />
}
