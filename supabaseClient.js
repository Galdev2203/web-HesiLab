// supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  "https://etmkmapztxvmzvlntgkh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bWttYXB6dHh2bXp2bG50Z2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4MzYyMDgsImV4cCI6MjA4MDQxMjIwOH0.SWrJhk4asccEIZ7hILcANQGw8nF8mDDb3kktKiYu7hs"
);
