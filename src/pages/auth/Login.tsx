
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

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

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full"></div>
        </div>

        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <Link to="/" className="inline-flex flex-col items-center gap-4 mb-8 group">
              <div className="w-20 h-20 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
                <img src="/PU%20Connect%20logo.png" alt="PU Connect" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
            </Link>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight mb-4">Reset Password.</h2>
            <p className="text-gray-500 font-bold uppercase tracking-wide text-[10px]">Provide your registered email address</p>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-gray-100 p-8 md:p-10">
            {resetMessage && (
              <div className={`mb-8 p-6 rounded-2xl flex items-start gap-4 ${resetMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-100'
                : 'bg-rose-50 border border-rose-100'
                }`}>
                <i className={`${resetMessage.type === 'success'
                  ? 'ri-checkbox-circle-fill text-emerald-600'
                  : 'ri-error-warning-fill text-rose-600'
                  } text-2xl`}></i>
                <p className={`text-sm font-bold leading-relaxed ${resetMessage.type === 'success' ? 'text-emerald-800' : 'text-rose-800'
                  }`}>
                  {resetMessage.text}
                </p>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-8">
              <div className="space-y-2">
                <label htmlFor="resetEmail" className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <i className="ri-mail-send-line absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-xl group-focus-within:text-blue-600 transition-colors"></i>
                  <input
                    id="resetEmail"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-14 pr-6 py-5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm transition-all"
                    placeholder="name@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-5 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all font-bold text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {resetLoading ? (
                  <i className="ri-loader-4-line animate-spin text-xl"></i>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <i className="ri-arrow-right-line"></i>
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 text-center">
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetMessage(null);
                }}
                className="text-[10px] font-bold text-gray-400 hover:text-blue-600 uppercase tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 mx-auto"
              >
                <i className="ri-arrow-left-s-line text-lg"></i>
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 flex flex-col items-center justify-center p-6 relative overflow-hidden transition-colors duration-300 font-sans">
      {/* Cinematic Background with University Image */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src="/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-2-1536x1152.jpeg"
          alt="Pentecost University Campus"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gray-900/60 dark:bg-gray-950/80 backdrop-blur-[2px]"></div>

        {/* Animated Gradient Accents */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-overlay animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-overlay animate-pulse delay-700"></div>
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block group mb-6 relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="w-32 h-32 relative bg-white dark:bg-gray-900 rounded-[2rem] flex items-center justify-center transition-transform duration-500 group-hover:scale-105 shadow-2xl shadow-blue-900/10 border border-white/20 dark:border-gray-800">
              <img
                src="/PU%20Connect%20logo.png"
                alt="PU Connect"
                className="w-[85%] h-[85%] object-contain drop-shadow-lg"
              />
            </div>
          </Link>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Welcome Back.</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Enter your credentials to access the portal</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 p-8 md:p-10 relative overflow-hidden backdrop-blur-xl">

          {error && (
            <div className="mb-8 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
              <i className="ri-error-warning-fill text-rose-600 dark:text-rose-400 text-xl mt-0.5"></i>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300 leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div className="group">
                <label htmlFor="email" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 ml-1 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 shadow-sm"
                    placeholder="name@example.com"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                    <i className="ri-mail-line text-lg"></i>
                  </div>
                </div>
              </div>

              <div className="group">
                <div className="flex items-center justify-between ml-1 mb-2">
                  <label htmlFor="password" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors uppercase tracking-wide flex items-center gap-1"
                  >
                    Forgot Key?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 shadow-sm"
                    placeholder="••••••••"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                    <i className="ri-lock-2-line text-lg"></i>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-gradient-to-r from-gray-900 to-black dark:from-white dark:to-gray-200 text-white dark:text-gray-900 rounded-2xl hover:shadow-xl hover:shadow-gray-900/20 dark:hover:shadow-white/10 hover:-translate-y-1 transition-all duration-300 font-bold text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-2xl"></div>
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 dark:border-gray-900/30 border-t-white dark:border-t-gray-900 rounded-full animate-spin"></div>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Sign In</span>
                  <i className="ri-arrow-right-line relative z-10 group-hover:translate-x-1 transition-transform"></i>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              New to the platform?{' '}
              <Link
                to="/register"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-bold ml-1 transition-colors"
              >
                Create Account
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 uppercase tracking-widest transition-colors"
          >
            <i className="ri-arrow-left-line"></i>
            Back to Campus Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
