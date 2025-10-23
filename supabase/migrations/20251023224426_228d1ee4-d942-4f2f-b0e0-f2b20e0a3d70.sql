-- Allow admins to view all uploaded songs for analysis
CREATE POLICY "Admins can view all uploaded songs"
ON public.uploaded_songs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));