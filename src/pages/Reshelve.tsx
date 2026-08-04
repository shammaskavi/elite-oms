import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  MapPin, 
  Barcode, 
  CheckCircle2, 
  XCircle,
  Loader2,
  RefreshCw,
  Volume2,
  Camera
} from "lucide-react";
import { MobileBarcodeScanner } from "@/components/MobileBarcodeScanner";

interface ScanLog {
  timestamp: Date;
  code: string;
  itemName?: string;
  fromLocation?: string;
  status: "success" | "error";
  message: string;
}

export default function Reshelve() {
  const [shelfQuery, setShelfQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [activeShelf, setActiveShelf] = useState<any>(null);
  const [scanLog, setScanLog] = useState<ScanLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingItem, setIsProcessingItem] = useState(false);
  const [isScanningShelf, setIsScanningShelf] = useState(false);
  const [isScanningItem, setIsScanningItem] = useState(false);
  
  const shelfInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const lastScanTimeRef = useRef<{ [code: string]: number }>({});
  const navigate = useNavigate();

  // Focus shelf input on load
  useEffect(() => {
    shelfInputRef.current?.focus();
  }, []);

  // Web Audio Synth for feedback sounds
  const playSound = (type: "success" | "error") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn("AudioContext blocked or failed", e);
    }
  };

  const executeShelfLookup = async (shelfCode: string) => {
    if (!shelfCode) return;
    setIsLoading(true);
    try {
      const { data: location, error } = await supabase
        .from("locations")
        .select("*")
        .or(`code.eq."${shelfCode}",barcode.eq."${shelfCode}"`)
        .maybeSingle();

      if (error) throw error;

      if (location) {
        if (location.location_type === "SOLD_OUT") {
          throw new Error("Cannot reshelve items to the Sold Out area manually");
        }
        setActiveShelf(location);
        playSound("success");
        setShelfQuery("");
        setTimeout(() => itemInputRef.current?.focus(), 100);
      } else {
        playSound("error");
        toast.error(`Location barcode "${shelfCode}" not registered`);
        shelfInputRef.current?.select();
      }
    } catch (err: any) {
      playSound("error");
      toast.error(err.message || "Failed to lookup shelf location");
    } finally {
      setIsLoading(false);
    }
  };

  const executeItemLookup = async (itemCode: string) => {
    if (!itemCode || !activeShelf) return;
    setIsProcessingItem(true);
    try {
      const { data: unit, error: unitError } = await supabase
        .from("stock_units")
        .select(`
          *,
          product:products(name),
          location:locations(label)
        `)
        .eq("unit_code", itemCode)
        .maybeSingle();

      if (unitError) throw unitError;

      if (!unit) {
        throw new Error("Garment tag barcode not found in inventory");
      }

      const { error: relocateError } = await supabase.rpc("relocate", {
        p_unit_code: itemCode,
        p_location_code: activeShelf.code,
        p_notes: "Scanned Reshelve Floor tool"
      });

      if (relocateError) throw relocateError;

      playSound("success");
      setScanLog(prev => [
        {
          timestamp: new Date(),
          code: itemCode,
          itemName: unit.product?.name,
          fromLocation: unit.location?.label || "Intake / Storage",
          status: "success",
          message: `Moved to ${activeShelf.label}`
        },
        ...prev
      ]);
    } catch (err: any) {
      console.error(err);
      playSound("error");
      setScanLog(prev => [
        {
          timestamp: new Date(),
          code: itemCode,
          status: "error",
          message: err.message || "Failed to relocate garment"
        },
        ...prev
      ]);
      toast.error(err.message || "Relocation failed");
    } finally {
      setIsProcessingItem(false);
      setTimeout(() => itemInputRef.current?.focus(), 100);
    }
  };

  const handleShelfSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const shelfCode = shelfQuery.trim();
    if (!shelfCode) return;
    await executeShelfLookup(shelfCode);
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemCode = itemQuery.trim();
    if (!itemCode || !activeShelf) return;

    const now = Date.now();
    const lastScan = lastScanTimeRef.current[itemCode] || 0;
    if (now - lastScan < 800) {
      setItemQuery("");
      return;
    }
    lastScanTimeRef.current[itemCode] = now;

    setItemQuery("");
    await executeItemLookup(itemCode);
  };

  const resetShelf = () => {
    setActiveShelf(null);
    setShelfQuery("");
    setItemQuery("");
    setTimeout(() => shelfInputRef.current?.focus(), 100);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Showroom Reshelving</h1>
            <p className="text-sm text-muted-foreground">Scan a shelf location, then scan items to place them</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => playSound("success")} className="gap-2 text-xs">
          <Volume2 className="w-4 h-4" /> Sound Test
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Input Configuration Panel */}
        <Card className="md:col-span-1 shadow border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Target shelf
            </CardTitle>
            <CardDescription>Scan target shelf barcode first</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Shelf Target Setup */}
            {!activeShelf ? (
              <form onSubmit={handleShelfSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="shelf-barcode" className="text-xs">Location Tag Barcode</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground animate-pulse" />
                      <Input
                        id="shelf-barcode"
                        ref={shelfInputRef}
                        placeholder="e.g. LOC-GF-RKA-S1"
                        value={shelfQuery}
                        onChange={(e) => setShelfQuery(e.target.value)}
                        className="pl-9"
                        disabled={isLoading}
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="h-10 w-10 shrink-0 text-primary border-primary/20 hover:bg-primary/5"
                      onClick={() => setIsScanningShelf(true)}
                      disabled={isLoading}
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set Shelf"}
                </Button>
              </form>
            ) : (
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase font-black">Active Placement Zone</Label>
                    <h3 className="font-bold text-lg leading-tight mt-0.5 text-primary">{activeShelf.label}</h3>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">{activeShelf.code}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={resetShelf} className="h-8 w-8 text-neutral-400 hover:text-foreground">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Item scan field */}
                <form onSubmit={handleItemSubmit} className="space-y-2 pt-2 border-t border-primary/10">
                  <Label htmlFor="item-barcode" className="text-xs font-semibold">Scan Garment Code</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-3 h-4 w-4 text-primary animate-pulse" />
                      <Input
                        id="item-barcode"
                        ref={itemInputRef}
                        placeholder="Scan garment tag now..."
                        value={itemQuery}
                        onChange={(e) => setItemQuery(e.target.value)}
                        className="pl-9 border-primary/30 focus-visible:ring-primary"
                        disabled={isProcessingItem}
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="h-10 w-10 shrink-0 text-primary border-primary/20 hover:bg-primary/5"
                      onClick={() => setIsScanningItem(true)}
                      disabled={isProcessingItem}
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic text-center">Ready for sequential hardware scans</p>
                </form>
              </div>
            )}

            <MobileBarcodeScanner 
              open={isScanningShelf} 
              onOpenChange={setIsScanningShelf} 
              onScan={executeShelfLookup} 
            />

            <MobileBarcodeScanner 
              open={isScanningItem} 
              onOpenChange={setIsScanningItem} 
              onScan={executeItemLookup} 
            />
          </CardContent>
        </Card>

        {/* Scan Log Panel */}
        <Card className="md:col-span-2 shadow">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Current Session Scan Log</CardTitle>
              <CardDescription>Logs of reshelved items in this session</CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Count: {scanLog.filter(l => l.status === "success").length}
            </Badge>
          </CardHeader>
          <CardContent className="pt-4 px-0">
            {scanLog.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                <Barcode className="w-10 h-10 text-neutral-300 animate-bounce" />
                No scans recorded. Please configure shelf and scan garments.
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto px-6 space-y-3">
                {scanLog.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-start justify-between p-3 rounded-lg border text-sm transition-all duration-200 ${
                      log.status === "success" 
                        ? "bg-green-500/5 border-green-500/10 text-green-700 dark:text-green-400" 
                        : "bg-red-500/5 border-red-500/10 text-red-700 dark:text-red-400"
                    }`}
                  >
                    <div className="flex gap-3">
                      {log.status === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold font-mono flex items-center gap-1.5">
                          {log.code}
                          {log.status === "success" && (
                            <span className="text-[10px] bg-green-500/10 text-green-500 px-1 rounded-full font-sans uppercase">
                              Success
                            </span>
                          )}
                        </div>
                        {log.itemName && <p className="font-medium text-xs mt-0.5">{log.itemName}</p>}
                        <p className="text-xs opacity-80 mt-1">{log.message}</p>
                        {log.fromLocation && (
                          <p className="text-[10px] opacity-60 mt-0.5">Moved from: {log.fromLocation}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-[10px] opacity-60">
                      {log.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
