import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Printer, 
  Folder, 
  Grid, 
  Bookmark, 
  MapPin,
  ChevronDown,
  ChevronRight,
  Barcode
} from "lucide-react";

// Code 39 character map for location barcodes
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

  const width = bitString.length * 1.5;
  const height = 22;

  return (
    <svg width="100%" height="22" viewBox={`0 0 ${width} ${height}`} className="w-full h-[22px] mt-0.5 select-none">
      {bitString.split("").map((bit, idx) => {
        if (bit === "1") {
          return <rect key={idx} x={idx * 1.5} y="0" width="1.5" height={height} fill="black" />;
        }
        return null;
      })}
    </svg>
  );
}

export default function LocationsAdmin() {
  const [locations, setLocations] = useState<any[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Form fields
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [locationType, setLocationType] = useState("SHELF");
  const [parentId, setParentId] = useState<string>("none");
  const [barcode, setBarcode] = useState("");
  
  const [expandedNodes, setExpandedNodes] = useState<{ [id: string]: boolean }>({});
  const [printTarget, setPrintTarget] = useState<any>(null);
  
  const navigate = useNavigate();

  const loadLocations = async () => {
    const { data } = await supabase
      .from("locations")
      .select("*")
      .order("label", { ascending: true });
    if (data) setLocations(data);
  };

  useEffect(() => {
    loadLocations();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, "-");
    const cleanLabel = label.trim();
    const cleanBarcode = barcode.trim() || `LOC-${cleanCode}`;

    if (!cleanCode || !cleanLabel) {
      toast.error("Please fill in code and label");
      return;
    }

    try {
      const payload: any = {
        code: cleanCode,
        label: cleanLabel,
        location_type: locationType,
        barcode: cleanBarcode,
        parent_id: parentId === "none" ? null : parentId,
        is_active: true
      };

      const { error } = await supabase
        .from("locations")
        .insert(payload);

      if (error) throw error;

      toast.success("Shelf location created successfully!");
      
      // Clear fields
      setCode("");
      setLabel("");
      setBarcode("");
      setParentId("none");
      loadLocations();

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create location");
    }
  };

  const handleDelete = async (id: string) => {
    if (role !== "admin") {
      toast.error("Access Denied: Only store administrators can delete shelf layout nodes");
      return;
    }
    if (!confirm("Are you sure you want to delete this shelf location? All nested shelves will also be deleted.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("locations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Location deleted successfully");
      loadLocations();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete location");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrintTrigger = (loc: any) => {
    setPrintTarget(loc);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  // Render locations tree recursively
  const renderTree = (parentVal: string | null, depth: number = 0) => {
    const nodes = locations.filter(l => l.parent_id === parentVal);
    
    if (nodes.length === 0) return null;

    return (
      <div className="space-y-1.5 pl-4 border-l border-dashed border-neutral-200 mt-1">
        {nodes.map((node) => {
          const hasChildren = locations.some(l => l.parent_id === node.id);
          const isExpanded = expandedNodes[node.id];

          return (
            <div key={node.id} className="space-y-1">
              <div className="flex items-center justify-between p-2 rounded hover:bg-neutral-500/5 transition-colors group">
                <div className="flex items-center gap-2">
                  {hasChildren ? (
                    <button onClick={() => toggleExpand(node.id)} className="text-neutral-500 hover:text-foreground">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4 h-4 shrink-0" />
                  )}

                  {node.location_type === "ZONE" ? (
                    <Folder className="w-4 h-4 text-amber-500 fill-amber-500/10 shrink-0" />
                  ) : node.location_type === "RACK" ? (
                    <Grid className="w-4 h-4 text-blue-500 shrink-0" />
                  ) : (
                    <Bookmark className="w-4 h-4 text-green-500 shrink-0" />
                  )}

                  <span className="font-medium text-sm">{node.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono bg-accent/40 px-1 rounded">
                    {node.code}
                  </span>
                  <Badge variant="outline" className="text-[8px] uppercase tracking-wider h-fit py-0 px-1 font-sans">
                    {node.location_type}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => handlePrintTrigger(node)} className="h-7 w-7 text-neutral-500 hover:text-foreground">
                    <Printer className="w-3.5 h-3.5" />
                  </Button>
                  {role === "admin" && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(node.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {hasChildren && isExpanded && renderTree(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      
      {/* Location Barcode printer CSS - prints a single 38mm x 25mm shelf tag */}
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
            #printable-location-tag, #printable-location-tag * {
              visibility: visible;
            }
            #printable-location-tag {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 38mm;
              height: 25mm;
              box-sizing: border-box;
              padding: 1mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
              font-family: monospace;
              color: black !important;
              background-color: white !important;
            }
          }
        `}
      </style>

      {/* Hidden printable single tag frame */}
      {printTarget && (
        <div id="printable-location-tag" className="hidden">
          <div className="font-bold text-[7px] border-b border-black pb-0.5 tracking-wider">
            SAREE PALACE LAYOUT
          </div>
          <div className="text-[8px] font-black uppercase truncate mt-0.5">
            {printTarget.label}
          </div>
          <div className="w-full flex justify-center py-0.5">
            {generateCode39Svg(printTarget.barcode)}
          </div>
          <div className="text-[5.5px] font-bold">
            {printTarget.barcode} ({printTarget.code})
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Showroom Shelf layout</h1>
          <p className="text-sm text-muted-foreground">Manage nested showroom zones, storage racks, and shelf layouts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Create Location Form */}
        <Card className="md:col-span-1 shadow border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-primary" /> Add Shelf Location
            </CardTitle>
            <CardDescription>Insert a new node inside your store layout</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-1">
                <Label htmlFor="loc-label" className="text-xs">Location Label *</Label>
                <Input
                  id="loc-label"
                  placeholder="e.g. Shelf 2, Rack C"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="loc-code" className="text-xs">Unique Code *</Label>
                <Input
                  id="loc-code"
                  placeholder="e.g. GF-RKC-S2"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="loc-type" className="text-xs">Location Type *</Label>
                <Select value={locationType} onValueChange={setLocationType}>
                  <SelectTrigger id="loc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ZONE">ZONE (Warehouse / Floor)</SelectItem>
                    <SelectItem value="RACK">RACK (Structural shelf stand)</SelectItem>
                    <SelectItem value="SHELF">SHELF (Horizonal row)</SelectItem>
                    <SelectItem value="BIN">BIN (Box / Container)</SelectItem>
                    <SelectItem value="TRIAL_ROOM">TRIAL ROOM</SelectItem>
                    <SelectItem value="WORKSHOP">WORKSHOP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="loc-parent" className="text-xs">Parent Location</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger id="loc-parent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top level Area/Zone)</SelectItem>
                    {locations.filter(l => l.location_type === "ZONE" || l.location_type === "RACK").map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.label} ({loc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="loc-barcode" className="text-xs">Custom Barcode (Optional)</Label>
                <Input
                  id="loc-barcode"
                  placeholder="Defaults to LOC-CODE"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full gap-2 mt-2">
                <Plus className="w-4 h-4" /> Create Location
              </Button>

            </form>
          </CardContent>
        </Card>

        {/* Tree View layout Display */}
        <Card className="md:col-span-2 shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-primary" /> Store Layout map
            </CardTitle>
            <CardDescription>Nested physical areas. Click arrows to expand children.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {locations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No store locations registered yet. Define layout zones on the left.
              </div>
            ) : (
              <div className="max-h-[500px] overflow-y-auto pr-2 space-y-1">
                {/* Render top-level nodes */}
                {locations.filter(l => l.parent_id === null).map((node) => {
                  const hasChildren = locations.some(l => l.parent_id === node.id);
                  const isExpanded = expandedNodes[node.id];

                  return (
                    <div key={node.id} className="border-b last:border-0 pb-2">
                      <div className="flex items-center justify-between p-2 rounded hover:bg-neutral-500/5 transition-colors group">
                        <div className="flex items-center gap-2">
                          {hasChildren ? (
                            <button onClick={() => toggleExpand(node.id)} className="text-neutral-500 hover:text-foreground">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 h-4 shrink-0" />
                          )}
                          <Folder className="w-4.5 h-4.5 text-amber-500 fill-amber-500/10 shrink-0" />
                          <span className="font-bold text-sm">{node.label}</span>
                          <span className="text-[10px] text-muted-foreground font-mono bg-accent/40 px-1 rounded">
                            {node.code}
                          </span>
                          <Badge variant="outline" className="text-[8px] uppercase tracking-wider py-0 px-1">
                            {node.location_type}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => handlePrintTrigger(node)} className="h-7 w-7 text-neutral-500 hover:text-foreground">
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          {role === "admin" && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(node.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {hasChildren && isExpanded && renderTree(node.id, 1)}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
