/**
 * V1.3 详情页：链路驱动的"分支替换"模型。
 *
 * 阅读区渲染规则：
 *  1. 默认渲染整篇原文。
 *  2. 当存在当前链路时，找到第一个节点分支的 source_node_id：
 *     - 原文渲染到该节点所在段落（含该段）为止
 *     - 该段之后的所有原文段落折叠成提示条
 *     - 在提示条之后顺序渲染当前链路上的 AI 续写段落
 *  3. AI 续写段落与原文使用相同正文样式，但有左侧色条 + 来源提示。
 *  4. 在原文 / AI 续写中的关键节点上展示"+ 分支"按钮。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  BookmarkPlus,
  BookOpen,
  ChevronDown,
  Expand,
  GitBranch,
  Globe2,
  Loader2,
  Network,
  Package,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';
import { getStoryDetail } from '../services/zhihuApi';
import { useStoryBackground } from '../hooks/useStoryBackground';
import { useBranchContinuation } from '../hooks/useBranchContinuation';
import { buildEscapeLingshanPresetKeyNodes } from '../data/escapeLingshanPresetKeyNodes';
import {
  appendBranchToCurrentLineage,
  createLineageFromBranch,
  findLineageContaining,
  getCurrentLineageBranches,
  getCurrentLineageTruncation,
  loadSession,
  removeLastBranchFromLineage,
  replaceOriginalKeyNodes,
  saveSession,
  sessionLimits,
  setCurrentBranch,
  setCurrentLineage,
  upsertImpact,
  upsertKeyNode,
} from '../state/storySession';
import { getParagraphs } from '../services/storyAi';
import { buildFullPrecedingNarrative } from '../utils/narrativeContext';
import type {
  Branch,
  BranchImpact,
  KeyNode,
  StoryDetail,
  StorySession,
} from '@shared/types/story';
import type {
  BranchContinuationInput,
  BranchContinuationResult,
} from '@shared/types/ai';
import StoryMindMap from '../components/StoryMindMap';
import BranchPopover from '../components/BranchPopover';
import GenerationCard from '../components/GenerationCard';
import LiukanshanMascot from '../components/LiukanshanMascot';
import StoryArchiveDrawer from '../components/StoryArchiveDrawer';

const MAX_DEPTH = 5;

interface DetailPageProps {
  workId: string;
  onBack: () => void;
}

function newBranchId() {
  return `branch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function DetailPage({ workId, onBack }: DetailPageProps) {
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState<StorySession | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // 底部自定义续写指令输入
  const [customInstruction, setCustomInstruction] = useState('');

  const background = useStoryBackground(story);
  const presetKeyNodes = useMemo(
    () => (story ? buildEscapeLingshanPresetKeyNodes(story) : null),
    [story?.work_id, story?.content_hash, story?.chapter_name, story?.content],
  );
  const branchGen = useBranchContinuation();

  const paragraphRefs = useRef<Map<number, HTMLElement | null>>(new Map());
  const [focusParagraph, setFocusParagraph] = useState<number | null>(null);

  // ── 加载详情 ───────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError('');
    setSession(null);
    getStoryDetail(workId)
      .then((detail) => {
        setStory(detail);
        const s = loadSession(detail.work_id, detail.content_hash);
        setSession(s);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : '故事详情加载失败'),
      )
      .finally(() => setLoading(false));
  }, [workId]);

  // ── 把后台拉来的原文关键节点写入 session（用于切换与渲染） ───
  useEffect(() => {
    if (!session || !background.keyNodes) return;
    if (presetKeyNodes && presetKeyNodes.length > 0) return;
    setSession((prev) => {
      if (!prev) return prev;
      let next = prev;
      for (const node of background.keyNodes ?? []) {
        next = upsertKeyNode(next, node);
      }
      return next;
    });
  }, [background.keyNodes, presetKeyNodes, session?.session_id]);

  // ── 《逃离灵山》预设节点写入 session（替换原文节点，保留续写节点） ───
  useEffect(() => {
    if (!session || !presetKeyNodes?.length) return;
    setSession((prev) => {
      if (!prev) return prev;
      return replaceOriginalKeyNodes(prev, presetKeyNodes);
    });
  }, [presetKeyNodes, session?.session_id]);

  // ── session 持久化 ─────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    saveSession(session);
  }, [session]);

  // ── 焦点段落动画过期 ───────────────────────────────────────
  useEffect(() => {
    if (focusParagraph === null) return;
    const id = window.setTimeout(() => setFocusParagraph(null), 1800);
    return () => window.clearTimeout(id);
  }, [focusParagraph]);

  // ── 计算正文渲染所需信息 ────────────────────────────────────
  const paragraphs = useMemo(() => getParagraphs(story?.content ?? ''), [story]);

  const allKeyNodes: KeyNode[] = useMemo(() => {
    if (presetKeyNodes && presetKeyNodes.length > 0) {
      if (!session) return presetKeyNodes;
      const extras = Object.values(session.key_nodes).filter((n) => n.source === 'ai_continuation');
      return [...presetKeyNodes, ...extras];
    }
    if (!session) return background.keyNodes ?? [];
    const fromSession = Object.values(session.key_nodes);
    if (fromSession.length === 0) return background.keyNodes ?? [];
    return fromSession;
  }, [session, background.keyNodes, presetKeyNodes]);

  const originalNodes = useMemo(
    () => allKeyNodes.filter((n) => n.source === 'original'),
    [allKeyNodes],
  );

  const currentLineageBranches = useMemo<Branch[]>(
    () => (session ? getCurrentLineageBranches(session) : []),
    [session],
  );

  /** 阅读区与续写逻辑忽略历史会话中的番外分支 */
  const readerBranches = useMemo(
    () => currentLineageBranches.filter((b) => b.branch_type !== 'extra'),
    [currentLineageBranches],
  );

  const currentLineageBranchIds = useMemo(
    () => new Set(currentLineageBranches.map((b) => b.branch_id)),
    [currentLineageBranches],
  );

  const truncation = useMemo(
    () => (session ? getCurrentLineageTruncation(session) : null),
    [session],
  );

  const visibleParagraphs = useMemo(() => {
    if (!truncation) return paragraphs;
    return paragraphs.slice(0, truncation.paragraphIndex + 1);
  }, [paragraphs, truncation]);

  const hiddenParagraphCount = paragraphs.length - visibleParagraphs.length;

  const currentImpacts: BranchImpact[] = useMemo(() => {
    if (!session) return [];
    // 统计所有分支的影响（不限于当前链路），与脑图保持一致
    return Object.values(session.branch_impacts).filter((x): x is BranchImpact => Boolean(x));
  }, [session]);

  const activeNode = useMemo(
    () => (activeNodeId ? allKeyNodes.find((n) => n.node_id === activeNodeId) ?? null : null),
    [activeNodeId, allKeyNodes],
  );

  // ── 把当前 generating 的实时文本注入 UI 显示 ─────────────────
  const generatingBranch = readerBranches.find((b) => b.status === 'generating');
  const liveBranchText =
    branchGen.state.phase === 'generating' || branchGen.state.phase === 'queued'
      ? branchGen.state.text
      : null;

  // ── 选择 / 自定义触发分支续写 ───────────────────────────────
  const startNodeBranch = useCallback(
    (params: {
      sourceNodeId: string;
      choiceText: string;
      choiceType: 'preset' | 'custom';
      option?: KeyNode['branch_options'][number];
      branchType?: 'node_branch' | 'continuation';
    }) => {
      if (!story || !session) return;
      const sourceNode = allKeyNodes.find((n) => n.node_id === params.sourceNodeId);
      if (!sourceNode) {
        alert('未找到对应的关键节点，请等待故事档案加载完成后再试。');
        return;
      }

      const branchType = params.branchType ?? 'node_branch';

      const parentBranchId = sourceNode.parent_branch_id ?? null;
      const depth = sourceNode.depth + 1;

      if (depth > MAX_DEPTH) {
        alert(`已达到最大分支深度（${MAX_DEPTH} 层），请回到主线或其他分支继续探索。`);
        return;
      }

      const parentLineageBranchIds: string[] = (() => {
        if (!parentBranchId) return [];
        const parentLineage = findLineageContaining(session, parentBranchId);
        if (!parentLineage) return [parentBranchId];
        const idx = parentLineage.branch_ids.indexOf(parentBranchId);
        return idx >= 0
          ? parentLineage.branch_ids.slice(0, idx + 1)
          : [parentBranchId];
      })();

      const lineageBranchesOrdered = parentLineageBranchIds
        .map((id) => session.branches[id])
        .filter((b): b is Branch => Boolean(b));
      const full_preceding_narrative = buildFullPrecedingNarrative(
        paragraphs,
        truncation,
        lineageBranchesOrdered,
        sourceNode.paragraph_index,
      );

      const branchId = newBranchId();
      const placeholderBranch: Branch = {
        branch_id: branchId,
        branch_type: branchType,
        source_node_id: sourceNode.node_id,
        parent_branch_id: parentBranchId,
        depth,
        choice_type: params.choiceType,
        choice_text: params.choiceText,
        status: 'queued',
        generated_content: '',
        next_node_id: null,
        is_terminal: false,
        created_at: Date.now(),
      };

      setSession((prev) => {
        if (!prev) return prev;
        const result = createLineageFromBranch(prev, parentBranchId, placeholderBranch);
        if ('error' in result) {
          alert(result.error);
          return prev;
        }
        return result.session;
      });
      setActiveNodeId(null);

      const input: BranchContinuationInput = {
        branch_id: branchId,
        work_id: story.work_id,
        content_hash: story.content_hash,
        branch_type: branchType,
        source_node_id: sourceNode.node_id,
        parent_branch_id: parentBranchId,
        depth,
        lineage_branch_ids: parentLineageBranchIds,
        lineage_branches: lineageBranchesOrdered,
        full_preceding_narrative,
        source_node: sourceNode,
        choice_type: params.choiceType,
        choice_text: params.choiceText,
        picked_option: params.option,
        constraints: { max_depth: MAX_DEPTH },
      };
      branchGen.start(input, story);
    },
    [story, session, allKeyNodes, branchGen, paragraphs, truncation],
  );

  // ── 流式生成结束 → 把 final 写入 session ────────────────────
  useEffect(() => {
    const result = branchGen.state.result;
    if (!result) return;
    setSession((prev) => {
      if (!prev) return prev;
      let next = prev;
      next = {
        ...next,
        branches: { ...next.branches, [result.branch.branch_id]: result.branch },
      };
      if (result.next_key_node) {
        next = upsertKeyNode(next, result.next_key_node);
      }
      if (result.impact) {
        next = upsertImpact(next, { ...result.impact, branch_id: result.branch.branch_id });
      }
      return next;
    });
    // 重置 hook，让 UI 回到 idle（result 已经在 session 中）
    setTimeout(() => branchGen.reset(), 0);
  }, [branchGen.state.result, branchGen]);

  // 流式生成中：把实时正文同步到 session 里的对应分支上
  useEffect(() => {
    if (!liveBranchText || !generatingBranch) return;
    setSession((prev) => {
      if (!prev) return prev;
      const b = prev.branches[generatingBranch.branch_id];
      if (!b) return prev;
      return {
        ...prev,
        branches: {
          ...prev.branches,
          [generatingBranch.branch_id]: {
            ...b,
            status: 'generating',
            generated_content: liveBranchText,
          },
        },
      };
    });
  }, [liveBranchText, generatingBranch]);

  // ── 切换链路 ───────────────────────────────────────────────
  const handleSwitchLineage = useCallback(
    (lineageId: string, _targetBranchId: string) => {
      setSession((prev) => (prev ? setCurrentLineage(prev, lineageId) : prev));
      setMapFullscreen(false);
    },
    [],
  );

  const handleJumpToNode = useCallback(
    (nodeId: string) => {
      const node = allKeyNodes.find((n) => n.node_id === nodeId);
      if (!node || node.paragraph_index === undefined) return;
      const el = paragraphRefs.current.get(node.paragraph_index);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFocusParagraph(node.paragraph_index);
      }
    },
    [allKeyNodes],
  );

  const handleRestoreOriginal = useCallback(() => {
    setSession((prev) =>
      prev
        ? {
            ...prev,
            current_branch_id: null,
            current_lineage_id: null,
            updated_at: Date.now(),
          }
        : prev,
    );
  }, []);

  // ── 文末继续续写（紧接当前已读内容末尾） ─────────────────────
  const startAppendContinuation = useCallback(() => {
    if (!story || !session) return;
    const chain = readerBranches;
    const tip = chain[chain.length - 1];
    const parentBranchId = tip?.branch_id ?? null;
    const depth = tip ? tip.depth + 1 : 1;

    if (depth > MAX_DEPTH) {
      alert(`已达到最大分支深度（${MAX_DEPTH} 层）`);
      return;
    }

    const lineage_branch_ids = chain.map((b) => b.branch_id);
    const lineage_branches = chain;

    const visibleOriginals = originalNodes.filter(
      (n) => !truncation || (n.paragraph_index ?? 0) <= truncation.paragraphIndex,
    );
    const sourceNodeId =
      tip?.next_node_id || visibleOriginals[visibleOriginals.length - 1]?.node_id || '';
    const sourceNode = allKeyNodes.find((n) => n.node_id === sourceNodeId);
    if (!sourceNode) {
      alert('尚未就绪：请等待关键节点加载完成后再续写。');
      return;
    }

    const branchId = newBranchId();
    const placeholderBranch: Branch = {
      branch_id: branchId,
      branch_type: 'continuation',
      source_node_id: sourceNode.node_id,
      parent_branch_id: parentBranchId,
      depth,
      choice_type: 'custom',
      choice_text: customInstruction.trim() || '沿着当前情节自然续写',
      status: 'queued',
      generated_content: '',
      next_node_id: null,
      is_terminal: false,
      created_at: Date.now(),
    };

    setSession((prev) => {
      if (!prev) return prev;
      if (parentBranchId) {
        return appendBranchToCurrentLineage(prev, placeholderBranch);
      }
      const r = createLineageFromBranch(prev, null, placeholderBranch);
      if ('error' in r) {
        alert(r.error);
        return prev;
      }
      return r.session;
    });
    setActiveNodeId(null);

    const full_preceding_narrative = buildFullPrecedingNarrative(
      paragraphs,
      truncation,
      lineage_branches,
      undefined,
    );

    branchGen.start(
      {
        branch_id: branchId,
        work_id: story.work_id,
        content_hash: story.content_hash,
        branch_type: 'continuation',
        source_node_id: sourceNode.node_id,
        parent_branch_id: parentBranchId,
        depth,
        lineage_branch_ids,
        lineage_branches,
        full_preceding_narrative,
        source_node: sourceNode,
        choice_type: 'custom',
        choice_text: customInstruction.trim() || '沿着当前情节自然续写',
        constraints: { max_depth: MAX_DEPTH },
      },
      story,
    );
  }, [
    story,
    session,
    readerBranches,
    truncation,
    paragraphs,
    allKeyNodes,
    originalNodes,
    customInstruction,
    branchGen,
  ]);

  // ── 重新生成当前链路上最后一次续写 ───────────────────────────
  const regenerateLastContinuation = useCallback(() => {
    if (!story || !session) return;
    if (readerBranches.length === 0) return;
    const removed = removeLastBranchFromLineage(session);
    if (!removed) return;
    const b = removed.removedBranch;
    let sess = removed.session;
    const branchId = newBranchId();
    const placeholder: Branch = {
      ...b,
      branch_id: branchId,
      status: 'queued',
      generated_content: '',
      next_node_id: null,
      created_at: Date.now(),
    };
    sess = appendBranchToCurrentLineage(sess, placeholder);
    setSession(sess);
    setActiveNodeId(null);

    const lineageAfter = getCurrentLineageBranches(sess).filter((x) => x.branch_type !== 'extra');
    const lineage_branch_ids = lineageAfter.map((x) => x.branch_id);
    const lineage_branches = lineageAfter
      .map((x) => sess.branches[x.branch_id])
      .filter((c): c is Branch => Boolean(c));

    const sourceNode = b.source_node_id
      ? allKeyNodes.find((n) => n.node_id === b.source_node_id)
      : undefined;

    const full_preceding_narrative = buildFullPrecedingNarrative(
      paragraphs,
      truncation,
      lineage_branches,
      sourceNode?.paragraph_index,
    );

    branchGen.start(
      {
        branch_id: branchId,
        work_id: story.work_id,
        content_hash: story.content_hash,
        branch_type: b.branch_type === 'node_branch' ? 'node_branch' : 'continuation',
        source_node_id: b.source_node_id,
        parent_branch_id: b.parent_branch_id,
        depth: b.depth,
        lineage_branch_ids,
        lineage_branches,
        full_preceding_narrative,
        source_node: sourceNode,
        choice_type: b.choice_type ?? 'custom',
        choice_text: b.choice_text,
        constraints: { max_depth: MAX_DEPTH },
      },
      story,
    );
  }, [story, session, readerBranches, branchGen, paragraphs, truncation, allKeyNodes]);

  // ─── 渲染 ───────────────────────────────────────────────────
  if (loading) return <div className="state-card">正文加载中…</div>;
  if (error) return <div className="state-card error">{error}</div>;
  if (!story || !session) return <div className="state-card">故事不存在</div>;

  const titleForReader = story.chapter_name;

  const direction =
    branchGen.state.result?.branch.choice_text ??
    readerBranches[readerBranches.length - 1]?.choice_text ??
    '尚未选择';

  return (
    <motion.section
      className="detail-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.8, 0.32, 1] }}
    >
      <div className="detail-layout">
        <article className="reader-card">
          <div className="reader-banner">
            <button className="back-btn" onClick={onBack}>
              <ArrowLeft size={14} /> 返回列表
            </button>
            <div className="crumb">
              <span className="label">正在阅读</span>
              <span className="title">
                {titleForReader}
                {story.author_name && (
                  <span style={{ color: 'var(--ink-3)', fontWeight: 500, marginLeft: 8 }}>
                    · {story.author_name}
                  </span>
                )}
              </span>
            </div>
            <div className="actions">
              <button className="btn-icon" aria-label="收藏">
                <BookmarkPlus size={16} />
              </button>
              <button className="btn-icon disabled" aria-label="分享（P0 未开放）" title="P0 暂未开放分享">
                <Share2 size={16} />
              </button>
            </div>
          </div>

          <div className="reader-body">
            <h1 className="chapter">{titleForReader}</h1>
            <div className="copyright">
              <span className="label">©</span>
              本内容版权为知乎及版权方所有，正在受版权保护中。
              {story.labels?.length > 0 && (
                <span style={{ marginLeft: 'auto' }}>
                  {story.labels.slice(0, 4).join(' / ')}
                </span>
              )}
            </div>

            {story.introduction && (
              <p className="intro">{story.introduction}</p>
            )}

            {/* 原文（按截断点裁切） */}
            {
              visibleParagraphs.map((paragraph, index) => {
                const node = originalNodes.find((n) => n.paragraph_index === index);
                const isActive = activeNodeId === node?.node_id;
                const isFocus = focusParagraph === index;
                return (
                  <section
                    key={`${index}_${paragraph.slice(0, 8)}`}
                    className={`paragraph-block ${isFocus ? 'focus' : ''}`}
                    ref={(el) => {
                      if (el) paragraphRefs.current.set(index, el);
                      else paragraphRefs.current.delete(index);
                    }}
                  >
                    <p className={node ? 'highlight' : ''}>
                      {paragraph}
                      {node && (
                        <button
                          className={`node-icon ${isActive ? 'active' : ''}`}
                          aria-label="展开剧情分支选项"
                          onClick={() => setActiveNodeId(isActive ? null : node.node_id)}
                        >
                          <GitBranch size={14} />
                        </button>
                      )}
                    </p>
                    <AnimatePresence>
                      {isActive && node && (
                        <BranchPopover
                          node={node}
                          onClose={() => setActiveNodeId(null)}
                          onPick={(text, sourceNodeId, option) =>
                            startNodeBranch({
                              sourceNodeId,
                              choiceText: text,
                              choiceType: option ? 'preset' : 'custom',
                              option,
                            })
                          }
                        />
                      )}
                    </AnimatePresence>
                  </section>
                );
              })
            }

            {/* 折叠提示（点击展开浮窗预览） */}
            {hiddenParagraphCount > 0 && (
              <FoldedNotice
                count={hiddenParagraphCount}
                hiddenParagraphs={paragraphs.slice(truncation!.paragraphIndex + 1)}
                onRestore={handleRestoreOriginal}
              />
            )}

            {/* AI 续写正文（与原文同样式） */}
            {readerBranches.map((branch) => (
              <ContinuationBlock key={branch.branch_id} branch={branch} />
            ))}

            <section className="ending-actions">
              <h3>
                {readerBranches.some((b) => b.is_terminal)
                  ? '故事已到结局'
                  : '你已读到当前内容末尾'}
              </h3>
              <p>告诉 AI 你想让故事往哪个方向发展，或者直接让它继续。</p>

              <textarea
                className="instruction-input"
                placeholder="你想让故事往哪个方向发展？（可选）"
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                rows={2}
              />

              <div className="row">
                <>
                  <button className="btn btn-primary" type="button" onClick={startAppendContinuation}>
                    继续续写
                  </button>
                  {readerBranches.length > 0 && (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={regenerateLastContinuation}
                    >
                      重新续写
                    </button>
                  )}
                  {truncation && (
                    <button className="btn btn-ghost" type="button" onClick={handleRestoreOriginal}>
                      回到主线
                    </button>
                  )}
                </>
              </div>
            </section>
          </div>
        </article>

        <aside className="side-panel">
          <section className="panel-card">
            <div className="panel-head">
              <h2>
                <Network size={16} /> 剧情脑图
              </h2>
              <div className="panel-actions">
                <button
                  className="btn-icon"
                  onClick={() => setMapFullscreen(true)}
                  aria-label="展开全屏"
                >
                  <Expand size={14} />
                </button>
              </div>
            </div>
            <div className="mindmap-wrap preview">
              <StoryMindMap
                story={story}
                keyNodes={allKeyNodes}
                branches={Object.values(session.branches).filter((b) => b.branch_type !== 'extra')}
                lineages={session.lineages}
                currentLineageId={session.current_lineage_id}
                selectedNodeId={activeNodeId ?? session.current_branch_id}
                interactive={false}
                onSelectNode={() => undefined}
                onRequestSwitchLineage={handleSwitchLineage}
                onExpand={() => setMapFullscreen(true)}
              />
              {background.progress.ready < background.progress.total && (
                <div className="mindmap-loading-overlay">
                  <Loader2 size={24} className="mindmap-loading-spinner" />
                  <span>构建世界观中…</span>
                </div>
              )}
            </div>
          </section>

          {/* 刘看山区块 — 上移，无需滚动即可看到 */}
          <LiukanshanCorner
            backgroundReady={background.progress.ready}
            backgroundTotal={background.progress.total}
            phase={branchGen.state.phase}
            sessionCount={session.lineages.length}
          />

          <GenerationCard
            phase={branchGen.state.phase}
            direction={direction}
            snippet={branchGen.state.text}
            upstream={branchGen.state.upstream}
            errorMessage={branchGen.state.error?.message}
          />

          <StoryArchiveEntry
            readiness={background.readiness}
            progress={background.progress}
            impactCount={currentImpacts.length}
            onOpen={() => setArchiveOpen(true)}
          />
        </aside>
      </div>

      {createPortal(
        <AnimatePresence>
          {mapFullscreen && (
            <>
              <motion.div
                key="mask"
                className="mindmap-mask"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMapFullscreen(false)}
              />
              <motion.div
                key="fullscreen"
                className="mindmap-wrap fullscreen"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.22, 0.8, 0.32, 1] }}
              >
                <StoryMindMap
                  story={story}
                  keyNodes={allKeyNodes}
                  branches={Object.values(session.branches).filter((b) => b.branch_type !== 'extra')}
                  lineages={session.lineages}
                  currentLineageId={session.current_lineage_id}
                  selectedNodeId={activeNodeId ?? session.current_branch_id}
                  interactive
                  onSelectNode={(id) => {
                    if (!id) return;
                    setSession((prev) => (prev ? setCurrentBranch(prev, id) : prev));
                  }}
                  onJumpToNode={handleJumpToNode}
                  onRequestSwitchLineage={handleSwitchLineage}
                  onRequestAddBranch={(nodeId) => {
                    setActiveNodeId(nodeId);
                    setMapFullscreen(false);
                  }}
                  onClose={() => setMapFullscreen(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <StoryArchiveDrawer
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        summary={background.summary}
        world={background.world}
        characters={background.characters}
        relations={background.relations}
        objects={background.objects}
        impacts={currentImpacts}
        readiness={background.readiness}
      />

      {/* 流式续写未完成时，提供取消入口 */}
      {(branchGen.state.phase === 'generating' || branchGen.state.phase === 'queued') && (
        <button className="floating-cancel" onClick={branchGen.cancel}>
          取消当前生成
        </button>
      )}
    </motion.section>
  );
}

// ────────────────────────────────────────────────────────────
// 折叠原文提示
// ────────────────────────────────────────────────────────────

function FoldedNotice({
  count,
  hiddenParagraphs,
  onRestore,
}: {
  count: number;
  hiddenParagraphs: string[];
  onRestore: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="folded-notice">
      <div className="row">
        <span>
          原本的剧情走向与你的选择不同，已隐藏 {count} 段原文 →
        </span>
        <div className="actions">
          <button className="link-btn" onClick={() => setExpanded((v) => !v)}>
            <ChevronDown size={12} className={expanded ? 'rot' : ''} />
            {expanded ? '收起预览' : '展开预览'}
          </button>
          <button className="link-btn primary" onClick={onRestore}>
            回到主线
          </button>
        </div>
      </div>
      {expanded && (
        <div className="folded-preview">
          {hiddenParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// AI 续写段落（与原文同样式）
// ────────────────────────────────────────────────────────────

function ContinuationBlock({ branch }: { branch: Branch }) {
  const paragraphs = branch.generated_content.split(/\n+/).filter((p) => p.trim());
  return (
    <section className="ai-continuation">
      <div className="ai-hint">
        <Sparkles size={11} />
        AI 续写自你的选择：{branch.choice_text}
        {branch.status === 'generating' && <span className="muted"> · 生成中</span>}
      </div>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {branch.is_terminal && (
        <div className="ai-terminal-hint">
          <Sparkles size={11} /> 故事在此自然收束。
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────
// 刘看山角落（侧栏下方常驻的状态提示位）
// ────────────────────────────────────────────────────────────

function LiukanshanCorner({
  backgroundReady,
  backgroundTotal,
  phase,
  sessionCount,
}: {
  backgroundReady: number;
  backgroundTotal: number;
  phase: 'idle' | 'queued' | 'generating' | 'success' | 'failed';
  sessionCount: number;
}) {
  let scene: 'welcome' | 'background_ready' | 'generating' | 'queued' | 'failed' = 'welcome';
  let caption = '世界观正在悄悄构建中…';

  if (phase === 'queued') {
    scene = 'queued';
    caption = '先把世界观补齐，分支马上就来。';
  } else if (phase === 'generating') {
    scene = 'generating';
    caption = '我正在替你续写故事…';
  } else if (phase === 'failed') {
    scene = 'failed';
    caption = '生成出了点小问题，重试试试看。';
  } else if (backgroundReady >= backgroundTotal && backgroundTotal > 0) {
    scene = 'background_ready';
    caption =
      sessionCount > 0
        ? `已积累 ${sessionCount} 条剧情路线，去脑图里看看？`
        : '一切准备就绪，选个关键节点开始你的故事吧。';
  }

  return (
    <section className="panel-card mascot-card">
      <LiukanshanMascot scene={scene} size={56} caption={caption} />
    </section>
  );
}

// ────────────────────────────────────────────────────────────
// 故事档案入口卡片（侧栏，脑图与生成进度之间）
// ────────────────────────────────────────────────────────────

function StoryArchiveEntry({
  readiness,
  progress,
  impactCount,
  onOpen,
}: {
  readiness: Record<string, 'pending' | 'ready' | 'failed'>;
  progress: { ready: number; total: number };
  impactCount: number;
  onOpen: () => void;
}) {
  type State = 'pending' | 'ready' | 'failed';

  const tiles: {
    key: 'world' | 'characters' | 'relations' | 'objects' | 'impact';
    label: string;
    Icon: typeof Archive;
    state: State;
    extra?: string;
  }[] = [
    { key: 'world', label: '世界观', Icon: Globe2, state: readiness.world ?? 'pending' },
    { key: 'characters', label: '人物', Icon: Users, state: readiness.characters ?? 'pending' },
    { key: 'relations', label: '关系网', Icon: Network, state: readiness.relations ?? 'pending' },
    { key: 'objects', label: '物品', Icon: Package, state: readiness.objects ?? 'pending' },
    {
      key: 'impact',
      label: '分支影响',
      Icon: Sparkles,
      state: impactCount > 0 ? 'ready' : 'pending',
      extra: impactCount > 0 ? `${impactCount} 条` : '尚无',
    },
  ];

  const allReady = progress.ready >= progress.total && progress.total > 0;
  const statusLabel = (s: State, extra?: string) =>
    extra ?? (s === 'ready' ? '已就绪' : s === 'failed' ? '生成失败' : '生成中…');

  const isLoading = progress.ready < progress.total;

  return (
    <section className={`panel-card archive-entry-card ${isLoading ? 'is-loading' : ''}`}>
      <div className="archive-entry-hero">
        <div className="archive-entry-hero-bg" aria-hidden />
        <div className="archive-entry-hero-content">
          <div className="archive-entry-badge">
            <BookOpen size={20} />
          </div>
          <div className="archive-entry-meta">
            <h3>故事档案</h3>
            <p>AI 在后台为你梳理世界观、人物与物品，让分支续写更贴合原作。</p>
          </div>
          <span className={`archive-entry-status ${allReady ? 'ready' : 'pending'}`}>
            <span className="indicator" />
            {allReady ? '已就绪' : `${progress.ready}/${progress.total}`}
          </span>
        </div>
      </div>

      <ul className="archive-tile-grid">
        {tiles.map((t) => (
          <li
            key={t.key}
            className={`archive-tile ${t.state} ${isLoading ? 'disabled' : ''}`}
            role={isLoading ? undefined : 'button'}
            tabIndex={isLoading ? -1 : 0}
            onClick={isLoading ? undefined : onOpen}
            onKeyDown={
              isLoading
                ? undefined
                : (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen();
                    }
                  }
            }
          >
            <span className="archive-tile-icon">
              <t.Icon size={14} />
            </span>
            <span className="archive-tile-body">
              <span className="label">{t.label}</span>
              <span className="status">{statusLabel(t.state, t.extra)}</span>
            </span>
          </li>
        ))}
      </ul>

      <button className="archive-entry-cta" onClick={onOpen} disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 size={14} className="spin" />
            档案构建中…
          </>
        ) : (
          <>
            展开完整档案
            <ArrowRight size={14} />
          </>
        )}
      </button>
    </section>
  );
}
