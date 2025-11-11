-- Allow commission agents to create their own receipt account
DROP POLICY IF EXISTS "Agents can create own receipt account" ON public.commission_agent_receipts_account;

CREATE POLICY "Agents can create own receipt account"
ON public.commission_agent_receipts_account
FOR INSERT
TO authenticated
WITH CHECK (
  agent_id IN (
    SELECT commission_agents.id
    FROM commission_agents
    WHERE commission_agents.user_id = auth.uid()
  )
);