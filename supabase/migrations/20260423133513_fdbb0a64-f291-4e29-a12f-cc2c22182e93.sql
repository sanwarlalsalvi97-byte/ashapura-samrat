-- Contractors table
CREATE TABLE public.contractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  site_name TEXT,
  contract_amount INTEGER NOT NULL DEFAULT 0,
  advance_paid INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contractors" ON public.contractors
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own contractors" ON public.contractors
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own contractors" ON public.contractors
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own contractors" ON public.contractors
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_contractors_updated_at
  BEFORE UPDATE ON public.contractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Brick stock entry type enum
CREATE TYPE public.brick_entry_type AS ENUM ('In', 'Out');

-- Brick stock table
CREATE TABLE public.brick_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  site_name TEXT,
  entry_type public.brick_entry_type NOT NULL DEFAULT 'In',
  quantity INTEGER NOT NULL DEFAULT 0,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brick_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brick stock" ON public.brick_stock
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own brick stock" ON public.brick_stock
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own brick stock" ON public.brick_stock
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own brick stock" ON public.brick_stock
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_brick_stock_updated_at
  BEFORE UPDATE ON public.brick_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_brick_stock_user_date ON public.brick_stock(user_id, date DESC);
CREATE INDEX idx_contractors_user_active ON public.contractors(user_id, is_active);