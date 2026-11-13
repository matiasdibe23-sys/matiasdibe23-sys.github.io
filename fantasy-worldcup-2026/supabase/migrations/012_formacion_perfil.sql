-- Add formacion column to perfiles to persist the user's chosen tactical formation
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS formacion text NOT NULL DEFAULT '4-3-3'
  CHECK (formacion IN ('4-3-3','4-4-2','3-4-3','5-3-2','4-5-1','3-5-2'));
