import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  MapPin, 
  Barcode, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  HelpCircle,
  Play,
  Volume2,
  Camera
} from "lucide-react";
import { MobileBarcodeScanner } from "@/components/MobileBarcodeScanner";

interface ExpectedUnit {
  id: string;
  unit_code: string;
  product_name: string;
  status: string;
  scanned: boolean;
}

interface ScannedUnit {
  unit_code: string;
  itemName?: string;
  audit_status: "verified" | "misplaced" | "unknown";
  expectedLocation?: string;
}

export default function StockAudit() {
  const [shelfQuery, setShelfQuery] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [activeLocation, setActiveLocation] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingItem, setIsProcessingItem] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanningShelf, setIsScanningShelf] = useState(false);
  const [isScanningItem, setIsScanningItem] = useState(false);
  
  const [expectedUnits, setExpectedUnits] = useState<ExpectedUnit[]>([]);
  const [scannedUnits, setScannedUnits] = useState<ScannedUnit[]>([]);
  const [misplacedCount, setMisplacedCount] = useState(0);

  const shelfInputRef = useRef<HTMLInputElement>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const lastScanTimeRef = useRef<{ [code: string]: number }>({});
  const navigate = useNavigate();

  // Focus shelf input on load
  useEffect(() => {
    shelfInputRef.current?.focus();
  }, []);

  // Web Audio Synth Sound Feedback
  const playSound = (type: "success" | "warning" | "error") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === "success") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "warning") {
        // High-low double beep
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.setValueAtTime(600, ctx.currentTime);
        gain1.gain.setValueAtTime(0.08, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.1);

        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(450, ctx.currentTime);
          gain2.gain.setValueAtTime(0.08, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.15);
        }, 120);
      } else {
        // Low buzzer
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn("AudioContext blocked or failed", e);
    }
  };

  const executeShelfLookup = async (shelfCode: string) => {
    if (!shelfCode) return;
    setIsLoading(true);
    setExpectedUnits([]);
    setScannedUnits([]);
    setMisplacedCount(0);

    try {
      const { data: location, error } = await supabase
        .from("locations")
        .select("*")
        .or(`code.eq."${shelfCode}",barcode.eq."${shelfCode}"`)
        .maybeSingle();

      if (error) throw error;

      if (location) {
        if (location.location_type === "SOLD_OUT") {
          throw new Error("Cannot run manual audit on the Sold Out area");
        }
        
        setActiveLocation(location);

        const { data: units, error: unitsError } = await supabase
          .from("stock_units")
          .select(`
            id,
            unit_code,
            status,
            product:products(name)
          `)
          .eq("current_location_id", location.id)
          .in("status", ["in_stock", "on_floor", "with_customer", "reserved"]);

        if (unitsError) throw unitsError;

        if (units) {
          const formatted = units.map((u: any) => ({
            id: u.id,
            unit_code: u.unit_code,
            product_name: u.product?.name || "Unknown Product",
            status: u.status,
            scanned: false
          }));
          setExpectedUnits(formatted);
        }

        playSound("success");
        setShelfQuery("");
        setTimeout(() => itemInputRef.current?.focus(), 100);
      } else {
        playSound("error");
        toast.error(`Shelf location "${shelfCode}" not registered`);
        shelfInputRef.current?.select();
      }
    } catch (err: any) {
      playSound("error");
      toast.error(err.message || "Failed to load shelf for audit");
    } finally {
      setIsLoading(false);
    }
  };

  const executeItemLookup = async (itemCode: string) => {
    if (!itemCode || !activeLocation) return;
    setIsProcessingItem(true);
    try {
      if (scannedUnits.some(u => u.unit_code === itemCode)) {
        playSound("warning");
        toast.info("This piece has already been scanned in this audit session");
        return;
      }

      const expectedIdx = expectedUnits.findIndex(u => u.unit_code === itemCode);

      if (expectedIdx !== -1) {
        playSound("success");
        setExpectedUnits(prev => {
          const copy = [...prev];
          copy[expectedIdx].scanned = true;
          return copy;
        });

        setScannedUnits(prev => [
          {
            unit_code: itemCode,
            itemName: expectedUnits[expectedIdx].product_name,
            audit_status: "verified"
          },
          ...prev
        ]);
      } else {
        const { data: unit, error } = await supabase
          .from("stock_units")
          .select(`
            id,
            unit_code,
            product:products(name),
            location:locations(label)
          `)
          .eq("unit_code", itemCode)
          .maybeSingle();

        if (error) throw error;

        if (unit) {
          playSound("warning");
          setMisplacedCount(prev => prev + 1);
          setScannedUnits(prev => [
            {
              unit_code: itemCode,
              itemName: unit.product?.name,
              audit_status: "misplaced",
              expectedLocation: unit.location?.label || "Warehouse Intake"
            },
            ...prev
          ]);
        } else {
          playSound("error");
          setScannedUnits(prev => [
            {
              unit_code: itemCode,
              audit_status: "unknown",
              itemName: "Unregistered Tag"
            },
            ...prev
          ]);
        }
      }
    } catch (err: any) {
      playSound("error");
      toast.error(err.message || "Failed to process audit scan");
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
    if (!itemCode || !activeLocation) return;

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

  const handleAuditSubmit = async () => {
    if (!activeLocation) return;
    setIsSubmitting(true);

    try {
      // 1. Get Actor
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();
      const actorId = profile?.id;

      // 2. Mark verified units
      const verified = scannedUnits.filter(u => u.audit_status === "verified");
      for (const vUnit of verified) {
        const matchingExpected = expectedUnits.find(e => e.unit_code === vUnit.unit_code);
        if (matchingExpected) {
          // Update unit audit timestamp
          await supabase
            .from("stock_units")
            .update({ last_counted_at: new Date().toISOString() })
            .eq("id", matchingExpected.id);
            
          // Log movement count log
          await supabase
            .from("stock_movements")
            .insert({
              unit_id: matchingExpected.id,
              movement_type: "stock_count",
              from_location_id: activeLocation.id,
              to_location_id: activeLocation.id,
              old_status: matchingExpected.status,
              new_status: matchingExpected.status,
              actor_profile_id: actorId,
              notes: "Audited - Item present and verified"
            });
        }
      }

      // 3. Reconcile misplaced units (relocate them to this shelf!)
      const misplaced = scannedUnits.filter(u => u.audit_status === "misplaced");
      for (const mUnit of misplaced) {
        // Query unit id
        const { data: dbUnit } = await supabase
          .from("stock_units")
          .select("id, status")
          .eq("unit_code", mUnit.unit_code)
          .maybeSingle();

        if (dbUnit) {
          // Update last counted
          await supabase
            .from("stock_units")
            .update({ last_counted_at: new Date().toISOString() })
            .eq("id", dbUnit.id);
            
          // Call relocate RPC to pull it to this shelf
          await supabase.rpc("relocate", {
            p_unit_code: mUnit.unit_code,
            p_location_code: activeLocation.code,
            p_notes: `Audit Reconcile: Misplaced item pulled to ${activeLocation.label}`
          });
        }
      }

      toast.success("Audit submitted successfully! Shelf coordinates updated.");
      
      // Reset audit
      setActiveLocation(null);
      setExpectedUnits([]);
      setScannedUnits([]);
      setMisplacedCount(0);
      setTimeout(() => shelfInputRef.current?.focus(), 100);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit audit checklist");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAuditStatusIcon = (status: "verified" | "misplaced" | "unknown") => {
    switch (status) {
      case "verified": return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
      case "misplaced": return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
      case "unknown": return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
    }
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shelf Audit / Stock Count</h1>
          <p className="text-sm text-muted-foreground">Scan shelves and verify physical garment coordinates to correct location drift</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Layout Setup Sidecard */}
        <Card className="md:col-span-1 shadow border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" /> Active Audit Target
            </CardTitle>
            <CardDescription>Select physical coordinates to check expectations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {!activeLocation ? (
              <form onSubmit={handleShelfSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="audit-shelf" className="text-xs">Location Tag Barcode</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground animate-pulse" />
                      <Input
                        id="audit-shelf"
                        ref={shelfInputRef}
                        placeholder="Scan shelf tag barcode..."
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
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Shelf"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-3.5 space-y-2">
                  <div>
                    <Label className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">Auditing Shelf Location</Label>
                    <h3 className="font-bold text-base mt-0.5 text-primary">{activeLocation.label}</h3>
                    <p className="font-mono text-xs text-muted-foreground">{activeLocation.code}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveLocation(null)} className="h-7 px-2 text-xs text-neutral-400 hover:text-foreground">
                    Reset Target
                  </Button>
                </div>

                <form onSubmit={handleItemSubmit} className="space-y-2 pt-2 border-t border-primary/10">
                  <Label htmlFor="audit-item" className="text-xs font-semibold">Scan Garment Barcode</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-3 h-4 w-4 text-primary animate-pulse" />
                      <Input
                        id="audit-item"
                        ref={itemInputRef}
                        placeholder="Scan physical tag..."
                        value={itemQuery}
                        onChange={(e) => setItemQuery(e.target.value)}
                        className="pl-9 border-primary/30"
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
                </form>

                <Button 
                  onClick={handleAuditSubmit} 
                  className="w-full h-10 gap-2 mt-2" 
                  disabled={isSubmitting || scannedUnits.length === 0}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Submit Audit Results"
                  )}
                </Button>
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

        {/* Audit Results Dashboard */}
        <Card className="md:col-span-2 shadow">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Audit Reconciliation Checklist</CardTitle>
              <CardDescription>Misplaced items will be automatically corrected to this shelf layout.</CardDescription>
            </div>
            
            {activeLocation && (
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px] bg-green-500/5 text-green-600 border-green-500/10">
                  Verified: {expectedUnits.filter(e => e.scanned).length} / {expectedUnits.length}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-yellow-500/5 text-yellow-600 border-yellow-500/10">
                  Misplaced: {misplacedCount}
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!activeLocation ? (
              <div className="text-center py-16 text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
                <Barcode className="w-10 h-10 text-neutral-300 animate-pulse" />
                Select a shelf coordinate target to begin audit comparison.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x max-h-[450px] overflow-y-auto">
                
                {/* EXPECTED UNITS COL */}
                <div className="p-4 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Expected Here ({expectedUnits.length})
                  </h4>
                  <div className="space-y-2">
                    {expectedUnits.map((item) => (
                      <div key={item.id} className={`flex items-center justify-between p-2 rounded text-xs border ${
                        item.scanned 
                          ? "bg-green-500/5 border-green-500/10 text-green-700 dark:text-green-400 font-semibold" 
                          : "bg-neutral-500/5 border-neutral-200 text-neutral-500"
                      }`}>
                        <div className="truncate max-w-[70%]">
                          <p className="font-mono text-xs">{item.unit_code}</p>
                          <p className="text-[10px] opacity-85 truncate mt-0.5">{item.product_name}</p>
                        </div>
                        {item.scanned ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <HelpCircle className="w-4 h-4 text-neutral-400 shrink-0 animate-pulse" />
                        )}
                      </div>
                    ))}
                    {expectedUnits.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-6">No pieces expected on this shelf.</p>
                    )}
                  </div>
                </div>

                {/* SCANNED / AUDITED LOG COL */}
                <div className="p-4 space-y-3 bg-neutral-500/5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    Scanned Pieces ({scannedUnits.length})
                  </h4>
                  <div className="space-y-2">
                    {scannedUnits.map((item, idx) => (
                      <div key={idx} className={`flex items-start gap-2.5 p-2 rounded text-xs border bg-card shadow-sm ${
                        item.audit_status === "verified" ? "border-green-500/10" : 
                        item.audit_status === "misplaced" ? "border-yellow-500/10" : "border-red-500/10"
                      }`}>
                        {getAuditStatusIcon(item.audit_status)}
                        <div>
                          <p className="font-mono font-bold">{item.unit_code}</p>
                          {item.itemName && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">{item.itemName}</p>}
                          {item.audit_status === "misplaced" && (
                            <p className="text-[9px] text-yellow-600 font-semibold mt-1">
                              Misplaced! Expected on: {item.expectedLocation}
                            </p>
                          )}
                          {item.audit_status === "unknown" && (
                            <p className="text-[9px] text-red-500 font-semibold mt-1">
                              Not in registry
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    {scannedUnits.length === 0 && (
                      <p className="text-xs text-muted-foreground italic text-center py-6">Scan garments to reconcile matches.</p>
                    )}
                  </div>
                </div>

              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
