import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Plus,
  Pencil,
  Trash2,
  Barcode,
  QrCode,
  Wand2,
  ShoppingBag,
  Upload,
  Download,
  AlertTriangle,
  Boxes,
  TrendingUp,
  IndianRupee,
  Activity,
  Printer,
  ChevronRight,
  Loader2,
  PlusCircle,
  MinusCircle,
  Check,
  ChevronsUpDown,
  Calendar,
  User,
  Info,
  History,
  Tag,
  Truck,
  Palette,
  Maximize2
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

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
    bitString += bits + "0"; // inter-character gap
  }

  const width = bitString.length * 1.5;
  const height = 40;

  return (
    <svg width="100%" height="45" viewBox={`0 0 ${width} ${height}`} className="w-full h-10 mt-1 select-none">
      {bitString.split("").map((bit, idx) => {
        if (bit === "1") {
          return <rect key={idx} x={idx * 1.5} y="0" width="1.5" height={height} fill="black" />;
        }
        return null;
      })}
    </svg>
  );
}

// Basic CSV string parser matching RFC 4180
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          cell += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell.trim());
        cell = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(cell.trim());
        if (row.some(c => c !== '')) {
          lines.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) {
      lines.push(row);
    }
  }

  return lines;
}

export default function Products() {
  useDocumentTitle("Products");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Selection & Bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printingTags, setPrintingTags] = useState(false);

  // Category Combobox Select States
  const [categoryComboboxOpen, setCategoryComboboxOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");

  // Product detail view state
  const [selectedProductDetails, setSelectedProductDetails] = useState<any | null>(null);

  // Stock Manual Adjustment States
  const [adjustStockProduct, setAdjustStockProduct] = useState<any | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [adjustNotes, setAdjustNotes] = useState("");

  // CSV Import States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ success: 0, failed: 0, total: 0 });

  // Complete form inputs with extended inventory fields
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: "",
    stock: "0",
    category: "",
    color: "",
    size: "",
    purchase_price: "",
    mrp: "",
    item_code: "",
    company_barcode: "",
    hsn_code: "",
    supplier_name: "",
    status: "available",
    inward_date: new Date().toISOString().split("T")[0],
    purchase_date: new Date().toISOString().split("T")[0],
  });

  const [activeTab, setActiveTab] = useState("details");

  // Load products list from Supabase
  const { data: products, isLoading, isError, refetch } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Calculate unique categories for dropdown suggestion
  const existingCategories = useMemo(() => {
    if (!products) return [];
    const cats = products.map((p) => p.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [products]);

  // Fetch audit log & sales order history dynamically for selected detail popup
  const { data: movementHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["product-history", selectedProductDetails?.id],
    queryFn: async () => {
      if (!selectedProductDetails?.id) return [];

      // 1. Fetch audit logs (manual adjustments)
      const { data: auditLogs, error: auditError } = await supabase
        .from("audit_logs")
        .select("id, created_at, payload, actor_profile_id, profiles:actor_profile_id(full_name)")
        .eq("resource_type", "products")
        .eq("resource_id", selectedProductDetails.id)
        .order("created_at", { ascending: false });

      if (auditError) console.error("Audit log fetch error:", auditError);

      // 2. Fetch orders (production sales & cancellations)
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_code, order_status, created_at, metadata, customers(name), invoices(invoice_number)")
        .eq("metadata->>product_id", selectedProductDetails.id)
        .order("created_at", { ascending: false });

      if (ordersError) console.error("Orders fetch error:", ordersError);

      const historyList: any[] = [];

      // Add manual adjustments to timeline
      if (auditLogs) {
        auditLogs.forEach((log: any) => {
          const diff = log.payload?.adjustment || 0;
          historyList.push({
            id: log.id,
            date: log.created_at,
            type: "adjustment",
            action: diff > 0 ? "added" : "deducted",
            qty: Math.abs(diff),
            user: log.profiles?.full_name || "System",
            notes: log.payload?.notes || "Manual stock override",
          });
        });
      }

      // Add sales & returns to timeline
      if (ordersData) {
        ordersData.forEach((ord: any) => {
          const qty = parseInt(ord.metadata?.qty || 1);
          const customer = ord.customers?.name || "Customer";
          const invNum = ord.invoices?.invoice_number || "Invoice";

          historyList.push({
            id: ord.id + "-sale",
            date: ord.created_at,
            type: "sale",
            action: "sold",
            qty: qty,
            user: customer,
            notes: `Sold via ${invNum} to ${customer}. Status: ${ord.order_status}`,
          });

          // Cancelled order counts as stock return
          if (ord.order_status === "cancelled") {
            historyList.push({
              id: ord.id + "-cancel",
              date: ord.created_at,
              type: "return",
              action: "returned",
              qty: qty,
              user: customer,
              notes: `Returned to inventory - Order ${ord.order_code} was cancelled`,
            });
          }
        });
      }

      // Sort chronological descending
      return historyList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!selectedProductDetails?.id,
  });

  // Calculate Valuation and Dashboard Metrics
  const stats = useMemo(() => {
    if (!products) return { totalQty: 0, totalCostValuation: 0, totalMrpValuation: 0, lowStockCount: 0 };
    let totalQty = 0;
    let totalCostValuation = 0;
    let totalMrpValuation = 0;
    let lowStockCount = 0;

    products.forEach((p) => {
      const stockVal = p.stock || 0;
      totalQty += stockVal;
      totalCostValuation += (Number(p.purchase_price) || Number(p.price) || 0) * stockVal;
      totalMrpValuation += (Number(p.mrp) || Number(p.price) || 0) * stockVal;
      if (stockVal <= 0) {
        lowStockCount++;
      }
    });

    return { totalQty, totalCostValuation, totalMrpValuation, lowStockCount };
  }, [products]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("products").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created");
      setOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      const { error } = await supabase.from("products").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated");
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== productToDelete?.id));
    },
  });

  // Bulk deletion mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`${variables.length} products deleted successfully`);
      setSelectedIds([]);
    },
  });

  // Manual stock adjustment mutation (updates stock and inserts into audit_logs)
  const adjustStockMutation = useMutation({
    mutationFn: async () => {
      if (!adjustStockProduct) return;
      const parsedQty = parseInt(adjustQty);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        throw new Error("Invalid adjustment quantity");
      }

      const diff = adjustType === "add" ? parsedQty : -parsedQty;
      const newStock = Math.max(0, (adjustStockProduct.stock || 0) + diff);

      // 1. Update product stock
      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", adjustStockProduct.id);

      if (updateError) throw updateError;

      // 2. Fetch actor profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      // 3. Log to audit_logs
      await supabase.from("audit_logs").insert([
        {
          actor_profile_id: profile?.id,
          action_type: "stock_adjustment",
          resource_type: "products",
          resource_id: adjustStockProduct.id,
          payload: {
            previous_stock: adjustStockProduct.stock,
            adjustment: diff,
            new_stock: newStock,
            notes: adjustNotes || "Manual stock override",
          },
        },
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Stock count adjusted");

      // Update selected details popup stock display in real time
      if (selectedProductDetails && selectedProductDetails.id === adjustStockProduct.id) {
        const diff = adjustType === "add" ? parseInt(adjustQty) : -parseInt(adjustQty);
        setSelectedProductDetails((prev: any) => ({
          ...prev,
          stock: Math.max(0, (prev.stock || 0) + diff)
        }));
      }

      setAdjustStockProduct(null);
      setAdjustQty("");
      setAdjustNotes("");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to adjust stock");
    },
  });

  // Bulk Tag Printing Handler
  const handleBulkPrintTags = () => {
    if (selectedIds.length === 0) {
      toast.info("Please select products to print tags for");
      return;
    }
    setPrintingTags(true);
    setTimeout(() => {
      window.print();
      setPrintingTags(false);
    }, 300);
  };

  // CSV Stock Importer Handler (supports chunking/batch uploads)
  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(0);
    setImportStats({ success: 0, failed: 0, total: 0 });

    try {
      const text = await file.text();
      const parsedRows = parseCSV(text);

      if (parsedRows.length <= 1) {
        toast.error("CSV file seems to be empty or missing items.");
        setImporting(false);
        return;
      }

      // Find Column Headers Index
      let headerRowIndex = -1;
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        if (row.some(c => c.toLowerCase() === 'barcode' || c.toLowerCase() === 'item')) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        toast.error("Could not locate Barcode or Item column header in CSV.");
        setImporting(false);
        return;
      }

      const headers = parsedRows[headerRowIndex].map(h => h.toLowerCase());
      const dataRows = parsedRows.slice(headerRowIndex + 1);

      // Maps CSV columns to db fields dynamically
      const colMap = {
        barcode: headers.indexOf("barcode"),
        name: headers.indexOf("item"),
        color: headers.indexOf("color"),
        purchase_price: headers.indexOf("pur. rate"),
        mrp: headers.indexOf("mrp"),
        company_barcode: headers.indexOf("company barcode"),
        category: headers.indexOf("product name"),
        item_code: headers.indexOf("item id"),
        hsn_code: headers.indexOf("hsn code"),
        supplier_name: headers.indexOf("party name"),
        stock: headers.indexOf("qty") !== -1 ? headers.indexOf("qty") : headers.indexOf("stock")
      };

      if (colMap.name === -1) {
        toast.error("CSV must contain an 'Item' column representing the product name.");
        setImporting(false);
        return;
      }

      const itemsToUpload: any[] = [];
      dataRows.forEach(row => {
        const barcodeVal = colMap.barcode !== -1 ? row[colMap.barcode] : null;
        const nameVal = row[colMap.name];
        if (!nameVal) return; // Skip rows without item name

        // Parse numbers safely, removing currency symbols and formatting commas
        const cleanNumber = (val: string) => {
          if (!val) return null;
          const cleaned = val.replace(/[^\d.]/g, "");
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        };

        const cleanInt = (val: string) => {
          if (!val) return 1;
          const cleaned = val.replace(/[^\d]/g, "");
          const num = parseInt(cleaned);
          return isNaN(num) ? 1 : num;
        };

        itemsToUpload.push({
          sku: barcodeVal || `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          name: nameVal,
          color: colMap.color !== -1 ? row[colMap.color] || null : null,
          purchase_price: colMap.purchase_price !== -1 ? cleanNumber(row[colMap.purchase_price]) : null,
          mrp: colMap.mrp !== -1 ? cleanNumber(row[colMap.mrp]) : null,
          price: colMap.mrp !== -1 ? cleanNumber(row[colMap.mrp]) : (colMap.purchase_price !== -1 ? cleanNumber(row[colMap.purchase_price]) : 0),
          company_barcode: colMap.company_barcode !== -1 ? row[colMap.company_barcode] || null : null,
          category: colMap.category !== -1 ? row[colMap.category] || null : null,
          item_code: colMap.item_code !== -1 ? row[colMap.item_code] || null : null,
          hsn_code: colMap.hsn_code !== -1 ? row[colMap.hsn_code] || null : null,
          supplier_name: colMap.supplier_name !== -1 ? row[colMap.supplier_name] || null : null,
          stock: colMap.stock !== -1 ? cleanInt(row[colMap.stock]) : 1,
          status: "available"
        });
      });

      setImportStats(prev => ({ ...prev, total: itemsToUpload.length }));

      // Batch Upload in chunks of 200 items to avoid payload limits
      const chunkSize = 200;
      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < itemsToUpload.length; i += chunkSize) {
        const chunk = itemsToUpload.slice(i, i + chunkSize);

        // Grab unique barcodes in chunk to avoid SQL constraints error, prioritizing earlier row
        const uniqueChunk: any[] = [];
        const seenSkus = new Set();
        chunk.forEach(item => {
          if (!seenSkus.has(item.sku)) {
            seenSkus.add(item.sku);
            uniqueChunk.push(item);
          } else {
            failed++;
          }
        });

        const { error } = await supabase.from("products").insert(uniqueChunk);

        if (error) {
          console.error("Batch insert failed for chunk index:", i, error);
          failed += uniqueChunk.length;
        } else {
          succeeded += uniqueChunk.length;
        }

        const progress = Math.min(100, Math.round(((i + chunk.length) / itemsToUpload.length) * 100));
        setImportProgress(progress);
        setImportStats(prev => ({ ...prev, success: succeeded, failed }));
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Successfully imported ${succeeded} products!`);
      setCsvImportOpen(false);
    } catch (err: any) {
      console.error("CSV import crash:", err);
      toast.error("Failed to parse CSV file. Ensure it is formatted correctly.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Bulk CSV Export
  const handleBulkExport = () => {
    const selectedProducts = products?.filter(p => selectedIds.includes(p.id)) || [];
    if (selectedProducts.length === 0) return;

    const headers = ["Barcode", "Item Name", "Color", "MRP", "Purchase Rate", "Company Barcode", "Category", "HSN Code", "Supplier", "Stock"];
    const csvRows = [headers.join(",")];

    selectedProducts.forEach(p => {
      const row = [
        `"${p.sku || ''}"`,
        `"${p.name || ''}"`,
        `"${p.color || ''}"`,
        p.mrp || p.price || 0,
        p.purchase_price || 0,
        `"${p.company_barcode || ''}"`,
        `"${p.category || ''}"`,
        `"${p.hsn_code || ''}"`,
        `"${p.supplier_name || ''}"`,
        p.stock || 0
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `elite-inventory-export-${Date.now()}.csv`);
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      price: "",
      stock: "0",
      category: "",
      color: "",
      size: "",
      purchase_price: "",
      mrp: "",
      item_code: "",
      company_barcode: "",
      hsn_code: "",
      supplier_name: "",
      status: "available",
      inward_date: new Date().toISOString().split("T")[0],
      purchase_date: new Date().toISOString().split("T")[0],
    });
    setEditingProduct(null);
    setActiveTab("details");
  };

  const generateSKU = () => {
    const sku = `SPE-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    setFormData({ ...formData, sku });
    toast.success("SKU generated");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = formData.price ? parseFloat(formData.price) : (formData.mrp ? parseFloat(formData.mrp) : 0);
    const data = {
      name: formData.name,
      sku: formData.sku || null,
      price: parsedPrice,
      stock: formData.stock ? parseInt(formData.stock) : 0,
      category: formData.category || null,
      color: formData.color || null,
      size: formData.size || null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      mrp: formData.mrp ? parseFloat(formData.mrp) : null,
      item_code: formData.item_code || null,
      company_barcode: formData.company_barcode || null,
      hsn_code: formData.hsn_code || null,
      supplier_name: formData.supplier_name || null,
      status: formData.status || "available",
      inward_date: formData.inward_date || null,
      purchase_date: formData.purchase_date || null,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || "",
      price: product.price?.toString() || "",
      stock: product.stock?.toString() || "0",
      category: product.category || "",
      color: product.color || "",
      size: product.size || "",
      purchase_price: product.purchase_price?.toString() || "",
      mrp: product.mrp?.toString() || "",
      item_code: product.item_code || "",
      company_barcode: product.company_barcode || "",
      hsn_code: product.hsn_code || "",
      supplier_name: product.supplier_name || "",
      status: product.status || "available",
      inward_date: product.inward_date || new Date().toISOString().split("T")[0],
      purchase_date: product.purchase_date || new Date().toISOString().split("T")[0],
    });
    setOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && filteredProducts) {
      setSelectedIds(filteredProducts.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (checked: boolean, id: string) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  // Filter & Search Products logic
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.item_code && p.item_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.company_barcode && p.company_barcode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesLowStock = !lowStockFilter || (p.stock || 0) <= 0;

      return matchesSearch && matchesLowStock;
    });
  }, [products, searchQuery, lowStockFilter]);

  return (
    <div className="space-y-6 p-4 md:p-0 select-none">
      {/* Dynamic print-tags styled layer which handles document tags printing layout */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #print-tag-layout, #print-tag-layout * {
              visibility: visible;
            }
            #print-tag-layout {
              position: absolute;
              left: 0;
              top: 0;
              width: 210mm; /* A4 width */
              padding: 5mm;
              background-color: white !important;
            }
            .print-tag-card {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}
      </style>

      {/* Hidden tags overlay for rendering barcode tags on A4 paper grid */}
      <div id="print-tag-layout" className="hidden print:grid print:grid-cols-3 print:gap-4 print:p-2 bg-white">
        {(products || [])
          .filter(p => selectedIds.includes(p.id))
          .map((p) => (
            <div
              key={p.id}
              className="print-tag-card border border-neutral-900 rounded p-2.5 flex flex-col items-center justify-between text-center bg-white text-black h-[48mm] w-[62mm] box-border relative overflow-hidden select-none"
            >
              <div className="text-[9px] font-black tracking-widest uppercase border-b border-black w-full pb-0.5 mb-1 font-mono">
                SAREE PALACE ELITE
              </div>
              <div className="text-[11px] font-bold mt-0.5 line-clamp-1 max-w-full font-mono uppercase">
                {p.name}
              </div>
              {p.color && (
                <div className="text-[8px] text-neutral-600 font-mono">
                  Color: {p.color} {p.size && `• Size: ${p.size}`}
                </div>
              )}
              <div className="w-full flex justify-center py-1 select-none">
                {generateCode39Svg(p.sku || p.company_barcode || 'SPE-000')}
              </div>
              <div className="text-[9px] font-mono tracking-wider font-bold mb-1">
                {p.sku || p.company_barcode}
              </div>
              <div className="text-[13px] font-extrabold uppercase border-t border-black pt-1 w-full flex justify-between px-2 font-mono">
                <span>MRP:</span>
                <span>₹{(p.mrp || p.price || 0).toLocaleString()}</span>
              </div>
            </div>
          ))}
      </div>

      {/* Overview Inventory Valuation Banner */}
      {!isLoading && !isError && products && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <Card className="p-4 shadow-sm flex items-center justify-between border bg-gradient-to-br from-card to-secondary/10 hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Total Products</span>
              <h3 className="text-3xl font-extrabold font-mono text-primary">{products.length}</h3>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg">
              <ShoppingBag className="h-6 w-6 text-primary" />
            </div>
          </Card>

          <Card className="p-4 shadow-sm flex items-center justify-between border bg-gradient-to-br from-card to-emerald-50/20 hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">In Stock Qty</span>
              <h3 className="text-3xl font-extrabold font-mono text-emerald-600">{stats.totalQty}</h3>
            </div>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Boxes className="h-6 w-6 text-emerald-600" />
            </div>
          </Card>

          <Card className="p-4 shadow-sm flex items-center justify-between border bg-gradient-to-br from-card to-indigo-50/20 hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Cost Valuation</span>
              <h3 className="text-2xl font-extrabold font-mono text-indigo-600">₹{stats.totalCostValuation.toLocaleString()}</h3>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
            </div>
          </Card>

          <Card className="p-4 shadow-sm flex items-center justify-between border bg-gradient-to-br from-card to-destructive/5 hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Out of Stock</span>
              <h3 className={`text-3xl font-extrabold font-mono ${stats.lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>{stats.lowStockCount}</h3>
            </div>
            <div className={`p-2 rounded-lg ${stats.lowStockCount > 0 ? "bg-destructive/10 animate-pulse" : "bg-muted"}`}>
              <AlertTriangle className={`h-6 w-6 ${stats.lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
          </Card>
        </div>
      )}

      {/* Filter controls and page actions */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Boxes className="w-8 h-8 text-primary" />
          Products & Inventory
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCsvImportOpen(true)} className="shadow-sm">
            <Upload className="w-4 h-4 mr-2" />
            CSV Stock Import
          </Button>

          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Product Details" : "Add New Stock Product"}</DialogTitle>
              </DialogHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Basic Details</TabsTrigger>
                  <TabsTrigger value="costing">Cost & Supplier</TabsTrigger>
                  <TabsTrigger value="attributes">Attributes & Barcode</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <TabsContent value="details" className="space-y-4">
                    <div>
                      <Label htmlFor="name">Garment/Item Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="e.g. Silk Kanjivaram Saree"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Dynamic Combobox Category Dropdown */}
                      <div>
                        <Label htmlFor="category">Category (Product Type)</Label>
                        <Popover open={categoryComboboxOpen} onOpenChange={setCategoryComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={categoryComboboxOpen}
                              className="w-full justify-between h-10 font-normal shadow-sm"
                            >
                              <span>{formData.category || "Select or type category..."}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[280px] p-0" align="start">
                            <Command>
                              <CommandInput
                                placeholder="Search or type new category..."
                                value={categorySearchQuery}
                                onValueChange={(val) => {
                                  setCategorySearchQuery(val);
                                  setFormData(prev => ({ ...prev, category: val }));
                                }}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFormData(prev => ({ ...prev, category: categorySearchQuery }));
                                      setCategoryComboboxOpen(false);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs text-blue-600 font-bold hover:bg-accent rounded"
                                  >
                                    + Create Category "{categorySearchQuery}"
                                  </button>
                                </CommandEmpty>
                                <CommandGroup>
                                  {existingCategories
                                    .filter(cat => cat.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                                    .map((cat) => (
                                      <CommandItem
                                        key={cat}
                                        value={cat}
                                        onSelect={() => {
                                          setFormData(prev => ({ ...prev, category: cat }));
                                          setCategorySearchQuery("");
                                          setCategoryComboboxOpen(false);
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", formData.category === cat ? "opacity-100" : "opacity-0")} />
                                        {cat}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label htmlFor="status">Current Status</Label>
                        <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                          <SelectTrigger className="shadow-sm"><SelectValue placeholder="Select Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="reserved">Reserved (Booked)</SelectItem>
                            <SelectItem value="sold">Sold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="stock">Initial Stock Quantity *</Label>
                        <Input
                          id="stock"
                          type="number"
                          value={formData.stock}
                          onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                          required
                          min="0"
                          disabled={!!editingProduct} // Require using the manual adjustment trigger for edits
                        />
                      </div>
                      <div>
                        <Label htmlFor="inward_date">Inward Date</Label>
                        <Input
                          id="inward_date"
                          type="date"
                          value={formData.inward_date}
                          onChange={(e) => setFormData({ ...formData, inward_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button type="button" onClick={() => setActiveTab("costing")} className="w-full flex items-center justify-center gap-2 mt-2">
                      Next: Costs & Pricing <ChevronRight className="w-4 h-4" />
                    </Button>
                  </TabsContent>

                  <TabsContent value="costing" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="purchase_price">Purchase Rate (Cost)</Label>
                        <Input
                          id="purchase_price"
                          type="number"
                          step="0.01"
                          value={formData.purchase_price}
                          onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                          placeholder="Cost Price"
                        />
                      </div>
                      <div>
                        <Label htmlFor="mrp">MRP *</Label>
                        <Input
                          id="mrp"
                          type="number"
                          step="0.01"
                          value={formData.mrp}
                          onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                          required
                          placeholder="MRP Label Price"
                        />
                      </div>
                      <div>
                        <Label htmlFor="price">Offer Price (Optional)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="Selling Price"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="supplier_name">Supplier (Vendor)</Label>
                        <Input
                          id="supplier_name"
                          value={formData.supplier_name}
                          onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                          placeholder="Supplier Name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="purchase_date">Purchase Invoice Date</Label>
                        <Input
                          id="purchase_date"
                          type="date"
                          value={formData.purchase_date}
                          onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="hsn_code">HSN Code</Label>
                        <Input
                          id="hsn_code"
                          value={formData.hsn_code}
                          onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                          placeholder="HSN Code"
                        />
                      </div>
                      <div>
                        <Label htmlFor="item_code">Item Reference Code</Label>
                        <Input
                          id="item_code"
                          value={formData.item_code}
                          onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                          placeholder="Previous system Item ID"
                        />
                      </div>
                    </div>
                    <Button type="button" onClick={() => setActiveTab("attributes")} className="w-full flex items-center justify-center gap-2 mt-2">
                      Next: Visual Attributes & Barcodes <ChevronRight className="w-4 h-4" />
                    </Button>
                  </TabsContent>

                  <TabsContent value="attributes" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="color">Garment Color</Label>
                        <Input
                          id="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          placeholder="e.g. Mustard, Mint Green"
                        />
                      </div>
                      <div>
                        <Label htmlFor="size">Size</Label>
                        <Input
                          id="size"
                          value={formData.size}
                          onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                          placeholder="e.g. Free Size, XL, M"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sku">Boutique Tag SKU / Barcode</Label>
                        <div className="flex gap-2">
                          <Input
                            id="sku"
                            value={formData.sku}
                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                            placeholder="Scan or enter unique ID"
                          />
                          <Button type="button" onClick={generateSKU} variant="outline" size="sm" className="shadow-sm">
                            <Wand2 className="w-4 h-4 mr-2" />
                            Generate
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="company_barcode">Manufacturer/Company Barcode</Label>
                        <Input
                          id="company_barcode"
                          value={formData.company_barcode}
                          onChange={(e) => setFormData({ ...formData, company_barcode: e.target.value })}
                          placeholder="Barcode on manufacturer tag"
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full mt-4 shadow-sm">
                      {editingProduct ? "Update Product Record" : "Save Stock Product"}
                    </Button>
                  </TabsContent>
                </form>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Products table list card */}
      <Card className="shadow-sm border">
        {/* Search header container */}
        <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-3 bg-muted/10">
          <div className="relative w-full md:w-80">
            <Input
              placeholder="Search by Name, SKU, Tag, Supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 shadow-sm"
            />
            <QrCode className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-4 self-stretch md:self-auto justify-between">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lowStockFilter}
                onChange={(e) => setLowStockFilter(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
              />
              Out of Stock Only
            </label>

            {selectedIds.length > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full animate-in fade-in zoom-in-95 duration-200">
                {selectedIds.length} Selected
              </span>
            )}
          </div>
        </div>

        {/* Selected rows Bulk action bar */}
        {selectedIds.length > 0 && (
          <div className="bg-secondary/40 p-3 px-6 border-b flex flex-col sm:flex-row justify-between items-center gap-3 animate-in slide-in-from-top duration-200">
            <div className="text-xs font-semibold text-muted-foreground">
              Execute actions on {selectedIds.length} selected inventory items
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkPrintTags} className="shadow-sm">
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print Tags
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkExport} className="shadow-sm">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete these ${selectedIds.length} products?`)) {
                    bulkDeleteMutation.mutate(selectedIds);
                  }
                }}
                className="shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading boutique products..." />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !products || products.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-7 w-7" />}
            title="No inventory logged yet"
            description="Import stock from your previous spreadsheet or manually add boutique items."
            action={{
              label: "Add product",
              icon: <Plus className="mr-2 h-4 w-4" />,
              onClick: () => setOpen(true),
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40px] p-2 text-center">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                    />
                  </TableHead>
                  <TableHead>Garment Name</TableHead>
                  <TableHead>SKU / Barcode</TableHead>
                  <TableHead>Specs (Color/Size)</TableHead>
                  <TableHead>Cost Price</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Stock Level</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const isLow = (product.stock || 0) <= 0;
                  const isSelected = selectedIds.includes(product.id);
                  return (
                    <TableRow key={product.id} className={`hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                      <TableCell className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(e.target.checked, product.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedProductDetails(product)}
                          className="font-bold text-foreground text-left hover:underline focus:outline-none flex items-center gap-1.5 cursor-pointer group"
                        >
                          {product.name}
                          <Maximize2 className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 text-muted-foreground transition-opacity" />
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{product.sku || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {product.color || product.size ? (
                          <span className="text-muted-foreground font-medium">
                            {product.color || "No color"}{" "}
                            {product.size && `• Size ${product.size}`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {product.purchase_price ? `₹${Number(product.purchase_price).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs">
                        ₹{Number(product.mrp || product.price || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setAdjustStockProduct(product)}
                          className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border cursor-pointer hover:bg-muted flex items-center gap-1.5 transition-colors ${isLow
                            ? "bg-destructive/10 text-destructive border-destructive/20 hover:border-destructive/40"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300"
                            }`}
                          title="Click to adjust stock"
                        >
                          <Activity className="w-3 h-3" />
                          {product.stock}
                        </button>
                      </TableCell>
                      <TableCell>
                        {product.category ? (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                            {product.category}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${product.name}`}
                            onClick={() => handleEdit(product)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${product.name}`}
                            onClick={() => setProductToDelete(product)}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Product Detail & Stock Movement pop-up Dialog */}
      <Dialog open={!!selectedProductDetails} onOpenChange={(o) => !o && setSelectedProductDetails(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              {selectedProductDetails?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedProductDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {/* Product Info Column */}
              <div className="space-y-4 pr-0 md:pr-4 md:border-r border-border">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Details</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustStockProduct(selectedProductDetails);
                      }}
                      className="h-8 text-xs shadow-sm"
                    >
                      <Activity className="w-3.5 h-3.5 mr-1" /> Adjust Stock
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const prod = selectedProductDetails;
                        setSelectedProductDetails(null);
                        handleEdit(prod);
                      }}
                      className="h-8 text-xs shadow-sm"
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-sm bg-muted/20 p-4 rounded-xl border">
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Boutique SKU</span>
                    <span className="font-mono font-semibold">{selectedProductDetails.sku || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Company Barcode</span>
                    <span className="font-mono font-semibold truncate block max-w-full" title={selectedProductDetails.company_barcode}>
                      {selectedProductDetails.company_barcode || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Category</span>
                    <span className="font-bold flex items-center gap-1 mt-0.5 text-primary text-xs">
                      <Tag className="w-3 h-3" />
                      {selectedProductDetails.category || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Availability Status</span>
                    <span className={`inline-flex mt-1 items-center px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase ${selectedProductDetails.status === "available"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : selectedProductDetails.status === "reserved"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200"
                      }`}>
                      {selectedProductDetails.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Color</span>
                    <span className="font-semibold flex items-center gap-1 text-xs">
                      <Palette className="w-3 h-3 text-muted-foreground" />
                      {selectedProductDetails.color || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Size</span>
                    <span className="font-semibold text-xs">{selectedProductDetails.size || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">Stock Quantity</span>
                    <span className={`font-mono font-bold text-base ${selectedProductDetails.stock <= 0 ? "text-destructive" : "text-emerald-700"}`}>
                      {selectedProductDetails.stock} units
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block font-medium">HSN Code</span>
                    <span className="font-semibold text-xs">{selectedProductDetails.hsn_code || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm bg-muted/20 p-4 rounded-xl border">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Cost Price</span>
                    <span className="font-mono font-semibold text-xs text-muted-foreground">
                      {selectedProductDetails.purchase_price ? `₹${Number(selectedProductDetails.purchase_price).toLocaleString()}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">MRP</span>
                    <span className="font-mono font-bold text-xs text-foreground">
                      ₹{(selectedProductDetails.mrp || selectedProductDetails.price || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Offer Price</span>
                    <span className="font-mono font-extrabold text-xs text-primary">
                      ₹{Number(selectedProductDetails.price || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground bg-muted/20 p-3.5 rounded-xl border">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 shrink-0" />
                    <div>
                      <span className="block text-[10px] uppercase font-bold tracking-wide">Supplier</span>
                      <strong className="text-foreground">{selectedProductDetails.supplier_name || "—"}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <div>
                      <span className="block text-[10px] uppercase font-bold tracking-wide">Inward Date</span>
                      <strong className="text-foreground">
                        {selectedProductDetails.inward_date ? new Date(selectedProductDetails.inward_date).toLocaleDateString() : "—"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Printable barcode preview */}
                <div className="border rounded-xl p-3 bg-white flex flex-col items-center justify-center">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground mb-1 select-none">Printable Barcode Graphic</span>
                  <div className="w-full max-w-[200px]">
                    {generateCode39Svg(selectedProductDetails.sku || selectedProductDetails.company_barcode || 'SPE-000')}
                  </div>
                  <span className="text-[10px] font-mono mt-1 font-bold">{selectedProductDetails.sku || selectedProductDetails.company_barcode}</span>
                </div>
              </div>

              {/* Stock Movement History Column */}
              <div className="space-y-4 flex flex-col max-h-[60vh]">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b pb-2">
                  <History className="w-4 h-4 text-primary" />
                  Stock Movement Timeline
                </div>

                {loadingHistory ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">Loading movement logs...</span>
                  </div>
                ) : !movementHistory || movementHistory.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-xl bg-muted/10">
                    <History className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <div className="text-xs font-bold text-muted-foreground">No adjustments recorded</div>
                    <p className="text-[10px] text-muted-foreground/70 max-w-xs mt-1">
                      Manual stock corrections and production order sales will be displayed here in chronological order.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin">
                    {movementHistory.map((item, idx) => {
                      const isAddition = item.action === "added" || item.action === "returned";
                      return (
                        <div key={item.id || idx} className="flex gap-3 relative group">
                          {/* Chronological bullet marker */}
                          <div className="flex flex-col items-center">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] border shadow-sm ${isAddition
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-destructive/10 text-destructive border-destructive/20"
                              }`}>
                              {isAddition ? "+" : "-"}
                            </div>
                            {idx < movementHistory.length - 1 && (
                              <div className="w-0.5 flex-1 bg-border my-1.5 group-hover:bg-primary/20 transition-colors" />
                            )}
                          </div>

                          <div className="flex-1 bg-muted/30 border rounded-xl p-3 hover:bg-muted/50 transition-colors">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-xs font-bold uppercase ${isAddition ? "text-emerald-700" : "text-destructive"}`}>
                                {item.qty} Items {item.action === "added" ? "Added" : item.action === "returned" ? "Returned" : item.action === "sold" ? "Sold" : "Deducted"}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-foreground">{item.notes}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stock Manual Adjustment Dialog */}
      <Dialog open={!!adjustStockProduct} onOpenChange={(o) => !o && setAdjustStockProduct(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock Quantity</DialogTitle>
          </DialogHeader>
          {adjustStockProduct && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted rounded text-xs space-y-1">
                <div className="font-bold text-foreground truncate">{adjustStockProduct.name}</div>
                <div>SKU: <span className="font-mono">{adjustStockProduct.sku || "—"}</span></div>
                <div>Current Stock Level: <span className="font-mono font-bold text-primary">{adjustStockProduct.stock}</span></div>
              </div>

              <div className="space-y-2">
                <Label>Adjustment Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={adjustType === "add" ? "default" : "outline"}
                    onClick={() => setAdjustType("add")}
                    className="h-9"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" /> Add Stock
                  </Button>
                  <Button
                    type="button"
                    variant={adjustType === "deduct" ? "default" : "outline"}
                    onClick={() => setAdjustType("deduct")}
                    className="h-9"
                  >
                    <MinusCircle className="w-4 h-4 mr-2" /> Deduct Stock
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="adjust_qty">Quantity Count</Label>
                <Input
                  id="adjust_qty"
                  type="number"
                  placeholder="e.g. 5"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  min="1"
                />
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="adjust_notes">Adjustment Reason / Notes</Label>
                <Input
                  id="adjust_notes"
                  placeholder="e.g. Stock audit correction, damaged item"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setAdjustStockProduct(null)}>Cancel</Button>
                <Button
                  disabled={adjustStockMutation.isPending}
                  onClick={() => adjustStockMutation.mutate()}
                >
                  {adjustStockMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Adjustment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV Stock Import Dialog */}
      <Dialog open={csvImportOpen} onOpenChange={(o) => { if (!importing) setCsvImportOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Stock From Spreadsheet CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {!importing ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 border-muted-foreground/30 transition">
                  <Upload className="w-10 h-10 text-muted-foreground/60 mb-3" />
                  <div className="text-sm font-semibold mb-1">Select your stock CSV file</div>
                  <p className="text-xs text-muted-foreground max-w-xs mb-4">
                    Ensure columns map to: Barcode, Item, Color, MRP, Pur. Rate, Product Name (Category), Party Name.
                  </p>
                  <Button onClick={() => fileInputRef.current?.click()} size="sm" className="shadow-sm">
                    Choose File
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleCSVImport}
                    className="hidden"
                  />
                </div>

                <div className="p-3 bg-indigo-50/50 rounded-lg text-xs text-indigo-700/80 border border-indigo-100 flex gap-2">
                  <Barcode className="w-5 h-5 shrink-0" />
                  <div>
                    <strong>Pro Tip:</strong> Large spreadsheets containing thousands of rows are fully supported. The system splits the upload into safe database batches to keep execution fast and uninterrupted.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                <div className="text-sm font-semibold">Processing spreadsheet rows...</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Progress: {importProgress}% ({importStats.success + importStats.failed} of {importStats.total} items)
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs mt-2 border-t pt-3">
                  <div className="text-emerald-700">Successfully Imported: <strong>{importStats.success}</strong></div>
                  <div className="text-destructive">Skipped / Failed: <strong>{importStats.failed}</strong></div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Single Product Confirmation */}
      <AlertDialog open={!!productToDelete} onOpenChange={(o) => !o && setProductToDelete(null)}>
        <AlertDialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product Record</DialogTitle>
          </DialogHeader>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold">{productToDelete?.name}</span>? This item will be removed from inventory. Past invoices will keep their details but reference links will be nullified.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (productToDelete) {
                  deleteMutation.mutate(productToDelete.id);
                  setProductToDelete(null);
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
