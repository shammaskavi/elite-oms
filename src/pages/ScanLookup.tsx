import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { 
  Search, 
  Barcode, 
  MapPin, 
  Calendar, 
  DollarSign, 
  History as HistoryIcon, 
  ArrowLeft,
  Loader2,
  Tag,
  Camera
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MobileBarcodeScanner } from "@/components/MobileBarcodeScanner";

export default function ScanLookup() {
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
    
    // Get user role
    const getRole = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setRole(data.role);
    };
    getRole();
  }, [user]);

  const executeScanLookup = async (code: string) => {
    if (!code) return;
    setIsLoading(true);
    setResult(null);
    setHistory([]);

    try {
      const { data: unit, error: unitError } = await supabase
        .from("stock_units")
        .select(`
          *,
          product:products(*),
          location:locations(*)
        `)
        .eq("unit_code", code)
        .maybeSingle();

      if (unitError) throw unitError;

      if (unit) {
        setResult({ type: "unit", data: unit });
        
        const { data: movements } = await supabase
          .from("stock_movements")
          .select(`
            *,
            from_location:locations!stock_movements_from_location_id_fkey(*),
            to_location:locations!stock_movements_to_location_id_fkey(*),
            actor:profiles(name)
          `)
          .eq("unit_id", unit.id)
          .order("moved_at", { ascending: false });
          
        if (movements) setHistory(movements);
      } else {
        const { data: product, error: prodError } = await supabase
          .from("products")
          .select("*")
          .or(`sku.eq."${code}",company_barcode.eq."${code}"`)
          .maybeSingle();

        if (prodError) throw prodError;

        if (product) {
          setResult({ type: "catalog", data: product });
        } else {
          toast.error("Garment tag or barcode not recognized");
        }
      }
    } catch (err: any) {
      console.error("Lookup error:", err);
      toast.error(err.message || "Failed to search barcode");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = barcodeQuery.trim();
    if (!cleanCode) return;
    await executeScanLookup(cleanCode);
    setBarcodeQuery("");
  };

  const handleCameraScan = async (code: string) => {
    setBarcodeQuery(code);
    await executeScanLookup(code);
  };

  const getAgeLabel = (dateStr: string) => {
    const received = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - received.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let bucket = "Fresh";
    let color = "bg-green-500/10 text-green-500 border-green-500/20";
    
    if (diffDays >= 180 && diffDays < 365) {
      bucket = "Slow-moving";
      color = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    } else if (diffDays >= 365 && diffDays < 730) {
      bucket = "Aging";
      color = "bg-orange-500/10 text-orange-500 border-orange-500/20";
    } else if (diffDays >= 730) {
      bucket = "Deadstock";
      color = "bg-red-500/10 text-red-500 border-red-500/20";
    }

    return { diffDays, bucket, color };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_stock": return "bg-green-500/10 text-green-500";
      case "on_floor": return "bg-blue-500/10 text-blue-500";
      case "in_workshop": return "bg-purple-500/10 text-purple-500";
      case "sold": return "bg-slate-500/10 text-slate-500";
      default: return "bg-yellow-500/10 text-yellow-500";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").toUpperCase();
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tag Scanner & Lookup</h1>
          <p className="text-sm text-muted-foreground">Scan any barcode tag to check physical location and status</p>
        </div>
      </div>

      {/* Lookup Bar */}
      <Card className="border-primary/20 shadow-lg shadow-primary/5 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleLookup} className="flex gap-3">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground animate-pulse" />
              <Input
                ref={inputRef}
                placeholder="Scan tag barcode or type SKU..."
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
                className="pl-9 h-10 text-base"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="button" 
              variant="outline" 
              className="h-10 px-3 border-primary/20 text-primary hover:bg-primary/5 shrink-0"
              onClick={() => setIsScanningCamera(true)}
              disabled={isLoading}
            >
              <Camera className="w-4 h-4" />
            </Button>
            <Button type="submit" className="px-6 h-10 gap-2" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </Button>
          </form>
          
          <MobileBarcodeScanner 
            open={isScanningCamera} 
            onOpenChange={setIsScanningCamera} 
            onScan={handleCameraScan} 
          />
        </CardContent>
      </Card>

      {/* Search Result */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
          
          {/* Main Info */}
          <Card className="md:col-span-2 shadow">
            <CardHeader className="flex flex-row items-start justify-between pb-2 border-b">
              <div>
                <CardTitle className="text-xl">
                  {result.type === "unit" ? result.data.product?.name : result.data.name}
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Tag className="w-3 h-3" />
                  {result.type === "unit" ? result.data.product?.category : result.data.category}
                </CardDescription>
              </div>
              <Badge className={result.type === "unit" ? getStatusColor(result.data.status) : "bg-neutral-500/10 text-neutral-500"}>
                {result.type === "unit" ? formatStatus(result.data.status) : "Variant Catalog"}
              </Badge>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                
                {/* Barcode / SKU */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Barcode className="w-3 h-3" /> Code
                  </Label>
                  <div className="font-mono font-bold text-sm">
                    {result.type === "unit" ? result.data.unit_code : (result.data.sku || result.data.company_barcode)}
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Physical Location
                  </Label>
                  <div className="font-semibold text-sm text-primary flex items-center gap-1">
                    {result.type === "unit" ? (
                      result.data.location ? (
                        <>
                          <span className="underline">{result.data.location.label}</span>
                          <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded font-mono">
                            {result.data.location.code}
                          </span>
                        </>
                      ) : (
                        "No Shelf Assigned (Intake Zone)"
                      )
                    ) : (
                      <span className="text-muted-foreground font-normal">Legacy Grid (Variant level)</span>
                    )}
                  </div>
                </div>

                {/* Inward Date & Age */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Age & Intake
                  </Label>
                  {result.type === "unit" ? (
                    (() => {
                      const age = getAgeLabel(result.data.date_received);
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">
                            {new Date(result.data.date_received).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <Badge variant="outline" className={`w-fit text-[10px] font-bold px-1.5 py-0 ${age.color}`}>
                            {age.bucket} ({age.diffDays} days old)
                          </Badge>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-sm font-medium">
                      {result.data.inward_date ? (
                        new Date(result.data.inward_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      ) : (
                        "Unknown Inward Date"
                      )}
                    </div>
                  )}
                </div>

                {/* Valuation */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" /> Retail MRP
                  </Label>
                  <div className="text-lg font-bold text-primary">
                    ₹{(result.type === "unit" ? (result.data.product?.price || 0) : (result.data.price || 0)).toLocaleString("en-IN")}
                  </div>
                  {role === "admin" && (
                    <div className="text-xs text-neutral-500">
                      Cost: ₹{(result.type === "unit" ? (result.data.cost_price || 0) : (result.data.purchase_price || 0)).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>

              </div>

              {result.type === "catalog" && (
                <div className="bg-amber-500/10 text-amber-500 text-xs p-3 rounded-lg border border-amber-500/20">
                  <strong>Notice:</strong> This is a bulk product tracked via legacy inventory count (Variant Stock: <strong>{result.data.stock}</strong>). Individual physical tags and locations are not assigned to pieces in this line.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional details */}
          <Card className="shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1.5">
                <HistoryIcon className="w-4 h-4 text-primary" /> Physical Specs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Color:</span>
                <span className="font-semibold uppercase">{result.type === "unit" ? (result.data.product?.color || "N/A") : (result.data.color || "N/A")}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Size:</span>
                <span className="font-semibold uppercase">{result.type === "unit" ? (result.data.product?.size || "N/A") : (result.data.size || "N/A")}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Fabric:</span>
                <span className="font-semibold uppercase">{result.type === "unit" ? (result.data.product?.metadata?.fabric || "N/A") : (result.data.metadata?.fabric || "N/A")}</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-muted-foreground">Supplier:</span>
                <span className="font-semibold truncate max-w-[150px]">{result.type === "unit" ? (result.data.product?.supplier_name || "N/A") : (result.data.supplier_name || "N/A")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Unit movement history ledger */}
          {result.type === "unit" && (
            <Card className="md:col-span-3 shadow">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <HistoryIcon className="w-4 h-4 text-primary" /> Stock Movement Audit Trail
                </CardTitle>
                <CardDescription>Ledger records of where this garment has been relocated or sold</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 px-0">
                {history.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">No movements logged yet</div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto px-6 space-y-4">
                    {history.map((mov, idx) => (
                      <div key={mov.id} className="relative pl-6 border-l-2 border-primary/20 last:border-0 pb-2">
                        {/* Timeline Bullet */}
                        <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
                        
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="font-semibold text-sm">
                              {formatStatus(mov.movement_type)}
                              {mov.to_location && (
                                <span className="text-muted-foreground font-normal">
                                  {" "}to <strong className="text-foreground">{mov.to_location.label}</strong>
                                </span>
                              )}
                            </div>
                            {mov.notes && <p className="text-xs text-muted-foreground mt-0.5">{mov.notes}</p>}
                            <div className="text-[10px] text-neutral-400 mt-1">
                              By: {mov.actor?.name || "System"}
                            </div>
                          </div>
                          
                          <div className="text-right text-[11px] text-muted-foreground">
                            {new Date(mov.moved_at).toLocaleString("en-IN", { 
                              day: "2-digit", 
                              month: "short", 
                              hour: "2-digit", 
                              minute: "2-digit" 
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      )}
    </div>
  );
}
