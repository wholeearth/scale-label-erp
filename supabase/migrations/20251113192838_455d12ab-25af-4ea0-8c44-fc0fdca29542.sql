-- Allow accountants to view all orders for creating invoices
CREATE POLICY "Accountants can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));