-- Allow commission agents to delete their own receipt transactions
CREATE POLICY "Commission agents can delete own receipt transactions"
ON public.commission_transactions
FOR DELETE
USING (
  transaction_type IN ('receipt_collected', 'receipt_paid')
  AND agent_id IN (
    SELECT id FROM commission_agents WHERE user_id = auth.uid()
  )
);