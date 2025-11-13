-- Drop existing SELECT policy on customers table
DROP POLICY IF EXISTS "Admins, sales, and commission agents can view customers" ON customers;

-- Create new policy that includes accountants
CREATE POLICY "Admins, sales, accountants, and commission agents can view customers" 
ON customers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'sales'::app_role) 
  OR has_role(auth.uid(), 'accountant'::app_role)
  OR (user_id = auth.uid()) 
  OR (commission_agent_id IN (
    SELECT id FROM commission_agents WHERE user_id = auth.uid()
  ))
);