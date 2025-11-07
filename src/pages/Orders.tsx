import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function Orders() {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("*, customers(name), invoices(invoice_number, payment_status)")
        .neq("order_status", "delivered")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Delete order stages first
      const { error: stagesError } = await (supabase as any)
        .from("order_stages")
        .delete()
        .eq("order_id", orderId);

      if (stagesError) throw stagesError;

      // Delete order
      const { error } = await (supabase as any)
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;
    },
    onMutate: async (orderId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["orders"] });

      // Snapshot the previous value
      const previousOrders = queryClient.getQueryData(["orders"]);

      // Optimistically remove the order from the list
      queryClient.setQueryData(["orders"], (old: any) =>
        old?.filter((order: any) => order.id !== orderId)
      );

      return { previousOrders };
    },
    onError: (error: any, orderId, context) => {
      // Rollback to previous state on error
      if (context?.previousOrders) {
        queryClient.setQueryData(["orders"], context.previousOrders);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete order. You may not have permission.",
        variant: "destructive",
      });
      console.error("Delete error:", error);
    },
    onSuccess: () => {
      toast({
        title: "Order deleted",
        description: "Order has been deleted successfully",
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const getStatusVariant = (status: string) => {
    const variants: Record<string, "default" | "success" | "warning" | "info"> = {
      pending: "warning",
      processing: "info",
      ready: "info",
      dispatched: "info",
      delivered: "success",
      cancelled: "default",
    };
    return variants[status] || "default";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Orders</h1>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Code</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : orders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">No active orders found</TableCell>
              </TableRow>
            ) : (
              orders?.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.order_code}</TableCell>
                  <TableCell>{order.customers?.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {order.invoices?.invoice_number || "-"}
                      {order.invoices?.payment_status && (
                        <Badge variant={order.invoices.payment_status === "paid" ? "success" : "warning"} className="text-xs">
                          {order.invoices.payment_status}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{order.metadata?.item_name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(order.order_status)}>
                      {order.order_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.payment_status === "paid" ? "success" : "warning"}>
                      {order.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>₹{order.total_amount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/orders/${order.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Order?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete order {order.order_code} and all its stages. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteOrderMutation.mutate(order.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
