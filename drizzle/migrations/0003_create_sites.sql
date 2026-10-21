CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  legacy_local_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sites_name_not_blank CHECK (length(btrim(name)) > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sites"   ON public.sites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own sites"    ON public.sites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sites" ON public.sites FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sites" ON public.sites FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX sites_user_name_unique
  ON public.sites (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
CREATE UNIQUE INDEX sites_user_legacy_unique
  ON public.sites (user_id, legacy_local_id) WHERE legacy_local_id IS NOT NULL;
CREATE INDEX sites_user_id_idx ON public.sites (user_id);

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();