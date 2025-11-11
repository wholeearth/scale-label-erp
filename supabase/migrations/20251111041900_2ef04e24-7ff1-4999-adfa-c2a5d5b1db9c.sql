-- Create function to handle commission agent role assignment
CREATE OR REPLACE FUNCTION public.handle_commission_agent_role_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
  next_code INTEGER;
  agent_code_text TEXT;
BEGIN
  -- Only proceed if the role being inserted is 'commission_agent'
  IF NEW.role = 'commission_agent' THEN
    -- Get the user's profile information
    SELECT * INTO user_profile
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Check if commission agent record already exists
    IF NOT EXISTS (SELECT 1 FROM commission_agents WHERE user_id = NEW.user_id) THEN
      -- Generate agent code
      SELECT COALESCE(MAX(CAST(SUBSTRING(agent_code FROM 'CA(\d+)') AS INTEGER)), 0) + 1
      INTO next_code
      FROM commission_agents
      WHERE agent_code ~ '^CA\d+$';
      
      agent_code_text := 'CA' || LPAD(next_code::TEXT, 4, '0');
      
      -- Create commission agent record with profile information
      INSERT INTO commission_agents (
        user_id, 
        agent_code, 
        agent_name, 
        contact_email
      )
      VALUES (
        NEW.user_id,
        agent_code_text,
        user_profile.full_name,
        (SELECT email FROM auth.users WHERE id = NEW.user_id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for commission agent role insertion
DROP TRIGGER IF EXISTS on_commission_agent_role_insert ON user_roles;
CREATE TRIGGER on_commission_agent_role_insert
  AFTER INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION handle_commission_agent_role_insert();