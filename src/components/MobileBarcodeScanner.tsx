import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Flashlight, Loader2 } from "lucide-react";

interface ScannerProps {
  onScan: (code: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
];

/** One shared AudioContext. Browsers cap concurrent contexts, so creating one
 *  per scan silently kills the beep after a handful of reads. */
let sharedAudioContext: AudioContext | null = null;

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioContext) sharedAudioContext = new AudioCtx();
    const ctx = sharedAudioContext;
    // iOS suspends contexts not created inside a user gesture.
    if (ctx.state === "suspended") ctx.resume();

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
}

/** getUserMedia rejections are wildly different problems with wildly different
 *  fixes, so tell the user which one they actually hit. */
function describeCameraError(err: any): string {
  const name = typeof err === "string" ? err : err?.name || err?.message || "";

  if (/NotAllowedError|Permission/i.test(name)) {
    return "Camera permission was denied. Tap the lock icon in the address bar, allow Camera, then try again.";
  }
  if (/NotFoundError|DevicesNotFound|no camera/i.test(name)) {
    return "No camera was found on this device.";
  }
  if (/NotReadableError|TrackStart|Could not start video source/i.test(name)) {
    return "The camera is already in use by another app. Close any other camera or video app, then try again.";
  }
  if (/OverconstrainedError|ConstraintNotSatisfied/i.test(name)) {
    return "This camera does not support the requested video mode. Try the other camera.";
  }
  if (/secure|https/i.test(name)) {
    return "Camera access needs a secure (https) connection.";
  }
  return `Camera failed to start: ${name || "unknown error"}`;
}

export function MobileBarcodeScanner({ onScan, open, onOpenChange }: ScannerProps) {
  // Unique per instance. Pages like Stock Audit mount two scanners, and
  // html5-qrcode resolves its container with getElementById — a shared id lets
  // one instance attach its video to the other one's (or a closing) element.
  const containerId = `barcode-scanner-${useId().replace(/:/g, "")}`;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  // Keep callbacks in refs so the effect can depend on `open` alone without
  // capturing a stale closure from the first render.
  const onScanRef = useRef(onScan);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onScanRef.current = onScan;
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setErrorMsg(null);
    setStarting(true);
    setTorchOn(false);
    setTorchSupported(false);
    hasScannedRef.current = false;

    const handleDecoded = (decodedText: string) => {
      // The decode loop keeps firing until stop() completes, so without this
      // latch a single scan can add the same item several times.
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;
      playBeep();
      onScanRef.current(decodedText);
      onOpenChangeRef.current(false);
    };

    const startScanner = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg(
          "Camera access is blocked inside this in-app browser. Use the (...) or share button and choose 'Open in Safari' or 'Open in Chrome' to scan."
        );
        setStarting(false);
        return;
      }

      const scanner = new Html5Qrcode(containerId, { formatsToSupport: SUPPORTED_FORMATS });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          // First argument is a CAMERA SELECTOR and must carry exactly one key.
          // Resolution belongs in videoConstraints below; passing it here makes
          // html5-qrcode reject the call outright.
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewWidth, viewHeight) => {
              const size = Math.floor(Math.min(viewWidth, viewHeight) * 0.75);
              return { width: size, height: size };
            },
            videoConstraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          },
          handleDecoded,
          () => {
            /* per-frame decode misses are normal and extremely noisy */
          }
        );

        if (cancelled) return;
        setStarting(false);

        try {
          const capabilities = scanner.getRunningTrackCapabilities() as any;
          if (capabilities && "torch" in capabilities) setTorchSupported(true);
        } catch {
          /* capability probing is best-effort */
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Camera start failed:", err);
        setStarting(false);
        setErrorMsg(describeCameraError(err));
      }
    };

    // start() can throw synchronously (before returning its promise) when the
    // container element is missing, which a .catch() would never see.
    const timer = setTimeout(() => {
      try {
        void startScanner();
      } catch (err) {
        console.error("Scanner init failed:", err);
        setStarting(false);
        setErrorMsg(describeCameraError(err));
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);

      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;

      // Await stop before clearing so the camera track is fully released;
      // reopening while the old track is still held is what makes Android
      // hand back a stream that renders black.
      const teardown = scanner.isScanning ? scanner.stop() : Promise.resolve();
      teardown
        .catch((e) => console.error("Scanner stop error:", e))
        .finally(() => {
          try {
            scanner.clear();
          } catch {
            /* element may already be unmounted by React */
          }
        });
    };
  }, [open, containerId]);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const next = !torchOn;
    try {
      await scanner.applyVideoConstraints({ advanced: [{ torch: next }] } as any);
      setTorchOn(next);
    } catch (e) {
      console.warn("Torch not available:", e);
      setTorchSupported(false);
    }
  }, [torchOn]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:max-w-md p-6 gap-4 border-primary/20 shadow-xl bg-card">
        <DialogHeader>
          <DialogTitle className="text-center font-bold tracking-tight">Camera Barcode Scanner</DialogTitle>
        </DialogHeader>

        <div className="relative border-2 border-primary/30 rounded-xl overflow-hidden bg-neutral-950 aspect-video shadow-inner flex items-center justify-center">
          <div id={containerId} className="w-full h-full" />

          {errorMsg ? (
            <div className="absolute inset-0 bg-neutral-900/95 flex flex-col items-center justify-center p-6 text-center z-20 animate-in fade-in duration-200">
              <AlertTriangle className="w-8 h-8 text-destructive mb-2" />
              <p className="text-xs font-bold text-destructive-foreground bg-destructive/10 border border-destructive/20 rounded p-3 leading-relaxed">
                {errorMsg}
              </p>
            </div>
          ) : starting ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-20 text-neutral-300">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-xs font-medium">Starting camera…</p>
            </div>
          ) : (
            <div className="absolute left-[8%] right-[8%] top-[50%] h-0.5 bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444] z-10" />
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Hold the tag QR inside the frame.</p>
          {torchSupported && !errorMsg && (
            <Button
              type="button"
              size="sm"
              variant={torchOn ? "default" : "outline"}
              className="gap-1.5 h-8 shrink-0"
              onClick={toggleTorch}
            >
              <Flashlight className="w-3.5 h-3.5" />
              {torchOn ? "Light on" : "Light"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
