import React from 'react';
import { X } from 'lucide-react';

// Shared hamburger menu (overlay + sliding panel) — used on every top-level
// page (Home/Dashboard, Scanner) so navigation stays in one place instead of
// duplicated per page. Each page builds its own `items` array (role-based
// items differ slightly), this component only owns the open/close UI.
export const AppMenu = ({ open, onClose, items }) => (
  <>
    <div
      className={`sidebar-overlay ${open ? 'open' : ''}`}
      onClick={onClose}
      data-testid="menu-overlay"
    />
    <aside className={`sidebar-panel ${open ? 'open' : ''}`} data-testid="sidebar-panel">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Menú</span>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
            data-testid="close-menu-button"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5 text-[#0B0B16]" />
          </button>
        </div>

        <nav className="space-y-1">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { onClose(); item.action(); }}
              className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left hover:bg-zinc-100 rounded-lg transition-colors border-b border-zinc-100"
              data-testid={item.testId}
            >
              <item.icon className="h-5 w-5 text-[#0B0B16]" strokeWidth={2} />
              <span className="font-medium text-sm sm:text-base text-[#0B0B16]">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  </>
);
