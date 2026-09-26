import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Menu,
  Home,
  ScanLine,
  CreditCard,
  MessageCircle,
  MapPin,
  Users,
  ClipboardList,
  Settings,
  LogOut
} from 'lucide-react';

// One persistent left icon-rail at every screen size — no separate mobile
// drawer/overlay. The hamburger at the top doesn't open/close the menu (it's
// always visible); it toggles whether labels are shown next to the icons.
// Collapsed is the default so it stays out of the way on narrow phones.
// Unlike a flyout, the main content's margin grows in step with the sidebar
// (both transition together) so the page adapts instead of getting covered.
const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: Home, path: '/' },
  { key: 'scanner', label: 'Escanear', icon: ScanLine, path: '/scanner' },
  { key: 'tarjetas', label: 'Tarjetas', icon: CreditCard, path: '/tarjetas', adminOnly: true },
  { key: 'mensajeria', label: 'Mensajería', icon: MessageCircle, path: '/notifications', adminOnly: true },
  { key: 'ubicaciones', label: 'Ubicaciones', icon: MapPin, path: '/ubicaciones', adminOnly: true },
  { key: 'clientes', label: 'Clientes', icon: Users, path: '/clientes', adminOnly: true },
  { key: 'historial', label: 'Historial', icon: ClipboardList, path: '/historial' },
];

export const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);

  const isAdmin = ['workspace_admin', 'super_admin'].includes(user?.role);
  const configPath = isAdmin ? '/admin/workspace' : '/settings';
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  // Centered icon when collapsed, left-aligned icon+label once expanded —
  // a fixed `justify-start` regardless of state left the icon looking
  // off-center against the rail when there was no label next to it.
  const rowClass = (active) => `w-full flex items-center py-3 rounded-lg text-sm font-medium transition-colors ${
    expanded ? 'justify-start gap-3 px-4' : 'justify-center px-0'
  } ${active ? 'bg-[#5B7CF7] text-white' : 'text-zinc-600 hover:bg-zinc-100'}`;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavButton = ({ item }) => {
    const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
    return (
      <button
        onClick={() => navigate(item.path)}
        className={rowClass(active)}
        data-testid={`nav-${item.key}`}
        title={item.label}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {expanded && <span className="whitespace-nowrap">{item.label}</span>}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <aside className={`app-sidebar ${expanded ? 'expanded' : ''}`} data-testid="app-sidebar">
        <div className="p-3 border-b border-zinc-100">
          <button
            onClick={() => setExpanded((v) => !v)}
            className={rowClass(false)}
            data-testid="menu-toggle"
            aria-label={expanded ? 'Contraer menú' : 'Expandir menú'}
          >
            <Menu className="h-6 w-6 shrink-0" strokeWidth={2} />
            {expanded && <span className="whitespace-nowrap">Menú</span>}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1">
          {items.map((item) => <NavButton key={item.key} item={item} />)}
        </nav>
        <div className="p-3 border-t border-zinc-100 space-y-1">
          <NavButton item={{ key: 'settings', label: 'Configuración', icon: Settings, path: configPath }} />
          <button
            onClick={handleLogout}
            className={rowClass(false)}
            data-testid="nav-logout"
            title="Cerrar Sesión"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {expanded && <span className="whitespace-nowrap">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <main className={`app-main-with-sidebar ${expanded ? 'expanded' : ''}`}>
        {children}
      </main>
    </div>
  );
};
