/**
 * 前端 AI 服务层（V1.3）。
 *
 * 设计原则：
 *  - 所有路径相对于 VITE_API_BASE（默认 /api）。
 *  - 流式接口返回 SseStream，调用方按事件名注册回调。
 *  - 同步接口直接返回 Promise。
 *
 * 用户级数据（branches / lineages / impacts）只存在浏览器 localStorage 中，
 * 服务端共享缓存只承载 7 类背景信息（详见 PRD §4.2.1）。
 */

import { apiPost } from './apiClient';
import { openSseStream, type SseStream } from './sseClient';
import { cacheKeys, getCache, setCache } from './cache';
import type {
  BackgroundTaskInputBase,
  BackgroundTaskResponse,
  BackgroundTaskType,
  BranchContinuationInput,
  BranchContinuationResult,
  StoryArchiveBundle,
} from '@shared/types/ai';
import type {
  Branch,
  BranchType,
  KeyNode,
  StoryDetail,
} from '@shared/types/story';

// ──────────────────────────────────────────────────────────────
// 工具
// ──────────────────────────────────────────────────────────────

export function getParagraphs(content: string): string[] {
  return content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function buildBgInput(story: StoryDetail): BackgroundTaskInputBase {
  return {
    work_id: story.work_id,
    content_hash: story.content_hash,
    story: {
      chapter_name: story.chapter_name,
      author_name: story.author_name,
      labels: story.labels,
      introduction: story.introduction,
      content: story.content,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// 浏览器会话存储（Branch / KeyNode 用户级）
// ──────────────────────────────────────────────────────────────

export function getBranches(workId: string): Branch[] {
  return getCache<Branch[]>(cacheKeys.branches(workId)) ?? [];
}

export function saveBranches(workId: string, branches: Branch[]) {
  setCache(cacheKeys.branches(workId), branches);
}

// ──────────────────────────────────────────────────────────────
// 单个背景任务
// ──────────────────────────────────────────────────────────────

export async function fetchBackgroundTask<T extends BackgroundTaskType>(
  taskType: T,
  story: StoryDetail,
): Promise<BackgroundTaskResponse<T>> {
  return apiPost<BackgroundTaskResponse<T>>(
    `/ai/background/${taskType}`,
    buildBgInput(story),
  );
}

export async function fetchKeyNodes(story: StoryDetail): Promise<KeyNode[]> {
  const resp = await fetchBackgroundTask('key_nodes', story);
  return resp.data.key_nodes;
}

// ──────────────────────────────────────────────────────────────
// 全套背景（SSE，按完成顺序推送）
// ──────────────────────────────────────────────────────────────

export interface BackgroundStreamCallbacks {
  onPartial?: (task: BackgroundTaskType, data: unknown, meta: unknown) => void;
  onFailedPart?: (task: BackgroundTaskType, error: string) => void;
  onProgress?: (ready: number, total: number) => void;
  onFinal?: (bundle: StoryArchiveBundle) => void;
  onError?: (error: { code: string; message: string; retryable: boolean }) => void;
  onDone?: () => void;
}

interface BackgroundDeltaEnvelope {
  kind: 'background_ready' | 'background_failed';
  task_type: BackgroundTaskType;
  ready?: number;
  total?: number;
  data?: unknown;
  meta?: unknown;
  error?: string;
}

export function startBackgroundAll(
  story: StoryDetail,
  callbacks: BackgroundStreamCallbacks = {},
): SseStream<StoryArchiveBundle> {
  const stream = openSseStream<StoryArchiveBundle>(
    '/ai/background/all/stream',
    buildBgInput(story),
  );
  stream.on('delta', (payload) => {
    try {
      const env = JSON.parse(payload.text) as BackgroundDeltaEnvelope;
      if (env.kind === 'background_ready') {
        callbacks.onPartial?.(env.task_type, env.data, env.meta);
        if (env.ready !== undefined && env.total !== undefined) {
          callbacks.onProgress?.(env.ready, env.total);
        }
      } else if (env.kind === 'background_failed') {
        callbacks.onFailedPart?.(env.task_type, env.error ?? 'unknown');
      }
    } catch {
      /* ignore non-json delta */
    }
  });
  stream.on('final', (bundle) => callbacks.onFinal?.(bundle));
  stream.on('error', (err) => callbacks.onError?.(err));
  stream.on('done', () => callbacks.onDone?.());
  return stream;
}

// ──────────────────────────────────────────────────────────────
// 分支续写（SSE）
// ──────────────────────────────────────────────────────────────

export interface BranchContinuationCallbacks {
  onStatus?: (
    status:
      | { status: 'queued'; upstream_ready: number; upstream_total: number }
      | { status: 'pending'; task_id: string }
      | { status: 'generating'; task_id: string }
      | { status: 'cancelling'; task_id: string },
  ) => void;
  onDelta?: (text: string) => void;
  onFinal?: (result: BranchContinuationResult) => void;
  onError?: (error: { code: string; message: string; retryable: boolean }) => void;
  onDone?: () => void;
}

export function startBranchContinuation(
  input: BranchContinuationInput,
  story: StoryDetail,
  callbacks: BranchContinuationCallbacks = {},
): SseStream<BranchContinuationResult> {
  const body = {
    ...input,
    story: {
      work_id: story.work_id,
      content_hash: story.content_hash,
      chapter_name: story.chapter_name,
      author_name: story.author_name,
      labels: story.labels,
      introduction: story.introduction,
      content: story.content,
    },
  };
  const stream = openSseStream<BranchContinuationResult>(
    '/ai/stream/branch-continuation',
    body,
  );
  stream.on('status', (payload) => callbacks.onStatus?.(payload));
  stream.on('delta', (payload) => callbacks.onDelta?.(payload.text));
  stream.on('final', (payload) => callbacks.onFinal?.(payload));
  stream.on('error', (payload) => callbacks.onError?.(payload));
  stream.on('done', () => callbacks.onDone?.());
  return stream;
}

// ──────────────────────────────────────────────────────────────
// 兼容层：getKeyNodes / generateBranch（已 deprecated，但旧 UI 还在用）
// ──────────────────────────────────────────────────────────────

/**
 * @deprecated 仅作为 UI 渐进迁移过渡使用。新逻辑请使用 fetchKeyNodes。
 */
export function getKeyNodes(_story: StoryDetail): KeyNode[] {
  return [];
}

/**
 * @deprecated 同步 mock；改用 startBranchContinuation。
 */
export function generateBranch(params: {
  storyTitle: string;
  branchType: BranchType;
  choiceText: string;
  sourceNodeId?: string;
}): string {
  const opening =
    params.branchType === 'continuation'
      ? '故事并没有在这里结束，新的选择让人物继续向前。'
      : '这个选择让原本的剧情走向发生了细微偏移。';
  return `${opening}围绕「${params.choiceText}」，《${params.storyTitle}》开始展开新的分支线。`;
}
