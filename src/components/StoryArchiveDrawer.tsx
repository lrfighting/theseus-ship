import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Globe2,
  Heart,
  Network,
  Package,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type {
  CharacterProfile,
  ObjectProfile,
  RelationGraph,
  StorySummaryData,
  WorldContext,
} from '@shared/types/ai';
import type { BranchImpact } from '@shared/types/story';

type ArchiveTab = 'world' | 'characters' | 'relations' | 'objects' | 'impact';

interface ArchiveDrawerProps {
  open: boolean;
  onClose: () => void;
  summary?: StorySummaryData;
  world?: WorldContext;
  characters?: CharacterProfile[];
  relations?: RelationGraph;
  objects?: ObjectProfile[];
  impacts: BranchImpact[];
  readiness: Record<string, 'pending' | 'ready' | 'failed'>;
}

const TABS: { key: ArchiveTab; label: string; icon: typeof Globe2 }[] = [
  { key: 'world', label: '世界观', icon: Globe2 },
  { key: 'characters', label: '人物', icon: Users },
  { key: 'relations', label: '关系网', icon: Network },
  { key: 'objects', label: '物品', icon: Package },
  { key: 'impact', label: '当前分支影响', icon: Sparkles },
];

export default function StoryArchiveDrawer({
  open,
  onClose,
  summary,
  world,
  characters,
  relations,
  objects,
  impacts,
  readiness,
}: ArchiveDrawerProps) {
  const [tab, setTab] = useState<ArchiveTab>('world');

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="mask"
            className="archive-mask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            className="archive-drawer"
            initial={{ x: 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 0.8, 0.32, 1] }}
          >
            <header className="archive-head">
              <h3>
                <Heart size={16} /> 故事档案
              </h3>
              <button className="btn-icon" onClick={onClose} aria-label="关闭">
                <X size={16} />
              </button>
            </header>

            <nav className="archive-tabs">
              {TABS.map((t) => {
                const Icon = t.icon;
                const stateKey = t.key === 'impact' ? null : t.key === 'characters' ? 'characters' : t.key === 'objects' ? 'objects' : t.key === 'relations' ? 'relations' : 'world';
                const status = stateKey ? readiness[stateKey] : undefined;
                return (
                  <button
                    key={t.key}
                    className={`archive-tab ${tab === t.key ? 'active' : ''}`}
                    onClick={() => setTab(t.key)}
                  >
                    <Icon size={14} />
                    {t.label}
                    {status === 'pending' && <span className="dot pending" title="生成中" />}
                    {status === 'failed' && <span className="dot failed" title="生成失败" />}
                  </button>
                );
              })}
            </nav>

            <div className="archive-body">
              {tab === 'world' && (
                <WorldTab summary={summary} world={world} ready={readiness.world === 'ready'} />
              )}
              {tab === 'characters' && (
                <CharactersTab characters={characters} ready={readiness.characters === 'ready'} />
              )}
              {tab === 'relations' && (
                <RelationsTab
                  relations={relations}
                  characters={characters}
                  ready={readiness.relations === 'ready'}
                />
              )}
              {tab === 'objects' && (
                <ObjectsTab objects={objects} ready={readiness.objects === 'ready'} />
              )}
              {tab === 'impact' && <ImpactTab impacts={impacts} characters={characters} />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function PendingPlaceholder({ label }: { label: string }) {
  return <div className="archive-empty">{label}信息加载中…</div>;
}

function WorldTab({
  summary,
  world,
  ready,
}: {
  summary?: StorySummaryData;
  world?: WorldContext;
  ready: boolean;
}) {
  return (
    <div className="archive-content">
      {summary && (
        <section className="archive-section">
          <h4>故事摘要</h4>
          <p>{summary.story_summary}</p>
          <div className="chip-row">
            <span className="chip">基调：{summary.tone}</span>
            {summary.themes?.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        </section>
      )}
      {world ? (
        <>
          <section className="archive-section">
            <h4>宏观世界观</h4>
            <p>{world.world_summary}</p>
          </section>
          <section className="archive-section">
            <h4>核心冲突</h4>
            <p>{world.core_conflict}</p>
          </section>
          <section className="archive-section">
            <h4>分场景</h4>
            {world.scenes.length === 0 ? (
              <p className="muted">暂无</p>
            ) : (
              <ul className="archive-list">
                {world.scenes.map((s) => (
                  <li key={s.scene_id}>
                    <strong>{s.name}</strong>
                    <span className="muted">{s.time}</span>
                    <p>{s.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="archive-section">
            <h4>世界观规则</h4>
            <ul className="archive-list">
              {world.rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="archive-empty">世界观信息待生成</div>
      )}
    </div>
  );
}

function CharactersTab({
  characters,
  ready,
}: {
  characters?: CharacterProfile[];
  ready: boolean;
}) {
  if (!characters) return <div className="archive-empty">人物信息待生成</div>;
  if (characters.length === 0 && !ready) return <div className="archive-empty">人物信息待生成</div>;

  const mains = characters.filter((c) => c.type === 'main');
  const npcs = characters.filter((c) => c.type === 'npc');

  return (
    <div className="archive-content">
      <section className="archive-section">
        <h4>主要人物</h4>
        <ul className="archive-list">
          {mains.map((c) => (
            <CharacterCard key={c.character_id} c={c} />
          ))}
        </ul>
      </section>
      <section className="archive-section">
        <h4>NPC / 配角</h4>
        {npcs.length === 0 ? (
          <p className="muted">暂未识别 NPC。</p>
        ) : (
          <ul className="archive-list">
            {npcs.map((c) => (
              <CharacterCard key={c.character_id} c={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CharacterCard({ c }: { c: CharacterProfile }) {
  return (
    <li className="archive-character">
      <div className="row">
        <strong>{c.name}</strong>
        <span className="muted">{c.role}</span>
      </div>
      <p className="muted small">{c.personality}</p>
      <p>
        <span className="label">动机：</span>
        {c.motivation}
      </p>
      <p>
        <span className="label">说话风格：</span>
        {c.speech_style}
      </p>
      {c.background && (
        <p>
          <span className="label">背景：</span>
          {c.background}
        </p>
      )}
    </li>
  );
}

function RelationsTab({
  relations,
  characters,
  ready,
}: {
  relations?: RelationGraph;
  characters?: CharacterProfile[];
  ready: boolean;
}) {
  if (!relations) return <div className="archive-empty">关系网信息待生成</div>;
  if (relations.relations.length === 0 && !ready) return <div className="archive-empty">关系网信息待生成</div>;

  const idMap = new Map<string, string>();
  characters?.forEach((c) => idMap.set(c.character_id, c.name));

  return (
    <div className="archive-content">
      <ul className="archive-list">
        {relations.relations.map((r, i) => (
          <li key={i}>
            <strong>
              {idMap.get(r.from) ?? r.from} → {idMap.get(r.to) ?? r.to}
            </strong>
            <span className="chip ml">{r.relation}</span>
            {r.intensity && <span className="chip mute ml">{r.intensity}</span>}
            {r.description && <p className="muted">{r.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ObjectsTab({
  objects,
  ready,
}: {
  objects?: ObjectProfile[];
  ready: boolean;
}) {
  if (!objects) return <div className="archive-empty">物品信息待生成</div>;
  if (objects.length === 0 && !ready) return <div className="archive-empty">物品信息待生成</div>;

  return (
    <div className="archive-content">
      <ul className="archive-list">
        {objects.map((o) => (
          <li key={o.object_id}>
            <strong>{o.name}</strong>
            <span className="chip mute ml">{o.type}</span>
            <p>{o.description}</p>
            {o.current_owner && (
              <p className="muted small">当前持有人：{o.current_owner}</p>
            )}
            {o.story_role && <p className="muted small">剧情作用：{o.story_role}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImpactTab({
  impacts,
  characters,
}: {
  impacts: BranchImpact[];
  characters?: CharacterProfile[];
}) {
  if (impacts.length === 0) {
    return (
      <div className="archive-content">
        <p className="muted">当前你还没有做出任何选择。在原文关键节点处选择分支后，这里会展示由此引发的世界状态变化。</p>
      </div>
    );
  }
  const idMap = new Map<string, string>();
  characters?.forEach((c) => idMap.set(c.character_id, c.name));

  return (
    <div className="archive-content">
      {impacts.map((impact, idx) => (
        <section className="archive-section" key={impact.branch_id}>
          <h4>第 {idx + 1} 次选择带来的变化</h4>
          {impact.character_changes.length > 0 && (
            <div className="impact-group">
              <span className="impact-title">人物状态</span>
              <ul className="archive-list">
                {impact.character_changes.map((c, i) => (
                  <li key={i}>
                    <strong>{idMap.get(c.character_id) ?? c.character_id}：</strong>
                    {c.before} → {c.after}
                    {c.trigger && <span className="muted small"> · 触发：{c.trigger}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {impact.relation_changes.length > 0 && (
            <div className="impact-group">
              <span className="impact-title">关系变化</span>
              <ul className="archive-list">
                {impact.relation_changes.map((r, i) => (
                  <li key={i}>
                    {idMap.get(r.from) ?? r.from} → {idMap.get(r.to) ?? r.to}：{r.before} →{' '}
                    {r.after}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {impact.new_events.length > 0 && (
            <div className="impact-group">
              <span className="impact-title">新增事件</span>
              <ul className="archive-list">
                {impact.new_events.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {impact.object_changes.length > 0 && (
            <div className="impact-group">
              <span className="impact-title">物品变化</span>
              <ul className="archive-list">
                {impact.object_changes.map((o, i) => (
                  <li key={i}>
                    {o.object_id}：{o.before} → {o.after}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
