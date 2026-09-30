import React, { useState, useEffect } from 'react';
import { ScanPage } from './pages/ScanPage';
import { AdminPage } from './pages/AdminPage';
import { ShieldCheck, QrCode } from 'lucide-react';
import logoImg from './assets/logo.png';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname.toLowerCase();
  });

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname.toLowerCase());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.history.pushState({}, '', path);
    setCurrentPath(path.toLowerCase());
  };

  const isAdminRoute = currentPath.startsWith('/admin');

  return (
    <div className="app-container">
      <nav className="navbar" role="navigation" aria-label="Main Navigation">
        <div className="navbar-inner">
          <a
            href="/scan"
            className="nav-brand"
            onClick={(e) => navigateTo('/scan', e)}
          >
            <img src={logoImg} alt="مدرسة الياسمين - ELyassamine School" className="nav-logo" />
            <span>ELyassamine school</span>
          </a>

          <div className="nav-links">
            <a
              href="/scan"
              className={`nav-link ${!isAdminRoute ? 'active' : ''}`}
              onClick={(e) => navigateTo('/scan', e)}
            >
              <QrCode size={16} />
              <span>Worker Scan</span>
            </a>

            <a
              href="/admin"
              className={`nav-link ${isAdminRoute ? 'active' : ''}`}
              onClick={(e) => navigateTo('/admin', e)}
            >
              <ShieldCheck size={16} />
              <span>Admin Portal</span>
            </a>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {isAdminRoute ? <AdminPage /> : <ScanPage />}
      </main>
    </div>
  );
};

export default App;
