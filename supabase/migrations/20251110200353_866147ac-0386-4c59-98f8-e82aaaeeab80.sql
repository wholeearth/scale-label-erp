-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'production_manager', 'sales', 'customer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  employee_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_roles table (CRITICAL: roles must be separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create units table
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  abbreviation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create items table (Item Master)
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  length_yards DECIMAL(10,2),
  width_inches DECIMAL(10,2),
  color TEXT,
  unit_id UUID REFERENCES public.units(id),
  item_type TEXT NOT NULL CHECK (item_type IN ('raw_material', 'finished_good')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create machines table
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_code TEXT NOT NULL UNIQUE,
  machine_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create global production counters
CREATE TABLE public.production_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_serial BIGINT NOT NULL DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Insert initial counter
INSERT INTO public.production_counters (id, global_serial) VALUES (uuid_generate_v4(), 1);

-- Create item production counters
CREATE TABLE public.item_counters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  item_serial BIGINT NOT NULL DEFAULT 1,
  UNIQUE(item_id)
);

-- Create operator assignments table
CREATE TABLE public.operator_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  quantity_assigned INTEGER NOT NULL,
  quantity_produced INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create production records table
CREATE TABLE public.production_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  serial_number TEXT NOT NULL UNIQUE,
  barcode_data TEXT NOT NULL,
  operator_id UUID REFERENCES public.profiles(id) NOT NULL,
  machine_id UUID REFERENCES public.machines(id),
  item_id UUID REFERENCES public.items(id) NOT NULL,
  weight_kg DECIMAL(10,3) NOT NULL,
  global_serial BIGINT NOT NULL,
  item_serial BIGINT NOT NULL,
  operator_sequence BIGINT NOT NULL,
  production_date DATE NOT NULL,
  production_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create raw material usage table
CREATE TABLE public.raw_material_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID REFERENCES public.profiles(id) NOT NULL,
  item_id UUID REFERENCES public.items(id) NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  usage_date DATE NOT NULL,
  shift_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create inventory table
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES public.items(id) NOT NULL,
  production_record_id UUID REFERENCES public.production_records(id),
  quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
  weight_kg DECIMAL(10,3),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('production', 'usage', 'adjustment', 'sale')),
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create customer product assignments
CREATE TABLE public.customer_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, item_id)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES public.customers(id) NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'completed', 'cancelled')),
  total_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.items(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  produced_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create scale configuration table
CREATE TABLE public.scale_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL,
  port INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default scale config
INSERT INTO public.scale_config (ip_address, port) VALUES ('192.168.1.239', 20301);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_material_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scale_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for units
CREATE POLICY "Everyone can view units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage units" ON public.units FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for items
CREATE POLICY "Everyone can view items" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage items" ON public.items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for machines
CREATE POLICY "Everyone can view machines" ON public.machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage machines" ON public.machines FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for production_counters
CREATE POLICY "Everyone can view counters" ON public.production_counters FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can update counters" ON public.production_counters FOR UPDATE TO authenticated USING (true);

-- RLS Policies for item_counters
CREATE POLICY "Everyone can view item counters" ON public.item_counters FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage item counters" ON public.item_counters FOR ALL TO authenticated USING (true);

-- RLS Policies for operator_assignments
CREATE POLICY "Operators can view own assignments" ON public.operator_assignments FOR SELECT TO authenticated 
  USING (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));
CREATE POLICY "Production managers can manage assignments" ON public.operator_assignments FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'production_manager'));

-- RLS Policies for production_records
CREATE POLICY "Everyone can view production records" ON public.production_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators can create own records" ON public.production_records FOR INSERT TO authenticated 
  WITH CHECK (operator_id = auth.uid() AND public.has_role(auth.uid(), 'operator'));

-- RLS Policies for raw_material_usage
CREATE POLICY "Everyone can view raw material usage" ON public.raw_material_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators can record own usage" ON public.raw_material_usage FOR INSERT TO authenticated 
  WITH CHECK (operator_id = auth.uid() AND public.has_role(auth.uid(), 'operator'));

-- RLS Policies for inventory
CREATE POLICY "Everyone can view inventory" ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage inventory" ON public.inventory FOR ALL TO authenticated USING (true);

-- RLS Policies for customers
CREATE POLICY "Admins and sales can view customers" ON public.customers FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales') OR user_id = auth.uid());
CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for customer_products
CREATE POLICY "Customers can view assigned products" ON public.customer_products FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'sales') OR
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_id AND user_id = auth.uid())
  );
CREATE POLICY "Admins can manage customer products" ON public.customer_products FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for orders
CREATE POLICY "Users can view relevant orders" ON public.orders FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'sales') OR
    public.has_role(auth.uid(), 'production_manager') OR
    EXISTS (SELECT 1 FROM public.customers WHERE id = customer_id AND user_id = auth.uid())
  );
CREATE POLICY "Customers can create orders" ON public.orders FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers WHERE id = customer_id AND user_id = auth.uid()));
CREATE POLICY "Sales can manage orders" ON public.orders FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- RLS Policies for order_items
CREATE POLICY "Users can view order items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales can manage order items" ON public.order_items FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales'));

-- RLS Policies for scale_config
CREATE POLICY "Everyone can view scale config" ON public.scale_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage scale config" ON public.scale_config FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, employee_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'employee_code', NULL)
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();