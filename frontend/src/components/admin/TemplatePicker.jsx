import React from 'react';
import { Loader2 } from 'lucide-react';

// Card picker for per-template config sections — only renders once there's
// something to pick between (2+ templates of that type). Selecting "Todas"
// (empty id) targets the workspace-wide default.
export const TemplatePicker = ({ templates, loading, selectedId, onSelect, testIdPrefix = 'template' }) => {
  if (loading) {
    return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-zinc-400" /></div>;
  }
  if (templates.length <= 1) return null;

  return (
    <div className="space-y-1.5 pb-1">
      <button onClick={() => onSelect('')}
        className={`w-full text-left rounded-lg px-3 py-2 border-2 text-sm transition-colors ${
          !selectedId ? 'border-[#0B0B16] bg-[#5B7CF7]/5 font-medium' : 'border-transparent bg-zinc-50'
        }`}
        data-testid={`${testIdPrefix}-default`}>
        Todas (configuración por defecto)
      </button>
      {templates.map((t) => (
        <button key={t.id} onClick={() => onSelect(String(t.id))}
          className={`w-full text-left rounded-lg px-3 py-2 border-2 text-sm transition-colors ${
            selectedId === String(t.id) ? 'border-[#0B0B16] bg-[#5B7CF7]/5 font-medium' : 'border-transparent bg-zinc-50'
          }`}
          data-testid={`${testIdPrefix}-${t.id}`}>
          {t.name}
        </button>
      ))}
    </div>
  );
};

// Small inline banner shown above a per-template config block: names which
// card is being edited and offers a way back to the default when it has its
// own override.
export const TemplateConfigHeader = ({ selectedName, hasOverride, onDeleteOverride, deleting }) => {
  if (!selectedName) return null;
  return (
    <div className="flex items-center justify-between gap-2 pb-1">
      <p className="text-xs text-zinc-500">
        Editando: <span className="font-medium text-[#0B0B16]">{selectedName}</span>
        {!hasOverride && ' — mostrando el valor por defecto como punto de partida'}
      </p>
      {hasOverride && (
        <button onClick={onDeleteOverride} disabled={deleting}
          className="text-xs text-red-700 hover:underline shrink-0" data-testid="delete-template-override">
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Usar la de por defecto'}
        </button>
      )}
    </div>
  );
};
