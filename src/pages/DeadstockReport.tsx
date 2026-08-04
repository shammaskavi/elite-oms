import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Download, 
  TrendingDown, 
  DollarSign, 
  Archive, 
  RefreshCw,
  Search,
  MapPin
} from "lucide-react";

export default function DeadstockReport() {
  const [deadstockUnits, setDeadstockUnits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  
  const navigate = useNavigate();

  const loadDeadstockData = async () => {
    setIsLoading(true);
    try {
      // Fetch all sellable units via deadstock view
      const { data, error } = await supabase
        .from("v_stock_units_deadstock")
        .select("*");

      if (error) throw error;

      if (data) {
        setDeadstockUnits(data);
        
        // Extract unique categories
        const cats = Array.from(new Set(data.map((u: any) => u.product_category).filter(Boolean))) as string[];
        setCategories(cats);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load deadstock data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeadstockData();
  }, []);

  // Filter logic
  const filteredUnits = deadstockUnits.filter((unit) => {
    const matchesCat = categoryFilter === "all" || unit.product_category === categoryFilter;
    const matchesBucket = bucketFilter === "all" || unit.age_bucket === bucketFilter;
    return matchesCat && matchesBucket;
  });

  // Analytics Math
  const totalCost = filteredUnits.reduce((acc, u) => acc + (u.cost_price || 0), 0);
  const totalRetail = filteredUnits.reduce((acc, u) => acc + (u.product_mrp || 0), 0);
  
  // Group by Age bucket
  const bucketCounts = filteredUnits.reduce((acc: any, u) => {
    acc[u.age_bucket] = (acc[u.age_bucket] || 0) + 1;
    return acc;
  }, {});

  const chartData = [
    { name: "Fresh (<180d)", count: bucketCounts["fresh"] || 0, fill: "#22c55e" },
    { name: "Slow (180-365d)", count: bucketCounts["slow_moving"] || 0, fill: "#eab308" },
    { name: "Aging (365-730d)", count: bucketCounts["aging"] || 0, fill: "#f97316" },
    { name: "Deadstock (>730d)", count: bucketCounts["deadstock"] || 0, fill: "#ef4444" }
  ];

  // Group by Category (Top 6)
  const categoryCounts = filteredUnits.reduce((acc: any, u) => {
    const cat = u.product_category || "Uncategorized";
    acc[cat] = (acc[cat] || 0) + (u.cost_price || 0);
    return acc;
  }, {});

  const categoryChartData = Object.entries(categoryCounts).map(([name, cost]) => ({
    name,
    cost
  })).sort((a, b) => b.cost - a.cost).slice(0, 6);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  const handleExportCSV = () => {
    if (filteredUnits.length === 0) {
      toast.error("No items to export");
      return;
    }

    const headers = ["Unit Code", "Product Name", "Category", "Shelf Location", "Location Code", "Age (Days)", "Age Bucket", "MRP (₹)", "Cost Price (₹)", "Date Received"];
    const rows = filteredUnits.map((u) => [
      u.unit_code,
      u.product_name,
      u.product_category,
      u.location_label || "No Location",
      u.location_code || "N/A",
      u.age_days,
      u.age_bucket.replace(/_/g, " ").toUpperCase(),
      u.product_mrp,
      u.cost_price || 0,
      u.date_received
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SPE_Deadstock_PullList_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Pull list checklist exported successfully!");
  };

  const getBucketBadge = (bucket: string) => {
    switch (bucket) {
      case "fresh": return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">FRESH</Badge>;
      case "slow_moving": return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">SLOW</Badge>;
      case "aging": return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">AGING</Badge>;
      case "deadstock": return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">DEAD</Badge>;
      default: return null;
    }
  };

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deadstock & Aging Report</h1>
            <p className="text-sm text-muted-foreground">Monitor slow-moving showroom units and export clearance pull lists</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDeadstockData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading && "animate-spin"}`} />
            Refresh
          </Button>
          <Button onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export Pull list
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase">Active Pieces Tagged</CardTitle>
            <Archive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredUnits.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total pieces tracked under filters</p>
          </CardContent>
        </Card>

        <Card className="shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase">Retail Stock Value</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRetail.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground mt-1">Total valuation at MRP retail rate</p>
          </CardContent>
        </Card>

        <Card className="shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase">Capital Tied Up (Cost)</CardTitle>
            <TrendingDown className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalCost.toLocaleString("en-IN")}</div>
            <p className="text-xs text-muted-foreground mt-1">Total capital bound at purchase rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Age buckets chart */}
        <Card className="shadow">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Stock Age Distribution (Units count)</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Categories bound capital chart */}
        <Card className="shadow">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Capital Tied Up by Category (Top 6 Cost Value)</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            {categoryChartData.length === 0 ? (
              <p className="text-muted-foreground text-xs">No category data available</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="cost"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Checklist Table pulls list */}
      <Card className="shadow">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Clearance Checklist / Pull List</CardTitle>
            <CardDescription>Check physical locations of slow-moving garments to clear racks</CardDescription>
          </div>
          
          {/* Filters */}
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={bucketFilter} onValueChange={setBucketFilter}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue placeholder="All Ages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ages</SelectItem>
                <SelectItem value="fresh">Fresh (&lt;180 days)</SelectItem>
                <SelectItem value="slow_moving">Slow (180-365 days)</SelectItem>
                <SelectItem value="aging">Aging (365-730 days)</SelectItem>
                <SelectItem value="deadstock">Deadstock (&gt;730 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredUnits.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No items found matching the selected filters.</div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-neutral-500/5 sticky top-0">
                  <TableRow>
                    <TableHead className="py-2 text-xs">Garment tag</TableHead>
                    <TableHead className="py-2 text-xs">Design Item</TableHead>
                    <TableHead className="py-2 text-xs">Category</TableHead>
                    <TableHead className="py-2 text-xs">Shelf Location</TableHead>
                    <TableHead className="py-2 text-xs">Age</TableHead>
                    <TableHead className="py-2 text-xs">MRP (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnits.slice(0, 100).map((unit) => (
                    <TableRow key={unit.unit_id} className="hover:bg-neutral-500/5">
                      <TableCell className="py-2 font-mono font-bold text-xs">{unit.unit_code}</TableCell>
                      <TableCell className="py-2 text-xs max-w-[200px] truncate">{unit.product_name}</TableCell>
                      <TableCell className="py-2 text-xs">{unit.product_category}</TableCell>
                      <TableCell className="py-2 text-xs font-semibold text-primary">
                        {unit.location_label ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {unit.location_label} ({unit.location_code})
                          </span>
                        ) : (
                          "Intake Area"
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        <div className="flex flex-col">
                          <span>{unit.age_days} Days</span>
                          {getBucketBadge(unit.age_bucket)}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-bold">₹{unit.product_mrp?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {filteredUnits.length > 100 && (
            <div className="text-center py-3 text-xs text-muted-foreground border-t bg-neutral-500/5">
              Showing first 100 items. Export to CSV to see all {filteredUnits.length} pieces.
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
