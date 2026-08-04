import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Settings 
} from 'lucide-react';
import logo from '../assets/logo.png';
import flexLogo from '../assets/flex_logo.png';

export const Sidebar: React.FC = () => {
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Projects', path: '/projects', icon: <Briefcase size={20} /> },
    { name: 'Facilitators', path: '/facilitators', icon: <Users size={20} /> },
    { name: 'Configuration', path: '/configuration', icon: <Settings size={20} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src={logo} alt="Lean Impact Logo" className="sidebar-logo-img" />
        <span className="sidebar-logo-text">Lean Impact</span>
      </div>
      
      <nav style={{ flexGrow: 1 }}>
        <ul className="sidebar-menu">
          {menuItems.map((item) => (
            <li key={item.name}>
              <NavLink 
                to={item.path} 
                className={({ isActive }: { isActive: boolean }) => 
                  isActive ? 'sidebar-item-link active' : 'sidebar-item-link'
                }
                end={item.path === '/'}
              >
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-branding" style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid var(--color-border)' }}>
        <img 
          src={flexLogo} 
          alt="Flex Logo" 
          className="sidebar-flex-logo"
          style={{ maxHeight: '28px', objectFit: 'contain', width: 'auto' }}
        />
        <span style={{ fontSize: '0.68rem', color: 'var(--color-primary-dark)', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>
          Live Smarter
        </span>
      </div>

      <div className="sidebar-footer" style={{ borderTop: '1px solid var(--color-border)', padding: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
        Lean Impact v1.1.0
      </div>
    </aside>
  );
};
