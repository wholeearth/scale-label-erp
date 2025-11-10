-- Allow customers to insert order items for their own orders
CREATE POLICY "Customers can create order items for own orders"
ON order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM orders
    JOIN customers ON customers.id = orders.customer_id
    WHERE orders.id = order_items.order_id
    AND customers.user_id = auth.uid()
  )
);