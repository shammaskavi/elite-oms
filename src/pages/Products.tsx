import { useState } from "react";
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
import { Plus, Pencil, Trash2, Barcode, QrCode, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Products() {
  const [open, setOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    price: "",
    stock: "",
    category: "",
  });
  const [barcodeData, setBarcodeData] = useState("");
  const [showBarcode, setShowBarcode] = useState(false);
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
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
    },
  });

  const resetForm = () => {
    setFormData({ name: "", sku: "", price: "", stock: "", category: "" });
    setEditingProduct(null);
    setShowBarcode(false);
    setBarcodeData("");
  };

  const generateSKU = () => {
    const sku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    setFormData({ ...formData, sku });
    toast.success("SKU generated");
  };

  const generateBarcode = () => {
    if (!formData.sku) {
      toast.error("Please generate or enter SKU first");
      return;
    }
    setBarcodeData(formData.sku);
    setShowBarcode(true);
    toast.success("Barcode generated! You can now print it.");
  };

  const handleScanBarcode = async () => {
    // Simulated barcode scan - in production, integrate with a barcode scanner library
    toast.info("Barcode scanning feature - integrate with your scanner device");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      sku: formData.sku || null,
      price: formData.price ? parseFloat(formData.price) : null,
      stock: formData.stock ? parseInt(formData.stock) : 0,
      category: formData.category || null,
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
      stock: product.stock?.toString() || "",
      category: product.category || "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold">Products</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Product Details</TabsTrigger>
                <TabsTrigger value="barcode">Barcode & SKU</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="sku">SKU</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      />
                      <Button type="button" onClick={generateSKU} variant="outline">
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock">Stock</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., Electronics, Clothing, etc."
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingProduct ? "Update" : "Create"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="barcode" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label>Product SKU</Label>
                    <div className="flex gap-2">
                      <Input value={formData.sku} disabled />
                      <Button type="button" onClick={generateSKU} variant="outline">
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button type="button" onClick={generateBarcode} className="flex-1">
                      <Barcode className="w-4 h-4 mr-2" />
                      Generate Barcode
                    </Button>
                    <Button type="button" onClick={handleScanBarcode} variant="outline" className="flex-1">
                      <QrCode className="w-4 h-4 mr-2" />
                      Scan Barcode
                    </Button>
                  </div>
                  
                  {showBarcode && barcodeData && (
                    <Card className="p-6 text-center">
                      <div className="space-y-4">
                        <div className="text-4xl font-mono tracking-widest">
                          ||||| {barcodeData} |||||
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Barcode representation for {barcodeData}
                        </p>
                        <Button onClick={() => window.print()} variant="outline">
                          Print Barcode
                        </Button>
                      </div>
                    </Card>
                  )}
                  
                  <div className="text-sm text-muted-foreground">
                    <p>• Generate SKU automatically or enter manually</p>
                    <p>• Generate barcode from SKU for printing labels</p>
                    <p>• Scan existing barcodes to auto-fill product details</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : products?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No products found</TableCell>
              </TableRow>
            ) : (
              products?.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku || "-"}</TableCell>
                  <TableCell>{product.price ? `₹${product.price}` : "-"}</TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>{product.category || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
