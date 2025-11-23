-- Create reprint_requests table
CREATE TABLE public.reprint_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_record_id UUID NOT NULL REFERENCES public.production_records(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.profiles(id),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_by UUID REFERENCES public.profiles(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.reprint_requests ENABLE ROW LEVEL SECURITY;

-- Operators can create and view own requests
CREATE POLICY "Operators can create own reprint requests"
  ON public.reprint_requests
  FOR INSERT
  WITH CHECK (operator_id = auth.uid() AND has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Operators can view own reprint requests"
  ON public.reprint_requests
  FOR SELECT
  USING (operator_id = auth.uid() OR has_role(auth.uid(), 'production_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Production managers can manage all requests
CREATE POLICY "Production managers can manage reprint requests"
  ON public.reprint_requests
  FOR ALL
  USING (has_role(auth.uid(), 'production_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_reprint_requests_status ON public.reprint_requests(status);
CREATE INDEX idx_reprint_requests_operator ON public.reprint_requests(operator_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reprint_requests;