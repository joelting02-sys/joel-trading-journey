// Supabase 客户端
// 在 .env.local 里配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // 不在启动时直接抛错,让 UI 层提示用户去配置
  // 这样即使没配 .env,dev server 也能启动,用户能看到配置引导页
  console.warn(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Set them in .env.local or in the Vercel project settings."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "tj-supabase-auth",
    },
  }
);

export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
