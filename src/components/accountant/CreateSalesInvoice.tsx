import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { z } from 'zod';

interface SalesItem {
  item_id: string;
  quantity: string;
  rate: string;
  amount: number;
}

interface SalesInvoice {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string;
  invoice_date: string;
  total_amount: number;
  notes?: string;
  status: string;
}

const salesItemSchema = z.object({
  item_id: z.string().uuid({ message: "Valid item must be selected" }),
  quantity: z.string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Quantity must be a positive number"
    })
    .refine((val) => {
      const num = parseInt(val, 10);
      return num <= 2147483647;
    }, {
      message: "Quantity exceeds maximum allowed value"
    }),
  rate: z.string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Rate must be a positive number"
    }),
});

const CreateSalesInvoice = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [customerId, setCustomerId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [showInvoicedOrders, setShowInvoicedOrders] = useState(false);
  const [salesItems, setSalesItems] = useState<SalesItem[]>([
    { item_id: '', quantity: '', rate: '', amount: 0 }
  ]);

  const { data: customers } = useQuery({
    queryKey: ['customers-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name')
        .order('customer_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ['items-sales', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('customer_products')
        .select('item_id, price, items!inner(*)')
        .eq('customer_id', customerId);
      if (error) throw error;
      // Map to include items with their assigned prices
      return data?.map(cp => ({
        ...cp.items,
        assigned_price: cp.price
      })).filter(Boolean) || [];
    },
    enabled: !!customerId,
  });

  const { data: customerOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            items(product_name, product_code)
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const { data: customerPricing } = useQuery({
    queryKey: ['customer-pricing', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from('customer_products')
        .select('item_id, price')
        .eq('customer_id', customerId);
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
  });

  const createSalesMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Customer is required');
      if (!selectedOrderId) throw new Error('Please select an order to create invoice from');

      // Check if the order is already invoiced
      const selectedOrder = customerOrders?.find(order => order.id === selectedOrderId);
      if (selectedOrder?.status === 'invoiced') {
        throw new Error('This order has already been invoiced. Please select a different order.');
      }

      // Check if an invoice already exists for this order
      const { data: existingInvoice } = await supabase
        .from('sales_invoices')
        .select('invoice_number')
        .eq('order_id', selectedOrderId)
        .maybeSingle();
      
      if (existingInvoice) {
        throw new Error(`An invoice (${existingInvoice.invoice_number}) already exists for this order.`);
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create sales invoice record with auto-generated invoice number
      const { data: invoice, error: invoiceError } = await supabase
        .from('sales_invoices')
        .insert({
          order_id: selectedOrderId,
          customer_id: customerId,
          invoice_date: saleDate,
          total_amount: selectedOrder?.total_amount || 0,
          notes: narration,
          status: 'posted',
          created_by: user.id
        } as any)
        .select()
        .single();

      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }
      
      if (!invoice) {
        throw new Error('Failed to create invoice - no data returned');
      }

      // Only update order status if invoice was successfully created
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'invoiced' })
        .eq('id', selectedOrderId);

      if (updateError) {
        console.error('Order update error:', updateError);
        // If order update fails, try to delete the invoice to maintain consistency
        await supabase
          .from('sales_invoices')
          .delete()
          .eq('id', invoice.id);
        throw new Error(`Failed to update order status: ${updateError.message}`);
      }
      
      return invoice;
    },
    onSuccess: (invoice: SalesInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['customer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      toast({
        title: 'Success',
        description: `Sales invoice ${invoice.invoice_number} created successfully`,
      });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setCustomerId('');
    setSelectedOrderId('');
    setReferenceNo('');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setNarration('');
    setSalesItems([{ item_id: '', quantity: '', rate: '', amount: 0 }]);
  };

  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    const selectedOrder = customerOrders?.find(order => order.id === orderId);
    if (selectedOrder && selectedOrder.order_items) {
      const items = selectedOrder.order_items.map((item: any) => ({
        item_id: item.item_id,
        quantity: item.quantity.toString(),
        rate: item.unit_price.toString(),
        amount: item.quantity * item.unit_price,
      }));
      setSalesItems(items);
    }
  };

  const addSalesItem = () => {
    setSalesItems([...salesItems, { item_id: '', quantity: '', rate: '', amount: 0 }]);
  };

  const removeSalesItem = (index: number) => {
    if (salesItems.length > 1) {
      setSalesItems(salesItems.filter((_, i) => i !== index));
    }
  };

  const updateSalesItem = (index: number, field: keyof SalesItem, value: string) => {
    const newItems = [...salesItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'item_id') {
      // Auto-fill rate from assigned customer price
      const selectedItem = items?.find(itm => itm.id === value);
      if (selectedItem && 'assigned_price' in selectedItem) {
        newItems[index].rate = (selectedItem as any).assigned_price.toString();
      }
    }
    
    if (field === 'quantity' || field === 'rate') {
      const quantity = parseFloat(newItems[index].quantity) || 0;
      const rate = parseFloat(newItems[index].rate) || 0;
      newItems[index].amount = quantity * rate;
    }
    
    setSalesItems(newItems);
  };

  const calculateGrandTotal = () => {
    return salesItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const handleSubmit = () => {
    createSalesMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      resetForm();
    }
  };

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
        <span className="font-semibold">Sales</span>
        <button 
          onClick={resetForm}
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
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
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
                onValueChange={(value) => {
                  setCustomerId(value);
                  setSelectedOrderId('');
                  setSalesItems([{ item_id: '', quantity: '', rate: '', amount: 0 }]);
                }}
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

            {customerId && (
              <div className="grid grid-cols-[120px_1fr] gap-2 items-center">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Select Order<span className="text-red-500">*</span></Label>
                  <label className="flex items-center gap-1 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={showInvoicedOrders}
                      onChange={(e) => setShowInvoicedOrders(e.target.checked)}
                      className="h-3 w-3"
                    />
                    <span>Show invoiced</span>
                  </label>
                </div>
                {ordersLoading ? (
                  <div className="h-8 bg-gray-50 border border-gray-400 rounded px-3 flex items-center text-sm text-gray-500">
                    Loading orders...
                  </div>
                ) : customerOrders && customerOrders.length > 0 ? (
                  <Select value={selectedOrderId} onValueChange={handleOrderSelect}>
                    <SelectTrigger className="h-8 bg-white border-gray-400">
                      <SelectValue placeholder="Select order to create invoice from (Required)" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      {customerOrders
                        .filter(order => showInvoicedOrders || order.status !== 'invoiced')
                        .map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            Order #{order.order_number} - {order.status.toUpperCase()} - ₹{Number(order.total_amount).toFixed(2)} - {new Date(order.created_at).toLocaleDateString()}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="h-8 bg-gray-50 border border-gray-400 rounded px-3 flex items-center text-sm text-gray-500">
                    No orders found for this customer
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border-t pt-4">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-y">
                  <th className="text-left p-2 text-sm font-semibold">Name of Item</th>
                  <th className="text-right p-2 text-sm font-semibold w-28">Quantity</th>
                  <th className="text-right p-2 text-sm font-semibold w-32">Rate per</th>
                  <th className="text-right p-2 text-sm font-semibold w-32">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {salesItems.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-1">
                      <Select
                        value={item.item_id}
                        onValueChange={(value) => updateSalesItem(index, 'item_id', value)}
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
                        max="2147483647"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          // Prevent entering values too large
                          if (val === '' || (Number(val) >= 1 && Number(val) <= 2147483647)) {
                            updateSalesItem(index, 'quantity', val);
                          }
                        }}
                        className="h-8 text-right bg-white border-gray-400"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => updateSalesItem(index, 'rate', e.target.value)}
                        className="h-8 text-right bg-white border-gray-400"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={item.amount.toFixed(2)}
                        readOnly
                        className="h-8 text-right bg-gray-50 border-gray-400 font-semibold"
                      />
                    </td>
                    <td className="p-1 text-center">
                      {salesItems.length > 1 && (
                        <button
                          onClick={() => removeSalesItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="p-1">
                    <button
                      onClick={addSalesItem}
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
              <div className="text-sm text-gray-600">Total Amount:</div>
              <div className="text-2xl font-bold">₹{calculateGrandTotal().toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t flex items-center justify-between px-4 py-2 text-sm">
        <div className="flex gap-6">
          <button 
            onClick={resetForm}
            className="hover:bg-gray-200 px-2 py-1 rounded"
          >
            <span className="underline">Q</span>: Quit
          </button>
          <button 
            onClick={handleSubmit}
            className="hover:bg-gray-200 px-2 py-1 rounded"
            disabled={createSalesMutation.isPending}
          >
            <span className="underline">A</span>: {createSalesMutation.isPending ? 'Saving...' : 'Accept'}
          </button>
          <button className="hover:bg-gray-200 px-2 py-1 rounded">
            <span className="underline">X</span>: Cancel Vch
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSalesInvoice;
