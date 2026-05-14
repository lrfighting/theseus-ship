import type { Branch } from '@shared/types/story';

/**
 * 拼接「当前读者已读」正文：可见范围内的原文 + 当前链路上已提交的续写（按顺序）。
 * 用于分支续写 prompt，模型须在该文本自然结束之后接着写。
 */
export function buildFullPrecedingNarrative(
  paragraphs: string[],
  truncation: { paragraphIndex: number } | null,
  branchesInOrder: Branch[],
  endAtOriginalParagraphInclusive?: number,
): string {
  if (paragraphs.length === 0) return '';

  const lastVisible =
    truncation != null
      ? Math.min(truncation.paragraphIndex, paragraphs.length - 1)
      : paragraphs.length - 1;

  let paraEnd = Math.max(0, lastVisible);
  if (endAtOriginalParagraphInclusive !== undefined) {
    paraEnd = Math.min(endAtOriginalParagraphInclusive, lastVisible);
  }

  const orig = paragraphs.slice(0, paraEnd + 1).join('\n\n');
  const ai = branchesInOrder
    .filter((b) => b.branch_type !== 'extra')
    .map((b) => (b.generated_content ?? '').trim())
    .filter(Boolean)
    .join('\n\n');

  return [orig, ai].filter(Boolean).join('\n\n');
}
