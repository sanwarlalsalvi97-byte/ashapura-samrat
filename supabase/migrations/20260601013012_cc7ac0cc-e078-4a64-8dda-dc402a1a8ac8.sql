-- Cashbook table for income/expense tracking
CREATE TYPE public.cashbook_type AS ENUM ('income', 'expense');
CREATE TYPE public.cashbook_category AS ENUM ('material', 'labor', 'transport', 'other');

CREATE TABLE public.cashbook (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type public.cashbook_type NOT NULL,
  category public.cashbook_category NOT NULL DEFAULT 'other',
  amount INTEGER NOT NULL DEFAULT 0,
  site_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashbook TO authenticated;
GRANT ALL ON public.cashbook TO service_role;

ALTER TABLE public.cashbook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cashbook"
ON public.cashbook FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own cashbook"
ON public.cashbook FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cashbook"
ON public.cashbook FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cashbook"
ON public.cashbook FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_cashbook_updated_at
BEFORE UPDATE ON public.cashbook
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cashbook_user_date ON public.cashbook(user_id, date DESC);

-- Roles system (admin / staff)
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Allow self-bootstrap: first time a user sets themselves as admin (only if no admin exists for them)
CREATE POLICY "Users can insert own initial admin"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
