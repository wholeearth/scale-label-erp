-- Allow customers to update their own pending orders
CREATE POLICY "Customers can update own pending orders"
ON orders
FOR UPDATE
USING (
  status = 'pending' AND
  EXISTS (
    SELECT 1
    FROM customers
    WHERE customers.id = orders.customer_id
    AND customers.user_id = auth.uid()
  )
)
WITH CHECK (
  status = 'pending' AND
  EXISTS (
    SELECT 1
    FROM customers
    WHERE customers.id = orders.customer_id
    AND customers.user_id = auth.uid()
  )
);

-- Allow customers to delete their own pending orders
CREATE POLICY "Customers can delete own pending orders"
ON orders
FOR DELETE
USING (
  status = 'pending' AND
  EXISTS (
    SELECT 1
    FROM customers
    WHERE customers.id = orders.customer_id
    AND customers.user_id = auth.uid()
  )
);

-- Allow customers to update order items for their own pending orders
CREATE POLICY "Customers can update order items for own pending orders"
ON order_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM orders
    JOIN customers ON customers.id = orders.customer_id
    WHERE orders.id = order_items.order_id
    AND orders.status = 'pending'
    AND customers.user_id = auth.uid()
  )
);

-- Allow customers to delete order items for their own pending orders
CREATE POLICY "Customers can delete order items for own pending orders"
ON order_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM orders
    JOIN customers ON customers.id = orders.customer_id
    WHERE orders.id = order_items.order_id
    AND orders.status = 'pending'
    AND customers.user_id = auth.uid()
  )
);