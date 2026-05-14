import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPresetKeyNodes } from '../data/storyPresets';
import {
  fetchKeyNodes,
  startBackgroundAll,
} from '../services/storyAi';
import { cacheKeys, getCache, setLongCache } from '../services/cache';
import type {
  BackgroundTaskType,
  CharacterProfile,
  ObjectProfile,
  RelationGraph,
  StoryArchiveBundle,
  StorySummaryData,
  WorldContext,
} from '@shared/types/ai';
import type { KeyNode, StoryDetail } from '@shared/types/story';

export interface StoryBackgroundState {
  summary?: StorySummaryData;
  world?: WorldContext;
  characters?: CharacterProfile[];
  relations?: RelationGraph;
  objects?: ObjectProfile[];
  keyNodes?: KeyNode[];
  readiness: Record<BackgroundTaskType, 'pending' | 'ready' | 'failed'>;
  progress: { ready: number; total: number };
  error?: { code: string; message: string };
}

const INITIAL_STATE: StoryBackgroundState = {
  readiness: {
    summary: 'pending',
    world: 'pending',
    characters: 'pending',
    relations: 'pending',
    objects: 'pending',
    key_nodes: 'pending',
  },
  progress: { ready: 0, total: 6 },
};

/**
 * 进入详情页后，后台自动启动 7 类背景任务（key_nodes 也算）。
 * 命中浏览器本地 archive 缓存时直接展示。
 * 完成后写入本地缓存，避免下次再走 SSE。
 */
export function useStoryBackground(story: StoryDetail | null): StoryBackgroundState {
  const [state, setState] = useState<StoryBackgroundState>(INITIAL_STATE);
  const abortRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => {
    if (!story) {
      setState(INITIAL_STATE);
      return;
    }

    const cacheKey = cacheKeys.archiveBundle(story.work_id, story.content_hash);
    const cached = getCache<StoryArchiveBundle>(cacheKey);
    if (cached) {
      setState({
        summary: cached.summary,
        world: cached.world,
        characters: cached.characters,
        relations: cached.relations,
        objects: cached.objects,
        keyNodes: cached.key_nodes?.key_nodes ?? [],
        readiness: { ...cached.readiness },
        progress: {
          ready: Object.values(cached.readiness).filter((s) => s === 'ready').length,
          total: 6,
        },
      });
      return;
    }

    setState(INITIAL_STATE);

    const stream = startBackgroundAll(story, {
      onPartial: (task, data) => {
        setState((prev) => {
          const next: StoryBackgroundState = {
            ...prev,
            readiness: { ...prev.readiness, [task]: 'ready' },
          };
          switch (task) {
            case 'summary':
              next.summary = data as StorySummaryData;
              break;
            case 'world':
              next.world = data as WorldContext;
              break;
            case 'characters':
              next.characters = data as CharacterProfile[];
              break;
            case 'relations':
              next.relations = data as RelationGraph;
              break;
            case 'objects':
              next.objects = data as ObjectProfile[];
              break;
            case 'key_nodes':
              next.keyNodes = (data as { key_nodes: KeyNode[] }).key_nodes ?? [];
              break;
          }
          return next;
        });
      },
      onFailedPart: (task, message) => {
        setState((prev) => ({
          ...prev,
          readiness: { ...prev.readiness, [task]: 'failed' },
          error: prev.error ?? { code: 'PART_FAILED', message: `${task}: ${message}` },
        }));
      },
      onProgress: (ready, total) =>
        setState((prev) => ({ ...prev, progress: { ready, total } })),
      onFinal: (bundle) => {
        setLongCache(cacheKey, bundle);
        setState((prev) => ({
          ...prev,
          summary: bundle.summary ?? prev.summary,
          world: bundle.world ?? prev.world,
          characters: bundle.characters ?? prev.characters,
          relations: bundle.relations ?? prev.relations,
          objects: bundle.objects ?? prev.objects,
          keyNodes: bundle.key_nodes?.key_nodes ?? prev.keyNodes,
          readiness: bundle.readiness,
        }));
      },
      onError: (err) => setState((prev) => ({ ...prev, error: err })),
    });
    abortRef.current = stream;

    return () => {
      try {
        stream.abort();
      } catch {
        /* ignore */
      }
    };
  }, [story]);

  // 兜底：若 key_nodes 没在 final 中拿到，单独再拉一次（保证 P0 阅读链路可用）
  useEffect(() => {
    if (!story) return;
    if (state.keyNodes) return;
    if (state.readiness.key_nodes === 'failed') return;
    let cancelled = false;
    fetchKeyNodes(story)
      .then((nodes) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          keyNodes: nodes,
          readiness: { ...prev.readiness, key_nodes: 'ready' },
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [story, state.keyNodes, state.readiness.key_nodes]);

  const presetKeyNodes = useMemo(
    () => (story ? buildPresetKeyNodes(story) : null),
    [story?.work_id, story?.content_hash, story?.chapter_name, story?.content],
  );

  if (presetKeyNodes && presetKeyNodes.length > 0) {
    return { ...state, keyNodes: presetKeyNodes };
  }
  return state;
}
