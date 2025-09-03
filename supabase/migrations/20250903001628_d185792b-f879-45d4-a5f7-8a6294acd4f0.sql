-- Add missing profile fields for singer information
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS contact_number TEXT;

-- Add check constraints for age
ALTER TABLE public.profiles 
ADD CONSTRAINT check_age_range CHECK (age IS NULL OR (age >= 13 AND age <= 120));

-- Add check constraint for gender (optional but good for data consistency)
ALTER TABLE public.profiles 
ADD CONSTRAINT check_gender_values CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'Other', 'Prefer not to say'));