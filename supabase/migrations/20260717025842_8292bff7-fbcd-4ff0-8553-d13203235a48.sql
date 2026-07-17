-- Remove auto-sync of salary payments into cashbook.
DROP TRIGGER IF EXISTS trg_sync_payment_to_cashbook ON public.payment_history;
DROP FUNCTION IF EXISTS public.sync_payment_to_cashbook();

-- Clean up historical cashbook rows that were auto-created from salary payments
-- (identified by having a payment_id link). Manual entries have payment_id IS NULL.
DELETE FROM public.cashbook WHERE payment_id IS NOT NULL;