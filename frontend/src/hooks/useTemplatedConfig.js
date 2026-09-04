import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API_BASE_URL as API } from '../config/api';

/**
 * Manages a "config with an optional per-template override" admin section:
 * fetches the Boomerangme templates of a given type plus the saved configs
 * (workspace default + any overrides), and exposes save/delete against
 * whichever template is currently selected. Mirrors the shared backend
 * contract used by stamp-config, gift-card-config, reward-accrual-config,
 * and discount-tiers: GET {basePath}/all, DELETE {basePath}/by-template/{id},
 * POST {basePath}?template_id=...
 */
export function useTemplatedConfig({ basePath, templateType, targetWorkspaceId, active }) {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [configs, setConfigs] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!active || !targetWorkspaceId) return;
    const token = localStorage.getItem('token');
    setLoadingTemplates(true);
    // The general /templates endpoint (not the Devotio-only /templates/by-type
    // reconnaissance one) — any authenticated role can call it, which matters
    // here since min-amount config is editable by workspace_admin too.
    axios.get(`${API}/templates`, {
      params: { workspace_id: targetWorkspaceId },
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => setTemplates(
        (res.data.templates || [])
          .filter((t) => t.type === templateType)
          .map((t) => ({ id: t.id, name: t.name || `Plantilla #${t.id}` }))
      ))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, [active, targetWorkspaceId, templateType]);

  const refetchConfigs = useCallback(() => {
    if (!active || !targetWorkspaceId) return;
    const token = localStorage.getItem('token');
    return axios.get(`${API}${basePath}/all`, {
      params: { workspace_id: targetWorkspaceId },
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => setConfigs(res.data.configs || []))
      .catch(() => setConfigs([]));
  }, [active, targetWorkspaceId, basePath]);

  useEffect(() => { refetchConfigs(); }, [refetchConfigs]);

  const defaultConfig = configs.find((c) => !c.template_id) || null;
  const specificConfig = selectedTemplateId ? configs.find((c) => c.template_id === selectedTemplateId) : null;
  const hasOverride = !!specificConfig;
  const currentConfig = specificConfig || defaultConfig;

  const save = async (body) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const params = { workspace_id: targetWorkspaceId };
      if (selectedTemplateId) params.template_id = selectedTemplateId;
      await axios.post(`${API}${basePath}`, body, { params, headers: { Authorization: `Bearer ${token}` } });
      setConfigs((prev) => {
        const withoutCurrent = prev.filter((c) => (c.template_id || null) !== (selectedTemplateId || null));
        return [...withoutCurrent, { ...body, template_id: selectedTemplateId || null }];
      });
      return true;
    } catch {
      toast.error('Error al guardar configuración');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedTemplateId) return false;
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}${basePath}/by-template/${selectedTemplateId}`, {
        params: { workspace_id: targetWorkspaceId },
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfigs((prev) => prev.filter((c) => c.template_id !== selectedTemplateId));
      return true;
    } catch {
      toast.error('Error al eliminar configuración específica');
      return false;
    } finally {
      setDeleting(false);
    }
  };

  return {
    templates, loadingTemplates,
    selectedTemplateId, setSelectedTemplateId,
    currentConfig, hasOverride,
    save, saving,
    remove, deleting
  };
}
