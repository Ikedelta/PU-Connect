import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if redirected from admin
  const fromAdmin = location.state?.from?.pathname?.includes('/admin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { user } = await signIn(email, password);

      // Fetch profile to determine role-based redirect
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profile?.role === 'admin') {
          navigate('/admin');
        } else if (profile?.role === 'news_publisher') {
          navigate('/publisher');
        } else if (profile?.role === 'seller') {
          navigate('/seller/dashboard');
        } else {
          navigate('/marketplace');
        }
      } else {
        navigate('/marketplace');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetMessage({
        type: 'success',
        text: 'Password reset link has been sent to your email. Please check your inbox.',
      });
      setResetEmail('');
    } catch (err: any) {
      setResetMessage({
        type: 'error',
        text: err.message || 'Failed to send reset email',
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans overflow-hidden">
      {/* Visual Identity Panel - Consistent with Register Page */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative p-12 flex-col justify-between overflow-hidden">
        {/* Background Image & Overlays */}
        <div className="absolute inset-0 z-0">
          <img
            src="/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-11.jpeg"
            alt="Pentecost University"
            className="w-full h-full object-cover object-bottom opacity-40 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-slate-900/80 to-transparent"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col gap-2">
          <Link to="/" className="w-48 h-48 transition-transform duration-500 hover:scale-110">
            <img src="/PU%20Connect%20logo.png" alt="Logo" className="w-full h-full object-contain" />
          </Link>

          <div className="max-w-xl">
            <h1 className="text-7xl font-extrabold text-white leading-[0.9] mb-6 tracking-tighter">
              {fromAdmin ? 'System' : 'Welcome'} <br />
              <span className="text-blue-400">{fromAdmin ? 'Access.' : 'Back.'}</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm opacity-90 border-l-2 border-blue-500/50 pl-6">
              {fromAdmin
                ? 'Secure administrative access point for system management and oversight.'
                : 'Log in to continue your journey. Manage your listings, messages, and campus connections.'}
            </p>
          </div>
        </div>

        {/* Mobile Mockup Image */}
        {!fromAdmin && (
          <div className="relative z-10 mt-auto -mb-24 flex justify-center">
            <img
              src="/app_mobile_mockup_1768321221445.png"
              alt="App Preview"
              className="w-[80%] h-auto drop-shadow-2xl animate-in slide-in-from-bottom-20 duration-1000"
            />
          </div>
        )}

        {/* Decorative Elements */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/20 blur-[100px] rounded-full"></div>
      </div>

      {/* Auth Interface */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 lg:p-10 relative">
        {/* Background Gradients for Mobile */}
        <div className="lg:hidden absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full"></div>
        </div>

        <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="w-20 h-20 transition-transform duration-500 active:scale-95">
              <img src="/PU%20Connect%20logo.png" alt="Logo" className="w-full h-full object-contain" />
            </Link>
          </div>

          {/* Header Section */}
          <div className="mb-8 text-center lg:text-left">
            {fromAdmin && (
              <span className="inline-block px-3 py-1 mb-4 bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-full">
                Restricted Access
              </span>
            )}
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              {showForgotPassword
                ? 'Reset Password.'
                : (fromAdmin ? 'Admin Login.' : 'Sign In.')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">
              {showForgotPassword
                ? 'Enter your email to receive reset instructions.'
                : 'Please enter your credentials to proceed.'}
            </p>
          </div>

          {/* Conditional Rendering: Main Login vs Forgot Password */}
          {!showForgotPassword ? (
            // === LOGIN FORM ===
            <>
              {error && (
                <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-2xl flex items-start gap-3 animate-in shake duration-300">
                  <i className="ri-error-warning-fill text-rose-600 dark:text-rose-400 text-lg mt-0.5"></i>
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Email Address</label>
                  <div className="relative group">
                    <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"></i>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs font-semibold transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setError('');
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors uppercase tracking-wide"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative group">
                    <i className="ri-lock-2-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"></i>
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-11 pr-11 text-xs font-semibold transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      <i className={`ri-${showPassword ? 'eye-off' : 'eye'}-line text-lg`}></i>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-2 overflow-hidden relative group"
                >
                  <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10"></div>
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 dark:border-slate-900/20 border-t-white dark:border-t-slate-900 rounded-full animate-spin"></div>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform"></i>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-900 text-center">
                <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                  New to the platform?{' '}
                  <Link
                    to="/register"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold ml-1 transition-colors"
                  >
                    Create Account
                  </Link>
                </p>
              </div>
            </>
          ) : (
            // === FORGOT PASSWORD FORM ===
            <>
              {resetMessage && (
                <div className={`mb-6 p-4 rounded-2xl flex items-start gap-3 border animate-in fade-in slide-in-from-top-2 ${resetMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
                  : 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30'
                  }`}>
                  <i className={`${resetMessage.type === 'success'
                    ? 'ri-checkbox-circle-fill text-emerald-600 dark:text-emerald-400'
                    : 'ri-error-warning-fill text-rose-600 dark:text-rose-400'
                    } text-lg mt-0.5`}></i>
                  <p className={`text-xs font-bold leading-relaxed ${resetMessage.type === 'success' ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200'
                    }`}>
                    {resetMessage.text}
                  </p>
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Email Address</label>
                  <div className="relative group">
                    <i className="ri-mail-send-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"></i>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs font-semibold transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
                      placeholder="name@example.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-2 overflow-hidden relative group"
                >
                  <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10"></div>
                  {resetLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 dark:border-slate-900/20 border-t-white dark:border-t-slate-900 rounded-full animate-spin"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Link</span>
                      <i className="ri-send-plane-fill group-hover:translate-x-1 transition-transform"></i>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetMessage(null);
                  }}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <i className="ri-arrow-left-line"></i>
                  Back to Sign In
                </button>
              </div>
            </>
          )}

          {/* Home Link */}
          <div className="mt-8 text-center lg:hidden">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-widest transition-colors"
            >
              <i className="ri-arrow-left-line"></i>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
