-- Fix 1: Restrict profiles table access (PUBLIC_DATA_EXPOSURE)
-- Remove the overly permissive policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restricted policies for profiles
-- Admins can view all profiles (for user management)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Production managers can view operator profiles (for assignments)
CREATE POLICY "Production managers can view profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'production_manager'::app_role));

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (id = auth.uid());

-- Fix 2: Restrict operator_yearly_sequences table (MISSING_RLS)
-- Remove the overly permissive "System can manage yearly sequences" policy
DROP POLICY IF EXISTS "System can manage yearly sequences" ON public.operator_yearly_sequences;

-- Create restricted policies for operator_yearly_sequences
-- Admins can manage all sequences
CREATE POLICY "Admins can manage yearly sequences" 
ON public.operator_yearly_sequences 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Production managers can view all sequences
CREATE POLICY "Production managers can view yearly sequences" 
ON public.operator_yearly_sequences 
FOR SELECT 
USING (public.has_role(auth.uid(), 'production_manager'::app_role));

-- Operators can insert/update their own sequences (for production recording)
CREATE POLICY "Operators can manage own sequences" 
ON public.operator_yearly_sequences 
FOR ALL 
USING (operator_id = auth.uid())
WITH CHECK (operator_id = auth.uid());