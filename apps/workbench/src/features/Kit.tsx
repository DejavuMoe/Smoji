import { X } from 'lucide-react'
import { useWorkbench } from '../app/WorkbenchContext'
import { Segmented } from '../ui/primitives'
import { Sticker } from '../ui/Sticker'
import { CustomGroups } from './Groups'
import { ExportBar } from './ExportBar'

interface KitProps {
  /** Close a containing sheet after navigating to a pack or group view. */
  onNavigate?: () => void
  showModeSwitch?: boolean
}

export function Kit({ onNavigate, showModeSwitch = true }: KitProps) {
  const { state } = useWorkbench()
  return (
    <section className="kit" aria-label="导出">
      {showModeSwitch && (
        <div className="kit__head">
          <ModeSwitch />
        </div>
      )}
      <div className="kit__body">
        {state.mode === 'packs' ? <SelectedPacks onNavigate={onNavigate} /> : <CustomGroups onViewGroup={onNavigate} />}
      </div>
      <ExportBar />
    </section>
  )
}

export function ModeSwitch({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { state, dispatch } = useWorkbench()
  return (
    <Segmented id="mode-tabs" size={size} label="工作模式" className="mode-switch" value={state.mode}
      onChange={(value) => dispatch({ type: 'SET_MODE', payload: value })}
      options={[
        { value: 'packs', label: '按分类导出', id: 'tab-packs' },
        { value: 'custom', label: '自选分组', id: 'tab-custom' },
      ]} />
  )
}

function SelectedPacks({ onNavigate }: { onNavigate?: () => void }) {
  const { state, dispatch } = useWorkbench()
  const excluded = state.packSelection.excludedItemSrcs
  const selected = state.catalog.packs
    .map((pack, index) => ({ pack, index }))
    .filter(({ pack }) => state.packSelection.selectedPackIds.has(pack.id))

  return (
    <div className="picked-packs" data-fly-target="packs">
      <div className="groups__bar">
        <h3 className="eyebrow">已选分类 <span className="eyebrow__n">{selected.length}</span></h3>
      </div>
      {selected.length === 0 ? (
        <div className="kit-empty">
          <p className="kit-empty__title">尚未选择分类</p>
          <p className="kit-empty__text">勾选分类，或在图库中点击「选择本分类导出」。</p>
        </div>
      ) : (
        <ul className="picked-packs__list">
          {selected.map(({ pack, index }) => {
            const kept = pack.items.filter((item) => !excluded.has(item.src)).length
            return (
              <li key={pack.id} className="sel" data-active={index === state.catalog.activePackIndex || undefined}>
                <button type="button" className="sel__main" onClick={() => { dispatch({ type: 'SET_ACTIVE_PACK', payload: index }); onNavigate?.() }}>
                  <span className="sel__cover">{pack.items[0] && <Sticker src={pack.items[0].src} alt="" />}</span>
                  <span className="sel__name">{pack.label}</span>
                  <span className="sel__n" data-partial={kept < pack.items.length || undefined}>
                    {kept < pack.items.length ? <>{kept}<span>/{pack.items.length}</span></> : pack.items.length}
                  </span>
                </button>
                <button type="button" className="icon-btn icon-btn--sm sel__x" aria-label={`取消选择 ${pack.label}`}
                  onClick={() => dispatch({ type: 'TOGGLE_PACK_SELECTION', payload: pack.id })}>
                  <X aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
