-- Create shift_records table
CREATE TABLE public.shift_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shift_end TIMESTAMP WITH TIME ZONE,
  data_input_completed BOOLEAN NOT NULL DEFAULT false,
  data_input_by UUID REFERENCES profiles(id),
  data_input_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift_raw_material_consumption table
CREATE TABLE public.shift_raw_material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_record_id UUID NOT NULL REFERENCES shift_records(id) ON DELETE CASCADE,
  consumed_serial_number TEXT NOT NULL,
  consumed_weight_kg NUMERIC,
  consumed_length_yards NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift_intermediate_production table
CREATE TABLE public.shift_intermediate_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_record_id UUID NOT NULL REFERENCES shift_records(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity_produced INTEGER NOT NULL,
  total_weight_kg NUMERIC,
  total_length_yards NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_raw_material_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_intermediate_production ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shift_records
CREATE POLICY "Operators can view own shifts"
ON public.shift_records
FOR SELECT
USING (
  operator_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'accountant'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

CREATE POLICY "Operators can create own shifts"
ON public.shift_records
FOR INSERT
WITH CHECK (operator_id = auth.uid() AND has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operators and managers can update shifts"
ON public.shift_records
FOR UPDATE
USING (
  operator_id = auth.uid() OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'accountant'::app_role) OR 
  has_role(auth.uid(), 'production_manager'::app_role)
);

-- RLS Policies for shift_raw_material_consumption
CREATE POLICY "Users can view shift raw material consumption"
ON public.shift_raw_material_consumption
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM shift_records sr
    WHERE sr.id = shift_raw_material_consumption.shift_record_id
    AND (
      sr.operator_id = auth.uid() OR 
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'accountant'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role)
    )
  )
);

CREATE POLICY "Operators and managers can insert consumption"
ON public.shift_raw_material_consumption
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shift_records sr
    WHERE sr.id = shift_raw_material_consumption.shift_record_id
    AND (
      sr.operator_id = auth.uid() OR 
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'accountant'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role)
    )
  )
);

-- RLS Policies for shift_intermediate_production
CREATE POLICY "Users can view shift intermediate production"
ON public.shift_intermediate_production
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM shift_records sr
    WHERE sr.id = shift_intermediate_production.shift_record_id
    AND (
      sr.operator_id = auth.uid() OR 
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'accountant'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role)
    )
  )
);

CREATE POLICY "Operators and managers can insert intermediate production"
ON public.shift_intermediate_production
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shift_records sr
    WHERE sr.id = shift_intermediate_production.shift_record_id
    AND (
      sr.operator_id = auth.uid() OR 
      has_role(auth.uid(), 'admin'::app_role) OR 
      has_role(auth.uid(), 'accountant'::app_role) OR 
      has_role(auth.uid(), 'production_manager'::app_role)
    )
  )
);

-- Create indexes for performance
CREATE INDEX idx_shift_records_operator ON shift_records(operator_id);
CREATE INDEX idx_shift_records_date ON shift_records(shift_date);
CREATE INDEX idx_shift_raw_material_consumption_shift ON shift_raw_material_consumption(shift_record_id);
CREATE INDEX idx_shift_intermediate_production_shift ON shift_intermediate_production(shift_record_id);