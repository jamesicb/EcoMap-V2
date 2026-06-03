-- EcoMap: customers table + RLS for the browser app (publishable / anon key).
-- Run once in Supabase Dashboard → SQL Editor → New query → paste → Run.

-- Optional column for quote form messages
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS message text;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Public quote form: controlled insert (bypasses table RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.submit_quote_enquiry(
  p_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF coalesce(trim(p_name), '') = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  INSERT INTO public.customers (name, email, phone, message)
  VALUES (
    trim(p_name),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_message, '')), '')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quote_enquiry(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quote_enquiry(text, text, text, text) TO anon, authenticated;

-- CRM + direct REST access (same anon key as the public site)
DROP POLICY IF EXISTS "customers_anon_select" ON public.customers;
CREATE POLICY "customers_anon_select"
  ON public.customers FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "customers_anon_insert" ON public.customers;
CREATE POLICY "customers_anon_insert"
  ON public.customers FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "customers_anon_update" ON public.customers;
CREATE POLICY "customers_anon_update"
  ON public.customers FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "customers_anon_delete" ON public.customers;
CREATE POLICY "customers_anon_delete"
  ON public.customers FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "customers_authenticated_all" ON public.customers;
CREATE POLICY "customers_authenticated_all"
  ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
