import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Dices, Sparkles } from 'lucide-react';
import { getStoryList } from '../services/zhihuApi';
import type { StorySummary } from '../types/story';

interface ListPageProps {
  onOpen: (workId: string) => void;
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function ListPage({ onOpen }: ListPageProps) {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    getStoryList()
      .then(setStories)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : '故事列表加载失败'),
      )
      .finally(() => setLoading(false));
  }, []);



  const heroFloating = useMemo(() => stories.slice(0, 3), [stories]);
  const heroStats = useMemo(
    () => ({
      stories: stories.length,
      nodes: stories.length * 5,
    }),
    [stories.length],
  );

  function handleRandom() {
    const target = pickRandom(stories);
    if (target) onOpen(target.work_id);
  }

  return (
    <motion.section
      className="list-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.8, 0.32, 1] }}
    >
      <header className="list-hero">
        <div className="hero-inner">
          <motion.div
            className="hero-text"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <span className="eyebrow">
              <Sparkles size={13} /> 知乎盐言 · AI 互动阅读
            </span>
            <h1>
              选择剧情，
              <br />
              <span className="accent">生成属于你的故事走向</span>
            </h1>
            <p className="subtitle">
              在 AI 的笔下，让每一次阅读都成为一次独一无二的创作旅程。
              数据 24 小时本地缓存，告别等待与重复调用。
            </p>
            <div className="stat-row">
              <span className="stat">
                <span className="num">{heroStats.stories || '—'}</span>篇精选
              </span>
              <span className="divider" />
              <span className="stat">
                <span className="num">{heroStats.nodes || '—'}+</span>关键节点
              </span>
              <span className="divider" />
              <span className="stat">
                <span className="num">∞</span>种走向
              </span>
            </div>
          </motion.div>

          <div className="floating-cards">
            <span className="glow g1" />
            <span className="glow g2" />
            {heroFloating.map((story, idx) => (
              <motion.div
                key={story.work_id}
                className={`float-card c${idx + 1}`}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + idx * 0.12, duration: 0.55 }}
                onClick={() => onOpen(story.work_id)}
                style={{ cursor: 'pointer' }}
              >
                <div
                  className="preview"
                  style={{
                    backgroundImage: `url(${story.artwork || story.tab_artwork})`,
                  }}
                />
                <div className="body">
                  <span className="title">{story.title}</span>
                  <span className="meta">{story.labels.slice(0, 2).join(' · ')}</span>
                  <span className="pill">
                    <Sparkles size={10} /> AI 互动
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </header>

      <motion.div
        className="list-toolbar"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
      >
        <span className="count">{stories.length} 篇</span>
        <button className="random-btn" onClick={handleRandom}>
          <Dices size={14} /> 随机一本
        </button>
      </motion.div>

      <div className="list-content">
        {loading && <div className="state-card">故事列表加载中…</div>}
        {error && <div className="state-card error">{error}</div>}
        {!loading && !error && stories.length === 0 && (
          <div className="state-card">暂无故事</div>
        )}

        <motion.div
          className="story-grid"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: {} }}
          transition={{ staggerChildren: 0.05 }}
        >
          <AnimatePresence>
            {stories.map((story) => (
                <motion.article
                  key={story.work_id}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: { opacity: 1, y: 0 },
                  }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: [0.22, 0.8, 0.32, 1] }}
                  className="story-card"
                  onClick={() => onOpen(story.work_id)}
                >
                  <div className="cover-wrap">
                    <img
                      src={story.artwork || story.tab_artwork}
                      alt={story.title}
                      loading="lazy"
                    />
                    <span className="floating-cta">
                      阅读 <ArrowRight size={11} />
                    </span>
                  </div>
                  <div className="card-body">
                    <h2>{story.title}</h2>
                    <p className="desc">{story.description}</p>
                    <div className="tag-row">
                      {story.labels.slice(0, 3).map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              ))}
          </AnimatePresence>
        </motion.div>
      </div>

    </motion.section>
  );
}
