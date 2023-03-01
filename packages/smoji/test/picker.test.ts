import { createSmoji, textTarget } from '../src'
import { smojiMarker } from '../src/marker'
import type { InsertTarget, SmojiPack } from '../src'

const packs: SmojiPack[] = [
  {
    id: 'faces',
    label: '<颜文字>',
    items: [{ id: 'happy', label: '<img src=x>', src: 'https://static.example.test/happy.webp' }],
  },
  {
    id: 'images',
    label: '图片',
    items: [{ id: 'cat', label: '猫猫', src: 'https://static.example.test/cat.webp' }],
  },
]

function setup(closeOnSelect = true) {
  document.body.replaceChildren()
  const trigger = document.createElement('button')
  const textarea = document.createElement('textarea')
  document.body.append(trigger, textarea)
  const onSelect = vi.fn()
  const picker = createSmoji({
    trigger,
    packs,
    target: textTarget(textarea, { serialize: smojiMarker }),
    closeOnSelect,
    onSelect,
  })
  return { trigger, textarea, picker, onSelect }
}

describe('smoji picker', () => {
  it('opens, toggles and closes with stable state', () => {
    const { trigger, picker } = setup()
    expect(picker.isOpen()).toBe(false)
    picker.open()
    expect(picker.isOpen()).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    picker.toggle()
    expect(picker.isOpen()).toBe(false)
  })

  it('replaces the selected text, bubbles input, and restores focus', () => {
    const { textarea, picker } = setup()
    textarea.value = 'hello world'
    textarea.setSelectionRange(6, 11)
    const input = vi.fn()
    textarea.addEventListener('input', input)
    textarea.blur()
    picker.open()
    document.querySelector<HTMLButtonElement>('[data-item-index="0"]')!.click()
    expect(textarea.value).toBe('hello ![smoji:<img src=x>](https://static.example.test/happy.webp)')
    expect(textarea.selectionStart).toBe(textarea.value.length)
    expect(input).toHaveBeenCalledOnce()
    expect(input.mock.calls[0]![0].bubbles).toBe(true)
    expect(document.activeElement).toBe(textarea)
    expect(picker.isOpen()).toBe(false)
  })

  it('renders user strings as text rather than HTML', () => {
    setup()
    const tab = document.querySelector<HTMLElement>('[role="tab"]')!
    const item = document.querySelector<HTMLElement>('[data-item-index]')!
    expect(tab.textContent).toBe('<颜文字>')
    expect(item.querySelector('img')?.getAttribute('src')).toBe('https://static.example.test/happy.webp')
    expect(item.getAttribute('aria-label')).toBe('<img src=x>')
    expect(item.innerHTML).not.toContain('<img src=x>')
  })

  it('renders only the active pack and inserts Ecoku markers', () => {
    const { textarea, picker, onSelect } = setup(false)
    picker.open()
    expect(document.querySelectorAll('[data-item-index]')).toHaveLength(1)
    document.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!.click()
    expect(document.querySelectorAll('[data-item-index]')).toHaveLength(1)
    const item = document.querySelector<HTMLButtonElement>('[data-item-index="0"]')!
    expect(item.querySelector('img')?.getAttribute('src')).toBe('https://static.example.test/cat.webp')
    expect(item.querySelector('img')?.referrerPolicy).toBe('no-referrer')
    item.click()
    expect(textarea.value).toBe('![smoji:猫猫](https://static.example.test/cat.webp)')
    expect(onSelect).toHaveBeenCalledWith(packs[1]!.items[0], packs[1])
    expect(picker.isOpen()).toBe(true)
  })

  it('closes on outside pointer and Escape', () => {
    const { trigger, picker } = setup()
    picker.open()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(picker.isOpen()).toBe(false)
    picker.open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(picker.isOpen()).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('destroys idempotently and removes its listeners, DOM and open state', () => {
    const { trigger, picker } = setup()
    picker.open()
    picker.destroy()
    picker.destroy()
    trigger.click()
    expect(picker.isOpen()).toBe(false)
    expect(document.querySelector('.smoji')).toBeNull()
    expect(trigger.hasAttribute('aria-expanded')).toBe(false)
  })

  it('rejects invalid options with a useful error', () => {
    expect(() => createSmoji({
      trigger: document.createTextNode('not an element') as unknown as HTMLElement,
      packs,
      target: { insert: 'not a function' } as unknown as InsertTarget,
    })).toThrow(TypeError)
  })

  it('navigates tabs with keyboard arrow keys and links tabpanel via ARIA', () => {
    setup()
    const tabsContainer = document.querySelector<HTMLElement>('.smoji__tabs')!
    const tabs = document.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    const grid = document.querySelector<HTMLElement>('.smoji__grid')!

    expect(grid.getAttribute('role')).toBe('tabpanel')
    expect(grid.getAttribute('aria-labelledby')).toBe(tabs[0]!.id)
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('false')

    // ArrowRight moves to next tab
    tabsContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    expect(grid.getAttribute('aria-labelledby')).toBe(tabs[1]!.id)
    expect(document.activeElement).toBe(tabs[1])

    // ArrowLeft moves back to first tab
    tabsContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    expect(grid.getAttribute('aria-labelledby')).toBe(tabs[0]!.id)
    expect(document.activeElement).toBe(tabs[0])

    // End moves to last tab
    tabsContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[1])

    // Home moves to first tab
    tabsContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tabs[0])
  })

  it('textTarget tries execCommand and falls back to setRangeText if execCommand returns false', () => {
    const textarea = document.createElement('textarea')
    document.body.append(textarea)
    const target = textTarget(textarea, { serialize: (i) => i.src })

    const execFn = vi.fn().mockReturnValue(false)
    ;(document as unknown as { execCommand: typeof execFn }).execCommand = execFn
    target.insert({ id: '1', label: '1', src: 'test.png' }, packs[0]!)
    expect(execFn).toHaveBeenCalledWith('insertText', false, 'test.png')
    expect(textarea.value).toBe('test.png')
    delete (document as unknown as { execCommand?: typeof execFn }).execCommand
  })
})
