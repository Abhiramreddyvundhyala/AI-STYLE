-- Create model_settings table
-- This table stores the enabled/disabled state of AI models

CREATE TABLE IF NOT EXISTS model_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_model_settings_model_id ON model_settings(model_id);
CREATE INDEX IF NOT EXISTS idx_model_settings_is_enabled ON model_settings(is_enabled);

-- Enable Row Level Security
ALTER TABLE model_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access to model settings"
  ON model_settings
  FOR SELECT
  TO public
  USING (true);

-- Create policy for authenticated users to update (admin only)
CREATE POLICY "Allow admin users to update model settings"
  ON model_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Insert default model settings (only GPT Image 2.0 enabled)
INSERT INTO model_settings (model_id, is_enabled) VALUES
  ('gpt-image-2', true),
  ('nanobanana-2', false),
  ('nanobanana-pro', false),
  ('seedream-5-lite', false),
  ('seedream-4-5', false),
  ('midjourney-v8', false),
  ('flux-2-klein', false),
  ('z-image-turbo', false)
ON CONFLICT (model_id) DO NOTHING;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_model_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
CREATE TRIGGER update_model_settings_timestamp
  BEFORE UPDATE ON model_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_model_settings_timestamp();

-- Create admin_users table for role management
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own data
CREATE POLICY "Users can read their own data"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy for admins to read all data
CREATE POLICY "Admins can read all user data"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.role = 'admin'
    )
  );
