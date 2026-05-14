import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, BookOpenCheck, LogIn, LogOut, Sparkles } from 'lucide-react';
import CoverPage from './pages/CoverPage';
import ListPage from './pages/ListPage';
import DetailPage from './pages/DetailPage';
import { fetchMe, loginWithZhihu, logout } from './services/auth';
import type { ZhihuUser } from './services/auth';
type View =
  | { name: 'cover' }
  | { name: 'list' }
  | { name: 'detail'; workId: string };

function App() {
  const [view, setView] = useState<View>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('detail/')) {
      return { name: 'detail', workId: hash.slice('detail/'.length) };
    }
    if (hash === 'list') return { name: 'list' };
    return { name: 'cover' };
  });
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<ZhihuUser | null>(null);

  useEffect(() => {
    // 检查是否是知乎前端回调（URL 中有 code）
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      // 前端提取 code 发给后端换 token
      fetch(`${import.meta.env.VITE_API_BASE}/auth/zhihu/exchange`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.data) setUser(res.data);
          // 清除 URL 中的 code，避免刷新重复提交
          window.history.replaceState(null, '', window.location.pathname + window.location.hash);
        })
        .catch(() => setUser(null))
        .finally(() => {
          // 兜底：无论成功与否都刷新一次用户状态
          fetchMe().then(setUser).catch(() => setUser(null));
        });
    } else {
      fetchMe().then(setUser).catch(() => setUser(null));
    }
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  useEffect(() => {
    const target = (() => {
      if (view.name === 'cover') return '';
      if (view.name === 'list') return '#list';
      if (view.name === 'detail') return `#detail/${view.workId}`;
      return '';
    })();
    if (target !== window.location.hash) {
      window.history.replaceState(null, '', target || ' ');
    }
    if (view.name !== 'detail') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [view]);

  useEffect(() => {
    if (view.name !== 'list') {
      setScrolled(false);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 240);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [view.name]);

  return (
    <div className="app-root">
      <TopNav view={view} onNavigate={setView} navOverlay={view.name === 'list' && !scrolled} user={user} onLogout={handleLogout} />
      <div className="app-view">
        <AnimatePresence mode="popLayout">
          {view.name === 'cover' && (
            <motion.div
              key="cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <CoverPage onEnter={() => setView({ name: 'list' })} />
            </motion.div>
          )}
          {view.name === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ListPage onOpen={(workId) => setView({ name: 'detail', workId })} />
            </motion.div>
          )}
          {view.name === 'detail' && (
            <motion.div
              key={`detail-${view.workId}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <DetailPage workId={view.workId} onBack={() => setView({ name: 'list' })} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function TopNav({
  view,
  onNavigate,
  navOverlay,
  user,
  onLogout,
}: {
  view: View;
  onNavigate: (v: View) => void;
  navOverlay: boolean;
  user: ZhihuUser | null;
  onLogout: () => void;
}) {
  return (
    <nav className={`top-nav ${navOverlay ? 'on-dark' : ''}`}>
      <button
        className="brand-logo"
        onClick={() => onNavigate({ name: 'cover' })}
        aria-label="返回封面"
      >
        <span className="dot">
          <Sparkles size={16} />
        </span>
        盐言互动
        <span className="sub">· AI Interactive Reading</span>
      </button>
      <div className="nav-actions">
        {view.name !== 'list' && view.name !== 'detail' ? (
          <button className="btn btn-primary" onClick={() => onNavigate({ name: 'list' })}>
            <BookOpenCheck size={14} />
            开始阅读
            <ArrowUpRight size={14} />
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={() => onNavigate({ name: 'cover' })}>
            返回首页
          </button>
        )}
        {user ? (
          <div className="user-menu">
            <img src={user.avatar_path} alt={user.fullname} className="user-avatar" />
            <span className="user-name">{user.fullname}</span>
            <button className="btn-icon" onClick={onLogout} title="退出登录">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost" onClick={loginWithZhihu}>
            <LogIn size={14} />
            知乎登录
          </button>
        )}
      </div>
    </nav>
  );
}

export default App;
