import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, PackageX, Plus, Check, X } from "lucide-react";

export function ProductReturns() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: returns, isLoading } = useQuery({
    queryKey: ["sales-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_returns")
        .select(`
          *,
          customers (
            customer_name,
            contact_email
          ),
          items (
            product_code,
            product_name
          ),
          orders (
            order_number
          )
        `)
        .order("return_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-for-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_name")
        .order("customer_name");

      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["items-for-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, product_code, product_name")
        .order("product_code");

      if (error) throw error;
      return data;
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async (returnData: any) => {
      // Generate return number
      const { data: returnNumber } = await supabase.rpc("generate_return_number");

      const { data, error } = await supabase
        .from("sales_returns")
        .insert({
          return_number: returnNumber,
          ...returnData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
      toast.success("Return created successfully");
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create return: " + error.message);
    },
  });

  const updateReturnStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("sales_returns")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
      toast.success("Return status updated");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const handleCreateReturn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    createReturnMutation.mutate({
      customer_id: formData.get("customer_id"),
      item_id: formData.get("item_id"),
      quantity: parseInt(formData.get("quantity") as string),
      refund_amount: parseFloat(formData.get("refund_amount") as string),
      reason: formData.get("reason"),
      notes: formData.get("notes"),
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      refunded: "outline",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Product Returns Management</CardTitle>
            <CardDescription>Track and process customer product returns</CardDescription>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Return
          </Button>
        </CardHeader>
      </Card>

      {/* Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Returns</CardTitle>
          <CardDescription>All product return requests</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns?.map((returnItem) => (
                <TableRow key={returnItem.id}>
                  <TableCell className="font-medium">{returnItem.return_number}</TableCell>
                  <TableCell>
                    {new Date(returnItem.return_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{returnItem.customers?.customer_name}</TableCell>
                  <TableCell>
                    {returnItem.items?.product_code} - {returnItem.items?.product_name}
                  </TableCell>
                  <TableCell className="text-right">{returnItem.quantity}</TableCell>
                  <TableCell className="text-right font-semibold">
                    ${Number(returnItem.refund_amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>{getStatusBadge(returnItem.status)}</TableCell>
                  <TableCell>
                    {returnItem.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() =>
                            updateReturnStatusMutation.mutate({
                              id: returnItem.id,
                              status: "approved",
                            })
                          }
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            updateReturnStatusMutation.mutate({
                              id: returnItem.id,
                              status: "rejected",
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!returns || returns.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No returns found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Return Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleCreateReturn}>
            <DialogHeader>
              <DialogTitle>Create New Return</DialogTitle>
              <DialogDescription>Record a product return from a customer</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="customer_id">Customer</Label>
                <Select name="customer_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="item_id">Product</Label>
                <Select name="item_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.product_code} - {item.product_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="1"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="refund_amount">Refund Amount</Label>
                  <Input
                    id="refund_amount"
                    name="refund_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  name="reason"
                  placeholder="e.g., Defective, Wrong item, etc."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes about the return..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createReturnMutation.isPending}>
                {createReturnMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Return
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
