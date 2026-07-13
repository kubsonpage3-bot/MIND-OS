import {
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

export function useTaskDndSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      // Require mouse to move 5px before drag starts
      // Prevents accidental drags on click
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      // CRITICAL for mobile — must hold 200ms before drag
      // This prevents conflict with scroll and tap
      activationConstraint: {
        delay: 200,        // ms hold before drag activates
        tolerance: 8,      // px movement allowed during delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
}
