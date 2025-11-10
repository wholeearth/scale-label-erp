-- Add weight fields to items table
ALTER TABLE public.items
ADD COLUMN predefined_weight_kg numeric,
ADD COLUMN use_predefined_weight boolean DEFAULT false;