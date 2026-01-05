-- Create operator yearly sequences table to track each operator's production count per year
CREATE TABLE public.operator_yearly_sequences (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    operator_id uuid NOT NULL REFERENCES public.profiles(id),
    year integer NOT NULL,
    sequence_count bigint NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(operator_id, year)
);

-- Enable RLS
ALTER TABLE public.operator_yearly_sequences ENABLE ROW LEVEL SECURITY;

-- Operators can view and update their own sequences
CREATE POLICY "Operators can view own yearly sequences"
ON public.operator_yearly_sequences
FOR SELECT
USING (operator_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'production_manager'::app_role));

CREATE POLICY "System can manage yearly sequences"
ON public.operator_yearly_sequences
FOR ALL
USING (true);

-- Create trigger for updated_at using existing update_updated_at function
CREATE TRIGGER update_operator_yearly_sequences_updated_at
BEFORE UPDATE ON public.operator_yearly_sequences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_yearly_sequences;