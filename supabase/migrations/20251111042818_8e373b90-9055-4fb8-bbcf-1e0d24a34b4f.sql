-- Drop existing policy
DROP POLICY IF EXISTS "Admins and sales can view customers" ON customers;

-- Create updated policy that includes commission agents
CREATE POLICY "Admins, sales, and commission agents can view customers"
ON customers
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'sales'::app_role) 
  OR (user_id = auth.uid())
  OR (commission_agent_id IN (
    SELECT id FROM commission_agents WHERE user_id = auth.uid()
  ))
);