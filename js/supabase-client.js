/* ─────────────────────────────────────────
   DJ LitKick Booking — supabase-client.js
   Shared Supabase connection for index.html + admin.html
   See README.md for setup instructions.
───────────────────────────────────────── */

/* Paste your Supabase project URL and anon (public) key below.
   The anon key is safe to expose in client code — access control
   is enforced by Row Level Security policies, not by key secrecy.
   See README.md section "Supabase setup". */
const SUPABASE_URL = "https://ltgeryyxddyklxnhsrjr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iRxR-3ft4zUM8bJcxH6MrQ_7nKkusbU";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
