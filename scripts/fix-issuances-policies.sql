-- Fix missing RLS policies for issuances table
-- Copy and paste this SQL into your Supabase SQL Editor
-- This will add the missing UPDATE and DELETE policies

-- Add UPDATE policy for issuances table
CREATE POLICY "Enable update for all users" ON issuances FOR UPDATE USING (true);

-- Add DELETE policy for issuances table  
CREATE POLICY "Enable delete for all users" ON issuances FOR DELETE USING (true);

-- Verify all policies are created correctly
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'issuances'
ORDER BY cmd;

-- Expected output should show 4 policies:
-- 1. Enable read access for all users (SELECT)
-- 2. Enable insert for all users (INSERT) 
-- 3. Enable update for all users (UPDATE) - NEW
-- 4. Enable delete for all users (DELETE) - NEW