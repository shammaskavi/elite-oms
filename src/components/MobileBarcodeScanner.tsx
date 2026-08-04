import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface ScannerProps {
  onScan: (code: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileBarcodeScanner({ onScan, open, onOpenChange }: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      
      const timer = setTimeout(() => {
        // Validate getUserMedia support first (blocked in in-app browsers on iOS)
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setErrorMsg("Camera access is blocked inside this in-app browser. Please click the (...) or share button and choose 'Open in Safari' or 'Open in Chrome' to scan.");
          return;
        }

        const html5QrCode = new Html5Qrcode("scanner-element-id", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE
          ]
        });
        scannerRef.current = html5QrCode;

        html5QrCode.start(
          { 
            facingMode: "environment",
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 }
          },
          {
            fps: 24,
            qrbox: (width, height) => {
              return { 
                width: Math.min(width * 0.9, 360), 
                height: Math.min(height * 0.5, 180) 
              };
            },
            aspectRatio: 1.777778,
            experimentalFeatures: {
              useBarCodeDetectorIfSupported: true
            }
          },
          (decodedText) => {
            onScan(decodedText);
            playBeep();
            onOpenChange(false);
          },
          () => {
            // silent parsing failures
          }
        ).catch((err) => {
          console.error("Camera environment start failed, trying fallback:", err);
          html5QrCode.start(
            {}, // Try blank constraints to let browser pick default camera
            {
              fps: 20,
              qrbox: (width, height) => ({ width: width * 0.9, height: height * 0.4 }),
              aspectRatio: 1.777778
            },
            (decodedText) => {
              onScan(decodedText);
              playBeep();
              onOpenChange(false);
            },
            () => {}
          ).catch((fallbackErr) => {
            console.error("All camera start options failed:", fallbackErr);
            setErrorMsg("Camera access failed. Ensure Saree Palace Elite has camera permissions allowed in your system settings, or open Saree Palace Elite in a standalone browser window (Safari/Chrome).");
          });
        });
      }, 450);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch((e) => console.error("Scanner stop error:", e));
        }
      };
    }
  }, [open]);

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio feedback blocked:", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md p-6 gap-4 border-primary/20 shadow-xl bg-card">
        <DialogHeader>
          <DialogTitle className="text-center font-bold tracking-tight">Camera Barcode Scanner</DialogTitle>
        </DialogHeader>
        <div className="relative border-2 border-primary/30 rounded-xl overflow-hidden bg-neutral-950 aspect-video shadow-inner flex items-center justify-center">
          <div id="scanner-element-id" className="w-full h-full" />
          
          {errorMsg ? (
            <div className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-200">
              <AlertTriangle className="w-8 h-8 text-destructive mb-2 animate-bounce" />
              <p className="text-xs font-bold text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded p-3 leading-relaxed">
                {errorMsg}
              </p>
            </div>
          ) : (
            /* Laser scanning visual guideline */
            <div className="absolute left-[8%] right-[8%] top-[50%] h-0.5 bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444] z-10" />
          )}
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Align the boutique label barcode inside the scan frame to read.
        </p>
      </DialogContent>
    </Dialog>
  );
}
