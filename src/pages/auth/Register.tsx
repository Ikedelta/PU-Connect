import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    studentId: '',
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
        formData.studentId,
        formData.department,
        formData.faculty,
        formData.phone
      );

      navigate('/marketplace');
    } catch (err: any) {
      console.error('Registration error:', err);
      // Check for specific Supabase "User already registered" error
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
    <div className="min-h-screen bg-white flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Visual Identity Panel - Cinematic & Premium */}
      <div className="hidden md:flex md:w-5/12 bg-[#0F172A] relative items-center justify-center p-20 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-11.jpeg"
            alt="Pentecost University"
            className="w-full h-full object-cover opacity-50 mix-blend-overlay"
          />
        </div>

        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/80 to-blue-900/40"></div>
          <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-600/20 blur-[150px] rounded-full animate-pulse"></div>
          <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-blue-600/20 blur-[150px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-[-20%] left-[-20%] w-[80%] h-[80%] bg-indigo-600/20 blur-[150px] rounded-full animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        </div>

        <div className="relative z-10 max-w-lg text-center md:text-left">
          <Link to="/" className="inline-flex items-center gap-4 mb-12 group">
            <div className="w-64 h-64 bg-white/5 backdrop-blur-xl rounded-[3rem] flex items-center justify-center group-hover:scale-105 transition-all duration-500 border border-white/10 shadow-2xl shadow-blue-900/20">
              <img src="/PU%20Connect%20logo.png" alt="PU Connect" className="w-[85%] h-[85%] object-contain drop-shadow-2xl" />
            </div>
          </Link>

          <h1 className="text-5xl md:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-8 drop-shadow-lg">
            Join the <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Future.</span>
          </h1>

          <p className="text-lg text-blue-200/80 font-medium leading-relaxed max-w-md mb-12 border-l-2 border-blue-500/30 pl-6">
            The official digital marketplace for Pentecost University students. Secure, fast, and built for your campus life.
          </p>
        </div>
      </div>

      {/* Auth Interface */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-20 bg-white dark:bg-gray-950 overflow-y-auto transition-colors duration-300">
        <div className="max-w-xl w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-10 text-center md:text-left">
            {/* Mobile Logo - Visible only on small screens */}
            <div className="md:hidden flex justify-center mb-8">
              <div className="w-24 h-24 bg-gray-50 dark:bg-gray-900 rounded-[1.5rem] flex items-center justify-center border border-gray-100 dark:border-gray-800 shadow-xl shadow-blue-900/10">
                <img src="/PU%20Connect%20logo.png" alt="PU Connect" className="w-[85%] h-[85%] object-contain" />
              </div>
            </div>

            <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
              <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-800">New Account</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">Create Profile.</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Enter your details to join the campus network.</p>
          </div>

          {error && (
            <div className="mb-8 p-6 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-900/30 rounded-2xl flex items-center gap-4 text-rose-700 dark:text-rose-300 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center flex-shrink-0">
                <i className="ri-error-warning-fill text-xl"></i>
              </div>
              <p className="font-bold text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              {[
                { label: 'Full Name', key: 'fullName', type: 'text', placeholder: 'John Doe', icon: 'ri-user-smile-line' },
                { label: 'Email Address', key: 'email', type: 'email', placeholder: 'student@pentvars.edu.gh', icon: 'ri-mail-line' },
                { label: 'Phone Number', key: 'phone', type: 'tel', placeholder: '055 123 4567', icon: 'ri-phone-line' },
              ].map((field) => (
                <div key={field.key} className="relative group">
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      required
                      type={field.type}
                      value={(formData as any)[field.key]}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-4 pl-12 pr-6 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 shadow-sm group-hover:bg-gray-100 dark:group-hover:bg-gray-800/80"
                      placeholder={field.placeholder}
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                      <i className={`${field.icon} text-lg`}></i>
                    </div>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Password', key: 'password', type: 'password', icon: 'ri-lock-2-line' },
                  { label: 'Confirm Password', key: 'confirmPassword', type: 'password', icon: 'ri-shield-keyhole-line' }
                ].map((field) => (
                  <div key={field.key} className="relative group">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1 group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400 transition-colors">
                      {field.label}
                    </label>
                    <div className="relative">
                      <input
                        required
                        type={field.type}
                        value={(formData as any)[field.key]}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl py-4 pl-12 pr-6 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 shadow-sm"
                        placeholder="••••••"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                        <i className={`${field.icon} text-lg`}></i>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-gradient-to-r from-gray-900 to-black dark:from-white dark:to-gray-200 text-white dark:text-gray-900 rounded-2xl hover:shadow-2xl hover:shadow-gray-900/20 dark:hover:shadow-white/10 hover:-translate-y-1 transition-all duration-300 font-bold text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-2xl"></div>
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 dark:border-gray-900/30 border-t-white dark:border-t-gray-900 rounded-full animate-spin"></div>
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <span className="relative z-10">Create Account</span>
                    <i className="ri-arrow-right-line relative z-10 group-hover:translate-x-1 transition-transform"></i>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-10 text-center border-t border-gray-100 dark:border-gray-800 pt-8">
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ml-2 font-bold uppercase tracking-wide text-xs">
                Sign In to Dashboard
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}