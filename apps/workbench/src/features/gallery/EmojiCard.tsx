import { memo, useState } from 'react'
import type { SmojiItem } from '../../../../../packages/smoji/src/types'
import { thumbnailSrc } from '../../images'

interface EmojiCardProps {
  item: SmojiItem
  index: number
  isCustomMode: boolean
  isPicked: boolean
  isExcluded: boolean
  isComfortable: boolean
  onCardClick: (item: SmojiItem) => void
  onActionClick: (e: React.MouseEvent, item: SmojiItem) => void
}

export const EmojiCard = memo(function EmojiCard({
  item,
  index,
  isCustomMode,
  isPicked,
  isExcluded,
  isComfortable,
  onCardClick,
  onActionClick,
}: EmojiCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const thumbUrl = thumbnailSrc(item.src)

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/smoji-src', item.src)
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  return (
    <div
      role="group"
      aria-label={`${item.label}，打开预览并复制`}
      data-roving-item="true"
      tabIndex={index === 0 ? 0 : -1}
      className={`card group relative flex flex-col items-center justify-center rounded-xl border bg-surface p-2 transition-all outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring select-none ${
        isComfortable ? 'h-24 sm:h-28' : 'h-20 sm:h-24'
      } ${
        isExcluded
          ? 'is-excluded opacity-35 grayscale border-dashed border-border'
          : 'border-border/60 hover:border-primary/40 hover:shadow-xs'
      }`}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onCardClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCardClick(item)
        }
      }}
    >
      {/* Picked badge (✓ in custom mode) */}
      {isCustomMode && isPicked && (
        <span
          className="card__badge absolute top-1.5 left-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs"
          data-badge-item-index={String(index)}
        >
          ✓
        </span>
      )}

      {/* Hover action / checkbox trigger */}
      <button
        type="button"
        className="card__check-hover card__action-btn absolute top-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md border border-border/80 bg-surface/90 text-muted-foreground opacity-0 transition-opacity hover:border-primary hover:text-primary group-hover:opacity-100 focus:opacity-100 max-[900px]:opacity-100"
        data-check-item-index={String(index)}
        title={
          isCustomMode
            ? isPicked
              ? '从自选分组中移出'
              : '加入当前自选分组'
            : isExcluded
              ? '恢复到导出'
              : '从导出中排除'
        }
        aria-label={
          isCustomMode
            ? isPicked
              ? `移出 ${item.label}`
              : `加入 ${item.label}`
            : isExcluded
              ? `恢复 ${item.label}`
              : `排除 ${item.label}`
        }
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onActionClick(e, item)
        }}
      >
        {isCustomMode ? (
          <span className="text-xs">{isPicked ? '−' : '+'}</span>
        ) : (
          <span className="text-xs">{isExcluded ? '↩' : '✕'}</span>
        )}
      </button>

      {/* Emoji image preview */}
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
        <img
          src={thumbUrl}
          alt={item.label || item.id}
          loading="lazy"
          className={`max-h-full max-w-full object-contain pointer-events-none transition-opacity duration-150 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      {/* Label for comfortable density */}
      {isComfortable && (
        <span className="mt-1 w-full truncate text-center text-[10px] text-muted-foreground">
          {item.label}
        </span>
      )}
    </div>
  )
})
