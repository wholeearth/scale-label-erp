-- Add manual entry flags and intermediate product tracking to items table
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS manual_weight_entry boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_length_entry boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_intermediate_product boolean DEFAULT false;

-- Add length tracking to production records
ALTER TABLE public.production_records
ADD COLUMN IF NOT EXISTS length_yards numeric;

-- Create raw material consumption tracking table
CREATE TABLE IF NOT EXISTS public.raw_material_consumption (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_record_id uuid NOT NULL REFERENCES public.production_records(id) ON DELETE CASCADE,
  consumed_serial_number text NOT NULL,
  consumed_weight_kg numeric,
  consumed_length_yards numeric,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.raw_material_consumption ENABLE ROW LEVEL SECURITY;

-- RLS policies for raw_material_consumption
CREATE POLICY "Everyone can view raw material consumption"
  ON public.raw_material_consumption
  FOR SELECT
  USING (true);

CREATE POLICY "Operators can record consumption"
  ON public.raw_material_consumption
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    has_role(auth.uid(), 'operator'::app_role)
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_raw_material_consumption_production_record 
  ON public.raw_material_consumption(production_record_id);

CREATE INDEX IF NOT EXISTS idx_raw_material_consumption_serial 
  ON public.raw_material_consumption(consumed_serial_number);

-- Add trigger for updated_at on raw_material_consumption
CREATE TRIGGER update_raw_material_consumption_updated_at
  BEFORE UPDATE ON public.raw_material_consumption
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();