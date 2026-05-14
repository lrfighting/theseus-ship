/**
 * 《逃离灵山》预设关键节点与选项（产品稿），用于前端展示时覆盖 AI 结果。
 * 段落锚点通过正文检索定位；若正文与预设不符则返回 null，回退为服务端 key_nodes。
 */

import { getParagraphs } from '../services/storyAi';
import type { BranchOption, KeyNode, StoryDetail } from '@shared/types/story';

const PRESET_WORK_IDS = new Set(['1622619372492722176']);

export function isEscapeLingshanPresetStory(story: Pick<StoryDetail, 'chapter_name' | 'work_id'>): boolean {
  const name = (story.chapter_name ?? '').trim();
  if (PRESET_WORK_IDS.has(story.work_id)) return true;
  return name.includes('逃离灵山');
}

type PresetDef = {
  node_id: string;
  title: string;
  summary: string;
  needles: string[];
  options: { tone: string; text: string }[];
};

const PRESET_DEFS: PresetDef[] = [
  {
    node_id: 'preset_lingshan_1',
    title: '师父的告诫',
    summary:
      '师父玄奘金光四溢，却说出自相矛盾的话。作为白龙马，你内心充满疑惑——该信哪一句？师父是否也已入魔？',
    needles: ['进大雷音寺前', '诸佛早已堕入魔道', '我的话也不能完全相信'],
    options: [
      {
        tone: '全然听信',
        text:
          '全然听信 —— 严格遵守「四不」原则（不吃、不听、不看、不喝），并暗中观察师父和师兄。',
      },
      {
        tone: '选择性相信',
        text:
          '选择性相信 —— 相信师父前半句「灵山是魔窟」，但不信「我的话不能全信」，准备找机会提醒大师兄。',
      },
      {
        tone: '反向思考',
        text:
          '反向思考 —— 认为师父已入魔，他的警告可能是陷阱。你决定反其道而行，主动接触灵山的一切，寻找真相。',
      },
    ],
  },
  {
    node_id: 'preset_lingshan_2',
    title: '大雄宝殿的真相',
    summary:
      '幻象破碎，你看到大殿实为魔窟，如来笑声妖异。师父的声音也变得似男非女。此刻，你该怎么做？',
    needles: [
      '整个大殿的魔气都随着他的笑声颤动',
      '这哪里有佛光？四处魔气冲天，一片暗红色',
      '这哪里有佛光',
      '中央的如来哈哈一笑',
      '我回过神来，往四周一看',
    ],
    options: [
      {
        tone: '大声揭穿',
        text:
          '大声揭穿 —— 不顾修为差距，嘶鸣警示师父和师兄：「这里全是魔，快逃！」（可能激怒诸魔）',
      },
      {
        tone: '暗中传音',
        text:
          '暗中传音 —— 使用龙族秘法，只将真实景象悄悄告诉大师兄（孙悟空），看他如何反应。',
      },
      {
        tone: '隐忍观察',
        text: '隐忍观察 —— 假装什么也没看见，继续扮演温顺脚力，等待脱离大殿后再做打算。',
      },
    ],
  },
  {
    node_id: 'preset_lingshan_3',
    title: '斋饭之劫',
    summary:
      '二师兄猪八戒假装狂吃，实则暗示你含肉再吐出。但你也看到那些血肉能诱人入魔。你该如何应对？',
    needles: ['二位尊者在一旁面露不善', '满嘴血迹', '开膛破肚的婴孩'],
    options: [
      {
        tone: '听从二师兄',
        text:
          '听从二师兄 —— 配合他演戏，咬一块肉含在嘴里，趁人不备吐出（正如原文二师兄所教）。',
      },
      {
        tone: '坚决不碰',
        text:
          '坚决不碰 —— 装病倒地，说自己「水土不服，闻不得荤腥」，无论尊者如何逼迫也不张口。',
      },
      {
        tone: '暗中破坏',
        text: '暗中破坏 —— 趁乱用龙尾扫翻几盘「菜肴」，制造混乱，让大家都无法进食。',
      },
    ],
  },
  {
    node_id: 'preset_lingshan_4',
    title: '二师兄的托付',
    summary:
      '二师兄承认自己吃了血肉，已入魔。他将九齿钉耙和玉梳交给你，托你逃出灵山送信。你接过宝物，但接下来怎么做？',
    needles: ['小白龙，俺老猪已经堕入魔道', '梳子带给高老庄的翠兰', '逃出灵山后把这个梳子'],
    options: [
      {
        tone: '独自逃生',
        text:
          '接受托付，独自逃生 —— 承诺完成嘱托，趁灵山混乱之际，变回龙身冲上云霄逃离。',
      },
      {
        tone: '劝二师兄反抗',
        text:
          '劝二师兄反抗 —— 告诉他「或许天庭有救法」，提议联手救出师父，再用钉耙打破魔气结界。',
      },
      {
        tone: '怀疑并试探',
        text:
          '怀疑并试探 —— 怀疑二师兄也被调包，假装答应，实际暗中用钉耙试探他是否还有神智（如果他不认识钉耙用法，便是魔）。',
      },
    ],
  },
];

function paragraphContains(p: string, needle: string): boolean {
  const n = needle.trim();
  if (!n) return false;
  if (p.includes(n)) return true;
  const pNorm = p.replace(/\s/g, '');
  const nNorm = n.replace(/\s/g, '');
  return pNorm.includes(nNorm);
}

/**
 * 按 needle 长度降序尝试、再在正文里自上而下找首段命中。
 * 避免「魔气冲天」等短句误匹配到更早段落。
 */
function paragraphIndexForNeedles(paragraphs: string[], needles: string[]): number {
  const sorted = [...needles]
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const n of sorted) {
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i] ?? '';
      if (paragraphContains(p, n)) return i;
    }
  }
  return -1;
}

function longestMatchingNeedleInParagraph(paragraph: string, needles: string[]): string {
  const sorted = [...needles]
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    if (paragraphContains(paragraph, n)) return n;
  }
  return '';
}

function defToKeyNode(def: PresetDef, paragraphIndex: number, paragraph: string): KeyNode {
  const hitNeedle = longestMatchingNeedleInParagraph(paragraph, def.needles);
  let anchor_text = paragraph.slice(0, 36);
  if (hitNeedle) {
    const direct = paragraph.indexOf(hitNeedle);
    if (direct >= 0) anchor_text = paragraph.slice(direct, direct + 36);
    else {
      const pNorm = paragraph.replace(/\s/g, '');
      const nNorm = hitNeedle.replace(/\s/g, '');
      const idx = pNorm.indexOf(nNorm);
      if (idx >= 0) {
        let normPos = 0;
        for (let i = 0; i < paragraph.length; i++) {
          if (!/\s/.test(paragraph[i]!)) {
            if (normPos === idx) {
              anchor_text = paragraph.slice(i, i + 36);
              break;
            }
            normPos += 1;
          }
        }
      }
    }
  }

  const branch_options: BranchOption[] = def.options.map((o, i) => ({
    option_id: `${def.node_id}_opt_${i + 1}`,
    text: o.text,
    tone: o.tone,
  }));

  return {
    node_id: def.node_id,
    title: def.title,
    summary: def.summary,
    importance: 'main',
    node_type: 'plot_hook',
    source: 'original',
    depth: 0,
    parent_branch_id: null,
    paragraph_index: paragraphIndex,
    anchor_text,
    quote_hash: '',
    confidence: 1,
    branch_options,
  };
}

/**
 * 若当前作品为《逃离灵山》且正文能命中全部锚点，返回 4 个预设节点；否则 null。
 */
export function buildEscapeLingshanPresetKeyNodes(story: StoryDetail): KeyNode[] | null {
  if (!isEscapeLingshanPresetStory(story)) return null;
  const paragraphs = getParagraphs(story.content ?? '');
  if (paragraphs.length === 0) return null;

  const indices: number[] = [];
  for (const def of PRESET_DEFS) {
    const pi = paragraphIndexForNeedles(paragraphs, def.needles);
    if (pi < 0) return null;
    indices.push(pi);
  }

  const out: KeyNode[] = [];
  for (let i = 0; i < PRESET_DEFS.length; i++) {
    const def = PRESET_DEFS[i]!;
    const pi = indices[i]!;
    out.push(defToKeyNode(def, pi, paragraphs[pi] ?? ''));
  }
  return out;
}
