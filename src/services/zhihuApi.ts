import { cacheKeys, getCache, setCache } from './cache';
import { apiGet } from './apiClient';
import type { StoryDetail, StorySummary } from '@shared/types/story';

/**
 * 前端不直接调用知乎开放接口，统一走服务端代理。
 * 浏览器侧仍按 PRD 强制 24 小时缓存。
 */

export async function getStoryList(): Promise<StorySummary[]> {
  const cached = getCache<StorySummary[]>(cacheKeys.storyList);
  if (cached) return cached;

  const payload = await apiGet<{ data: StorySummary[] }>('/zhihu/list');
  if (!Array.isArray(payload.data)) {
    throw new Error('故事列表数据格式异常');
  }
  setCache(cacheKeys.storyList, payload.data);
  return payload.data;
}

export async function getStoryDetail(workId: string): Promise<StoryDetail> {
  const cacheKey = cacheKeys.storyDetail(workId);
  const cached = getCache<StoryDetail>(cacheKey);
  if (cached) return cached;

  const payload = await apiGet<{ data: StoryDetail }>(
    `/zhihu/detail/${encodeURIComponent(workId)}`,
  );
  if (!payload?.data) {
    throw new Error('故事详情不存在');
  }
  setCache(cacheKey, payload.data);
  return payload.data;
}
