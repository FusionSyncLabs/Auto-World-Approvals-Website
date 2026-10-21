
-- Happy Clients showcase table
CREATE TABLE public.happy_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  location text,
  vehicle text,
  quote text NOT NULL,
  photo_url text NOT NULL,
  accent_color text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.happy_clients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.happy_clients TO authenticated;
GRANT ALL ON public.happy_clients TO service_role;

ALTER TABLE public.happy_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active happy clients"
  ON public.happy_clients FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert happy clients"
  ON public.happy_clients FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update happy clients"
  ON public.happy_clients FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete happy clients"
  ON public.happy_clients FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER happy_clients_set_updated_at
  BEFORE UPDATE ON public.happy_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX happy_clients_order_idx ON public.happy_clients (is_active, display_order);

-- Seed a few placeholder entries so the section has content immediately (admin can replace)
INSERT INTO public.happy_clients (client_name, location, vehicle, quote, photo_url, display_order) VALUES
  ('Jordan M.', 'Surrey, BC', '2022 Toyota RAV4', 'Painless application — someone called me the next morning. I was in the SUV I wanted within a week.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80', 10),
  ('Priya S.', 'Calgary, AB', '2023 Honda Civic', 'I was nervous about my credit. They walked me through realistic options without any pressure.', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=900&q=80', 20),
  ('Marc D.', 'Kelowna, BC', '2021 Ford F-150', 'They factored in my trade-in before I even walked into a dealership. Saved me hours.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80', 30),
  ('Aisha K.', 'Edmonton, AB', '2023 Hyundai Tucson', 'First-time buyer and they made every step feel approachable. Drove off in my dream SUV.', 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80', 40),
  ('Ryan T.', 'Vancouver, BC', '2022 Tesla Model 3', 'Got matched with a lender that actually understood EVs. The whole thing took two days.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80', 50),
  ('Chantal R.', 'Red Deer, AB', '2020 Mazda CX-5', 'Rebuilding my credit and they still found me a great rate. I felt heard, not judged.', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80', 60);
