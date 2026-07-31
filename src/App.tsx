import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';

// Views
import { Dashboard } from './components/Dashboard';
import { Projects } from './components/Projects';
import { Forecast } from './components/Forecast';
import { Facilitators } from './components/Facilitators';
import { Configuration } from './components/Configuration';

export const App: React.FC = () => {
  const location = useLocation();

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return 'Executive Dashboard';
      case '/projects':
        return 'Project Savings Tracker';
      case '/forecast':
        return 'Strategic Forecast';
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
      case '/forecast':
        return 'Lean Impact / Strategic Forecast';
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
              backgroundColor: '#DCFCE7',
              borderRadius: '9999px',
              color: '#15803D',
              fontWeight: 600,
              fontSize: '0.8rem'
            }}>
              Active Fiscal Year: 2026
            </div>
          </div>
        </header>

        <main className="view-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/forecast" element={<Forecast />} />
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
