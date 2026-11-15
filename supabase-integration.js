/* Supabase bootstrap for Global Heights RWA Care.
   Requires supabase-config.js. The public anon key is safe only with the RLS policies
   in supabase-schema.sql enabled. Never use a service_role key in browser code. */
(async () => {
  const cfg = window.RWA_SUPABASE_CONFIG || {};
  const configured = cfg.url && cfg.anonKey &&
    !cfg.url.includes("YOUR_SUPABASE") && !cfg.anonKey.includes("YOUR_SUPABASE");
  window.rwaDbReady = false;
  if (!configured) {
    console.warn("Supabase is not configured. Add the project URL and anon key in supabase-config.js.");
    window.dispatchEvent(new Event("rwa-db-ready"));
    return;
  }
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  window.rwaSupabase = createClient(cfg.url, cfg.anonKey);
  window.rwaDbReady = true;
  window.dispatchEvent(new Event("rwa-db-ready"));
})();
