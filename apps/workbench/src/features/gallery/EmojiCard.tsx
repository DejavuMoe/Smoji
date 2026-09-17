import { Button } from '../../components/ui/button'
import { memo } from 'react'
import type { SmojiItem } from '../../../../../packages/smoji/src/types'
import { thumbnailSrc } from '../../images'
import { EmojiImage } from './EmojiImage'

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
  const thumbUrl = thumbnailSrc(item.src)

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/smoji-src', item.src)
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  const actionLabel = isCustomMode
    ? isPicked
      ? `移出 ${item.label}`
      : `加入 ${item.label}`
    : isExcluded
      ? `恢复 ${item.label}`
      : `排除 ${item.label}`

  return (
    <div
      data-card-index={String(index)}
      className={`card group relative flex flex-col items-center justify-center rounded-xl border bg-surface p-2 transition-all select-none aspect-square w-full ${
        isExcluded
          ? 'is-excluded opacity-35 grayscale border-dashed border-border'
          : 'border-border/60 hover:border-primary/40 hover:shadow-xs'
      }`}
      draggable
      onDragStart={handleDragStart}
    >
      {/* Picked badge (✓ in custom mode) */}
      {isCustomMode && isPicked && (
        <span
          className="card__badge pointer-events-none absolute top-1.5 left-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-xs"
          data-badge-item-index={String(index)}
        >
          ✓
        </span>
      )}

      {/* The whole card is one real button: a single roving tab stop that opens the preview. */}
      <button
        type="button"
        data-roving-item="true"
        data-card-open-index={String(index)}
        tabIndex={index === 0 ? 0 : -1}
        className="card__open absolute inset-0 z-0 rounded-xl "
        aria-label={`${item.label}，打开预览并复制`}
        onClick={() => onCardClick(item)}
      />

      {/* Reveal quick actions on hover/keyboard focus; tapping the image opens the same actions in the preview. */}
      <Button variant="ghost" size="icon"
        type="button"
        className="card__check-hover card__action-btn p-0 absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-surface text-foreground pointer-events-none opacity-0 transition-opacity hover:border-primary hover:text-primary group-hover:pointer-events-auto group-hover:opacity-100 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100"
        data-check-item-index={String(index)}
        tabIndex={-1}
        tooltip={
          isCustomMode
            ? isPicked
              ? '从自选分组中移出'
              : '加入当前自选分组'
            : isExcluded
              ? '恢复到导出'
              : '从导出中排除'
        }
        aria-label={actionLabel}
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
      </Button>

      {/* Emoji image preview */}
      <EmojiImage
        src={thumbUrl}
        alt={item.label || item.id}
        className={`pointer-events-none relative z-[1] w-full overflow-hidden ${
          isComfortable ? 'flex-1 min-h-0' : 'h-full'
        }`}
        imgClassName="max-h-full max-w-full object-contain"
      />

      {/* Label for comfortable density */}
      {isComfortable && (
        <span className="pointer-events-none relative z-[1] mt-1 w-full shrink-0 truncate px-0.5 text-center text-[10px] leading-tight text-muted-foreground">
          {item.label || item.id}
        </span>
      )}
    </div>
  )
})
