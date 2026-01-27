-- Create table for shift configuration
CREATE TABLE public.shift_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_shift_start time NOT NULL DEFAULT '06:00:00',
  day_shift_end time NOT NULL DEFAULT '18:00:00',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shift_config ENABLE ROW LEVEL SECURITY;

-- Everyone can view shift config
CREATE POLICY "Everyone can view shift config"
ON public.shift_config
FOR SELECT
USING (true);

-- Only admins can manage shift config
CREATE POLICY "Admins can manage shift config"
ON public.shift_config
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Insert default configuration
INSERT INTO public.shift_config (day_shift_start, day_shift_end)
VALUES ('06:00:00', '18:00:00');

-- Create trigger for updated_at
CREATE TRIGGER update_shift_config_updated_at
BEFORE UPDATE ON public.shift_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();