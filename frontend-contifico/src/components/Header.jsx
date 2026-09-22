import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, History, Search, ScanLine } from 'lucide-react';

const navItemClass = ({ isActive }) =>
  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? 'bg-[#5B7CF7] text-white' : 'text-[#0B0B16] hover:bg-zinc-100'
  }`;

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="nav-header gap-2">
      <img src="/fonts/logo.png" alt="Devotio Rewards" className="h-8 sm:h-10 flex-shrink-0" />

      <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
        <NavLink to="/" end className={navItemClass} data-testid="nav-dashboard">
          <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Inicio</span>
        </NavLink>
        <NavLink to="/historial" className={navItemClass} data-testid="nav-historial">
          <History className="h-4 w-4" /> <span className="hidden sm:inline">Historial</span>
        </NavLink>
        <NavLink to="/buscar" className={navItemClass} data-testid="nav-buscar">
          <Search className="h-4 w-4" /> <span className="hidden sm:inline">Buscar</span>
        </NavLink>
        <NavLink to="/escanear" className={navItemClass} data-testid="nav-escanear">
          <ScanLine className="h-4 w-4" /> <span className="hidden sm:inline">Escanear</span>
        </NavLink>
      </nav>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs sm:text-sm text-zinc-500 hidden sm:inline">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          aria-label="Cerrar sesión"
          data-testid="logout-button"
        >
          <LogOut className="h-5 w-5 text-[#0B0B16]" />
        </button>
      </div>
    </header>
  );
};
