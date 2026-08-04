import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { checkConnection, dbService } from './lib/supabaseClient';

// Views
import { Dashboard } from './components/Dashboard';
import { Projects } from './components/Projects';
import { Facilitators } from './components/Facilitators';
import { Configuration } from './components/Configuration';

export const App: React.FC = () => {
  const location = useLocation();
  const [activeFy, setActiveFy] = useState<string>('FY26');

  const loadActiveFy = async () => {
    try {
      const data = await dbService.getFiscalYears();
      const active = data.find(fy => fy.active);
      if (active) {
        setActiveFy(active.fiscal_year);
      } else if (data.length > 0) {
        setActiveFy(data[0].fiscal_year);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const checkDb = async () => {
      const connected = await checkConnection();
      console.log(`[Lean Impact Startup] Supabase Connection Verified: ${connected}`);
    };
    checkDb();
    loadActiveFy();

    window.addEventListener('lean-impact-db-changed', loadActiveFy);
    return () => {
      window.removeEventListener('lean-impact-db-changed', loadActiveFy);
    };
  }, []);

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return 'Lean Savings Dashboard';
      case '/projects':
        return 'Project Savings Tracker';
      case '/facilitators':
        return 'Facilitator Program Performance';
      case '/configuration':
        return 'Configuration';
      default:
        return 'Lean Impact';
    }
  };

  const getBreadcrumbs = (pathname: string) => {
    switch (pathname) {
      case '/':
        return 'Lean Impact / Dashboard';
      case '/projects':
        return 'Lean Impact / Projects';
      case '/facilitators':
        return 'Lean Impact / Facilitators';
      case '/configuration':
        return 'Lean Impact / Configuration';
      default:
        return 'Lean Impact';
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      
      <div className="main-wrapper">
        <header className="app-header">
          <div className="header-title-container">
            <h2 className="header-page-title">{getPageTitle(location.pathname)}</h2>
            <span className="header-breadcrumbs">{getBreadcrumbs(location.pathname)}</span>
          </div>
          <div className="header-actions">
            <div style={{
              display: 'inline-flex',
              padding: '6px 12px',
              backgroundColor: 'var(--color-primary-light)',
              borderRadius: '9999px',
              color: 'var(--color-primary-dark)',
              fontWeight: 600,
              fontSize: '0.8rem'
            }}>
              Active FY: {activeFy}
            </div>
          </div>
        </header>

        <main className="view-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/facilitators" element={<Facilitators />} />
            <Route path="/configuration" element={<Configuration />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;
