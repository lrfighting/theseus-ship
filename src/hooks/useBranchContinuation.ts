import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  startBranchContinuation,
  type BranchContinuationCallbacks,
} from '../services/storyAi';
import type {
  BranchContinuationInput,
  BranchContinuationResult,
} from '@shared/types/ai';
import type { StoryDetail } from '@shared/types/story';

export type GenerationPhase = 'idle' | 'queued' | 'generating' | 'success' | 'failed';

export interface BranchGenerationState {
  phase: GenerationPhase;
  /** 已积累的续写正文（实时流） */
  text: string;
  /** 上游背景任务进度（queued 阶段） */
  upstream: { ready: number; total: number };
  /** 最终结果（generating 完成后填充） */
  result?: BranchContinuationResult;
  error?: { code: string; message: string };
}

const INITIAL: BranchGenerationState = {
  phase: 'idle',
  text: '',
  upstream: { ready: 0, total: 5 },
};

export interface UseBranchContinuation {
  state: BranchGenerationState;
  start: (input: BranchContinuationInput, story: StoryDetail) => void;
  cancel: () => void;
  reset: () => void;
}

export function useBranchContinuation(): UseBranchContinuation {
  const [state, setState] = useState<BranchGenerationState>(INITIAL);
  const streamRef = useRef<{ abort: () => void } | null>(null);

  const cancel = useCallback(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setState((prev) => (prev.phase === 'generating' || prev.phase === 'queued'
      ? { ...prev, phase: 'failed', error: { code: 'CANCELLED', message: '已取消' } }
      : prev));
  }, []);

  const reset = useCallback(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setState(INITIAL);
  }, []);

  const start = useCallback(
    (input: BranchContinuationInput, story: StoryDetail) => {
      streamRef.current?.abort();
      setState({ ...INITIAL, phase: 'queued' });

      const callbacks: BranchContinuationCallbacks = {
        onStatus: (status) => {
          if (status.status === 'queued') {
            setState((prev) => ({
              ...prev,
              phase: 'queued',
              upstream: { ready: status.upstream_ready, total: status.upstream_total },
            }));
          } else if (status.status === 'generating') {
            setState((prev) => ({ ...prev, phase: 'generating' }));
          }
        },
        onDelta: (delta) => {
          setState((prev) => ({
            ...prev,
            phase: 'generating',
            text: prev.text + delta,
          }));
        },
        onFinal: (result) => {
          setState((prev) => ({
            ...prev,
            phase: 'success',
            text: result.branch.generated_content,
            result,
          }));
        },
        onError: (err) => {
          setState((prev) => ({
            ...prev,
            phase: 'failed',
            error: err,
          }));
        },
        onDone: () => {
          streamRef.current = null;
        },
      };

      streamRef.current = startBranchContinuation(input, story, callbacks);
    },
    [],
  );

  useEffect(() => () => streamRef.current?.abort(), []);

  return useMemo(() => ({ state, start, cancel, reset }), [state, start, cancel, reset]);
}
