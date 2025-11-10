-- Drop existing customer update/delete policies for orders
DROP POLICY IF EXISTS "Customers can update own pending orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can delete own pending orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can update order items for own pending orders" ON public.order_items;
DROP POLICY IF EXISTS "Customers can delete order items for own pending orders" ON public.order_items;

-- Allow customers to update their own pending or approved orders
CREATE POLICY "Customers can update own pending or approved orders"
ON public.orders
FOR UPDATE
USING (
  (status IN ('pending', 'approved')) AND
  (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = orders.customer_id
    AND customers.user_id = auth.uid()
  ))
)
WITH CHECK (
  (status = 'pending') AND
  (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = orders.customer_id
    AND customers.user_id = auth.uid()
  ))
);

-- Allow customers to delete their own pending or approved orders
CREATE POLICY "Customers can delete own pending or approved orders"
ON public.orders
FOR DELETE
USING (
  (status IN ('pending', 'approved')) AND
  (EXISTS (
    SELECT 1 FROM customers
    WHERE customers.id = orders.customer_id
    AND customers.user_id = auth.uid()
  ))
);

-- Allow customers to update order items for their own pending or approved orders
CREATE POLICY "Customers can update order items for own pending or approved orders"
ON public.order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM orders
    JOIN customers ON customers.id = orders.customer_id
    WHERE orders.id = order_items.order_id
    AND orders.status IN ('pending', 'approved')
    AND customers.user_id = auth.uid()
  )
);

-- Allow customers to delete order items for their own pending or approved orders
CREATE POLICY "Customers can delete order items for own pending or approved orders"
ON public.order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM orders
    JOIN customers ON customers.id = orders.customer_id
    WHERE orders.id = order_items.order_id
    AND orders.status IN ('pending', 'approved')
    AND customers.user_id = auth.uid()
  )
);