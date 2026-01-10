import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Vibrate, Volume2, Eye, Clipboard, Loader2 } from 'lucide-react';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, loading } = useSettings();

  const handleToggle = async (key, value) => {
    try {
      await updateSettings({ [key]: value });
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const settingsItems = [
    {
      key: 'vibration',
      label: 'Vibration',
      description: 'Vibrate when scanning a barcode',
      icon: Vibrate,
      testId: 'setting-vibration'
    },
    {
      key: 'beep',
      label: 'Beep',
      description: 'Play sound when scanning',
      icon: Volume2,
      testId: 'setting-beep'
    },
    {
      key: 'show_result',
      label: 'Show result',
      description: 'Display card details after scan',
      icon: Eye,
      testId: 'setting-show-result'
    },
    {
      key: 'copy_to_clipboard',
      label: 'Copy to clipboard',
      description: 'Copy card ID after scanning',
      icon: Clipboard,
      testId: 'setting-copy-clipboard'
    }
  ];

  return (
    <div className="min-h-screen bg-white" data-testid="settings-page">
      {/* Header */}
      <header className="nav-header">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-sm transition-colors"
          data-testid="back-button"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Back</span>
        </button>
        <h1 className="logo-text text-xl">Devotio Rewards</h1>
        <div className="w-20" />
      </header>

      <main className="max-w-md mx-auto p-6">
        <h2 className="text-heading text-3xl text-center mb-8" data-testid="settings-title">
          Settings
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="card-brutalist">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">
              When scanning a barcode
            </p>

            <div className="divide-y divide-zinc-200">
              {settingsItems.map((item) => (
                <div key={item.key} className="settings-row" data-testid={item.testId}>
                  <div className="flex items-center gap-4">
                    <item.icon className="h-5 w-5 text-zinc-600" strokeWidth={2} />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-zinc-500">{item.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings[item.key] || false}
                    onCheckedChange={(checked) => handleToggle(item.key, checked)}
                    className="data-[state=checked]:bg-[#00FF94]"
                    data-testid={`${item.testId}-switch`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Version Info */}
        <div className="text-center mt-8 text-zinc-400 text-sm">
          <p>Devotio Rewards Scanner v1.0.0</p>
          <p className="mt-1">Powered by Devotio Rewards</p>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
