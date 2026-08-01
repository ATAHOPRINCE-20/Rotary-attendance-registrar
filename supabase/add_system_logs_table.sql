-- Create system_logs table for storing backend and frontend real-time application errors & logs
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'fatal')),
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'acknowledged', 'resolved'))
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON public.system_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_logs_status ON public.system_logs(status);
CREATE INDEX IF NOT EXISTS idx_system_logs_org_id ON public.system_logs(organization_id);

-- Enable RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can select system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Super admins can update system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Super admins can delete system logs" ON public.system_logs;
DROP POLICY IF EXISTS "Everyone can insert system logs" ON public.system_logs;

-- Policy: Only super_admin users can view system logs
CREATE POLICY "Super admins can select system logs"
ON public.system_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- Policy: Super admins can update system log status
CREATE POLICY "Super admins can update system logs"
ON public.system_logs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- Policy: Super admins can delete system logs
CREATE POLICY "Super admins can delete system logs"
ON public.system_logs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'super_admin'
  )
);

-- Policy: Allow authenticated users and service role to insert system logs
CREATE POLICY "Everyone can insert system logs"
ON public.system_logs FOR INSERT
WITH CHECK (true);

-- Enable Supabase Realtime for system_logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'system_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_logs;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
