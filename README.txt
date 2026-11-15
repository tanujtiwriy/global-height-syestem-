GLOBAL HEIGHTS — RWA CARE (SUPABASE DATABASE EDITION)
=====================================================

Files:
- index.html, style.css, script.js
- supabase-config.js (paste Supabase Project URL + anon/public key)
- supabase-integration.js (loads Supabase JS client)
- supabase-schema.sql (tables, auth trigger, Row Level Security policies)

IMPORTANT: The project is prepared for Supabase, but it is NOT connected to your
live database until you create a Supabase project and enter its URL + anon/public
key in supabase-config.js. I cannot create/connect a database inside your account
without access to your project credentials. Never put a service_role key in frontend.

SET UP THE REAL DATABASE:
1. Create a project at https://supabase.com/dashboard
2. Open SQL Editor > New query. Paste all of supabase-schema.sql and click Run.
3. Open Project Settings > API. Copy the Project URL and anon/public key.
4. Paste both into supabase-config.js (the anon/public key is intended for frontend use).
5. In Authentication > URL Configuration, add your local development URL and your
   deployed Netlify URL to the allowed redirect URLs.
6. Register a resident account in the website. If email confirmation is enabled,
   verify the email before signing in.
7. New residents start unverified. The RWA must verify each resident's flat details.
   In SQL Editor, after checking identity, run:
   update public.profiles set is_verified=true where id='RESIDENT_AUTH_USER_UUID';
8. Promote only a verified management account to admin. In SQL Editor run:
   select id,email from auth.users;
   update public.profiles set role='admin', is_verified=true where id='ADMIN_AUTH_USER_UUID';
9. Test with two resident accounts and one admin account. Complaints are private
   to their creator and admins; notices are shared with authenticated residents.

SECURITY / LIMITATIONS:
- Row Level Security (RLS) is included. Keep it enabled.
- New accounts are always unverified residents; users cannot self-verify or select admin role.
- RWA must set profiles.is_verified=true only after verifying a resident's flat details.
- Never expose a service_role/secret key in frontend code or GitHub.
- Complaints and notices use the shared Supabase database and realtime refresh.
- Maintenance/payment tables are created with access policies, but the UI is not
  yet wired to real billing records. Online payment is NOT integrated. Payment status
  must only be marked verified after server-side payment gateway confirmation.
- Admin identity and resident/flat identity must be verified by the RWA before launch.
- Replace sample/illustrative society photos and verify all society details.

NETLIFY:
- Push all project files to GitHub.
- Import the repo in Netlify. Build command: blank; publish directory: .
- Ensure supabase-config.js contains only the anon/public key, never service_role.
