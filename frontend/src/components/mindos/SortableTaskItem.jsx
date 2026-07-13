import { createContext, useContext } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

const DragContext = createContext(null)

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
    transition: transition || undefined,
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
      <DragContext.Provider value={{ attributes, listeners }}>
        {/* The child component (the task card) will now include the DragHandle inside itself */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </DragContext.Provider>
    </div>
  )
}

export function DragHandle() {
  const context = useContext(DragContext)
  if (!context) return null
  const { attributes, listeners } = context

  return (
    <div
      {...attributes}
      {...listeners}
      className="
        cursor-grab active:cursor-grabbing
        touch-none select-none
        flex items-center justify-center
        h-full w-8
        opacity-30 hover:opacity-100 hover:bg-[var(--habit-dim)]/10
        transition-all duration-200
        border-r border-[var(--habit-border)]
        shrink-0
      "
      aria-label="Drag to reorder"
    >
      <GripVertical size={16} className="text-[var(--habit-text)]" />
    </div>
  )
}
