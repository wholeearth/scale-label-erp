-- Add RLS policy to allow accountants to update orders
CREATE POLICY "Accountants can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role))
WITH CHECK (has_role(auth.uid(), 'accountant'::app_role));