import { createClient } from "@supabase/supabase-js";

export function createClerkSupabaseClient(clerk) {

  return createClient(

    import.meta.env.VITE_SUPABASE_URL,

    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,

    {

      accessToken: async () => {

        return clerk.session?.getToken() ?? null;

      }

    }

  );

}