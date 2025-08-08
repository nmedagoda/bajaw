-- Create user role enum
CREATE TYPE public.user_role AS ENUM ('singer', 'judge', 'audience');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  profile_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create songs table
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  lyrics TEXT,
  karaoke_url TEXT,
  professional_audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create performances table
CREATE TABLE public.performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  audio_url TEXT,
  video_url TEXT,
  analysis_data JSONB,
  similarity_score DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  performance_id UUID NOT NULL REFERENCES public.performances(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(voter_id, performance_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Songs policies (public read access)
CREATE POLICY "Anyone can view songs" ON public.songs
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert songs" ON public.songs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Performances policies
CREATE POLICY "Anyone can view performances" ON public.performances
  FOR SELECT USING (true);

CREATE POLICY "Singers can create performances" ON public.performances
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'singer'
    )
  );

CREATE POLICY "Singers can update own performances" ON public.performances
  FOR UPDATE USING (
    singer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'singer'
    )
  );

-- Votes policies
CREATE POLICY "Users can view all votes" ON public.votes
  FOR SELECT USING (true);

CREATE POLICY "Judges and audience can vote" ON public.votes
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = voter_id AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('judge', 'audience')
    )
  );

CREATE POLICY "Users can update own votes" ON public.votes
  FOR UPDATE USING (auth.uid() = voter_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_performances_updated_at
  BEFORE UPDATE ON public.performances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'audience')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for media files
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('audio-files', 'audio-files', false),
  ('video-files', 'video-files', false),
  ('profile-photos', 'profile-photos', true);

-- Storage policies for audio files
CREATE POLICY "Users can upload their own audio" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'audio-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view audio they have access to" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'audio-files'
  );

-- Storage policies for video files
CREATE POLICY "Users can upload their own videos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'video-files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view videos" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'video-files'
  );

-- Storage policies for profile photos
CREATE POLICY "Anyone can view profile photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'profile-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own profile photos" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'profile-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );