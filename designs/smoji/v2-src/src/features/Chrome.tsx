import { useEffect, useRef } from 'react'
import { ChevronDown, CircleHelp, Monitor, Moon, Sun } from 'lucide-react'
import { useWorkbench } from '@wb/app/WorkbenchContext'
import type { Theme } from '@wb/domain/state'
import { IconButton, Logo } from '../ui/primitives'
import { Sticker } from '../ui/Sticker'
import { PackList } from './PackList'

const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const THEME_LABEL: Record<Theme, string> = {
  system: '当前：跟随系统 (点击切换到浅色)',
  light: '当前：浅色模式 (点击切换到深色)',
  dark: '当前：深色模式 (点击切换到跟随系统)',
}

export function ThemeButton() {
  const { state, dispatch } = useWorkbench()
  const theme = state.preferences.theme
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  return (
    <IconButton id="theme-toggle" label={THEME_LABEL[theme]} onClick={() => dispatch({ type: 'SET_THEME', payload: THEME_NEXT[theme] })}>
      <Icon aria-hidden="true" />
    </IconButton>
  )
}

export function HelpButton() {
  const { dispatch } = useWorkbench()
  return (
    <IconButton id="btn-open-guide" label="帮助" tip="使用指南 (?)" onClick={() => dispatch({ type: 'SET_HELP_DIALOG_OPEN', payload: true })}>
      <CircleHelp aria-hidden="true" />
    </IconButton>
  )
}

export function Brand() {
  return (
    <a className="brand" href="./" aria-label="Smoji 首页">
      <Logo />
      <span className="brand__word">smoji</span>
    </a>
  )
}

export function Rail() {
  return (
    <aside id="sidebar" className="rail" aria-label="侧边栏工作区">
      <div className="rail__top">
        <Brand />
      </div>
      <div className="rail__scroll">
        <PackList />
      </div>
      <div className="rail__foot">
        <HelpButton />
        <ThemeButton />
      </div>
    </aside>
  )
}

interface MobileTopProps {
  onOpenDrawer: () => void
  drawerOpen: boolean
}

export function MobileTop({ onOpenDrawer, drawerOpen }: MobileTopProps) {
  const { state, dispatch } = useWorkbench()
  const stripRef = useRef<HTMLDivElement | null>(null)
  const activeIndex = state.catalog.activePackIndex

  // Keep the current pack chip in view without scrolling the page itself.
  useEffect(() => {
    const strip = stripRef.current
    const chip = strip?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!strip || !chip) return
    const left = chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2
    strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [activeIndex])

  return (
    <header className="mtop">
      <div className="mtop__row">
        <Brand />
        <div className="mtop__tools">
          <HelpButton />
          <ThemeButton />
        </div>
      </div>
      <nav className="strip" aria-label="分类导航">
        <button id="menu-toggle" type="button" className="strip__all" aria-expanded={drawerOpen} aria-controls="mobile-sidebar"
          aria-label="打开侧边栏菜单" onClick={onOpenDrawer}>
          <span>分类</span><ChevronDown aria-hidden="true" />
        </button>
        <div className="strip__scroll" ref={stripRef}>
          {state.catalog.packs.map((pack, index) => {
            const active = index === state.catalog.activePackIndex
            const included = state.mode === 'packs' && state.packSelection.selectedPackIds.has(pack.id)
            return (
              <button key={pack.id} type="button" className="strip__chip" data-active={active || undefined}
                data-included={included || undefined} aria-current={active ? 'true' : undefined}
                onClick={() => {
                  dispatch({ type: 'SET_ACTIVE_PACK', payload: index })
                  if (state.mode === 'custom') dispatch({ type: 'SET_GALLERY_VIEW', payload: 'source' })
                }}>
                {pack.items[0] && <Sticker src={pack.items[0].src} alt="" className="strip__cover" />}
                <span>{pack.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </header>
  )
}
