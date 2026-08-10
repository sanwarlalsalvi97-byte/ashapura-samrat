CREATE TABLE public.office_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL DEFAULT 'मुख्य ऑफिस',
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  radius_meters integer NOT NULL DEFAULT 50,
  face_scan_enabled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_locations TO authenticated;
GRANT ALL ON public.office_locations TO service_role;

ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own office locations" ON public.office_locations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own office locations" ON public.office_locations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own office locations" ON public.office_locations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own office locations" ON public.office_locations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_office_locations_updated_at
BEFORE UPDATE ON public.office_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  office_location_id uuid REFERENCES public.office_locations(id) ON DELETE SET NULL,
  attendance_type text NOT NULL DEFAULT 'in',
  logged_at timestamptz NOT NULL DEFAULT now(),
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  latitude numeric,
  longitude numeric,
  distance_meters numeric,
  face_verified boolean NOT NULL DEFAULT false,
  site_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX attendance_logs_user_date_idx ON public.attendance_logs (user_id, log_date DESC);
CREATE INDEX attendance_logs_worker_idx ON public.attendance_logs (worker_id, log_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_logs TO authenticated;
GRANT ALL ON public.attendance_logs TO service_role;

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own attendance logs" ON public.attendance_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attendance logs" ON public.attendance_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own attendance logs" ON public.attendance_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own attendance logs" ON public.attendance_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);