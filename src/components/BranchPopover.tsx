import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import type { BranchOption, KeyNode } from '../types/story';

interface BranchPopoverProps {
  node: KeyNode;
  onPick: (text: string, sourceNodeId: string, option?: BranchOption) => void;
  onClose: () => void;
}

export default function BranchPopover({ node, onPick, onClose }: BranchPopoverProps) {
  const [custom, setCustom] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  function submitCustom() {
    if (!custom.trim()) return;
    onPick(custom.trim(), node.node_id);
    setCustom('');
  }

  return (
    <motion.div
      ref={ref}
      className="node-popover"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.22, 0.8, 0.32, 1] }}
    >
      <div className="pop-title">
        <span>{node.title}</span>
        <span className="badge">
          <Sparkles size={12} /> AI 推荐分支
        </span>
      </div>
      <p className="pop-summary">{node.summary}</p>

      {node.branch_options.map((option, idx) => (
        <button
          key={option.option_id}
          className="option-btn"
          onClick={() => onPick(option.text, node.node_id, option)}
        >
          <span className="opt-index">{idx + 1}</span>
          <span>
            {option.text}
            <small className="opt-tone">{option.tone}</small>
          </span>
        </button>
      ))}

      <div className="custom-row">
        <input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitCustom();
          }}
          placeholder="自定义你想要的剧情走向…"
        />
        <button
          className="send-btn"
          onClick={submitCustom}
          disabled={!custom.trim()}
          aria-label="发送自定义剧情"
        >
          <Send size={14} />
        </button>
      </div>
    </motion.div>
  );
}
