import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Header } from '../components/Header';
import { RedeemModal } from '../components/RedeemModal';
import { Button } from '../components/ui/button';
import { Scan, X, Loader2 } from 'lucide-react';
import { API_BASE_URL as API } from '../config/api';

// Ported from the Scanner App's ScannerPage.js — html5-qrcode's start() has
// no way to request continuous autofocus (it's a raw MediaTrackConstraint,
// only settable via applyVideoConstraints() after the stream is live).
// Without this the camera focuses once and never refocuses, which shows up
// as a progressively blurry picture. Kept here because it's a real fix, not
// scanner-picker/UI complexity this thin app doesn't need.
const enableContinuousAutofocus = async (html5QrCode) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    if (html5QrCode.getState() === Html5QrcodeScannerState.SCANNING) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  try {
    await html5QrCode.applyVideoConstraints({ advanced: [{ focusMode: 'continuous' }] });
  } catch (err) {
    // Not all cameras/browsers support this — scanning still works without it.
  }
};

const ScannerPage = () => {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [redeemCardId, setRedeemCardId] = useState(null);

  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    return () => { stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScanner = async () => {
    try {
      setCameraError(null);
      setScanning(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!scannerRef.current) throw new Error('Elemento del escáner no encontrado');

      const html5QrCode = new Html5Qrcode('barcode-scanner');
      html5QrCodeRef.current = html5QrCode;

      const screenWidth = window.innerWidth;
      const scannerWidth = Math.min(screenWidth - 32, 400);
      const qrboxWidth = Math.floor(scannerWidth * 0.8);
      const qrboxHeight = Math.floor(qrboxWidth * 0.5);

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: qrboxWidth, height: qrboxHeight },
          aspectRatio: 1.0,
          disableFlip: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          formatsToSupport: [0, 5, 9, 10, 3, 14, 15, 1, 2, 4, 6, 8, 11],
        },
        onScanSuccess,
        () => {} // ignore per-frame "no code found" noise
      );

      enableContinuousAutofocus(html5QrCode);
    } catch (error) {
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
        // Scanner may already be stopped — safe to ignore.
      }
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText) => {
    await stopScanner();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/scan`, { qr_data: decodedText });
      if (navigator.vibrate) navigator.vibrate(100);
      setRedeemCardId(response.data.card?.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al escanear tarjeta');
      startScanner();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div
            className="scanner-viewport mb-4 relative rounded-xl overflow-hidden bg-black"
            style={{ aspectRatio: '1/1', maxHeight: '400px' }}
          >
            {scanning ? (
              <>
                <div id="barcode-scanner" ref={scannerRef} className="w-full h-full" style={{ minHeight: '300px' }} />
                <button
                  onClick={stopScanner}
                  className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg hover:bg-white transition-colors z-20"
                  aria-label="Detener escaneo"
                >
                  <X className="h-5 w-5 text-[#0B0B16]" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg z-20">
                  <p className="text-xs font-medium text-[#0B0B16] flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Escaneando...
                  </p>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#0B0B16]">
                {cameraError && <p className="text-xs sm:text-sm text-zinc-300 p-4 text-center">{cameraError}</p>}
              </div>
            )}

            {!scanning && !loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button onClick={startScanner} className="btn-primary px-8 py-3 text-base sm:text-lg" data-testid="scan-button">
                  <Scan className="mr-2 h-5 w-5" /> Escanear tarjeta
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
        </div>
      </main>

      {redeemCardId && (
        <RedeemModal cardId={redeemCardId} onClose={() => setRedeemCardId(null)} />
      )}
    </div>
  );
};

export default ScannerPage;
