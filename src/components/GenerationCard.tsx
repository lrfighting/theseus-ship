import { motion } from 'framer-motion';
import { Compass, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { GenerationPhase } from '../hooks/useBranchContinuation';

export interface GenerationCardProps {
  phase: GenerationPhase;
  direction: string;
  snippet: string;
  upstream: { ready: number; total: number };
  estimatedSeconds?: number;
  errorMessage?: string;
}

export default function GenerationCard({
  phase,
  direction,
  snippet,
  upstream,
  estimatedSeconds,
  errorMessage,
}: GenerationCardProps) {
  const isQueued = phase === 'queued';
  const isGenerating = phase === 'generating';
  const isSuccess = phase === 'success';
  const progress = phase === 'idle' ? 0
    : isQueued
      ? Math.min(0.4, upstream.total ? (upstream.ready / upstream.total) * 0.4 : 0.05)
      : isGenerating
        ? 0.5 + Math.min(0.45, snippet.length / 2000)
        : isSuccess
          ? 1
          : 0;

  const snippetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = snippetRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [snippet]);

  return (
    <section className="panel-card progress-card">
      <div className="panel-head" style={{ borderBottom: 0, padding: '4px 0 16px' }}>
        <h2>
          {isGenerating || isQueued ? (
            <Loader2 size={16} className="spin" style={{ animation: 'spin 1.2s linear infinite' }} />
          ) : (
            <Sparkles size={16} />
          )}
          {isQueued
            ? '正在准备世界观背景…'
            : isGenerating
              ? 'AI 正在续写中…'
              : isSuccess
                ? '生成完成'
                : phase === 'failed'
                  ? '生成失败'
                  : '生成进度'}
        </h2>
        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
          {Math.round(progress * 100)}%
        </span>
      </div>

      {isQueued && (
        <div className="cur-snippet muted">
          已就绪 {upstream.ready}/{upstream.total} 项背景任务，就绪后立即开始你的分支生成。
        </div>
      )}

      {!isQueued && (
        <div className="cur-snippet" ref={snippetRef}>
          {phase === 'failed'
            ? errorMessage || '生成失败，请重试'
            : snippet || '点击段落上的圆形节点，挑选一条分支后这里会显示 AI 当前的生成片段。'}
        </div>
      )}

      <div className="direction-row">
        <Compass size={14} />
        <span className="dir-label">生成方向：</span>
        <span className="dir-pill">{direction || '尚未选择'}</span>
      </div>

      <div className="progress-bar" role="progressbar" aria-valuenow={progress * 100}>
        <motion.div
          className="fill"
          initial={false}
          animate={{ width: `${Math.min(progress, 1) * 100}%` }}
          transition={{ duration: 0.6, ease: [0.22, 0.8, 0.32, 1] }}
        />
      </div>
      <div className="progress-meta">
        <span>
          状态：
          {phase === 'idle' && '空闲'}
          {phase === 'queued' && '排队中'}
          {phase === 'generating' && '生成中'}
          {phase === 'success' && '已完成'}
          {phase === 'failed' && '已失败'}
        </span>
        <span>
          预计 {isGenerating ? Math.max(1, estimatedSeconds ?? 6) : 0} 秒
        </span>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}
