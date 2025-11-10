-- Allow production managers to read roles so they can list operators
CREATE POLICY "Production managers can view roles (select)"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'production_manager'::app_role)
);
