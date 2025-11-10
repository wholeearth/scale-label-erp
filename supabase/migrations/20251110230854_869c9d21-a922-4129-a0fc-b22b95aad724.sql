-- Add weight tolerance fields to items table for quality control
ALTER TABLE public.items 
ADD COLUMN expected_weight_kg numeric,
ADD COLUMN weight_tolerance_percentage numeric DEFAULT 10;

COMMENT ON COLUMN public.items.expected_weight_kg IS 'Expected weight for quality control checks';
COMMENT ON COLUMN public.items.weight_tolerance_percentage IS 'Acceptable deviation percentage from expected weight (default 10%)';