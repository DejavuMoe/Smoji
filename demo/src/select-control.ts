/** A themed, keyboard-accessible picker backed by the existing select value and change event. */
export function createSelectControl(select: HTMLSelectElement) {
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.id = `${select.id}-trigger`
  trigger.className = 'select-control'
  trigger.setAttribute('role', 'combobox')
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  const label = document.createElement('span')
  trigger.append(label)

  const menu = document.createElement('div')
  menu.id = `${select.id}-options`
  menu.className = 'select-menu'
  menu.setAttribute('role', 'listbox')
  menu.setAttribute('aria-label', select.getAttribute('aria-label') ?? '选择')
  menu.setAttribute('popover', 'auto')
  menu.hidden = true
  trigger.setAttribute('aria-controls', menu.id)
  select.hidden = true
  select.after(trigger, menu)
  let open = false

  const choices = () => [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  const focusChoice = (item: HTMLButtonElement | undefined) => {
    if (!item) return
    item.focus({ preventScroll: true })
    if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop
    const bottom = item.offsetTop + item.offsetHeight
    if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight
  }
  const close = (restoreFocus = true) => {
    if (!open) return
    open = false
    menu.hidePopover?.()
    menu.hidden = true
    trigger.setAttribute('aria-expanded', 'false')
    if (restoreFocus) trigger.focus({ preventScroll: true })
  }
  const sync = () => {
    const focusedValue = menu.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.value : undefined
    label.textContent = select.selectedOptions[0]?.textContent ?? '选择'
    trigger.setAttribute('aria-label', `${select.getAttribute('aria-label') ?? '选择'}：${label.textContent}`)
    trigger.disabled = select.disabled || !select.options.length
    menu.replaceChildren(...[...select.options].map((option) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'select-option'
      item.dataset.value = option.value
      item.textContent = option.textContent
      item.disabled = option.disabled
      item.tabIndex = option.selected ? 0 : -1
      item.setAttribute('role', 'option')
      item.setAttribute('aria-selected', String(option.selected))
      return item
    }))
    if (open && focusedValue) focusChoice(choices().find((item) => item.dataset.value === focusedValue) ?? choices()[0])
  }
  const position = () => {
    if (!open) return
    const rect = trigger.getBoundingClientRect()
    const vv = window.visualViewport
    const top = vv?.offsetTop ?? 0
    const left = vv?.offsetLeft ?? 0
    const width = vv?.width ?? window.innerWidth
    const height = vv?.height ?? window.innerHeight
    const gap = parseFloat(getComputedStyle(menu).getPropertyValue('--select-gap')) || 4
    menu.style.width = `${Math.min(rect.width, width - gap * 2)}px`
    menu.style.maxWidth = `${width - gap * 2}px`
    const above = rect.top - top - gap
    const below = top + height - rect.bottom - gap
    const opensAbove = menu.scrollHeight > below && above > below
    menu.style.maxHeight = `${Math.max(0, opensAbove ? above : below)}px`
    const bounds = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(left + gap, Math.min(rect.left, left + width - bounds.width - gap))}px`
    menu.style.top = `${opensAbove ? rect.top - bounds.height - gap : rect.bottom + gap}px`
  }
  const show = (edge?: 'first' | 'last') => {
    if (trigger.disabled) return
    sync()
    open = true
    menu.hidden = false
    menu.showPopover?.()
    trigger.setAttribute('aria-expanded', 'true')
    position()
    const options = choices()
    const target = edge === 'first' ? options[0] : edge === 'last' ? options[options.length - 1]
      : options.find((item) => item.dataset.value === select.value) ?? options[0]
    focusChoice(target)
  }

  trigger.addEventListener('click', () => open ? close() : show())
  trigger.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    show(event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : undefined)
  })
  menu.addEventListener('click', (event) => {
    const option = (event.target as Element).closest<HTMLButtonElement>('[data-value]')
    if (!option || option.disabled) return
    select.value = option.dataset.value!
    close()
    sync()
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.stopPropagation()
      if (event.key === 'Escape') event.preventDefault()
      close()
      return
    }
    const options = choices()
    const index = options.indexOf(document.activeElement as HTMLButtonElement)
    let next: number | undefined
    if (event.key === 'ArrowDown') next = Math.min(options.length - 1, index + 1)
    if (event.key === 'ArrowUp') next = Math.max(0, index - 1)
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = options.length - 1
    if (next !== undefined) {
      event.preventDefault()
      event.stopPropagation()
      focusChoice(options[next])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      options[index]?.click()
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault()
      event.stopPropagation()
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      const ordered = [...options.slice(index + 1), ...options.slice(0, index + 1)]
      focusChoice(ordered.find((item) => item.textContent?.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase())))
    }
  })
  menu.addEventListener('toggle', (event) => {
    if ((event as ToggleEvent).newState === 'closed') close(false)
  })
  document.addEventListener('pointerdown', (event) => {
    if (open && !menu.contains(event.target as Node) && !trigger.contains(event.target as Node)) close(false)
  })
  select.addEventListener('change', sync)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
  window.visualViewport?.addEventListener('resize', position)
  window.visualViewport?.addEventListener('scroll', position)
  sync()
  return { sync, close, focus: () => trigger.focus() }
}
