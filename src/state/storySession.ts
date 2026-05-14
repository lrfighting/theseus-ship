/**
 * 用户级会话状态：在浏览器中持久化分支、节点、链路。
 *
 * 模型对应 PRD §3.2.7 "链路驱动渲染"：
 *  - lineages：所有平行分支链路（从根到叶子的 branch_id 列表）
 *  - currentLineageId / currentBranchId：当前激活链路
 *  - branches / keyNodes / impacts：所有用户级数据按 ID 索引
 */

import { cacheKeys, getCache, setLongCache, removeCache } from '../services/cache';
import type {
  Branch,
  BranchImpact,
  KeyNode,
  Lineage,
  StorySession,
} from '@shared/types/story';

/**
 * 同时活跃的剧情链路上限：不再限制（先前为 3，因产品需求改为无上限）。
 * 该常量保留导出，避免外部引用断裂；值仅作为提示，不再触发拒绝。
 */
const MAX_PARALLEL_LINEAGES = Number.POSITIVE_INFINITY;

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function loadSession(workId: string, contentHash: string): StorySession {
  const existing = getCache<StorySession>(cacheKeys.session(workId));
  if (existing && existing.base_content_hash === contentHash) {
    return existing;
  }
  // 内容变化时重置会话，避免锚点失效
  return createEmptySession(workId, contentHash);
}

export function saveSession(session: StorySession) {
  session.updated_at = Date.now();
  setLongCache(cacheKeys.session(session.work_id), session);
}

export function clearSession(workId: string) {
  removeCache(cacheKeys.session(workId));
}

export function createEmptySession(workId: string, contentHash: string): StorySession {
  const now = Date.now();
  return {
    session_id: newId('session'),
    work_id: workId,
    base_content_hash: contentHash,
    current_branch_id: null,
    current_lineage_id: null,
    lineages: [],
    branches: {},
    key_nodes: {},
    branch_impacts: {},
    created_at: now,
    updated_at: now,
  };
}

// ─────────────────────────────────────────────────────────
// 链路操作
// ─────────────────────────────────────────────────────────

export function findLineageContaining(session: StorySession, branchId: string): Lineage | null {
  return (
    session.lineages.find((l) => l.branch_ids[l.branch_ids.length - 1] === branchId) ??
    session.lineages.find((l) => l.branch_ids.includes(branchId)) ??
    null
  );
}

/**
 * 在 parentBranchId（可为 null 表示根）下新建一条链路并加入会话。
 * 自动检查 MAX_PARALLEL_LINEAGES，溢出时返回 null。
 */
export function createLineageFromBranch(
  session: StorySession,
  parentBranchId: string | null,
  newBranch: Branch,
): { session: StorySession; lineage: Lineage } | { error: string } {
  const parentLineage = parentBranchId
    ? findLineageContaining(session, parentBranchId)
    : null;
  const prefix = parentLineage
    ? parentLineage.branch_ids.slice(
        0,
        parentLineage.branch_ids.indexOf(parentBranchId!) + 1,
      )
    : [];

  const lineage: Lineage = {
    lineage_id: newId('lineage'),
    branch_ids: [...prefix, newBranch.branch_id],
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const next: StorySession = {
    ...session,
    branches: { ...session.branches, [newBranch.branch_id]: newBranch },
    lineages: [...session.lineages, lineage],
    current_branch_id: newBranch.branch_id,
    current_lineage_id: lineage.lineage_id,
    updated_at: Date.now(),
  };
  return { session: next, lineage };
}

export function appendBranchToCurrentLineage(
  session: StorySession,
  newBranch: Branch,
): StorySession {
  const lineageId = session.current_lineage_id;
  if (!lineageId) {
    const created = createLineageFromBranch(session, null, newBranch);
    if ('error' in created) return session;
    return created.session;
  }
  const lineages = session.lineages.map((l) =>
    l.lineage_id === lineageId
      ? { ...l, branch_ids: [...l.branch_ids, newBranch.branch_id], updated_at: Date.now() }
      : l,
  );
  return {
    ...session,
    branches: { ...session.branches, [newBranch.branch_id]: newBranch },
    lineages,
    current_branch_id: newBranch.branch_id,
    updated_at: Date.now(),
  };
}

export function setCurrentLineage(session: StorySession, lineageId: string): StorySession {
  const lineage = session.lineages.find((l) => l.lineage_id === lineageId);
  if (!lineage) return session;
  return {
    ...session,
    current_lineage_id: lineageId,
    current_branch_id: lineage.branch_ids[lineage.branch_ids.length - 1] ?? null,
    updated_at: Date.now(),
  };
}

export function setCurrentBranch(session: StorySession, branchId: string): StorySession {
  const lineage = findLineageContaining(session, branchId);
  return {
    ...session,
    current_branch_id: branchId,
    current_lineage_id: lineage?.lineage_id ?? session.current_lineage_id,
    updated_at: Date.now(),
  };
}

/**
 * 从当前链路的末尾移除最后一个分支，并清理关联数据。
 * 返回 { session, removedBranch }，如果当前没有链路或为空则返回 null。
 */
export function removeLastBranchFromLineage(
  session: StorySession,
): { session: StorySession; removedBranch: Branch } | null {
  const lineageId = session.current_lineage_id;
  if (!lineageId) return null;
  const lineage = session.lineages.find((l) => l.lineage_id === lineageId);
  if (!lineage || lineage.branch_ids.length === 0) return null;

  const removedBranchId = lineage.branch_ids[lineage.branch_ids.length - 1];
  const removedBranch = session.branches[removedBranchId];
  if (!removedBranch) return null;

  // 从 lineage 中移除
  const newBranchIds = lineage.branch_ids.slice(0, -1);
  const lineages = session.lineages.map((l) =>
    l.lineage_id === lineageId
      ? { ...l, branch_ids: newBranchIds, updated_at: Date.now() }
      : l,
  );

  // 检查该 branch 是否被其它 lineage 引用
  const otherIds = new Set<string>();
  for (const l of lineages) {
    l.branch_ids.forEach((id) => otherIds.add(id));
  }

  const branches = { ...session.branches };
  const branch_impacts = { ...session.branch_impacts };
  const key_nodes = { ...session.key_nodes };

  if (!otherIds.has(removedBranchId)) {
    delete branches[removedBranchId];
    delete branch_impacts[removedBranchId];
  }

  // 清理该 branch 创建的 next_key_node
  if (removedBranch.next_node_id) {
    delete key_nodes[removedBranch.next_node_id];
  }

  const current_branch_id = newBranchIds.length > 0 ? newBranchIds[newBranchIds.length - 1] : null;

  return {
    session: {
      ...session,
      lineages,
      branches,
      branch_impacts,
      key_nodes,
      current_branch_id,
      updated_at: Date.now(),
    },
    removedBranch,
  };
}

export function removeLineage(session: StorySession, lineageId: string): StorySession {
  const lineage = session.lineages.find((l) => l.lineage_id === lineageId);
  if (!lineage) return session;

  // 仅删除当前链路上"独占"的分支（不被其它链路引用）
  const otherIds = new Set<string>();
  for (const l of session.lineages) {
    if (l.lineage_id === lineageId) continue;
    l.branch_ids.forEach((id) => otherIds.add(id));
  }
  const branches = { ...session.branches };
  for (const id of lineage.branch_ids) {
    if (!otherIds.has(id)) {
      delete branches[id];
      delete session.branch_impacts[id];
    }
  }

  const lineages = session.lineages.filter((l) => l.lineage_id !== lineageId);
  const fallback = lineages[lineages.length - 1] ?? null;
  return {
    ...session,
    branches,
    lineages,
    current_lineage_id: fallback?.lineage_id ?? null,
    current_branch_id: fallback ? fallback.branch_ids[fallback.branch_ids.length - 1] : null,
    updated_at: Date.now(),
  };
}

export function upsertKeyNode(session: StorySession, node: KeyNode): StorySession {
  return {
    ...session,
    key_nodes: { ...session.key_nodes, [node.node_id]: node },
    updated_at: Date.now(),
  };
}

/** 用预设原文节点替换会话中的「原文」关键节点，保留 AI 续写节点。 */
export function replaceOriginalKeyNodes(
  session: StorySession,
  nodes: KeyNode[],
): StorySession {
  const kept: Record<string, KeyNode> = {};
  for (const [id, n] of Object.entries(session.key_nodes)) {
    if (n.source === 'ai_continuation') kept[id] = n;
  }
  let next: StorySession = { ...session, key_nodes: kept, updated_at: Date.now() };
  for (const node of nodes) {
    next = upsertKeyNode(next, node);
  }
  return next;
}

export function upsertImpact(session: StorySession, impact: BranchImpact): StorySession {
  return {
    ...session,
    branch_impacts: { ...session.branch_impacts, [impact.branch_id]: impact },
    updated_at: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────
// 当前链路上的分支序列
// ─────────────────────────────────────────────────────────

export function getCurrentLineageBranches(session: StorySession): Branch[] {
  if (!session.current_lineage_id) return [];
  const lineage = session.lineages.find((l) => l.lineage_id === session.current_lineage_id);
  if (!lineage) return [];
  return lineage.branch_ids
    .map((id) => session.branches[id])
    .filter((b): b is Branch => Boolean(b));
}

/**
 * 当前链路在原文上的"截断点"：
 *  - 找到第一个分支的 source_node_id
 *  - 用原文该 paragraph_index 作为截断位置
 *  - 没有任何分支时返回 null（展示整篇原文）
 */
export function getCurrentLineageTruncation(
  session: StorySession,
): { sourceNodeId: string; paragraphIndex: number } | null {
  const branches = getCurrentLineageBranches(session);
  const firstNodeBranch = branches.find(
    (b) => b.branch_type === 'node_branch' && b.source_node_id,
  );
  if (!firstNodeBranch || !firstNodeBranch.source_node_id) return null;
  const node = session.key_nodes[firstNodeBranch.source_node_id];
  if (!node || node.paragraph_index === undefined) return null;
  return {
    sourceNodeId: node.node_id,
    paragraphIndex: node.paragraph_index,
  };
}

export const sessionLimits = { MAX_PARALLEL_LINEAGES };
