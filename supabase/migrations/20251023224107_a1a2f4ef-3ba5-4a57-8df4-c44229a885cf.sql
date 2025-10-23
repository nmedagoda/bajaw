-- Allow admins to update any uploaded song
CREATE POLICY "Admins can update any uploaded song"
ON public.uploaded_songs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admins to delete any uploaded song
CREATE POLICY "Admins can delete any uploaded song"
ON public.uploaded_songs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));