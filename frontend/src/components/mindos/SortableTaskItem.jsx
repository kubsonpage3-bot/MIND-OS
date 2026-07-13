import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function SortableTaskItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(id) })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    // Dragged item appears above others
    zIndex: isDragging ? 999 : undefined,
    // Subtle opacity while dragging
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex w-full
        ${isDragging
          ? 'shadow-[0_8px_32px_rgba(168,85,247,0.4)] scale-[1.02] z-50'
          : ''
        }
      `}
    >
      {/* Drag handle — only this area initiates drag */}
      <div
        {...attributes}
        {...listeners}
        className="
          cursor-grab active:cursor-grabbing
          touch-none select-none
          flex items-center justify-center
          w-8 h-full px-1
          opacity-40 hover:opacity-100
          transition-opacity duration-200
        "
        aria-label="Drag to reorder"
      >
        ⠿
      </div>
      {/* Task content — receives NO drag listeners */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
