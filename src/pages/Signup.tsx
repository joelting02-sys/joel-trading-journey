import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useSettings } from "@/store/useSettings";

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const t = useSettings((s) => s.t());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const configured = isSupabaseConfigured();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setSuccess(true);
    // 如果没开启邮箱验证,会自动登录并跳转
    setTimeout(() => navigate("/"), 1500);
  };

  if (!configured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="max-w-md w-full rounded-md border border-border bg-bg-surface p-6 text-sm text-text-secondary">
          请先在 <code className="font-mono">.env.local</code> 配置 Supabase。
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
          <UserPlus className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-text">{t.auth.signup}</h1>
        </div>

        {error && (
          <div className="mb-3 rounded-sm border border-loss/30 bg-loss/5 px-3 py-2 text-xs text-loss">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 rounded-sm border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            注册成功!正在跳转到主页...
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
              placeholder="至少 6 位"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || success}
          className="mt-5 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "..." : t.auth.signup}
        </button>

        <p className="mt-4 text-center text-xs text-text-muted">
          已有账号?{" "}
          <Link to="/login" className="text-primary hover:underline">
            {t.auth.login}
          </Link>
        </p>
      </form>
    </div>
  );
}
