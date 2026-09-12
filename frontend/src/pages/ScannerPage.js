import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import {
  Scan,
  Menu,
  X,
  Home,
  Settings,
  LogOut,
  Loader2,
  Camera,
  CameraOff,
  Building2,
  ChevronDown
} from 'lucide-react';

import { AppMenu } from '../components/AppMenu';
import { API_BASE_URL as API } from '../config/api';

const CAMERA_ID_STORAGE_KEY = 'devotio_camera_id';

// Prefer the standard back lens over ultra-wide/telephoto — those have a much
// wider field of view or a longer minimum focus distance, which is what made
// the scanner "desenfocarse" when the browser picked one of them by default.
// `facing` is a workspace-level preference (Config. Tarjetas) for businesses
// that scan with the front camera by default (e.g. a fixed kiosk) — camera
// deviceIds aren't portable across phones, so this can only bias by label,
// not pin an exact camera for every device.
const pickDefaultCamera = (cameras, facing = 'back') => {
  const byLabel = (re) => cameras.find((c) => re.test(c.label || ''));
  if (facing === 'front') {
    return byLabel(/^front camera$/i) || byLabel(/^front/i) || cameras[0];
  }
  return (
    byLabel(/^back camera$/i) ||
    byLabel(/back.*(?<!ultra )wide/i) ||
    byLabel(/^back/i) ||
    cameras[0]
  );
};

// html5-qrcode's own start() config (fps/qrbox/etc.) has no way to request
// continuous autofocus — that's a raw MediaTrackConstraint, only settable via
// applyVideoConstraints() *after* the stream is confirmed live. Without this,
// the camera does a single autofocus pass when the stream opens and never
// refocuses again, which is exactly what made the picture look progressively
// "desenfocado" the more times a business scanned (each card sits at a
// slightly different distance than the last). Confirmed against the
// library's own GitHub issue #308, where this was the maintainer-endorsed
// fix. Polling for the SCANNING state (rather than a fixed delay) avoids a
// race where the video track isn't ready yet and the constraint is dropped.
const enableContinuousAutofocus = async (html5QrCode) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    if (html5QrCode.getState() === Html5QrcodeScannerState.SCANNING) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  try {
    await html5QrCode.applyVideoConstraints({ advanced: [{ focusMode: 'continuous' }] });
  } catch (err) {
    // Not all cameras/browsers support this constraint (e.g. some iOS
    // Safari versions) — scanning still works without it, just without the
    // refocus fix, so this must never surface as a user-facing error.
    console.warn('No se pudo activar el enfoque continuo:', err);
  }
};

const ScannerPage = () => {
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() => localStorage.getItem(CAMERA_ID_STORAGE_KEY) || null);
  const [showCameraPicker, setShowCameraPicker] = useState(false);

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

  const startScanner = async (cameraIdOverride = null) => {
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

      // Enumerate cameras so a specific lens can be targeted — with
      // facingMode:"environment" alone the browser/OS picks one on its own,
      // which on multi-lens phones is sometimes the ultra-wide or telephoto
      // lens instead of the main camera, causing focus issues up close.
      let cameraTarget = { facingMode: "environment" };
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          setAvailableCameras(cameras);
          const requestedId = cameraIdOverride || selectedCameraId;
          const requested = requestedId && cameras.find((c) => c.id === requestedId);
          const chosen = requested || pickDefaultCamera(cameras, settings?.preferred_camera_facing);
          if (chosen) {
            cameraTarget = chosen.id;
            setSelectedCameraId(chosen.id);
            localStorage.setItem(CAMERA_ID_STORAGE_KEY, chosen.id);
          }
        }
      } catch (enumError) {
        console.error('No se pudieron listar las cámaras:', enumError);
      }

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
        cameraTarget,
        config,
        onScanSuccess,
        onScanFailure
      );

      // Fire-and-forget — must never delay the scanner becoming usable or
      // block on cameras that don't support the constraint.
      enableContinuousAutofocus(html5QrCode);

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

  const switchCamera = async (cameraId) => {
    setShowCameraPicker(false);
    if (cameraId === selectedCameraId) return;
    await stopScanner();
    startScanner(cameraId);
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

  // "Operaciones" no longer needs its own entry — its dashboard view IS Home now.
  const menuItems = [
    { icon: Home, label: 'Inicio', action: () => navigate('/'), testId: 'menu-home' },
    { icon: Settings, label: 'Configuración', action: () => navigate('/settings'), testId: 'menu-settings' },
    ...(user?.role === 'workspace_admin' ? [
      { icon: Building2, label: 'Admin Workspace', action: () => navigate('/admin/workspace'), testId: 'menu-admin' }
    ] : []),
    ...(user?.role === 'super_admin' ? [
      { icon: Building2, label: 'Panel Super Admin', action: () => navigate('/admin/dashboard'), testId: 'menu-admin' }
    ] : []),
    { icon: LogOut, label: 'Cerrar Sesión', action: handleLogout, testId: 'menu-logout' }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col" data-testid="scanner-page">
      {/* Header */}
      <header className="nav-header">
        <div className="w-10" />
        <img
          src="/fonts/logo.png"
          alt="Devotio Rewards"
          className="h-8 sm:h-10"
          data-testid="header-logo"
        />
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 hover:bg-[#5B7CF7] hover:text-white rounded-lg transition-colors"
          data-testid="menu-button"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6 text-[#0B0B16]" strokeWidth={2} />
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
{/* Instruction text removed per client request */}
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
                  <X className="h-5 w-5 text-[#0B0B16]" />
                </button>
                {/* Camera picker — only shown when more than one lens is available */}
                {availableCameras.length > 1 && (
                  <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20">
                    <button
                      onClick={() => setShowCameraPicker((open) => !open)}
                      className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2.5 py-2 rounded-lg shadow-lg hover:bg-white transition-colors"
                      data-testid="camera-picker-button"
                      aria-label="Seleccionar cámara"
                    >
                      <Camera className="h-4 w-4 text-[#0B0B16]" />
                      <ChevronDown className="h-3 w-3 text-[#0B0B16]" />
                    </button>
                    {showCameraPicker && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-zinc-200 overflow-hidden min-w-[200px]" data-testid="camera-picker-list">
                        {availableCameras.map((cam) => (
                          <button
                            key={cam.id}
                            onClick={() => switchCamera(cam.id)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 transition-colors ${cam.id === selectedCameraId ? 'font-semibold text-[#5B7CF7]' : 'text-[#0B0B16]'}`}
                            data-testid={`camera-option-${cam.id}`}
                          >
                            {cam.label || 'Cámara'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Scanning indicator */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg z-20">
                  <p className="text-xs font-medium text-[#0B0B16] flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Escaneando...
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#0B0B16]">
                {cameraError ? (
                  <div className="text-center text-zinc-300 p-4">
                    <CameraOff className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm">{cameraError}</p>
                  </div>
                ) : (
                  /* Empty placeholder - camera icon and text removed per client request */
                  <div className="w-full h-full" />
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
                  Click aquí para Escanear Tarjeta
                </Button>
              </div>
            )}
            
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-[#0B0B16]" />
                </div>
              </div>
            )}
          </div>

          {/* Manual Input - Only shown when enable_manual_search is enabled in settings */}
          {settings?.enable_manual_search && (
            <form onSubmit={handleManualSubmit} className="space-y-3 sm:space-y-4">
              <div className="relative">
                <Input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="ID, teléfono o email"
                  className="input-brutalist text-sm sm:text-base pr-16"
                  data-testid="manual-input"
                />
                {manualInput && (
                  <Button
                    type="submit"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#5B7CF7] text-white px-3 sm:px-4 h-9 sm:h-10 rounded-lg hover:bg-[#ffca32] hover:text-[#0B0B16] text-sm"
                    data-testid="manual-submit"
                  >
                    Ir
                  </Button>
                )}
              </div>
              <p className="text-xs text-zinc-400 text-center">
                Buscar por ID de tarjeta, número de teléfono o email del cliente
              </p>
            </form>
          )}
        </div>
      </main>

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
    </div>
  );
};

export default ScannerPage;
