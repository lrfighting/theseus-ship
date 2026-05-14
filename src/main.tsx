import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// 清除旧版列表缓存，确保重新拉取完整数据（v1 → v2 升级）
try { localStorage.removeItem('yyan_story_list_v1'); } catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
