import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * 刘看山 4 视图素材的统一引用（PRD §7.3.1）。
 *
 * 设计原则：
 *  - 只展示 1 个视角；通过 CSS background-position 在同一张大图上裁剪。
 *  - 调用方通过 `view` 决定使用哪个视角；不同场景对应不同视角。
 *  - loading 状态（generating / queued / welcome）时循环切换 4 个视角，模拟原地转身。
 */

export type LiukanshanView = 'front' | 'side' | 'turn' | 'back';

export type LiukanshanScene =
  | 'welcome'
  | 'background_ready'
  | 'key_nodes_ready'
  | 'generating'
  | 'queued'
  | 'failed';

const SCENE_TO_VIEW: Record<LiukanshanScene, LiukanshanView> = {
  welcome: 'front',
  background_ready: 'front',
  key_nodes_ready: 'front',
  generating: 'side',
  queued: 'turn',
  failed: 'back',
};

const VIEW_INDEX: Record<LiukanshanView, number> = {
  front: 0,
  side: 1,
  turn: 2,
  back: 3,
};

interface LiukanshanMascotProps {
  scene?: LiukanshanScene;
  view?: LiukanshanView;
  size?: number;
  className?: string;
  caption?: string;
}

export default function LiukanshanMascot({
  scene,
  view,
  size = 64,
  className,
  caption,
}: LiukanshanMascotProps) {
  const finalView = view ?? (scene ? SCENE_TO_VIEW[scene] : 'front');
  const idx = VIEW_INDEX[finalView];
  const isLoading = scene === 'generating' || scene === 'queued' || scene === 'welcome';

  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setFrame(0);
      return;
    }
    const id = setInterval(() => {
      setFrame((prev) => (prev + 1) % 3);
    }, 180);
    return () => clearInterval(id);
  }, [isLoading]);

  const FRAME_OFFSETS = [0, -52, -108];
  const displayOffset = isLoading ? FRAME_OFFSETS[frame] : FRAME_OFFSETS[idx] ?? 0;

  const figureStyle = useMemo(() => {
    return {
      width: size,
      height: size,
      backgroundImage: 'url(/liukanshan.png)',
      backgroundSize: `${size * 4}px ${size}px`,
      backgroundPosition: `${displayOffset}px 0`,
      backgroundRepeat: 'no-repeat',
    };
  }, [displayOffset, size]);

  return (
    <motion.div
      className={`liukanshan ${className ?? ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      title={caption}
    >
      <motion.div
        className="liukanshan-figure"
        style={figureStyle}
        transition={
          isLoading
            ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.3 }
        }
      />
      {caption && <div className="liukanshan-caption">{caption}</div>}
    </motion.div>
  );
}
