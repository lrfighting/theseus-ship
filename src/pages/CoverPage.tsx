import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, GitBranch, Network, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { clearAllProjectData } from '../services/cache';

const mockList = [
  { thumb: 't1', title: '秦始皇登月计划', tags: '科幻 · 穿越', active: true },
  { thumb: 't2', title: '人脸解锁失败', tags: '悬疑 · 惊悚' },
  { thumb: 't3', title: '夹心饼干', tags: '现实 · 家庭' },
  { thumb: 't4', title: '逃离灵山', tags: '玄幻 · 西游' },
];

interface MockNode {
  id: string;
  label: string;
  variant: '' | 'root' | 'branch' | 'continuation';
  x: number;
  y: number;
  w: number;
}

const NODE_HEIGHT = 24;

const mockNodes: MockNode[] = [
  { id: 'root', label: '人脸解锁失败', variant: 'root', x: 8, y: 96, w: 92 },
  { id: 'k1', label: '关键节点 1', variant: '', x: 120, y: 36, w: 78 },
  { id: 'k2', label: '关键节点 2', variant: '', x: 120, y: 96, w: 78 },
  { id: 'k3', label: '关键节点 3', variant: '', x: 120, y: 156, w: 78 },
  { id: 'b1', label: '追问真相', variant: 'branch', x: 222, y: 36, w: 78 },
  { id: 'b2', label: '继续观察', variant: 'continuation', x: 222, y: 156, w: 78 },
];

const mockEdges: Array<[string, string]> = [
  ['root', 'k1'],
  ['root', 'k2'],
  ['root', 'k3'],
  ['k1', 'b1'],
  ['k3', 'b2'],
];

const variantStyles: Record<MockNode['variant'], { fill: string; stroke: string; text: string }> = {
  '': { fill: '#ffffff', stroke: '#dddfe3', text: '#4f5969' },
  root: { fill: '#0084ff', stroke: '#0066d6', text: '#ffffff' },
  branch: { fill: '#ffe9b0', stroke: '#fbe4b0', text: '#b27200' },
  continuation: { fill: '#ffd1de', stroke: '#ffb6c8', text: '#c1397f' },
};

interface CoverPageProps {
  onEnter: () => void;
}

const features = [
  {
    icon: <BookOpen size={22} />,
    title: '盐言精选 · 沉浸式阅读',
    desc: '接入知乎盐选开放接口，挑选你最想读的悬疑、脑洞与言情故事，一键开启沉浸式阅读。',
  },
  {
    icon: <Wand2 size={22} />,
    title: 'AI 重写命运',
    desc: '在剧情的关键节点，由 AI 为你生成多种可能的走向，也支持自定义你的剧情指令。',
  },
  {
    icon: <Network size={22} />,
    title: '可视化剧情脑图',
    desc: '可缩放、可点击的节点树，记录你每一次选择，让每一条分支都看得见、回得去。',
  },
];

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function CoverPage({ onEnter }: CoverPageProps) {
  return (
    <motion.section
      className="cover-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.22, 0.8, 0.32, 1] }}
    >
      <motion.span
        className="cover-badge"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <span className="pulse" />
        改写命运的节点，驶向未知的结局
      </motion.span>

      <motion.h1
        className="cover-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.6 }}
      >
        故事没有既定的结局，<br />
        <span className="gradient">每一次选择都是新的航向</span>
      </motion.h1>

      <motion.p
        className="cover-subtitle"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        在已有小说的关键节点进行分支改写，产生基于原有世界观的全新结局。
        简洁的界面、可视化的脑图、丰富的动效，让每一次阅读都是一次创作。
      </motion.p>

      <motion.div
        className="cover-cta-row"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="btn btn-primary"
          onClick={onEnter}
        >
          <Sparkles size={16} />
          登船启程
          <ArrowRight size={16} />
        </motion.button>
        <a className="btn btn-ghost" href="#features">
          了解更多
        </a>
      </motion.div>

      <motion.div
        id="features"
        className="cover-features"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.12, delayChildren: 0.6 }}
        variants={{
          hidden: {},
          show: {},
        }}
      >
        {features.map((feat) => (
          <motion.div
            key={feat.title}
            className="feature-card"
            variants={item}
            transition={{ duration: 0.5, ease: [0.22, 0.8, 0.32, 1] }}
          >
            <span className="icon-bubble">{feat.icon}</span>
            <h3>{feat.title}</h3>
            <p>{feat.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        className="cover-preview"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.7 }}
      >
        <div className="preview-bar">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
          <span className="addr">app.yan-story / 人脸解锁失败</span>
        </div>

        <div className="preview-grid">
          <div className="mock-pane">
            <div className="mock-title">
              <BookOpen size={12} /> 故事列表
            </div>
            {mockList.map((item) => (
              <div
                key={item.title}
                className={`mock-list-item ${item.active ? 'active' : ''}`}
              >
                <span className={`mock-thumb ${item.thumb}`} />
                <span className="meta">
                  <strong>{item.title}</strong>
                  <small>{item.tags}</small>
                </span>
              </div>
            ))}
          </div>

          <div className="mock-pane mock-reader">
            <div className="mock-title">
              <Sparkles size={12} /> 阅读器
            </div>
            <div className="mock-line title" />
            <div className="mock-line w-90" />
            <div className="mock-line w-86" />
            <div className="mock-line with-icon">
              <span className="seg" />
              <span className="node-pin">
                <GitBranch size={11} />
              </span>
              <span className="seg" />
            </div>
            <div className="mock-line w-72" />
            <div className="mock-line w-64" />
            <div className="mock-line w-90" />
            <div className="mock-line w-86" />
            <div className="mock-line w-72" />
            <div className="mock-line w-64" />
          </div>

          <div className="mock-pane mock-mindmap">
            <div className="mock-title">
              <Network size={12} /> 剧情脑图
            </div>
            <svg
              viewBox="0 0 308 200"
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: 'calc(100% - 22px)' }}
            >
              {mockEdges.map(([from, to]) => {
                const a = mockNodes.find((n) => n.id === from)!;
                const b = mockNodes.find((n) => n.id === to)!;
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={a.x + a.w}
                    y1={a.y + NODE_HEIGHT / 2}
                    x2={b.x}
                    y2={b.y + NODE_HEIGHT / 2}
                    stroke="#c5d1e2"
                    strokeWidth={1.4}
                  />
                );
              })}
              {mockNodes.map((node) => {
                const style = variantStyles[node.variant];
                return (
                  <g key={node.id}>
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.w}
                      height={NODE_HEIGHT}
                      rx={9}
                      ry={9}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={1}
                    />
                    <text
                      x={node.x + node.w / 2}
                      y={node.y + NODE_HEIGHT / 2 + 3.6}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight={600}
                      fill={style.text}
                      fontFamily="-apple-system, 'PingFang SC', sans-serif"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="preview-foot">
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <GitBranch size={14} />
            列表 · 阅读器 · 脑图，三栏一气呵成
          </span>
          <button
            className="clear-data-btn"
            onClick={() => {
              const removed = clearAllProjectData();
              if (removed.length) {
                alert(`已清除 ${removed.length} 条本地数据：\n${removed.join('\n')}`);
              } else {
                alert('没有本地缓存数据需要清除');
              }
            }}
            title="清除分支、会话等本地数据（开发调试用）"
          >
            <Trash2 size={12} />
            清除本地数据
          </button>
        </div>
      </motion.div>
    </motion.section>
  );
}
