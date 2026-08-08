-- Allow public to search complaints by submitter details
CREATE POLICY "Public can search complaints"
ON public.complaints FOR SELECT
USING (true);