-- Allow accountants to create sales orders/invoices
CREATE POLICY "Accountants can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));