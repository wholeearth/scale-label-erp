-- Allow accountants to view customer products for sales invoice creation
CREATE POLICY "Accountants can view customer products"
ON public.customer_products
FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));