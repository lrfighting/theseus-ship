/**
 * 9 个故事的预设关键节点与选项（本地 mock，覆盖 AI 生成结果）。
 *
 * 设计原则：
 *  - needles 用于在正文中定位段落，优先放该段落独有的长句。
 *  - options 的 text 格式：标题——具体描述（20-40 字），用中文破折号分隔。
 *  - 避免"仍处在/语境/仍基于"等垃圾模板，每个选项体现具体行动或态度。
 */

import { getParagraphs } from '../services/storyAi';
import type { BranchOption, KeyNode, StoryDetail } from '@shared/types/story';
import { buildEscapeLingshanPresetKeyNodes, isEscapeLingshanPresetStory } from './escapeLingshanPresetKeyNodes';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

type PresetDef = {
  node_id: string;
  title: string;
  summary: string;
  importance: 'main' | 'side';
  node_type: string;
  needles: string[];
  options: { tone: string; text: string }[];
};

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function paragraphContains(p: string, needle: string): boolean {
  const n = needle.trim();
  if (!n) return false;
  if (p.includes(n)) return true;
  const pNorm = p.replace(/\s/g, '');
  const nNorm = n.replace(/\s/g, '');
  return pNorm.includes(nNorm);
}

function paragraphIndexForNeedles(paragraphs: string[], needles: string[]): number {
  const sorted = [...needles]
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const n of sorted) {
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphContains(paragraphs[i]!, n)) return i;
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
    importance: def.importance,
    node_type: def.node_type,
    source: 'original',
    depth: 0,
    parent_branch_id: null,
    paragraph_index: paragraphIndex,
    char_range: [0, Math.min(anchor_text.length, 36)],
    anchor_text: anchor_text.slice(0, 36),
    quote_hash: '',
    confidence: 0.95,
    branch_options,
  };
}

// ═══════════════════════════════════════════════════════════════
// 故事 1：人脸解锁失败（悬疑惊悚）
// work_id: 1487746545537290240
// ═══════════════════════════════════════════════════════════════

const STORY_1_PRESETS: PresetDef[] = [
  {
    node_id: 's1_node_1',
    title: '红绣花鞋',
    summary: '凌晨三点，你发现闯入者脚上穿着一双老式红绣花鞋。此刻手机在客厅充电，你独自面对危险。',
    importance: 'main',
    node_type: 'conflict',
    needles: ['她的脚上，穿着一双红色的绣花鞋', '老式绣花鞋', '现在已经没人穿了'],
    options: [
      { tone: '冲突升级', text: '大声呵斥——猛地开灯大声质问对方身份，试图用气势吓退闯入者' },
      { tone: '稳健', text: '悄然报警——屏住呼吸退回卧室反锁房门，用手机静音拨打报警电话' },
      { tone: '意外反转', text: '假装梦游——揉着眼睛装作梦游走向对方，趁其不备夺下尖刀' },
    ],
  },
  {
    node_id: 's1_node_2',
    title: '外婆的疑问',
    summary: '外婆突然问出"你是谁"，仿佛不认识你。是病情加重，还是她看到了什么你没看到的东西？',
    importance: 'side',
    node_type: 'revelation',
    needles: ['「你是谁，你怎么在这里？」', '外婆问出了同样的问题'],
    options: [
      { tone: '稳健', text: '安抚外婆——轻声安抚外婆情绪，趁机观察屋内是否还有异常' },
      { tone: '试探', text: '追问细节——反问外婆"你看到了谁"，试图从她口中获取闯入者信息' },
      { tone: '意外反转', text: '假装陌生人——顺着外婆的话演戏，试探外婆是否被"什么东西"附身' },
    ],
  },
  {
    node_id: 's1_node_3',
    title: '噩梦还是现实',
    summary: '你一度以为这只是噩梦，但身上的冷汗和真实的恐惧告诉你并非如此。该相信自己还是逃避？',
    importance: 'side',
    node_type: 'emotional',
    needles: ['正当我以为那只是一个可怕的噩梦的时候'],
    options: [
      { tone: '稳健', text: '掐醒自己——用力掐手臂确认不是梦境，强迫自己冷静思考对策' },
      { tone: '逃避', text: '自我催眠——告诉自己"这是梦快醒来"，缩回被子等待一切消失' },
      { tone: '冲突升级', text: '破釜沉舟——既然分不清梦境现实，干脆豁出去直面那个穿红鞋的女人' },
    ],
  },
  {
    node_id: 's1_node_4',
    title: '攥紧的拳头',
    summary: '你死死攥紧拳头，指甲嵌入掌心。恐惧和愤怒交织，你必须做出选择：逃、战，还是另寻他路？',
    importance: 'main',
    node_type: 'action',
    needles: ['我焦急地死死攥紧拳头'],
    options: [
      { tone: '稳健', text: '隐忍观察——保持姿势不动，用余光扫视房间寻找可用的防身武器' },
      { tone: '冲突升级', text: '主动出击——抄起 bedside 台灯砸向对方，先下手为强争取逃生时间' },
      { tone: '意外反转', text: '以退为进——突然瘫软在地假装昏倒，降低对方戒心伺机反击' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 故事 2：燕子（原生家庭）
// work_id: 1609568601303859200
// ═══════════════════════════════════════════════════════════════

const STORY_2_PRESETS: PresetDef[] = [
  {
    node_id: 's2_node_1',
    title: '给哥哥炒饭',
    summary: '小学时每天回家给哥哥炒饭，自己却只能吃剩饭。这种不公平的待遇，你该如何面对？',
    importance: 'side',
    node_type: 'emotional',
    needles: ['小学是回家吃午饭的，我要给哥哥炒饭'],
    options: [
      { tone: '稳健', text: '默默承受——像往常一样做好饭，把委屈咽进肚里不声张' },
      { tone: '冲突升级', text: '当场质问——放下锅铲问妈妈"为什么哥哥不用做我只用做"' },
      { tone: '意外反转', text: '故意做差——把哥哥的饭炒糊，试探家人会不会因此责怪自己' },
    ],
  },
  {
    node_id: 's2_node_2',
    title: '迷失的夸赞',
    summary: '众人夸赞你懂事，直到长大后才醒悟：为什么"懂事"的总是你？这种认知觉醒让你痛苦。',
    importance: 'main',
    node_type: 'revelation',
    needles: ['那时我迷失在众人一声声夸赞里', '为什么是我'],
    options: [
      { tone: '冲突升级', text: '当众揭穿——在家庭聚会中指出多年来的不公，让所有人下不来台' },
      { tone: '稳健', text: '暗自改变——不再无条件付出，开始拒绝那些"理所当然"的要求' },
      { tone: '关系扩展', text: '寻求帮助——把心事告诉大伯，请求他出面和父母谈谈' },
    ],
  },
  {
    node_id: 's2_node_3',
    title: '五块钱的差距',
    summary: '爸妈给了你五块钱，却给哥哥和妹妹更多。这不只是钱的差距，是爱与关注的差距。',
    importance: 'side',
    node_type: 'emotional',
    needles: ['爸妈都要赚钱，给了我五块钱'],
    options: [
      { tone: '稳健', text: '接受现实——默默收下五块钱，心里记下这笔账日后独立了再算' },
      { tone: '冲突升级', text: '当场拒绝——把钱推回去说"我不要你们的施舍"，摔门而去' },
      { tone: '意外反转', text: '以退为进——收下钱但从此不再开口要任何东西，用冷漠制造愧疚' },
    ],
  },
  {
    node_id: 's2_node_4',
    title: '墙上的奖状',
    summary: '演讲比赛二等奖，奖状在墙上贴了一年多，却换不来一句真心的夸奖。你的努力，值得被看见。',
    importance: 'main',
    node_type: 'emotional',
    needles: ['演讲比赛我获了二等奖', '奖状在墙上贴一年多'],
    options: [
      { tone: '稳健', text: '继续证明自己——用更优异的成绩让所有人不得不承认自己的价值' },
      { tone: '冲突升级', text: '撕下奖状——当众撕下奖状质问父母"我做到这样你们还不满意吗"' },
      { tone: '关系扩展', text: '转移战场——把精力投入学校社团和兴趣班，在外部世界寻找认可' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 故事 3：逃离灵山（已有独立预设文件，直接复用）
// work_id: 1622619372492722176
// ═══════════════════════════════════════════════════════════════

// 见 escapeLingshanPresetKeyNodes.ts

// ═══════════════════════════════════════════════════════════════
// 故事 4：秦始皇登月计划（穿越爽文）
// work_id: 1644038836790169600
// ═══════════════════════════════════════════════════════════════

const STORY_4_PRESETS: PresetDef[] = [
  {
    node_id: 's4_node_1',
    title: '好感度系统',
    summary: '你发现自己自带好感度系统，可以兑换物品。但初始好感度为负，秦始皇随时可能赐死你。',
    importance: 'main',
    node_type: 'turning_point',
    needles: ['好感度越高，能兑换的物品就越多'],
    options: [
      { tone: '稳健', text: '先刷好感——献上小恩小惠，每天变着法子讨好秦始皇身边的近侍' },
      { tone: '冲突升级', text: '孤注一掷——直接兑换西地那非声称是仙丹，赌上性命一搏' },
      { tone: '意外反转', text: '反向操作——故意惹怒秦始皇再救他，制造"救命之恩"的戏剧反差' },
    ],
  },
  {
    node_id: 's4_node_2',
    title: '死马当活马医',
    summary: '秦始皇病危，太医束手无策。你手中有系统兑换的现代药物，但没有任何人相信你。',
    importance: 'main',
    node_type: 'action',
    needles: ['哪怕是死马当活马医', '先把秦始皇的命保下来再说'],
    options: [
      { tone: '稳健', text: '暗中下药——趁太医不注意把药混入汤中，不声张不邀功' },
      { tone: '冲突升级', text: '当众请命——跪求秦始皇给自己一次机会，失败则甘愿受死' },
      { tone: '意外反转', text: '嫁祸太医——声称太医开的药方有误，借机展示自己的"医术"' },
    ],
  },
  {
    node_id: 's4_node_3',
    title: '秦始皇的倦意',
    summary: '秦始皇满脸倦意摆了摆手，对你的"仙丹"半信半疑。这一刻决定了你能不能留在他身边。',
    importance: 'side',
    node_type: 'emotional',
    needles: ['秦始皇满脸倦意，摆了摆手'],
    options: [
      { tone: '稳健', text: '适可而止——退下不再纠缠，用行动等药效显现后再来证明' },
      { tone: '冲突升级', text: '跪地不起——长跪不起以死明志，用极端姿态逼秦始皇给个机会' },
      { tone: '关系扩展', text: '拉拢赵高——私下找赵高合作，让他帮忙在秦始皇面前美言几句' },
    ],
  },
  {
    node_id: 's4_node_4',
    title: '信任建立',
    summary: '药效显现，秦始皇说"看来你没有骗朕"。你终于获得了初步信任，但这也意味着更大的责任和风险。',
    importance: 'main',
    node_type: 'revelation',
    needles: ['看来你没有骗朕，此药确实有效'],
    options: [
      { tone: '稳健', text: '趁热打铁——立刻献上世界地图和华夏史，巩固"先知"人设' },
      { tone: '冲突升级', text: '狮子大开口——趁机索要官职和权力，为后续登月计划铺路' },
      { tone: '意外反转', text: '欲擒故纵——故意推辞说"小道不敢居功"，引发秦始皇更大的好奇和信任' },
    ],
  },
  {
    node_id: 's4_node_5',
    title: '新的追问',
    summary: '秦始皇忽然又问道。他的问题意味着你的知识储备即将见底，一个答不上来就可能前功尽弃。',
    importance: 'side',
    node_type: 'plot_hook',
    needles: ['可没想到秦始皇忽然又问道'],
    options: [
      { tone: '稳健', text: '含糊其辞——用"天机不可泄露"搪塞，把解释权抓在自己手里' },
      { tone: '冲突升级', text: '编造答案——硬着头皮编造一个看似合理的解释，赌秦始皇不懂' },
      { tone: '意外反转', text: '反客为主——反问秦始皇"陛下觉得呢"，把问题抛回去争取思考时间' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 故事 5：老婆孩子在天堂（社会悬疑）
// work_id: 1748658750670757888
// ═══════════════════════════════════════════════════════════════

const STORY_5_PRESETS: PresetDef[] = [
  {
    node_id: 's5_node_1',
    title: '火灾次日注册微博',
    summary: '你发现男主在火灾次日就注册了微博，深情人设的背后是精心计算的运营。该曝光还是继续深挖？',
    importance: 'main',
    node_type: 'revelation',
    needles: ['火灾次日即注册微博', '深情人设席卷网络'],
    options: [
      { tone: '冲突升级', text: '全网曝光——立刻整理证据发到各大平台，让舆论反噬这个"深情人"' },
      { tone: '稳健', text: '暗中调查——不轻举妄动，联系其他受害者家属和记者联合深挖' },
      { tone: '意外反转', text: '接近试探——伪装成粉丝接近男主，从内部获取更多一手证据' },
    ],
  },
  {
    node_id: 's5_node_2',
    title: '兄弟堂的秘密',
    summary: '男主加入了神秘组织"兄弟堂"。这个组织与火灾是否有联系？你是否要追查下去？',
    importance: 'side',
    node_type: 'plot_hook',
    needles: ['加入神秘组织「兄弟堂」', '捐赠疑似'],
    options: [
      { tone: '稳健', text: '外围调查——从兄弟堂公开活动和成员入手，寻找与男主的关联证据' },
      { tone: '冲突升级', text: '潜入调查——设法加入兄弟堂或派人卧底，直接获取内部信息' },
      { tone: '意外反转', text: '反向利用——故意在社交媒体上放出风声，逼兄弟堂和男主自乱阵脚' },
    ],
  },
  {
    node_id: 's5_node_3',
    title: '捐赠疑云',
    summary: '男主声称把赔偿款捐出，但资金流向可疑。是真心慈善还是洗白手段？你要怎么证明？',
    importance: 'main',
    node_type: 'action',
    needles: ['捐赠疑似', '巨额赔偿与商业成功'],
    options: [
      { tone: '稳健', text: '财务追踪——申请公开慈善机构的账目，追踪每一笔资金的最终去向' },
      { tone: '冲突升级', text: '实名举报——向税务机关和慈善监管部门实名举报，要求彻查' },
      { tone: '意外反转', text: '设局取证——以捐助者身份联系慈善机构，套取资金流向的真实信息' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 故事 6：郾城之战（历史军事）
// work_id: 1781367684632399872
// ═══════════════════════════════════════════════════════════════

const STORY_6_PRESETS: PresetDef[] = [
  {
    node_id: 's6_node_1',
    title: '请缨北伐',
    summary: '金军二十余万分四路南下，宋高宗被迫应战。岳飞主动请缨，但朝中主和派极力阻挠。',
    importance: 'main',
    node_type: 'turning_point',
    needles: ['岳飞主动请缨', '率岳家军北上迎击'],
    options: [
      { tone: '稳健', text: '稳扎稳打——按兵不动等待朝廷正式调令，避免给政敌留下把柄' },
      { tone: '冲突升级', text: '先斩后奏——不待圣旨直接率军北上，以战功逼朝廷认可' },
      { tone: '关系扩展', text: '联合上书——联合主战派大臣共同上奏，以舆论压力迫使皇帝下令' },
    ],
  },
  {
    node_id: 's6_node_2',
    title: '蔡州首战',
    summary: '岳家军于蔡州城外与金将韩常前锋首次交锋。金军步骑混编战力倍增，这一战关乎士气。',
    importance: 'main',
    node_type: 'conflict',
    needles: ['蔡州城外与金将韩常前锋部队首次交锋', '步骑混编战力倍增'],
    options: [
      { tone: '稳健', text: '诱敌深入——佯装败退诱敌入伏击圈，以地形抵消金军骑兵优势' },
      { tone: '冲突升级', text: '正面迎击——以岳家军精锐背嵬军硬撼金军前锋，一战立威' },
      { tone: '意外反转', text: '夜袭敌营——趁夜色派死士潜入敌营烧毁粮草，不战而溃敌军心' },
    ],
  },
  {
    node_id: 's6_node_3',
    title: '十二道金牌',
    summary: '（待补充）宋高宗连发十二道金牌召岳飞班师。抗命则株连九族，遵命则十年心血毁于一旦。',
    importance: 'main',
    node_type: 'emotional',
    needles: ['十二道金牌', '班师回朝'],
    options: [
      { tone: '稳健', text: '含泪班师——接令回朝，留得青山在日后寻机再战' },
      { tone: '冲突升级', text: '拒不奉诏——撕毁金牌继续北伐，以收复失地的大义对抗皇命' },
      { tone: '意外反转', text: '假死脱身——派替身班师，自己率精锐化整为零继续游击抗金' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 故事 7：秦始皇登月计划（fixture 演示版）
// work_id: demo_001
// ═══════════════════════════════════════════════════════════════

const STORY_7_PRESETS: PresetDef[] = [
  {
    node_id: 's7_node_1',
    title: '呈上世界地图',
    summary: '你向秦始皇呈上世界地图，声称可以助他上天揽月。秦始皇好感度暴涨，但也引起了权臣的猜忌。',
    importance: 'main',
    node_type: 'turning_point',
    needles: ['陛下，此乃世界地图', '上天揽月'],
    options: [
      { tone: '稳健', text: '循序渐进——先完成几个小发明建立信任，再逐步推进登月计划' },
      { tone: '冲突升级', text: '画大饼——直接展示火箭草图，声称三月内可送陛下视察月宫' },
      { tone: '意外反转', text: '拉人下水——暗示李斯丞相也参与了计划，把权臣绑上同一条船' },
    ],
  },
  {
    node_id: 's7_node_2',
    title: '匠人质疑',
    summary: '匠人们围着登月草图反复演算，认为这不可能实现。你的权威受到挑战，必须做出回应。',
    importance: 'side',
    node_type: 'conflict',
    needles: ['匠人作坊', '登月草图反复演算'],
    options: [
      { tone: '稳健', text: '现场教学——召集匠人亲自讲解原理，用简易实验验证可行性' },
      { tone: '冲突升级', text: '以权压人——借秦始皇之名呵斥匠人，限期完成否则军法处置' },
      { tone: '意外反转', text: '激将法——当众说"大秦匠人不若楚人"，用民族荣誉感逼他们拼命' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════
// 故事 8 / 9：演示数据（空模板，待填充）
// work_id: demo_002 / demo_003
// ═══════════════════════════════════════════════════════════════

const STORY_8_PRESETS: PresetDef[] = [
  // TODO: 填入 demo_002 的关键节点
];

const STORY_9_PRESETS: PresetDef[] = [
  // TODO: 填入 demo_003 的关键节点
];

// ═══════════════════════════════════════════════════════════════
// 预设映射表
// ═══════════════════════════════════════════════════════════════

const PRESET_MAP: Record<string, PresetDef[]> = {
  '1487746545537290240': STORY_1_PRESETS,
  '1609568601303859200': STORY_2_PRESETS,
  '1644038836790169600': STORY_4_PRESETS,
  '1748658750670757888': STORY_5_PRESETS,
  '1781367684632399872': STORY_6_PRESETS,
  'demo_001': STORY_7_PRESETS,
  'demo_002': STORY_8_PRESETS,
  'demo_003': STORY_9_PRESETS,
};

// ═══════════════════════════════════════════════════════════════
// 对外接口
// ═══════════════════════════════════════════════════════════════

export function buildPresetKeyNodes(story: StoryDetail): KeyNode[] | null {
  // 故事 3（逃离灵山）走独立预设文件
  if (isEscapeLingshanPresetStory(story)) {
    return buildEscapeLingshanPresetKeyNodes(story);
  }

  const presets = PRESET_MAP[story.work_id];
  if (!presets || presets.length === 0) return null;

  const paragraphs = getParagraphs(story.content);
  const nodes: KeyNode[] = [];

  for (const def of presets) {
    const pi = paragraphIndexForNeedles(paragraphs, def.needles);
    if (pi < 0) continue;
    nodes.push(defToKeyNode(def, pi, paragraphs[pi]!));
  }

  return nodes.length > 0 ? nodes : null;
}
