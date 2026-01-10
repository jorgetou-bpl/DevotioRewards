import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Scan, 
  Search, 
  Menu, 
  X, 
  Home, 
  Settings, 
  HelpCircle, 
  LogOut,
  Loader2,
  Camera,
  CameraOff
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ScannerPage = () => {
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { triggerVibration, triggerBeep, copyToClipboard, settings } = useSettings();

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setCameraError(null);
      setScanning(true);

      // Wait for the DOM element to be available
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!scannerRef.current) {
        throw new Error('Scanner element not found');
      }

      const html5QrCode = new Html5Qrcode("barcode-scanner");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 300, height: 150 },
        aspectRatio: 1.777,
        formatsToSupport: [
          // Barcode formats
          0,  // QR_CODE (fallback)
          1,  // AZTEC
          2,  // CODABAR
          3,  // CODE_39
          4,  // CODE_93
          5,  // CODE_128
          6,  // DATA_MATRIX
          7,  // MAXICODE
          8,  // ITF
          9,  // EAN_13
          10, // EAN_8
          11, // PDF_417
          12, // RSS_14
          13, // RSS_EXPANDED
          14, // UPC_A
          15, // UPC_E
          16, // UPC_EAN_EXTENSION
        ]
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
      );

    } catch (error) {
      console.error('Scanner error:', error);
      setCameraError('Unable to access camera. Please check permissions.');
      toast.error('Camera access denied');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText, decodedResult) => {
    console.log('Barcode detected:', decodedText, decodedResult);
    
    // Stop scanner immediately to prevent multiple scans
    await stopScanner();
    
    // Process the scanned barcode
    handleScan(decodedText);
  };

  const onScanFailure = (error) => {
    // Silently ignore - this fires constantly when no barcode is detected
  };

  const handleScan = async (barcodeData) => {
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/scan`, { qr_data: barcodeData });
      
      triggerVibration();
      triggerBeep();
      
      if (settings.copy_to_clipboard && response.data.card?.id) {
        await copyToClipboard(response.data.card.id);
      }
      
      toast.success('Card scanned successfully!');
      
      if (settings.show_result) {
        navigate('/result', { state: { card: response.data.card } });
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to scan card';
      toast.error(message);
      // Restart scanner on error so user can try again
      startScanner();
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: Home, label: 'Home', action: () => navigate('/'), testId: 'menu-home' },
    { icon: Settings, label: 'Settings', action: () => navigate('/settings'), testId: 'menu-settings' },
    { icon: HelpCircle, label: 'Support', action: () => navigate('/support'), testId: 'menu-support' },
    { icon: LogOut, label: 'Logout', action: handleLogout, testId: 'menu-logout' }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col" data-testid="scanner-page">
      {/* Header */}
      <header className="nav-header">
        <h1 className="logo-text text-xl" data-testid="header-logo">Devotio Rewards</h1>
        <button 
          onClick={() => setMenuOpen(true)} 
          className="p-2 hover:bg-zinc-100 rounded-sm transition-colors"
          data-testid="menu-button"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" strokeWidth={2} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        {/* User Info */}
        <div className="text-center mb-8">
          <p className="text-zinc-500 text-sm">You are logged in as:</p>
          <h2 className="text-heading text-2xl mt-1" data-testid="user-name">
            {user?.name || 'User'}
          </h2>
          <p className="text-zinc-500 text-sm masked-data" data-testid="user-email">
            {user?.email || '***@***.***'}
          </p>
          <p className="text-zinc-400 text-sm mt-2">
            Press the "Scan" button to scan a barcode
          </p>
        </div>

        {/* Scanner Viewport */}
        <div className="w-full max-w-md">
          <div className="scanner-viewport rounded-sm mb-6 relative" data-testid="scanner-viewport">
            {scanning ? (
              <>
                <div 
                  id="barcode-scanner" 
                  ref={scannerRef}
                  className="w-full h-full"
                  data-testid="barcode-scanner"
                />
                <button
                  onClick={stopScanner}
                  className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-2 rounded-sm border-2 border-black hover:bg-white transition-colors z-20"
                  data-testid="stop-scan-button"
                  aria-label="Stop scanning"
                >
                  <X className="h-5 w-5" />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {cameraError ? (
                  <div className="text-center text-zinc-400 p-4">
                    <CameraOff className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">{cameraError}</p>
                  </div>
                ) : (
                  <div className="text-center text-zinc-400">
                    <Camera className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">Barcode scanner</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Scan button overlay */}
            {!scanning && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={startScanner}
                  className="btn-primary px-12 py-4 text-xl"
                  data-testid="scan-button"
                >
                  <Scan className="mr-2 h-6 w-6" />
                  Scan
                </Button>
              </div>
            )}
            
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-sm p-4 rounded-sm border-2 border-black">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              </div>
            )}
          </div>

          {/* Manual Input / Search */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full btn-secondary"
              onClick={() => navigate('/search')}
              data-testid="search-customers-button"
            >
              <Search className="mr-2 h-5 w-5" />
              Search customers
            </Button>

            <div className="relative">
              <Input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Enter card ID manually"
                className="input-brutalist"
                data-testid="manual-input"
              />
              {manualInput && (
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-black text-white px-4 h-10"
                  data-testid="manual-submit"
                >
                  Go
                </Button>
              )}
            </div>
          </form>
        </div>
      </main>

      {/* Sidebar Menu Overlay */}
      <div 
        className={`sidebar-overlay ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
        data-testid="menu-overlay"
      />

      {/* Sidebar Panel */}
      <aside className={`sidebar-panel ${menuOpen ? 'open' : ''}`} data-testid="sidebar-panel">
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">Menu</span>
            <button 
              onClick={() => setMenuOpen(false)}
              className="p-2 hover:bg-zinc-100 rounded-sm transition-colors"
              data-testid="close-menu-button"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setMenuOpen(false);
                  item.action();
                }}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-zinc-100 rounded-sm transition-colors border-b border-zinc-100"
                data-testid={item.testId}
              >
                <item.icon className="h-5 w-5" strokeWidth={2} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
};

export default ScannerPage;
