-- Create label_configurations table
CREATE TABLE IF NOT EXISTS public.label_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  logo_url TEXT,
  label_width_mm NUMERIC NOT NULL DEFAULT 100,
  label_height_mm NUMERIC NOT NULL DEFAULT 60,
  orientation TEXT NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
  fields_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.label_configurations ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage label configurations
CREATE POLICY "Admins can manage label configurations"
ON public.label_configurations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy for authenticated users to view label configurations
CREATE POLICY "Authenticated users can view label configurations"
ON public.label_configurations
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create storage bucket for label logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('label-logos', 'label-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for label logos
CREATE POLICY "Admins can upload label logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'label-logos' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Anyone can view label logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'label-logos');

CREATE POLICY "Admins can update label logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'label-logos' AND
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete label logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'label-logos' AND
  has_role(auth.uid(), 'admin'::app_role)
);