import { useState } from "react";
import { useSettings } from "@/store/useSettings";
import { getSupabaseClient, triggerSupabaseSync } from "@/services/supabaseService";
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, RefreshCw, AlertTriangle, CheckCircle, Database } from "lucide-react";

const translations = {
  zh: {
    title: "交易日志",
    subtitle: "请登录以开始记录和同步您的交易旅程",
    email: "邮箱",
    emailPlaceholder: "name@example.com",
    password: "密码",
    passwordPlaceholder: "••••••••",
    loginBtn: "登 录",
    registerBtn: "注 册",
    loginTab: "账号登录",
    registerTab: "注册新账号",
    recheckCreds: "请输入邮箱和密码",
    signUpSuccess: "注册成功！请检查您的邮箱以确认账号，或直接尝试登录。",
    authError: "认证失败",
    secureTitle: "已加密内置云端数据库连接（安全保密）"
  },
  en: {
    title: "Trading Journal",
    subtitle: "Please log in to start tracking and syncing your trading journey",
    email: "Email",
    emailPlaceholder: "name@example.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    loginBtn: "Log In",
    registerBtn: "Register",
    loginTab: "Log In",
    registerTab: "Sign Up",
    recheckCreds: "Please enter email and password",
    signUpSuccess: "Sign up successful! Please check your email or try logging in.",
    authError: "Auth failed",
    secureTitle: "Private Cloud Database Connected (Secure)"
  }
};

export default function Login() {
  const language = useSettings((s) => s.language) === "zh" ? "zh" : "en";
  const t = translations[language];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setAuthError(t.recheckCreds);
      return;
    }
    
    setAuthenticating(true);
    setAuthError("");
    setAuthSuccess(false);
    setStatusMsg("");

    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error(language === "zh" ? "Supabase 客户端未初始化，请检查配置" : "Supabase client not initialized.");
      }

      if (authMode === "login") {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (data.session && data.user) {
          useSettings.setState({
            supabaseUserEmail: data.user.email || "",
            supabaseSessionToken: data.session.access_token || "",
            syncEnabled: true
          });
          // 登录成功，立即静默拉取云端数据
          triggerSupabaseSync().catch(() => {});
        }
      } else {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setAuthSuccess(true);
        setStatusMsg(t.signUpSuccess);
        setAuthMode("login");
        setPassword("");
      }
    } catch (e) {
      setAuthError((e as Error).message || t.authError);
    } finally {
      setAuthenticating(false);
    }
  }

  const inputClass = "w-full rounded-md border border-border bg-bg-surface px-3 py-2 pl-10 pr-10 font-mono text-sm text-text placeholder-text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20 disabled:opacity-60";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg-primary px-4 py-12">
      {/* Decorative backdrop blobs */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-info/10 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
            <img src="/joel-logo.svg" alt="Joel Logo" className="h-9 w-9" onError={(e) => {
              // Fallback if logo fails to load
              e.currentTarget.style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const icon = document.createElement('div');
                icon.className = 'text-primary text-2xl font-bold font-display';
                icon.innerText = 'TJ';
                parent.appendChild(icon);
              }
            }} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {t.subtitle}
          </p>
        </div>

        {/* Auth Box */}
        <div className="rounded-lg border border-border bg-bg-surface/80 p-6 shadow-xl backdrop-blur-md sm:p-8">
          <div className="mb-6 flex border-b border-border">
            <button
              type="button"
              onClick={() => { setAuthMode("login"); setAuthError(""); setAuthSuccess(false); }}
              className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
                authMode === "login"
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {t.loginTab}
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode("register"); setAuthError(""); setAuthSuccess(false); }}
              className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors ${
                authMode === "register"
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {t.registerTab}
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authError && (
              <div className="flex items-start gap-2.5 rounded-md border border-loss/20 bg-loss/5 px-3.5 py-2.5 text-xs text-loss animate-fadeIn">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div className="flex items-start gap-2.5 rounded-md border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-primary animate-fadeIn">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{statusMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">{t.email}</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className={inputClass}
                  disabled={authenticating}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">{t.password}</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className={inputClass}
                  disabled={authenticating}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authenticating}
              className="w-full justify-center inline-flex items-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/10 transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 mt-2"
            >
              {authenticating ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : authMode === "login" ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {authMode === "login" ? t.loginBtn : t.registerBtn}
            </button>
          </form>

          {/* Secure indicator */}
          <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-border/60 pt-4 text-[11px] text-text-muted">
            <Database className="h-3.5 w-3.5 text-primary/75" />
            <span>{t.secureTitle}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
