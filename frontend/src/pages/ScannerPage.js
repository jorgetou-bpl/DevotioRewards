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
        throw new Error('Elemento del escáner no encontrado');
      }

      const html5QrCode = new Html5Qrcode("barcode-scanner");
      html5QrCodeRef.current = html5QrCode;

      // Get screen dimensions for responsive qrbox
      const screenWidth = window.innerWidth;
      const scannerWidth = Math.min(screenWidth - 32, 400); // Account for padding
      const qrboxWidth = Math.floor(scannerWidth * 0.8);
      const qrboxHeight = Math.floor(qrboxWidth * 0.5);

      const config = {
        fps: 15, // Increased for better detection
        qrbox: { width: qrboxWidth, height: qrboxHeight },
        aspectRatio: 1.0, // Square aspect for better mobile compatibility
        disableFlip: false, // Allow flipped codes
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true // Use native barcode API if available
        },
        formatsToSupport: [
          // QR Code - prioritize
          0,  // QR_CODE
          // Most common barcode formats
          5,  // CODE_128
          9,  // EAN_13
          10, // EAN_8
          3,  // CODE_39
          14, // UPC_A
          15, // UPC_E
          // Other formats
          1,  // AZTEC
          2,  // CODABAR
          4,  // CODE_93
          6,  // DATA_MATRIX
          8,  // ITF
          11, // PDF_417
        ]
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
      );

    } catch (error) {
      console.error('Error del escáner:', error);
      setCameraError('No se puede acceder a la cámara. Por favor verifica los permisos.');
      toast.error('Acceso a la cámara denegado');
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (error) {
        console.error('Error al detener el escáner:', error);
      }
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText, decodedResult) => {
    console.log('Código detectado:', decodedText, decodedResult);
    
    // Stop scanner immediately to prevent multiple scans
    await stopScanner();
    
    // Process the scanned code
    handleScan(decodedText);
  };

  const onScanFailure = (error) => {
    // Silently ignore - this fires constantly when no code is detected
  };

  const handleScan = async (codeData) => {
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/scan`, { qr_data: codeData });
      
      triggerVibration();
      triggerBeep();
      
      if (settings.copy_to_clipboard && response.data.card?.id) {
        await copyToClipboard(response.data.card.id);
      }
      
      toast.success('¡Tarjeta escaneada exitosamente!');
      
      if (settings.show_result) {
        navigate('/result', { state: { card: response.data.card } });
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al escanear tarjeta';
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
    { icon: Home, label: 'Inicio', action: () => navigate('/'), testId: 'menu-home' },
    { icon: Settings, label: 'Configuración', action: () => navigate('/settings'), testId: 'menu-settings' },
    { icon: HelpCircle, label: 'Soporte', action: () => navigate('/support'), testId: 'menu-support' },
    { icon: LogOut, label: 'Cerrar Sesión', action: handleLogout, testId: 'menu-logout' }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col" data-testid="scanner-page">
      {/* Header */}
      <header className="nav-header">
        <img 
          src="/fonts/logo.png" 
          alt="Devotio Rewards" 
          className="h-8 sm:h-10"
          data-testid="header-logo"
        />
        <button 
          onClick={() => setMenuOpen(true)} 
          className="p-2 hover:bg-[#ee478a] hover:text-white rounded-lg transition-colors"
          data-testid="menu-button"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6 text-[#120627]" strokeWidth={2} />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        {/* User Info */}
        <div className="text-center mb-6 sm:mb-8">
          <p className="text-zinc-500 text-xs sm:text-sm">Has iniciado sesión como:</p>
          <h2 className="text-heading text-xl sm:text-2xl mt-1" data-testid="user-name">
            {user?.name || 'Usuario'}
          </h2>
          <p className="text-zinc-500 text-xs sm:text-sm masked-data" data-testid="user-email">
            {user?.email || '***@***.***'}
          </p>
          <p className="text-zinc-400 text-xs sm:text-sm mt-2 px-4">
            Presiona el botón "Escanear" para escanear un código de barras o QR
          </p>
        </div>

        {/* Scanner Viewport */}
        <div className="w-full max-w-md">
          <div className="scanner-viewport mb-4 sm:mb-6 relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '1/1', maxHeight: '400px' }} data-testid="scanner-viewport">
            {scanning ? (
              <>
                <div 
                  id="barcode-scanner" 
                  ref={scannerRef}
                  className="w-full h-full"
                  style={{ minHeight: '300px' }}
                  data-testid="barcode-scanner"
                />
                <button
                  onClick={stopScanner}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg hover:bg-white transition-colors z-20"
                  data-testid="stop-scan-button"
                  aria-label="Detener escaneo"
                >
                  <X className="h-5 w-5 text-[#120627]" />
                </button>
                {/* Scanning indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg z-20">
                  <p className="text-xs font-medium text-[#120627] flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Escaneando...
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#120627]">
                {cameraError ? (
                  <div className="text-center text-zinc-300 p-4">
                    <CameraOff className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm">{cameraError}</p>
                  </div>
                ) : (
                  <div className="text-center text-zinc-300">
                    <Camera className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm">Escáner de códigos de barras y QR</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Scan button overlay */}
            {!scanning && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  onClick={startScanner}
                  className="btn-primary px-8 sm:px-12 py-3 sm:py-4 text-lg sm:text-xl"
                  data-testid="scan-button"
                >
                  <Scan className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                  Escanear
                </Button>
              </div>
            )}
            
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-[#120627]" />
                </div>
              </div>
            )}
          </div>

          {/* Manual Input Only - Search removed */}
          <form onSubmit={handleManualSubmit} className="space-y-3 sm:space-y-4">
            <div className="relative">
              <Input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Ingresar ID de tarjeta manualmente"
                className="input-brutalist text-sm sm:text-base pr-16"
                data-testid="manual-input"
              />
              {manualInput && (
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#120627] text-white px-3 sm:px-4 h-9 sm:h-10 rounded-lg hover:bg-[#ffca32] hover:text-[#120627] text-sm"
                  data-testid="manual-submit"
                >
                  Ir
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
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6 sm:mb-8">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-500">Menú</span>
            <button 
              onClick={() => setMenuOpen(false)}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
              data-testid="close-menu-button"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5 text-[#120627]" />
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
                className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 text-left hover:bg-zinc-100 rounded-lg transition-colors border-b border-zinc-100"
                data-testid={item.testId}
              >
                <item.icon className="h-5 w-5 text-[#120627]" strokeWidth={2} />
                <span className="font-medium text-sm sm:text-base text-[#120627]">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
};

export default ScannerPage;
