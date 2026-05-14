/**
 * SSE 客户端：浏览器 EventSource 只支持 GET，
 * 这里基于 fetch + ReadableStream 实现 POST + SSE 解析。
 *
 * 事件协议见 shared/types/sse.ts。
 */

import type { AiErrorPayload } from '@shared/types/ai';
import type { SseDeltaEvent, SseStatusEvent } from '@shared/types/sse';
import { apiBase } from './apiClient';

export interface SseStream<TFinal> {
  on<E extends 'status'>(event: E, handler: (payload: SseStatusEvent) => void): void;
  on<E extends 'delta'>(event: E, handler: (payload: SseDeltaEvent) => void): void;
  on<E extends 'final'>(event: E, handler: (payload: TFinal) => void): void;
  on<E extends 'error'>(event: E, handler: (payload: AiErrorPayload) => void): void;
  on<E extends 'done'>(event: E, handler: () => void): void;
  abort: () => void;
}

interface ParsedEvent {
  name: string;
  data: string;
}

function* parseSseChunks(buffer: string): Generator<{ events: ParsedEvent[]; rest: string }> {
  // 不返回值，但内部用 closure 即可，这里改为常规迭代不必使用 generator
  yield { events: [], rest: buffer };
}

export function openSseStream<TFinal>(path: string, body: unknown): SseStream<TFinal> {
  const handlers: Record<string, Array<(payload: unknown) => void>> = {};
  const controller = new AbortController();

  function emit(name: string, payload: unknown) {
    const list = handlers[name] ?? [];
    list.forEach((h) => {
      try {
        h(payload);
      } catch {
        /* ignore */
      }
    });
  }

  function on(name: string, handler: (payload: unknown) => void) {
    if (!handlers[name]) handlers[name] = [];
    handlers[name].push(handler);
  }

  (async () => {
    try {
      const resp = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        credentials: 'include',
        signal: controller.signal,
      });

      if (!resp.ok) {
        let errPayload: { error?: { code?: string; message?: string } } | undefined;
        try {
          errPayload = await resp.json();
        } catch {
          /* ignore */
        }
        emit('error', {
          code: errPayload?.error?.code ?? 'HTTP_ERROR',
          message: errPayload?.error?.message ?? `HTTP ${resp.status}`,
          retryable: false,
        });
        emit('done', {});
        return;
      }

      if (!resp.body) {
        emit('error', {
          code: 'NO_BODY',
          message: 'response has no body',
          retryable: false,
        });
        emit('done', {});
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        // SSE 事件块通过 "\n\n" 分隔
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          const lines = block.split('\n');
          let eventName = 'message';
          let dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
          }
          if (!dataLines.length) continue;
          const dataStr = dataLines.join('\n');
          let payload: unknown = dataStr;
          try {
            payload = JSON.parse(dataStr);
          } catch {
            /* keep as string */
          }
          emit(eventName, payload);
        }
      }
      // 流自然结束
      emit('done', {});
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        emit('done', {});
        return;
      }
      emit('error', {
        code: 'NETWORK_ERROR',
        message: (err as Error).message,
        retryable: true,
      });
      emit('done', {});
    }
  })();

  return {
    on,
    abort: () => controller.abort(),
  } as SseStream<TFinal>;
}

// 该未使用 generator 仅用于类型占位避免 dead code 警告
void parseSseChunks;
