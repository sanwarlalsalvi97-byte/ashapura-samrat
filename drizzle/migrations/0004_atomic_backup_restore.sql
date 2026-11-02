CREATE OR REPLACE FUNCTION public.restore_user_data(backup_json jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  tables text[] := ARRAY['workers','office_locations','contractors','brick_stock','material_entries','attendance','worker_expenses','payment_history','attendance_logs','cashbook'];
  core text[] := ARRAY['workers','attendance','worker_expenses','cashbook','brick_stock','contractors','payment_history'];
  t text;
  r jsonb;
  cols text;
  vals text;
  updates text;
  ref_id uuid;
  current_link uuid;
  affected bigint;
  row_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'रीस्टोर के लिए लॉगिन करें'; END IF;
  IF jsonb_typeof(backup_json) IS DISTINCT FROM 'object'
     OR backup_json->>'app' IS DISTINCT FROM 'AshapuraSamrat'
     OR backup_json->>'version' IS DISTINCT FROM '1'
     OR jsonb_typeof(backup_json->'data') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'बैकअप फ़ाइल का स्वरूप गलत है';
  END IF;
  IF backup_json->'user'->>'id' IS DISTINCT FROM uid::text THEN
    RAISE EXCEPTION 'यह बैकअप दूसरे अकाउंट का है';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(uid::text, 0));
  FOREACH t IN ARRAY core LOOP
    IF NOT (backup_json->'data' ? t) THEN
      RAISE EXCEPTION 'बैकअप में आवश्यक डेटा गायब है: %', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY tables || ARRAY['sites'] LOOP
    IF backup_json->'data' ? t THEN
      IF jsonb_typeof(backup_json->'data'->t) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'बैकअप में सूची गलत है: %', t;
      END IF;
      FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(backup_json->'data'->t) LOOP
        IF jsonb_typeof(r) IS DISTINCT FROM 'object'
           OR (r ? 'user_id' AND r->>'user_id' IS DISTINCT FROM uid::text) THEN
          RAISE EXCEPTION 'बैकअप रिकॉर्ड का अकाउंट या स्वरूप गलत है: %', t;
        END IF;
        IF t <> 'sites' THEN
          row_id := (r->>'id')::uuid;
          IF row_id IS NULL THEN RAISE EXCEPTION 'बैकअप रिकॉर्ड ID गायब है: %', t; END IF;
        END IF;
      END LOOP;
      IF t <> 'sites' AND EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_array_elements(backup_json->'data'->t) e
        GROUP BY e->>'id' HAVING count(*) > 1
      ) THEN RAISE EXCEPTION 'बैकअप में दोहराई गई ID है: %', t; END IF;
    END IF;
  END LOOP;
  IF NOT (backup_json->'data' ? 'attendance_logs') AND EXISTS (
    SELECT 1 FROM public.attendance_logs WHERE user_id = uid
  ) THEN RAISE EXCEPTION 'पुराने बैकअप में पंच हाजिरी नहीं है; वर्तमान पंच डेटा सुरक्षित रखने के लिए रीस्टोर रोका गया'; END IF;
  FOREACH t IN ARRAY ARRAY['cashbook','attendance_logs','payment_history','worker_expenses','attendance','material_entries','brick_stock','contractors'] LOOP
    IF backup_json->'data' ? t THEN
      EXECUTE pg_catalog.format('DELETE FROM public.%I WHERE user_id = $1', t) USING uid;
    END IF;
  END LOOP;
  DELETE FROM public.workers w WHERE w.user_id = uid AND NOT EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(backup_json->'data'->'workers') b WHERE (b->>'id')::uuid = w.id
  );
  FOREACH t IN ARRAY tables LOOP
    IF NOT (backup_json->'data' ? t) THEN CONTINUE; END IF;
    FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(backup_json->'data'->t) LOOP
      r := r || pg_catalog.jsonb_build_object('user_id', uid);
      row_id := (r->>'id')::uuid;
      IF t = 'workers' THEN
        SELECT linked_user_id INTO current_link FROM public.workers WHERE id = row_id AND user_id = uid;
        IF r->>'linked_user_id' IS NOT NULL AND (r->>'linked_user_id')::uuid IS DISTINCT FROM current_link THEN
          RAISE EXCEPTION 'बैकअप से मजदूर का लिंक बदलना अनुमत नहीं है';
        END IF;
        r := r || pg_catalog.jsonb_build_object('linked_user_id', current_link);
      END IF;
      IF t IN ('attendance','attendance_logs','worker_expenses','payment_history','cashbook') THEN
        ref_id := (r->>'worker_id')::uuid;
        IF ref_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.workers WHERE id = ref_id AND user_id = uid
            AND EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(backup_json->'data'->'workers') w WHERE (w->>'id')::uuid = ref_id)
        ) THEN RAISE EXCEPTION 'बैकअप में मजदूर का संबंध गलत है: %', t; END IF;
      END IF;
      IF t = 'attendance_logs' THEN
        ref_id := (r->>'office_location_id')::uuid;
        IF ref_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.office_locations WHERE id = ref_id AND user_id = uid) THEN
          RAISE EXCEPTION 'पंच हाजिरी की कार्यालय लोकेशन उपलब्ध नहीं है';
        END IF;
      END IF;
      IF t = 'cashbook' THEN
        ref_id := (r->>'payment_id')::uuid;
        IF ref_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.payment_history WHERE id = ref_id AND user_id = uid) THEN
          RAISE EXCEPTION 'कैशबुक का भुगतान संबंध गलत है';
        END IF;
      END IF;
      SELECT pg_catalog.string_agg(pg_catalog.format('%I', a.attname), ', ' ORDER BY a.attnum),
             pg_catalog.string_agg(pg_catalog.format('v.%I', a.attname), ', ' ORDER BY a.attnum),
             pg_catalog.string_agg(pg_catalog.format('%1$I = EXCLUDED.%1$I', a.attname), ', ' ORDER BY a.attnum) FILTER (WHERE a.attname NOT IN ('id','user_id'))
      INTO cols, vals, updates
      FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = pg_catalog.to_regclass('public.' || t)
        AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '' AND r ? a.attname;
      IF t = 'workers' THEN
        SELECT pg_catalog.string_agg(pg_catalog.format('%1$I = v.%1$I', a.attname), ', ' ORDER BY a.attnum)
          INTO updates FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.workers'::regclass AND a.attnum > 0 AND NOT a.attisdropped
            AND a.attname NOT IN ('id','user_id') AND r ? a.attname;
        EXECUTE pg_catalog.format('UPDATE public.workers w SET %s FROM pg_catalog.jsonb_populate_record(NULL::public.workers, $1) v WHERE w.id = $2 AND w.user_id = $3', updates)
          USING r, row_id, uid;
        GET DIAGNOSTICS affected = ROW_COUNT;
        IF affected = 1 THEN CONTINUE; END IF;
        SELECT pg_catalog.string_agg(pg_catalog.format('%1$I = EXCLUDED.%1$I', a.attname), ', ' ORDER BY a.attnum)
          INTO updates FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = 'public.workers'::regclass AND a.attnum > 0 AND NOT a.attisdropped
            AND a.attname NOT IN ('id','user_id') AND r ? a.attname;
      END IF;
      EXECUTE pg_catalog.format(
        'INSERT INTO public.%1$I (%2$s) SELECT %3$s FROM pg_catalog.jsonb_populate_record(NULL::public.%1$I, $1) v ON CONFLICT (id) DO UPDATE SET %4$s WHERE %1$I.user_id = $2', t, cols, vals, updates
      ) USING r, uid;
      EXECUTE pg_catalog.format('SELECT id FROM public.%I WHERE id = $1 AND user_id = $2', t) INTO ref_id USING row_id, uid;
      IF ref_id IS NULL THEN RAISE EXCEPTION 'रिकॉर्ड ID दूसरे अकाउंट की है: %', t; END IF;
    END LOOP;
  END LOOP;
  FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(backup_json->'data'->'sites', '[]'::jsonb)) LOOP
    IF r->>'name' IS NULL OR pg_catalog.btrim(r->>'name') = '' THEN RAISE EXCEPTION 'साइट का नाम खाली है'; END IF;
    INSERT INTO public.sites (user_id, name, owner_name, is_active)
    VALUES (uid, pg_catalog.regexp_replace(pg_catalog.btrim(r->>'name'), '\s+', ' ', 'g'), COALESCE(r->>'owner_name',''), COALESCE((r->>'is_active')::boolean,false))
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.restore_user_data(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_user_data(jsonb) TO authenticated;
COMMENT ON FUNCTION public.restore_user_data(jsonb) IS 'Atomic same-account operational restore. RLS and subscription worker limits remain active. Sites/office locations merge. Storage files and auth/billing are not restored.';