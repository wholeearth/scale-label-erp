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

interface ReturnItem {
  item_id: string;
  quantity: string;
  refund_amount: string;
}

export function ProductReturns() {
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [narration, setNarration] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([
    { item_id: '', quantity: '', refund_amount: '' }
  ]);
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
    mutationFn: async () => {
      if (!customerId) throw new Error('Customer is required');
      if (returnItems.some(item => !item.item_id || !item.quantity || !item.refund_amount)) {
        throw new Error('All item fields must be filled');
      }

      const { data: returnNumber } = await supabase.rpc("generate_return_number");

      // For simplicity, create one return per item
      for (const item of returnItems) {
        const { error } = await supabase
          .from("sales_returns")
          .insert({
            return_number: returnNumber,
            customer_id: customerId,
            item_id: item.item_id,
            quantity: parseFloat(item.quantity),
            refund_amount: parseFloat(item.refund_amount),
            reason: reason,
            notes: narration,
            status: 'pending',
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-returns"] });
      toast.success("Return created successfully");
      resetForm();
      setShowForm(false);
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

  const resetForm = () => {
    setCustomerId('');
    setReferenceNo('');
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setNarration('');
    setReturnItems([{ item_id: '', quantity: '', refund_amount: '' }]);
  };

  const addReturnItem = () => {
    setReturnItems([...returnItems, { item_id: '', quantity: '', refund_amount: '' }]);
  };

  const removeReturnItem = (index: number) => {
    if (returnItems.length > 1) {
      setReturnItems(returnItems.filter((_, i) => i !== index));
    }
  };

  const updateReturnItem = (index: number, field: keyof ReturnItem, value: string) => {
    const newItems = [...returnItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReturnItems(newItems);
  };

  const calculateTotalRefund = () => {
    return returnItems.reduce((sum, item) => sum + (parseFloat(item.refund_amount) || 0), 0);
  };

  const handleSubmit = () => {
    createReturnMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      setShowForm(false);
    }
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

  if (showForm) {
    return (
      <div className="min-h-screen bg-[#F5F5DC]" onKeyDown={handleKeyPress}>
        {/* Tally Header */}
        <div className="bg-[#1e40af] text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-lg">Tally <span className="text-yellow-400">GOLD</span></span>
            <span className="text-sm">Prime</span>
          </div>
          <div className="text-sm">
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </div>
        </div>

        {/* Sub Header */}
        <div className="bg-white border-b px-4 py-1 text-sm">
          Accounting Voucher Creation
        </div>

        {/* Voucher Type Bar */}
        <div className="bg-[#1e40af] text-white px-4 py-1 flex items-center justify-between">
          <span className="font-semibold">Sales Return</span>
          <button 
            onClick={() => setShowForm(false)}
            className="hover:bg-blue-700 px-2 py-0.5 rounded text-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main Form */}
        <div className="p-6 max-w-6xl mx-auto">
          <div className="bg-white border-2 border-gray-300 p-6 space-y-4">
            {/* Header Fields */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label className="text-xs">Reference No</Label>
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="h-8 bg-white border-gray-400"
                  placeholder="Enter reference"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="h-8 bg-white border-gray-400"
                />
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-3 border-t pt-3">
              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                <Label className="text-sm">Party A/c name</Label>
                <Select
                  value={customerId}
                  onValueChange={setCustomerId}
                >
                  <SelectTrigger className="h-8 bg-white border-gray-400">
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
              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                <Label className="text-sm">Reason</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-8 bg-white border-gray-400"
                  placeholder="e.g., Defective, Wrong item"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="border-t pt-4">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-y">
                    <th className="text-left p-2 text-sm font-semibold">Name of Item</th>
                    <th className="text-right p-2 text-sm font-semibold w-28">Quantity</th>
                    <th className="text-right p-2 text-sm font-semibold w-32">Refund Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {returnItems.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-1">
                        <Select
                          value={item.item_id}
                          onValueChange={(value) => updateReturnItem(index, 'item_id', value)}
                        >
                          <SelectTrigger className="h-8 bg-amber-50 border-gray-400">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items?.map((itm) => (
                              <SelectItem key={itm.id} value={itm.id}>
                                {itm.product_code} - {itm.product_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateReturnItem(index, 'quantity', e.target.value)}
                          className="h-8 text-right bg-white border-gray-400"
                          placeholder="0"
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.refund_amount}
                          onChange={(e) => updateReturnItem(index, 'refund_amount', e.target.value)}
                          className="h-8 text-right bg-white border-gray-400"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="p-1 text-center">
                        {returnItems.length > 1 && (
                          <button
                            onClick={() => removeReturnItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="p-1">
                      <button
                        onClick={addReturnItem}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        + Add Item
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Narration */}
            <div className="border-t pt-4">
              <Label className="text-sm mb-2 block">Narration:</Label>
              <Textarea
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="bg-white border-gray-400 min-h-[60px]"
                placeholder="Additional notes..."
              />
            </div>

            {/* Total */}
            <div className="flex justify-end border-t pt-4">
              <div className="text-right space-y-1">
                <div className="text-sm text-gray-600">Total Refund:</div>
                <div className="text-2xl font-bold">₹{calculateTotalRefund().toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t flex items-center justify-between px-4 py-2 text-sm">
          <div className="flex gap-6">
            <button 
              onClick={() => setShowForm(false)}
              className="hover:bg-gray-200 px-2 py-1 rounded"
            >
              <span className="underline">Q</span>: Quit
            </button>
            <button 
              onClick={handleSubmit}
              className="hover:bg-gray-200 px-2 py-1 rounded"
              disabled={createReturnMutation.isPending}
            >
              <span className="underline">A</span>: {createReturnMutation.isPending ? 'Saving...' : 'Accept'}
            </button>
            <button className="hover:bg-gray-200 px-2 py-1 rounded">
              <span className="underline">X</span>: Cancel Vch
            </button>
          </div>
        </div>
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
          <Button onClick={() => setShowForm(true)}>
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
                    ₹{Number(returnItem.refund_amount || 0).toFixed(2)}
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
    </div>
  );
}
