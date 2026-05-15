const DAY_MS = 24 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  data: T;
  cached_at: number;
  expires_at: number;
}

export function getCache<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() > envelope.expires_at) {
      localStorage.removeItem(key);
      return null;
    }
    return envelope.data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttl = DAY_MS) {
  const now = Date.now();
  const envelope: CacheEnvelope<T> = {
    data,
    cached_at: now,
    expires_at: now + ttl,
  };
  localStorage.setItem(key, JSON.stringify(envelope));
}

export function getCacheMeta(key: string) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as CacheEnvelope<unknown>;
    return {
      cached_at: envelope.cached_at,
      expires_at: envelope.expires_at,
    };
  } catch {
    return null;
  }
}

export function removeCache(key: string) {
  localStorage.removeItem(key);
}

/**
 * 长时缓存（30 天）：用于用户会话级数据（分支链路）。
 * 知乎接口仍走 24h（顶部默认值）。
 */
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
export function setLongCache<T>(key: string, data: T) {
  setCache(key, data, MONTH_MS);
}

export const cacheKeys = {
  storyList: 'yyan_story_list_v2',
  storyDetail: (workId: string) => `yyan_story_detail_${workId}`,
  keyNodes: (workId: string, contentHash: string) =>
    `ai_key_nodes_${workId}_${contentHash}_local_v1`,
  /** 浏览器侧的故事档案副本（背景信息一次性聚合） */
  archiveBundle: (workId: string, contentHash: string) =>
    `yyan_archive_${workId}_${contentHash}_v3`,
  /** 用户会话：分支链路与节点（user-level，不进入服务端共享缓存） */
  session: (workId: string) => `yyan_session_${workId}`,
  /** 旧 UI 兼容键，仅前端使用 */
  branches: (workId: string) => `yyan_story_branches_${workId}`,
} as const;

/**
 * 清除本项目所有浏览器本地数据（分支、会话、档案、联动残留等）。
 * 开发调试用，可在控制台执行或绑定到按钮。
 */
export function clearAllProjectData(): string[] {
  const removed: string[] = [];
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.startsWith('yyan_') ||
        key.startsWith('ai_key_nodes_') ||
        key.startsWith('yyan_crossover_'))
    ) {
      localStorage.removeItem(key);
      removed.push(key);
    }
  }
  return removed;
}
