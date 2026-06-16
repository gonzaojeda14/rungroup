-- FK entre carreras_sugeridas y profiles
ALTER TABLE public.carreras_sugeridas
  ADD CONSTRAINT carreras_sugeridas_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
