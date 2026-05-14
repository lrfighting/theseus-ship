/**
 * V1.3 思维导图：从原来的"画板"升级为"分支切换中心"。
 *
 * 节点类型：
 *  - root：故事根（含书籍图标）
 *  - keypoint：原文关键节点（含序号徽章）
 *  - branch：用户生成的分支续写
 *  - continuation：从文末继续的续写层
 *  - terminal：达到最大深度或自然收束
 *
 * 视觉规则：
 *  - 当前链路：高饱和 + 流动连线
 *  - 其他链路：低饱和 + 虚线连线
 *  - generating：节点边缘脉冲动画 + 右上 spinner
 *  - ready_to_switch：右上勾选徽章
 */

import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  Flag,
  GitBranch,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import type { Branch, KeyNode, Lineage, StoryDetail } from '@shared/types/story';

type NodeVariant = 'root' | 'keypoint' | 'branch' | 'continuation' | 'terminal';

interface FlowNodeData extends Record<string, unknown> {
  label: string;
  variant: NodeVariant;
  active: boolean;
  /** 节点状态：生成中 / 已完成可切回 */
  taskState?: 'generating' | 'ready_to_switch';
  canAdd?: boolean;
  paragraphIndex?: number;
  /** 原文 keypoint 的章节序号（从 1 起） */
  index?: number;
  /** 当前 lineage 的"最末端"节点（正文当前进度所在） */
  isCurrent?: boolean;
  /** 当前 lineage 的分叉点（正文从这里开始走 AI 续写） */
  isForkPoint?: boolean;
  /** 该节点描述当前剧情如何走向（hover/select 时显示） */
  hint?: string;
}

type StoryFlowNode = Node<FlowNodeData>;

interface StoryMindMapProps {
  story: StoryDetail;
  keyNodes: KeyNode[];
  branches: Branch[];
  lineages: Lineage[];
  currentLineageId: string | null;
  selectedNodeId?: string | null;
  interactive?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  /** 点击非当前链路上的节点 → 切换链路 */
  onRequestSwitchLineage?: (lineageId: string, targetBranchId: string) => void;
  /** 点击当前链路上的节点 → 仅滚动 */
  onJumpToNode?: (nodeId: string) => void;
  /** 在关键节点上 + 按钮 → 触发分支选择 */
  onRequestAddBranch?: (nodeId: string) => void;
  onClose?: () => void;
  onExpand?: () => void;
}

function NodeIcon({ variant }: { variant: NodeVariant }) {
  switch (variant) {
    case 'root':
      return <BookOpen size={13} />;
    case 'keypoint':
      return <Bookmark size={12} />;
    case 'terminal':
      return <Flag size={12} />;
    case 'branch':
    case 'continuation':
    default:
      return <GitBranch size={12} />;
  }
}

function FlowNodeView({ data, selected, id }: NodeProps<StoryFlowNode>) {
  const indexBadge =
    data.variant === 'keypoint' && data.index !== undefined
      ? String(data.index).padStart(2, '0')
      : null;

  const classNames = [
    'flow-node',
    data.variant,
    selected ? 'selected' : '',
    data.active ? 'active-lineage' : 'inactive-lineage',
    data.taskState ?? '',
    data.isCurrent ? 'is-current' : '',
    data.isForkPoint ? 'is-fork-point' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classNames}>
      <Handle type="target" position={Position.Left} id="l" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} id="t" style={{ opacity: 0 }} />

      {indexBadge && <span className="flow-node-index">{indexBadge}</span>}

      <span className="flow-node-icon" aria-hidden>
        <NodeIcon variant={data.variant} />
      </span>

      <span className="flow-node-label" title={data.hint ? `${data.label}\n${data.hint}` : data.label}>
        {data.label}
      </span>

      {data.isCurrent && (
        <span className="flow-node-marker current" aria-label="当前阅读分支">
          当前
        </span>
      )}
      {data.isForkPoint && !data.isCurrent && (
        <span className="flow-node-marker fork" aria-label="当前剧情分叉点">
          分叉
        </span>
      )}

      {data.taskState === 'generating' && (
        <span className="node-state-pill generating" title="生成中">
          <Loader2 size={10} />
        </span>
      )}
      {data.taskState === 'ready_to_switch' && (
        <span className="node-state-pill ready" title="该链路有更新，点击切换">
          <CheckCircle2 size={10} />
        </span>
      )}
      {data.canAdd && (
        <button
          className="plus-btn"
          aria-label="新增分支"
          data-add-id={id}
          onClick={(event) => event.stopPropagation()}
          title="基于该节点新增分支"
        >
          <Plus size={12} />
        </button>
      )}
      <Handle type="source" position={Position.Right} id="r" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { storyNode: FlowNodeView };

const COL_GAP = 340;           // 主线 keypoint 之间的横向间距
const ROW_HEIGHT = 116;        // 同一子树内每"行"占用的纵向空间
const FIRST_ROW_OFFSET = 132;  // keypoint 主线到下方第一行子分支的距离
const MIN_GAP = 50;            // 父子节点之间的最小安全间隙

function FitViewOnChange({ trigger, padding }: { trigger: string; padding?: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const id = window.setTimeout(() => {
      fitView({ padding: padding ?? 0.22, duration: 320 });
    }, 40);
    return () => window.clearTimeout(id);
  }, [trigger, fitView, padding]);
  return null;
}

export default function StoryMindMap({
  story,
  keyNodes,
  branches,
  lineages,
  currentLineageId,
  selectedNodeId,
  interactive = false,
  onSelectNode,
  onRequestSwitchLineage,
  onJumpToNode,
  onRequestAddBranch,
  onClose,
  onExpand,
}: StoryMindMapProps) {
  const activeBranchIds = useMemo(() => {
    const lineage = lineages.find((l) => l.lineage_id === currentLineageId);
    return new Set(lineage?.branch_ids ?? []);
  }, [lineages, currentLineageId]);

  /**
   * 当前 lineage 的轨迹：
   *  - tipBranchId：lineage 末端分支（"当前阅读位置"在脑图上的锚点）
   *  - forkSourceNodeId：lineage 第一个 node_branch 的 source_node_id（即"主线分叉点"）
   */
  const { tipBranchId, forkSourceNodeId } = useMemo(() => {
    const lineage = lineages.find((l) => l.lineage_id === currentLineageId);
    if (!lineage || lineage.branch_ids.length === 0) {
      return { tipBranchId: null as string | null, forkSourceNodeId: null as string | null };
    }
    const tip = lineage.branch_ids[lineage.branch_ids.length - 1] ?? null;
    const firstNodeBranchId = lineage.branch_ids.find((bid) => {
      const b = branches.find((x) => x.branch_id === bid);
      return b && b.branch_type !== 'extra' && b.branch_type === 'node_branch';
    });
    const firstBranch = firstNodeBranchId
      ? branches.find((b) => b.branch_id === firstNodeBranchId) ?? null
      : null;
    return {
      tipBranchId: tip,
      forkSourceNodeId: firstBranch?.source_node_id ?? null,
    };
  }, [lineages, currentLineageId, branches]);

  const branchToLineage = useMemo(() => {
    const map = new Map<string, string>();
    for (const lineage of lineages) {
      for (const bid of lineage.branch_ids) {
        if (!map.has(bid)) map.set(bid, lineage.lineage_id);
      }
    }
    return map;
  }, [lineages]);

  const { nodes, edges } = useMemo(() => {
    const branchesNoExtra = branches.filter((b) => b.branch_type !== 'extra');
    const rootId = `root_${story.work_id}`;
    const flowNodes: StoryFlowNode[] = [
      {
        id: rootId,
        type: 'storyNode',
        position: { x: 0, y: 0 },
        data: {
          label: story.chapter_name || '故事起点',
          variant: 'root',
          active: true,
        },
        draggable: false,
      },
    ];
    const flowEdges: Edge[] = [];

    const originalNodes = keyNodes.filter((k) => k.source === 'original');
    const nodeById = new Map(keyNodes.map((k) => [k.node_id, k]));

    // 当前 lineage 在主线上的"前缀范围"。
    const forkIdxOnMain = forkSourceNodeId
      ? originalNodes.findIndex((n) => n.node_id === forkSourceNodeId)
      : -1;

    // ── 子分支树形布局（避免连线穿过其它分支）──
    // 每个分支占用纵向 "leafCount" 行；同 parent 的多个分支按子树高度依次堆叠。
    const childrenOf = (parentId: string) =>
      branchesNoExtra.filter((b) => b.parent_branch_id === parentId);

    const leafCountCache = new Map<string, number>();
    const leafCount = (branchId: string): number => {
      const cached = leafCountCache.get(branchId);
      if (cached !== undefined) return cached;
      const kids = childrenOf(branchId);
      const v = kids.length === 0 ? 1 : kids.reduce((acc, k) => acc + leafCount(k.branch_id), 0);
      leafCountCache.set(branchId, v);
      return v;
    };

    // ── 动态宽度估算（避免节点重叠）──
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '500 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    }
    const measure = (text: string) => ctx?.measureText(text).width ?? text.length * 8;

    function estimateNodeWidth(label: string, hasCurrentMarker: boolean): number {
      const base = 54; // padding(24) + icon(22) + gap(8)
      const marker = hasCurrentMarker ? 36 : 0;
      const textWidth = measure(label);
      return Math.min(Math.max(base + textWidth + marker, 132), 220);
    }

    const placedBridgeKeyIds = new Set<string>();
    const bridgeKeyPositions = new Map<string, { x: number; y: number }>();

    interface ParentRef {
      id: string;
      handle: 'b' | 'r';
    }

    /**
     * 在 [topY, topY + height) 区间内布局以 branch 为根的子树。
     * branch 自身放在该区间的纵向中心；它的所有 children 顺序堆叠在 branch 右侧。
     * 横向偏移基于父节点的实际预估宽度 + 安全间隙，防止节点重叠。
     */
    const placeBranchSubtree = (
      branch: Branch,
      parentX: number,
      parentWidth: number,
      topY: number,
      depth: number,
      parent: ParentRef,
    ) => {
      const height = leafCount(branch.branch_id) * ROW_HEIGHT;
      const gap = depth === 0 ? Math.max(MIN_GAP, 28) : MIN_GAP;
      const x = parentX + parentWidth + gap;
      const y = topY + height / 2 - ROW_HEIGHT / 2;
      const inActiveLineage = activeBranchIds.has(branch.branch_id);

      const sourceNode = branch.source_node_id ? nodeById.get(branch.source_node_id) : undefined;
      const sourceHint = sourceNode ? `来源节点：${sourceNode.title}` : undefined;
      const displayLabel =
        sourceNode && depth === 0
          ? `${sourceNode.title} · ${branch.choice_text}`
          : branch.choice_text;

      const currentWidth = estimateNodeWidth(
        displayLabel,
        branch.branch_id === tipBranchId,
      );

      flowNodes.push({
        id: branch.branch_id,
        type: 'storyNode',
        position: { x, y },
        data: {
          label: displayLabel,
          variant: branch.is_terminal
            ? 'terminal'
            : branch.branch_type === 'continuation'
              ? 'continuation'
              : 'branch',
          active: inActiveLineage,
          hint: sourceHint,
          isCurrent: branch.branch_id === tipBranchId,
          taskState:
            branch.status === 'generating' || branch.status === 'queued'
              ? 'generating'
              : !inActiveLineage && branch.status === 'success'
                ? 'ready_to_switch'
                : undefined,
        },
        draggable: false,
      });

      flowEdges.push({
        id: `e_${parent.id}_${branch.branch_id}`,
        source: parent.id,
        target: branch.branch_id,
        sourceHandle: parent.handle,
        targetHandle: 'l',
        type: 'smoothstep',
        animated: inActiveLineage,
        className: inActiveLineage ? 'lineage-active' : 'lineage-inactive',
      });

      // 递归布局子树（若子分支挂在 AI 续写关键节点上，则插入桥接节点）
      let cursor = topY;
      for (const kid of childrenOf(branch.branch_id)) {
        const kidHeight = leafCount(kid.branch_id) * ROW_HEIGHT;
        const bridgeKey =
          kid.source_node_id &&
          keyNodes.find(
            (kn) =>
              kn.node_id === kid.source_node_id &&
              kn.source === 'ai_continuation' &&
              kn.parent_branch_id === branch.branch_id,
          );
        if (bridgeKey) {
          const bridgeWidth = estimateNodeWidth(bridgeKey.title, false);
          const kx = x + currentWidth + MIN_GAP;
          if (!placedBridgeKeyIds.has(bridgeKey.node_id)) {
            placedBridgeKeyIds.add(bridgeKey.node_id);
            const ky = cursor + kidHeight / 2 - ROW_HEIGHT / 2;
            bridgeKeyPositions.set(bridgeKey.node_id, { x: kx, y: ky });
            flowNodes.push({
              id: bridgeKey.node_id,
              type: 'storyNode',
              position: { x: kx, y: ky },
              data: {
                label: bridgeKey.title,
                variant: 'keypoint',
                active: true,
                hint: '续写关键节点',
                isForkPoint: false,
              },
              draggable: false,
            });
            flowEdges.push({
              id: `e_${branch.branch_id}_bridge_${bridgeKey.node_id}`,
              source: branch.branch_id,
              target: bridgeKey.node_id,
              sourceHandle: 'r',
              targetHandle: 'l',
              type: 'smoothstep',
              animated: inActiveLineage,
              className: inActiveLineage ? 'lineage-active' : 'lineage-inactive',
            });
          }
          const kpos = bridgeKeyPositions.get(bridgeKey.node_id)!;
          placeBranchSubtree(kid, kpos.x, bridgeWidth, cursor, depth + 1, { id: bridgeKey.node_id, handle: 'b' });
        } else {
          placeBranchSubtree(kid, x, currentWidth, cursor, depth + 1, { id: branch.branch_id, handle: 'b' });
        }
        cursor += kidHeight;
      }
    };

    originalNodes.forEach((node, index) => {
      const x = (index + 1) * COL_GAP;
      const isForkPoint = forkSourceNodeId === node.node_id;
      flowNodes.push({
        id: node.node_id,
        type: 'storyNode',
        position: { x, y: 0 },
        data: {
          label: node.title,
          variant: 'keypoint',
          canAdd: interactive,
          paragraphIndex: node.paragraph_index,
          active: true,
          index: index + 1,
          isForkPoint,
        },
        draggable: false,
      });
      const isOnActiveTrunk = forkIdxOnMain >= 0 && index <= forkIdxOnMain;
      flowEdges.push({
        id: `e_${index === 0 ? rootId : originalNodes[index - 1].node_id}_${node.node_id}`,
        source: index === 0 ? rootId : originalNodes[index - 1].node_id,
        target: node.node_id,
        sourceHandle: 'r',
        targetHandle: 'l',
        type: 'smoothstep',
        animated: isOnActiveTrunk,
        className: isOnActiveTrunk ? 'lineage-active' : 'lineage-main',
      });

      // 该 keypoint 下挂着的分支按子树高度顺序堆叠
      // 只挂载 parent_branch_id 为 null 的分支（链路起点）；
      // continuation 等子分支通过 parent_branch_id 链递归挂载，形成链式结构。
      const nodeBranches = branchesNoExtra.filter(
        (b) => b.source_node_id === node.node_id && b.parent_branch_id === null,
      );
      const keypointWidth = estimateNodeWidth(node.title, false);
      let cursor = FIRST_ROW_OFFSET;
      for (const branch of nodeBranches) {
        const subtreeHeight = leafCount(branch.branch_id) * ROW_HEIGHT;
        placeBranchSubtree(branch, x, keypointWidth, cursor, 0, { id: node.node_id, handle: 'b' });
        cursor += subtreeHeight;
      }
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [
    story,
    keyNodes,
    branches,
    activeBranchIds,
    interactive,
    tipBranchId,
    forkSourceNodeId,
  ]);

  const styledNodes = useMemo<StoryFlowNode[]>(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [nodes, selectedNodeId],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: StoryFlowNode) => {
      if (!interactive) {
        onExpand?.();
        return;
      }
      onSelectNode(node.id);
      const lineageId = branchToLineage.get(node.id);
      if (lineageId && lineageId !== currentLineageId) {
        onRequestSwitchLineage?.(lineageId, node.id);
        return;
      }
      onJumpToNode?.(node.id);
    },
    [
      onSelectNode,
      interactive,
      onJumpToNode,
      onExpand,
      onRequestSwitchLineage,
      branchToLineage,
      currentLineageId,
    ],
  );

  const handlePaneClick = useCallback(() => {
    if (!interactive) {
      onExpand?.();
      return;
    }
    onSelectNode(null);
  }, [interactive, onSelectNode, onExpand]);

  const handleFlowClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const addBtn = target.closest('[data-add-id]') as HTMLElement | null;
      if (addBtn && onRequestAddBranch) {
        event.stopPropagation();
        const id = addBtn.getAttribute('data-add-id');
        if (id) onRequestAddBranch(id);
      }
    },
    [onRequestAddBranch],
  );

  useEffect(() => {
    if (!interactive || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interactive, onClose]);

  const fitTrigger = `${interactive ? 'i' : 'p'}-${nodes.length}-${edges.length}-${currentLineageId ?? ''}`;

  return (
    <div
      className={`mindmap-canvas ${interactive ? 'is-interactive' : 'is-preview'}`}
      style={{ width: '100%', height: '100%' }}
      onClick={handleFlowClick}
    >
      <div className="mindmap-aurora" aria-hidden />
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: interactive ? 0.18 : 0.06, includeHiddenNodes: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={interactive}
        panOnDrag={interactive}
        panOnScroll={false}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={interactive}
        preventScrolling={interactive}
        proOptions={{ hideAttribution: true }}
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.2} color="#c4d4ea" />
        {interactive && <Controls position="bottom-right" showInteractive={false} />}
        <FitViewOnChange trigger={fitTrigger} padding={interactive ? 0.18 : 0.06} />
      </ReactFlow>

      <div className="legend">
        <span className="legend-title">图例</span>
        <span className="legend-item legend-root">
          <span className="swatch" /> 故事起点
        </span>
        <span className="legend-item legend-keypoint">
          <span className="swatch" /> 原文节点
        </span>
        <span className="legend-item legend-branch">
          <span className="swatch" /> AI 分支
        </span>
        <span className="legend-item legend-continuation">
          <span className="swatch" /> 文末续写
        </span>
        <span className="legend-item legend-terminal">
          <span className="swatch" /> 收束
        </span>
      </div>

      {interactive && onClose && (
        <>
          <div className="fullscreen-hint">
            点击节点跳转或切换链路 · 按 <span className="kbd">Esc</span> 关闭
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            aria-label="关闭脑图"
          >
            <X size={18} />
          </button>
        </>
      )}
    </div>
  );
}
