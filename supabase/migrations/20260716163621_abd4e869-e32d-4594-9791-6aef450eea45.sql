-- Trigger function: mirror payment_history rows into cashbook as linked expenses
CREATE OR REPLACE FUNCTION public.sync_payment_to_cashbook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cashbook (
      user_id, date, type, category, amount, site_name, notes, worker_id, payment_id
    ) VALUES (
      NEW.user_id,
      NEW.payment_date,
      'expense'::cashbook_type,
      'labor'::cashbook_category,
      ROUND(NEW.amount)::int,
      NEW.site_name,
      COALESCE(NEW.note, 'सैलरी भुगतान'),
      NEW.worker_id,
      NEW.id
    )
    ON CONFLICT (payment_id) WHERE payment_id IS NOT NULL DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.cashbook
       SET amount    = ROUND(NEW.amount)::int,
           date      = NEW.payment_date,
           site_name = NEW.site_name,
           notes     = COALESCE(NEW.note, 'सैलरी भुगतान'),
           worker_id = NEW.worker_id
     WHERE payment_id = NEW.id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_to_cashbook ON public.payment_history;
CREATE TRIGGER trg_sync_payment_to_cashbook
AFTER INSERT OR UPDATE ON public.payment_history
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_to_cashbook();

-- Backfill: create cashbook entries for existing salary payments that don't have one yet
INSERT INTO public.cashbook (user_id, date, type, category, amount, site_name, notes, worker_id, payment_id)
SELECT ph.user_id,
       ph.payment_date,
       'expense'::cashbook_type,
       'labor'::cashbook_category,
       ROUND(ph.amount)::int,
       ph.site_name,
       COALESCE(ph.note, 'सैलरी भुगतान'),
       ph.worker_id,
       ph.id
  FROM public.payment_history ph
  LEFT JOIN public.cashbook cb ON cb.payment_id = ph.id
 WHERE cb.id IS NULL
   AND ph.user_id IS NOT NULL;