import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Barcode, 
  Search, 
  Calendar, 
  Tag, 
  Check, 
  Plus, 
  Loader2, 
  Printer,
  Volume2,
  Zap,
  Settings2
} from "lucide-react";
import { PrinterSetupDialog } from "@/components/PrinterSetupDialog";
import { buildGarmentLabelJob, GarmentLabel } from "@/lib/tspl";
import { loadPrinterSettings, sendTsplJob, PrintAgentOfflineError } from "@/lib/labelPrint";

// Code 39 Barcode character mapping for native SVG drawing
const CODE39_MAP: Record<string, string> = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
  '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
  '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
  'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
  'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
  'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
  'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',
  'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
  'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
  '$': '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001'
};

function generateCode39Svg(code: string): React.ReactNode {
  const cleanCode = (code || "").trim().toUpperCase().replace(/[^0-9A-Z\-.\s\$/+*%]/g, "");
  const normalized = `*${cleanCode}*`;
  let bitString = "";
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const bits = CODE39_MAP[char] || CODE39_MAP["*"];
    bitString += bits + "0";
  }

  const width = bitString.length * 1;
  const height = 22;

  return (
    <svg 
      width="100%" 
      height="22" 
      viewBox={`0 0 ${width} ${height}`} 
      className="w-full h-[22px] mt-0.5 select-none"
      shapeRendering="crispEdges"
    >
      {bitString.split("").map((bit, idx) => {
        if (bit === "1") {
          return (
            <rect 
              key={idx} 
              x={idx * 1} 
              y="0" 
              width="1" 
              height={height} 
              fill="black" 
              shapeRendering="crispEdges"
            />
          );
        }
        return null;
      })}
    </svg>
  );
}

export default function Receive() {
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [locComboboxOpen, setLocComboboxOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  
  const [quantity, setQuantity] = useState("1");
  const [costPrice, setCostPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [receivedUnits, setReceivedUnits] = useState<any[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printerSetupOpen, setPrinterSetupOpen] = useState(false);
  const [sendingToPrinter, setSendingToPrinter] = useState(false);
  
  const navigate = useNavigate();

  // Load variant products and locations
  useEffect(() => {
    const loadData = async () => {
      const { data: prodData } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (prodData) setProducts(prodData);

      const { data: locData } = await supabase
        .from("locations")
        .select("*")
        .eq("is_active", true)
        .order("label", { ascending: true });
      if (locData) {
        setLocations(locData);
        // Default select INTAKE location if exists
        const intake = locData.find(l => l.code === "INTAKE");
        if (intake) setSelectedLocation(intake);
      }
    };
    loadData();
  }, []);

  // Update cost and MRP from product variant automatically
  useEffect(() => {
    if (selectedProduct) {
      setCostPrice(selectedProduct.purchase_price?.toString() || "");
      setMrp(selectedProduct.price?.toString() || "");
    }
  }, [selectedProduct]);

  // Compute vendor abbreviation initials code (e.g. "P. Ramesh Silk" -> "PRSIL")
  const getVendorAbbreviation = (name: string) => {
    if (!name) return "GEN";
    const clean = name.toUpperCase().replace(/[^A-Z\s]/g, "");
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      return words.map(w => w[0]).join("").slice(0, 5);
    }
    return clean.replace(/\s/g, "").slice(0, 5);
  };

  // Compute encoded supplier code (e.g., 07262800VKFAB)
  const getEncodedVendorCode = (unit: any) => {
    if (!unit || !selectedProduct) return "";
    const date = new Date(dateReceived);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    const cp = String(Math.round(Number(costPrice) || 0));
    const abbrev = getVendorAbbreviation(selectedProduct.supplier_name || "GEN");
    return `${mm}${yy}${cp}${abbrev}`;
  };

  const handleRegisterIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error("Please select a product variant");
      return;
    }
    if (!selectedLocation) {
      toast.error("Please select an initial location");
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    setIsLoading(true);
    const unitsToCreate: any[] = [];
    const baseCode = selectedProduct.sku || selectedProduct.company_barcode || `SPE-${selectedProduct.id.slice(0, 8).toUpperCase()}`;

    try {
      const source = (selectedProduct.supplier_name || "").toLowerCase().match(/(workshop|karigar|in-house)/) 
        ? "in_house" 
        : "supplier";

      // 1. Generate unit codes & query existing to prevent clashes
      for (let i = 1; i <= qty; i++) {
        // If qty is 1 and no existing stock, reuse raw barcode, else suffix
        let generatedCode = baseCode;
        
        // Check variant stock to calculate index offset if suffix is required
        const currentStockCount = selectedProduct.stock || 0;
        if (qty > 1 || currentStockCount > 0) {
          const suffixNum = currentStockCount + i;
          generatedCode = `${baseCode}-${String(suffixNum).padStart(2, '0')}`;
        }

        unitsToCreate.push({
          unit_code: generatedCode,
          product_id: selectedProduct.id,
          current_location_id: selectedLocation.id,
          status: "in_stock",
          source_type: source,
          cost_price: Number(costPrice) || null,
          date_received: dateReceived,
          notes: notes || "Intake receive run"
        });
      }

      // 2. Insert into database
      const createdRows: any[] = [];
      for (const unit of unitsToCreate) {
        const { data, error } = await supabase
          .from("stock_units")
          .insert(unit)
          .select()
          .maybeSingle();

        if (error) {
          // If code duplicate, try alternate suffix
          if (error.code === "23505") {
            const alternateCode = `${unit.unit_code}-ALT-${Math.floor(Math.random() * 1000)}`;
            const { data: altData, error: altError } = await supabase
              .from("stock_units")
              .insert({ ...unit, unit_code: alternateCode })
              .select()
              .maybeSingle();
            
            if (altError) throw altError;
            if (altData) createdRows.push(altData);
          } else {
            throw error;
          }
        } else if (data) {
          createdRows.push(data);
        }
      }

      // 3. Log movements ledger
      for (const unit of createdRows) {
        await supabase
          .from("stock_movements")
          .insert({
            unit_id: unit.id,
            movement_type: "receive",
            from_location_id: null,
            to_location_id: selectedLocation.id,
            old_status: null,
            new_status: "in_stock",
            notes: `Received supplier intake run. Notes: ${notes || "None"}`
          });
      }

      toast.success(`Successfully registered ${createdRows.length} units!`);
      
      // Update local product variant cache reference
      setSelectedProduct(prev => ({
        ...prev,
        stock: (prev.stock || 0) + createdRows.length
      }));

      setReceivedUnits(createdRows);
      setShowPrintPreview(true);

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to register stock intake");
    } finally {
      setIsLoading(false);
      setNotes("");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  /** Sends the freshly registered units straight to the TSC label printer. */
  const handleDirectPrint = async () => {
    if (receivedUnits.length === 0) return;

    const labels: GarmentLabel[] = receivedUnits.map((unit) => ({
      storeName: "SAREE PALACE ELITE",
      category: selectedProduct?.category,
      name: selectedProduct?.name || "Boutique Collection",
      color: selectedProduct?.color,
      size: selectedProduct?.size,
      mrp: Number(mrp) || selectedProduct?.price || 0,
      code: unit.unit_code,
      costCode: getEncodedVendorCode(unit),
    }));

    const settings = loadPrinterSettings();
    setSendingToPrinter(true);
    try {
      await sendTsplJob(buildGarmentLabelJob(labels, settings.media), settings);
      toast.success(`${labels.length} label${labels.length === 1 ? "" : "s"} sent to ${settings.printerName}`);
    } catch (err: any) {
      if (err instanceof PrintAgentOfflineError) {
        toast.error(err.message, {
          action: { label: "Setup", onClick: () => setPrinterSetupOpen(true) },
        });
      } else {
        toast.error(err?.message || "Failed to print labels");
      }
    } finally {
      setSendingToPrinter(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <PrinterSetupDialog open={printerSetupOpen} onOpenChange={setPrinterSetupOpen} />

      {/* Dynamic Printing CSS for 38mm x 25mm thermal label tags */}
      <style>
        {`
          @media print {
            @page {
              size: 38mm 25mm;
              margin: 0;
            }
            body * {
              visibility: hidden;
            }
            #printable-tag-container, #printable-tag-container * {
              visibility: visible;
            }
            #printable-tag-container {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 38mm;
              padding: 0;
              margin: 0;
              background-color: white !important;
            }
            .thermal-print-card {
              width: 38mm;
              height: 25mm;
              page-break-after: always;
              break-after: page;
              box-sizing: border-box;
              padding: 1.0mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              font-family: monospace;
              color: black !important;
              background-color: white !important;
              font-size: 6px;
              line-height: 1.05;
              overflow: hidden;
            }
          }
        `}
      </style>

      {/* Hidden Thermal Printer Container */}
      <div id="printable-tag-container" className="hidden">
        {receivedUnits.map((unit) => (
          <div key={unit.id} className="thermal-print-card">
            {/* Row 1: Item & Category */}
            <div className="flex justify-between font-bold text-[7px] border-b border-black pb-0.5">
              <span className="truncate max-w-[60%] uppercase">
                {selectedProduct?.name?.split("-")[0]?.trim() || "SPE APPAREL"}
              </span>
              <span className="truncate max-w-[38%] text-[5.5px]">
                {selectedProduct?.category || "SPE"}
              </span>
            </div>
            
            {/* Row 2: Description Detail */}
            <div className="text-[5.5px] truncate mt-0.5 font-sans uppercase">
              {selectedProduct?.name || "Boutique Collection"}
            </div>

            {/* Row 3: Fabric & Size */}
            <div className="flex justify-between text-[5.5px] mt-0.5">
              <span>FAB: {selectedProduct?.metadata?.fabric || "NETT"}</span>
              <span>SZ: {selectedProduct?.size || "FREE"}</span>
            </div>

            {/* Row 4: Color */}
            <div className="text-[5.5px]">
              COL: {selectedProduct?.color || "N/A"}
            </div>

            {/* Row 5: Price Tag */}
            <div className="text-[7.5px] font-black text-center border-t border-b border-dashed border-black/30 py-0.5">
              MRP: ₹{(selectedProduct?.price || 0).toLocaleString("en-IN")}
            </div>

            {/* Row 6: Barcode Render */}
            <div className="w-full flex justify-center py-0.5">
              {generateCode39Svg(unit.unit_code)}
            </div>

            {/* Row 7: Barcode Text / Vendor Code */}
            <div className="flex justify-between text-[5px] font-mono mt-0.5">
              <span>{unit.unit_code}</span>
              <span>{getEncodedVendorCode(unit)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Intake & Intake</h1>
          <p className="text-sm text-muted-foreground">Receive supplier delivery batches and generate printed labels</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Intake configuration Form */}
        <Card className="md:col-span-2 shadow">
          <CardHeader>
            <CardTitle className="text-base">Supplier Delivery Form</CardTitle>
            <CardDescription>Input details to register pieces in the physical layout</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegisterIntake} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                
                {/* Product Variant Selector */}
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs font-semibold">Select Catalog Variant *</Label>
                  <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal h-10">
                        {selectedProduct ? (
                          <div className="flex flex-col items-start text-left">
                            <span className="font-semibold text-sm">{selectedProduct.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">
                              SKU: {selectedProduct.sku || "N/A"} • Cat: {selectedProduct.category}
                            </span>
                          </div>
                        ) : (
                          "Search catalog variants..."
                        )}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[450px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search product variant by name or SKU..." 
                          value={productSearch}
                          onValueChange={setProductSearch}
                        />
                        <CommandEmpty>No matching product variant found.</CommandEmpty>
                        <CommandGroup>
                          <CommandList className="max-h-[220px]">
                            {products.filter(p => 
                              p.name?.toLowerCase().includes(productSearch.toLowerCase()) || 
                              p.sku?.toLowerCase().includes(productSearch.toLowerCase())
                            ).map((prod) => (
                              <CommandItem
                                key={prod.id}
                                value={prod.id}
                                onSelect={() => {
                                  setSelectedProduct(prod);
                                  setComboboxOpen(false);
                                }}
                                className="flex justify-between items-center py-2"
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm">{prod.name}</span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    SKU: {prod.sku || "N/A"} • Col: {prod.color || "N/A"}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-xs text-primary">₹{(prod.price || 0).toLocaleString()}</span>
                                  <p className="text-[10px] text-muted-foreground">Legacy Stock: {prod.stock}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Initial Placement Location */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Initial shelf/Zone *</Label>
                  <Popover open={locComboboxOpen} onOpenChange={setLocComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal h-10">
                        {selectedLocation ? selectedLocation.label : "Select placement..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Search shelf locations..." 
                          value={locationSearch}
                          onValueChange={setLocationSearch}
                        />
                        <CommandEmpty>No matching locations.</CommandEmpty>
                        <CommandGroup>
                          <CommandList className="max-h-[180px]">
                            {locations.filter(l => 
                              l.label?.toLowerCase().includes(locationSearch.toLowerCase()) || 
                              l.code?.toLowerCase().includes(locationSearch.toLowerCase())
                            ).map((loc) => (
                              <CommandItem
                                key={loc.id}
                                value={loc.id}
                                onSelect={() => {
                                  setSelectedLocation(loc);
                                  setLocComboboxOpen(false);
                                }}
                                className="flex justify-between py-2"
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm">{loc.label}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{loc.code}</span>
                                </div>
                                <Badge variant="outline" className="text-[9px] uppercase h-fit mt-1">
                                  {loc.location_type}
                                </Badge>
                              </CommandItem>
                            ))}
                          </CommandList>
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Intake Quantity */}
                <div className="space-y-1">
                  <Label htmlFor="receive-qty" className="text-xs font-semibold">Quantity to Receive *</Label>
                  <Input
                    id="receive-qty"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="h-10 text-base"
                    required
                  />
                </div>

                {/* Cost Price */}
                <div className="space-y-1">
                  <Label htmlFor="receive-cost" className="text-xs font-semibold">Purchase Cost Price (₹)</Label>
                  <Input
                    id="receive-cost"
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="Variant cost price"
                    className="h-10"
                  />
                </div>

                {/* Retail MRP */}
                <div className="space-y-1">
                  <Label htmlFor="receive-mrp" className="text-xs font-semibold">Retail Sale Price MRP (₹)</Label>
                  <Input
                    id="receive-mrp"
                    type="number"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    placeholder="Variant MRP"
                    className="h-10"
                  />
                </div>

                {/* Inward Date */}
                <div className="space-y-1">
                  <Label htmlFor="receive-date" className="text-xs font-semibold">Received Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="receive-date"
                      type="date"
                      value={dateReceived}
                      onChange={(e) => setDateReceived(e.target.value)}
                      className="pl-9 h-10"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="receive-notes" className="text-xs">Notes / Details</Label>
                  <Input
                    id="receive-notes"
                    placeholder="e.g. Lot number, supplier invoice number"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

              </div>

              <Button type="submit" className="w-full h-11 gap-2 text-base mt-2" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing & Registering Units...
                  </>
                ) : (
                  <>
                    <Barcode className="w-5 h-5" />
                    Register delivery batch
                  </>
                )}
              </Button>

            </form>
          </CardContent>
        </Card>

        {/* Print Label Panel */}
        <Card className="md:col-span-1 shadow border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-primary" /> Label Generator
            </CardTitle>
            <CardDescription>Print barcode tags for the newly received batch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showPrintPreview && receivedUnits.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 text-green-500 border border-green-500/20 p-3 rounded-lg text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Registered Successfully
                  </p>
                  <p>Registered <strong>{receivedUnits.length}</strong> physical pieces in the database.</p>
                </div>

                <div className="border border-neutral-300 rounded p-3 text-[10px] bg-white text-black font-mono shadow-sm flex flex-col justify-between h-32 max-w-[220px] mx-auto select-none">
                  <div className="flex justify-between border-b pb-0.5 text-[8px] font-bold">
                    <span className="truncate max-w-[60%]">{selectedProduct?.name?.split("-")[0]}</span>
                    <span>{selectedProduct?.category}</span>
                  </div>
                  <div className="text-[7.5px] truncate mt-0.5 uppercase">{selectedProduct?.name}</div>
                  <div className="flex justify-between text-[7px] mt-0.5">
                    <span>FABRIC: {selectedProduct?.metadata?.fabric || "NETT"}</span>
                    <span>SIZE: {selectedProduct?.size || "FREE"}</span>
                  </div>
                  <div className="text-[9px] font-black text-center border-t border-b border-dashed py-0.5 my-1">
                    MRP: ₹{Number(mrp).toLocaleString()}
                  </div>
                  <div className="flex justify-center select-none py-0.5">
                    {generateCode39Svg(receivedUnits[0]?.unit_code)}
                  </div>
                  <div className="flex justify-between text-[6px] mt-0.5">
                    <span>{receivedUnits[0]?.unit_code}</span>
                    <span>{getEncodedVendorCode(receivedUnits[0])}</span>
                  </div>
                </div>

                <div className="space-y-2 mt-2">
                  <Button onClick={handleDirectPrint} disabled={sendingToPrinter} className="w-full gap-2 h-10">
                    {sendingToPrinter ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Print {receivedUnits.length} Label{receivedUnits.length === 1 ? "" : "s"}
                  </Button>
                  <div className="flex gap-2">
                    <Button onClick={handlePrint} variant="outline" size="sm" className="flex-1 gap-1.5 text-xs">
                      <Printer className="w-3.5 h-3.5" /> Browser print
                    </Button>
                    <Button
                      onClick={() => setPrinterSetupOpen(true)}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                    >
                      <Settings2 className="w-3.5 h-3.5" /> Setup
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm flex flex-col items-center gap-2">
                <Printer className="w-8 h-8 text-neutral-300 animate-pulse" />
                Register a supplier delivery batch to enable barcode printing.
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
