-- Fix MISSING_RLS issue: Production counters allow unrestricted updates
-- Drop overly permissive policies on production_counters
DROP POLICY IF EXISTS "System can update counters" ON public.production_counters;

-- Drop overly permissive policies on item_counters
DROP POLICY IF EXISTS "System can manage item counters" ON public.item_counters;

-- Create restricted policy for production_counters - only operators and admins
CREATE POLICY "Operators and admins can update production counters"
  ON public.production_counters
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'operator'::app_role) 
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Create restricted policies for item_counters - only operators and admins
CREATE POLICY "Operators and admins can manage item counters"
  ON public.item_counters
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'operator'::app_role) 
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'operator'::app_role) 
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );