-- Function to automatically create customer record when a user with customer role is created
CREATE OR REPLACE FUNCTION public.handle_customer_role_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  -- Only proceed if the role being inserted is 'customer'
  IF NEW.role = 'customer' THEN
    -- Get the user's profile information
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Check if customer record already exists
    IF NOT EXISTS (SELECT 1 FROM customers WHERE user_id = NEW.user_id) THEN
      -- Create customer record with profile information
      INSERT INTO customers (user_id, customer_name, contact_email)
      VALUES (
        NEW.user_id,
        user_profile.full_name,
        (SELECT email FROM auth.users WHERE id = NEW.user_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS on_customer_role_created ON user_roles;
CREATE TRIGGER on_customer_role_created
  AFTER INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_customer_role_insert();