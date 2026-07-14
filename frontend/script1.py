import re

with open("src/pages/Dashboard.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Import modalStack
if "import { modalStack }" not in content:
    content = content.replace(
        "import { isMobileApp }",
        'import { modalStack } from "@/utils/modalStack";\nimport { isMobileApp }',
    )

# 2. Add containerWidth state
if "const [containerWidth" not in content:
    hook_str = """
  const [containerWidth, setContainerWidth] = useState(0);
  const activeTabIndex = getSectionIndex(activeSection);
  const activeIndexRef = useRef(activeTabIndex);
  activeIndexRef.current = activeTabIndex;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (containerWidth > 0) {
      animate(dragX, -(activeTabIndex * containerWidth), {
        type: 'spring', stiffness: 380, damping: 36, mass: 0.8
      });
    }
  }, [activeTabIndex, containerWidth]);
"""
    # Insert after useMotionValue(0);
    content = content.replace(
        "const dragX = useMotionValue(0);",
        "const dragX = useMotionValue(0);\n" + hook_str,
    )

# 3. Modify handleStart, handleMove, handleEnd
# We need to replace the entire pointer event logic block
pointer_start = content.find("    let touchStart = null;")
pointer_end = content.find("    }, [onSectionChange]);") + 26

new_pointer_logic = """
    let touchStart = null;
    let isHorizontal = null;
    let velocityX = 0;
    let lastMoveTime = 0;
    let lastMoveX = 0;

    const handleStart = (e) => {
      if (document.body.classList.contains('dnd-dragging') || modalStack.length > 0) return;
      if (e.target.closest('.overflow-x-auto, .overflow-x-scroll, .touch-none, [data-no-swipe], nav')) return;
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
      isHorizontal = null;
      velocityX = 0;
      lastMoveTime = Date.now();
      lastMoveX = touch.clientX;
      dragX.stop(); // Stop snap animation mid-swipe
    };

    const handleMove = (e) => {
      if (!touchStart || document.body.classList.contains('dnd-dragging') || modalStack.length > 0) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;

      if (isHorizontal === null) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          if (Math.abs(dy) > Math.abs(dx) * 0.9) {
            touchStart = null; // Yield to vertical scroll
            return;
          }
          isHorizontal = true;
        }
        return;
      }

      if (isHorizontal === true) {
        if (e.cancelable) e.preventDefault();

        const now = Date.now();
        const dt = now - lastMoveTime;
        if (dt > 0 && dt < 100) {
          const instantV = (touch.clientX - lastMoveX) / dt * 1000;
          velocityX = velocityX * 0.6 + instantV * 0.4;
        }
        lastMoveTime = now;
        lastMoveX = touch.clientX;

        const cw = containerRef.current?.getBoundingClientRect().width || window.innerWidth;
        const currentIdx = activeIndexRef.current;
        const baseOffset = -(currentIdx * cw);
        let targetX = baseOffset + dx;

        // Rubber-band resistance at edges
        if (targetX > 0) {
          targetX = targetX * 0.3;
        } else if (targetX < -(BOTTOM_TABS.length - 1) * cw) {
          const over = targetX - (-(BOTTOM_TABS.length - 1) * cw);
          targetX = -(BOTTOM_TABS.length - 1) * cw + (over * 0.3);
        }

        dragX.set(targetX);
      }
    };

    const handleEnd = () => {
      if (!touchStart) return;
      touchStart = null;

      if (isHorizontal !== true) return;
      isHorizontal = null;

      const cw = containerRef.current?.getBoundingClientRect().width || window.innerWidth;
      const currentIdx = activeIndexRef.current;
      const baseOffset = -(currentIdx * cw);
      const distValue = dragX.get() - baseOffset; // dx relative to start
      const vel = velocityX;

      const DIST_THRESHOLD = cw * 0.25; // 25% of screen width to swipe
      const VEL_THRESHOLD  = 450; 

      const wantsForward = distValue < -DIST_THRESHOLD || vel < -VEL_THRESHOLD;
      const wantsBack    = distValue >  DIST_THRESHOLD || vel >  VEL_THRESHOLD;

      if (wantsForward && currentIdx < BOTTOM_TABS.length - 1) {
        const nextTab = BOTTOM_TABS[currentIdx + 1];
        hapticLight();
        onSectionChange(nextTab === 'tools' ? 'history' : nextTab);
      } else if (wantsBack && currentIdx > 0) {
        const prevTab = BOTTOM_TABS[currentIdx - 1];
        hapticLight();
        onSectionChange(prevTab === 'tools' ? 'history' : prevTab);
      } else {
        animate(dragX, baseOffset, {
          type: 'spring',
          stiffness: 350,
          damping: 30,
          mass: 0.8,
        });
      }
    };

    document.addEventListener('touchstart', handleStart, { passive: true });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd, { passive: true });
    document.addEventListener('touchcancel', handleEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleStart);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [onSectionChange]);
"""
content = content[:pointer_start] + new_pointer_logic + content[pointer_end:]

# 4. Remove useEffect(() => { dragX.set(0); }, [activeTabKey]); since we now rely on containerWidth effect
content = re.sub(
    r"// Reset drag offset whenever the active tab key changes \(AnimatePresence swap\)\s*useEffect\(\(\) => \{\s*dragX\.set\(0\);\s*\}, \[activeTabKey\]\);",
    "",
    content,
)


with open("src/pages/Dashboard_new.jsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Part 1 complete.")
