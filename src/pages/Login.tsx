import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSettings } from "@/store/useSettings";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const t = useSettings((s) => s.t());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const configured = isSupabaseConfigured();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate("/");
  };

  if (!configured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="max-w-md w-full rounded-md border border-border bg-bg-surface p-6">
          <h1 className="text-lg font-semibold text-text">需要先配置 Supabase</h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            1. 到 <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary underline">supabase.com</a> 创建一个项目<br />
            2. Project Settings → API 复制 URL 和 anon key<br />
            3. 在项目根目录的 <code className="rounded bg-bg-elevated px-1 py-0.5 text-xs font-mono">.env.local</code> 里填上：
          </p>
          <pre className="mt-3 overflow-x-auto rounded-sm bg-bg-elevated p-3 text-xs font-mono text-text">
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
          </pre>
          <p className="mt-3 text-sm text-text-secondary">4. 在 Supabase 控制台 SQL Editor 里跑一次 <code className="rounded bg-bg-elevated px-1 py-0.5 text-xs font-mono">supabase/schema.sql</code></p>
          <p className="mt-3 text-sm text-text-secondary">5. 重启 dev server (pnpm dev)</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-md border border-border bg-bg-surface p-6"
      >
        <div className="mb-5 flex items-center gap-2">
          <LogIn className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-text">{t.auth.login}</h1>
        </div>

        {error && (
          <div className="mb-3 rounded-sm border border-loss/30 bg-loss/5 px-3 py-2 text-xs text-loss">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-text-secondary text-xs font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs font-medium">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "..." : t.auth.login}
        </button>

        <p className="mt-4 text-center text-xs text-text-muted">
          {t.auth.noAccount}{" "}
          <Link to="/signup" className="text-primary hover:underline">
            {t.auth.signup}
          </Link>
        </p>
      </form>
    </div>
  );
}
