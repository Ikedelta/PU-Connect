import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    department: '',
    faculty: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signUp(
        formData.email,
        formData.password,
        formData.fullName,
        '', // studentId (removed as requested)
        formData.department,
        formData.faculty,
        formData.phone
      );

      navigate('/marketplace');
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message && err.message.includes('User already registered')) {
        setError('This email address is already registered. Please sign in instead.');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans overflow-hidden">
      {/* Visual Identity Panel - Hidden on Small Screens */}
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
              Build your <br />
              <span className="text-blue-400">Campus Identity.</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm opacity-90 border-l-2 border-blue-500/50 pl-6">
              Join thousands of students in the most trusted marketplace at Pentecost University. Sell, buy, and grow together.
            </p>
          </div>
        </div>

        {/* Mobile Mockup Image */}
        <div className="relative z-10 mt-auto -mb-24 flex justify-center">
          <img
            src="/app_mobile_mockup_1768321221445.png"
            alt="App Preview"
            className="w-[80%] h-auto drop-shadow-2xl animate-in slide-in-from-bottom-20 duration-1000"
          />
        </div>

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

        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="w-20 h-20 transition-transform duration-500 active:scale-95">
              <img src="/PU%20Connect%20logo.png" alt="Logo" className="w-full h-full object-contain" />
            </Link>
          </div>

          <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-2xl shadow-blue-900/5 relative overflow-hidden">
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">Create Profile.</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Begin your academic journey with us.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-300 animate-in shake duration-500">
                <i className="ri-error-warning-fill text-xl shrink-0"></i>
                <p className="font-bold text-xs tracking-tight">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-3">Full Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <i className="ri-user-smile-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                    </div>
                    <input
                      required
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 hover:bg-white dark:hover:bg-slate-900"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-3">Phone Number</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <i className="ri-phone-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                    </div>
                    <input
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 hover:bg-white dark:hover:bg-slate-900"
                      placeholder="e.g. 0551234567"
                    />
                  </div>
                </div>

                {/* Faculty */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-3">Faculty</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <i className="ri-community-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                    </div>
                    <select
                      required
                      value={formData.faculty}
                      onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                      className="block w-full pl-12 pr-10 py-3.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none hover:bg-white dark:hover:bg-slate-900 transition-all text-slate-600 dark:text-slate-300"
                    >
                      <option value="" disabled>Select your faculty</option>
                      <option value="Faculty of Business">Faculty of Business</option>
                      <option value="Faculty of Science & Computing">Faculty of Science & Computing</option>
                      <option value="Faculty of Nursing & Midwifery">Faculty of Nursing & Midwifery</option>
                      <option value="Faculty of Education">Faculty of Education</option>
                      <option value="Faculty of Engineering">Faculty of Engineering</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <i className="ri-arrow-down-s-line text-slate-400"></i>
                    </div>
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-3">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <i className="ri-mail-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                    </div>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 hover:bg-white dark:hover:bg-slate-900"
                      placeholder="Enter your email address"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-3">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <i className="ri-lock-2-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                    </div>
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="block w-full pl-12 pr-12 py-3.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 hover:bg-white dark:hover:bg-slate-900"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors cursor-pointer"
                    >
                      <i className={`ri-${showPassword ? 'eye-off' : 'eye'}-line text-lg`}></i>
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-3">Confirm</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <i className="ri-shield-check-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                    </div>
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="block w-full pl-12 pr-4 py-3.5 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 hover:bg-white dark:hover:bg-slate-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-blue-900/10 hover:shadow-blue-900/20 hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10"></div>
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 dark:border-slate-900/20 border-t-white dark:border-t-slate-900 rounded-full animate-spin"></div>
                      <span>Creating Profile...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform text-lg"></i>
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 text-center pt-2">
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ml-1 font-bold">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}