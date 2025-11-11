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
import { Loader2, CreditCard, Plus, Check } from "lucide-react";

export function SupplierPayments() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["supplier-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_payments")
        .select(`
          *,
          purchases (
            purchase_number
          )
        `)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["purchases-for-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("id, purchase_number, supplier_name, total_amount")
        .order("purchase_number", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data: paymentNumber } = await supabase.rpc("generate_payment_number");

      const { data, error } = await supabase
        .from("supplier_payments")
        .insert({
          payment_number: paymentNumber,
          ...paymentData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
      toast.success("Payment created successfully");
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create payment: " + error.message);
    },
  });

  const postPaymentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("supplier_payments")
        .update({ status: "posted" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
      toast.success("Payment posted successfully");
    },
    onError: (error) => {
      toast.error("Failed to post payment: " + error.message);
    },
  });

  const handleCreatePayment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    createPaymentMutation.mutate({
      supplier_name: formData.get("supplier_name"),
      supplier_contact: formData.get("supplier_contact") || null,
      purchase_id: formData.get("purchase_id") || null,
      amount: parseFloat(formData.get("amount") as string),
      payment_method: formData.get("payment_method"),
      reference_number: formData.get("reference_number") || null,
      notes: formData.get("notes") || null,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      posted: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const totalPaid = payments
    ?.filter((p) => p.status === "posted")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

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
            <CardTitle>Supplier Payments</CardTitle>
            <CardDescription>Track and manage payments to suppliers</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-2xl font-bold text-destructive">${totalPaid.toFixed(2)}</p>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Payment
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Records</CardTitle>
          <CardDescription>All supplier payment records</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Purchase #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments?.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.payment_number}</TableCell>
                  <TableCell>
                    {new Date(payment.payment_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{payment.supplier_name}</TableCell>
                  <TableCell>{payment.purchases?.purchase_number || "N/A"}</TableCell>
                  <TableCell className="text-right font-semibold text-destructive">
                    ${Number(payment.amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="capitalize">
                    {payment.payment_method?.replace("_", " ")}
                  </TableCell>
                  <TableCell>{payment.reference_number || "—"}</TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell>
                    {payment.status === "pending" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => postPaymentMutation.mutate(payment.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Post
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!payments || payments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No payments found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Payment Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleCreatePayment}>
            <DialogHeader>
              <DialogTitle>Record Supplier Payment</DialogTitle>
              <DialogDescription>Record a payment made to a supplier</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supplier_name">Supplier Name *</Label>
                  <Input
                    id="supplier_name"
                    name="supplier_name"
                    required
                    placeholder="Supplier name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="supplier_contact">Contact</Label>
                  <Input
                    id="supplier_contact"
                    name="supplier_contact"
                    placeholder="Phone or email"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="purchase_id">Purchase Order (Optional)</Label>
                <Select name="purchase_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Select purchase order (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchases?.map((purchase) => (
                      <SelectItem key={purchase.id} value={purchase.id}>
                        {purchase.purchase_number} - {purchase.supplier_name} (${Number(purchase.total_amount).toFixed(2)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payment_method">Payment Method *</Label>
                  <Select name="payment_method" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reference_number">Reference Number</Label>
                <Input
                  id="reference_number"
                  name="reference_number"
                  placeholder="Check #, Transaction ID, etc."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes..."
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
              <Button type="submit" disabled={createPaymentMutation.isPending}>
                {createPaymentMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
