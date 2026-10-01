CREATE TABLE public.material_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  site_name text NOT NULL,
  material_type text NOT NULL,
  quantity numeric(12, 2) NOT NULL,
  unit text NOT NULL,
  supplier_vehicle text,
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_entries_site_name_length CHECK (char_length(btrim(site_name)) BETWEEN 1 AND 120),
  CONSTRAINT material_entries_material_type_valid CHECK (material_type IN ('sand', 'aggregate', 'cement', 'water', 'steel', 'other')),
  CONSTRAINT material_entries_quantity_positive CHECK (quantity > 0),
  CONSTRAINT material_entries_unit_valid CHECK (unit IN ('bags', 'tons', 'trips', 'cft', 'liters', 'kg', 'pieces')),
  CONSTRAINT material_entries_supplier_vehicle_length CHECK (supplier_vehicle IS NULL OR char_length(supplier_vehicle) <= 160),
  CONSTRAINT material_entries_total_amount_nonnegative CHECK (total_amount >= 0),
  CONSTRAINT material_entries_payment_status_valid CHECK (payment_status IN ('paid', 'unpaid', 'partial'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_entries TO authenticated;
GRANT ALL ON public.material_entries TO service_role;

ALTER TABLE public.material_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own material entries"
ON public.material_entries
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add own material entries"
ON public.material_entries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own material entries"
ON public.material_entries
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own material entries"
ON public.material_entries
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX material_entries_user_date_idx
ON public.material_entries (user_id, entry_date DESC, created_at DESC);

CREATE INDEX material_entries_user_material_idx
ON public.material_entries (user_id, material_type);

CREATE INDEX material_entries_user_site_idx
ON public.material_entries (user_id, site_name);

CREATE TRIGGER update_material_entries_updated_at
BEFORE UPDATE ON public.material_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();