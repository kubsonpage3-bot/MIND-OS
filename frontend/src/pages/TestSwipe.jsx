import { useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import { IonItemSliding, IonItemOptions, IonItemOption, IonItem, IonLabel, setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/structure.css';
import { SwipeableList, SwipeableListItem, SwipeAction, TrailingActions } from 'react-swipeable-list';
import 'react-swipeable-list/dist/styles.css';

// Initialize Ionic
setupIonicReact({ mode: 'ios' });

// --- Mock Data ---
const MOCK_TASKS = [
  { id: 1, title: 'Drink Water', category: 'Health' },
  { id: 2, title: 'Read 10 Pages', category: 'Mind' },
  { id: 3, title: 'Exercise (30 mins)', category: 'Health' },
  { id: 4, title: 'Clear Inbox', category: 'Work' },
  { id: 5, title: 'Meditate', category: 'Mind' },
];

// --- Impl 1: Custom Pointer-based (Framer Motion) ---
function CustomSwipeItem({ task }) {
  const dragX = useMotionValue(0);
  const containerRef = useRef(null);

  const handleDragEnd = (e, info) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    
    if (offset < -50 || velocity < -500) {
      // Swiped far enough left -> Action
      animate(dragX, -100, { type: 'spring', stiffness: 400, damping: 25 });
    } else {
      // Snap back
      animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 25 });
    }
  };

  return (
    <div className="relative w-full h-16 mb-2 bg-red-500 rounded-xl overflow-hidden" ref={containerRef}>
      <div className="absolute right-0 top-0 bottom-0 w-24 flex items-center justify-center text-white font-bold">
        Complete
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        style={{ x: dragX }}
        onDragEnd={handleDragEnd}
        className="absolute inset-0 bg-[#1e1e24] border border-white/10 rounded-xl flex items-center px-4 z-10"
      >
        <span className="text-white font-bold">{task.title}</span>
      </motion.div>
    </div>
  );
}

// --- Impl 2: Ionic React ---
function IonicSwipeItem({ task }) {
  return (
    <div className="mb-2 rounded-xl overflow-hidden" style={{ '--ion-background-color': '#1e1e24', '--ion-item-background': '#1e1e24', '--ion-text-color': 'white' }}>
      <IonItemSliding>
        <IonItem lines="none" style={{ '--border-radius': '12px' }}>
          <IonLabel className="font-bold">{task.title}</IonLabel>
        </IonItem>
        <IonItemOptions side="end">
          <IonItemOption color="success" onClick={() => console.log('Done')}>Complete</IonItemOption>
        </IonItemOptions>
      </IonItemSliding>
    </div>
  );
}

// --- Impl 3: React Swipeable List ---
function SwipeableListItemWrapper({ task }) {
  const trailingActions = () => (
    <TrailingActions>
      <SwipeAction
        destructive={true}
        onClick={() => console.log('Complete')}
      >
        <div className="bg-green-500 h-full w-full flex items-center justify-center px-4 font-bold text-white rounded-r-xl">
          Complete
        </div>
      </SwipeAction>
    </TrailingActions>
  );

  return (
    <div className="mb-2 rounded-xl overflow-hidden bg-[#1e1e24] border border-white/10">
      <SwipeableListItem trailingActions={trailingActions()}>
        <div className="h-16 flex items-center px-4 w-full">
          <span className="text-white font-bold">{task.title}</span>
        </div>
      </SwipeableListItem>
    </div>
  );
}

export default function TestSwipe() {
  return (
    <div className="min-h-screen bg-black text-white p-4 pb-4 overflow-y-auto">
      <h1 className="text-xl font-bold mb-6 text-center">Swipe Implementations Test</h1>
      
      <section className="mb-8">
        <h2 className="text-amber-400 font-bold mb-4 uppercase text-sm">1. Custom (Framer Motion)</h2>
        {MOCK_TASKS.map(t => <CustomSwipeItem key={t.id} task={t} />)}
      </section>

      <section className="mb-8">
        <h2 className="text-amber-400 font-bold mb-4 uppercase text-sm">2. Ionic (@ionic/react)</h2>
        {/* Note: Ionic components require some base CSS which we injected minimally */}
        {MOCK_TASKS.map(t => <IonicSwipeItem key={t.id} task={t} />)}
      </section>

      <section className="mb-8">
        <h2 className="text-amber-400 font-bold mb-4 uppercase text-sm">3. React Swipeable List</h2>
        <SwipeableList>
          {MOCK_TASKS.map(t => <SwipeableListItemWrapper key={t.id} task={t} />)}
        </SwipeableList>
      </section>
    </div>
  );
}
