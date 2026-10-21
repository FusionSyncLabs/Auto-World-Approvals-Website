ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));
UPDATE public.profiles SET username = 'adaml' WHERE id = '12cca0ca-0a3f-41c4-a6a2-dc117849964e';