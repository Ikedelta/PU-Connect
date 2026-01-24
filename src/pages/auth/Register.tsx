import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { sendSMS } from '../../lib/arkesel';

export default function Register() {
  const navigate = useNavigate();
  const { signUp, signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Verification State
  const [verificationStep, setVerificationStep] = useState<'details' | 'otp'>('details');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    department: '',
    faculty: '',
    phone: '',
  });

  const handleInitiateRegistration = async (e: React.FormEvent) => {
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

    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Phone Validation (Ghana format: 02... or 05... followed by 8 digits)
    const phoneRegex = /^0(2|3|5)\d{8}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('Please enter a valid 10-digit Ghana phone number (starting with 02, 03, or 05)');
      return;
    }

    setLoading(true);

    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);

      // Send OTP via SMS
      const result = await sendSMS([formData.phone], `Your Campus Connect verification code is: ${otp}`);

      // Check if SMS was sent successfully
      console.log('OTP Sent:', result);

      setVerificationStep('otp');
    } catch (err: any) {
      console.error('OTP Send Error:', err);
      setError('Failed to send verification code. Please check your phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpInput.trim() !== generatedOtp) {
      setError('Invalid verification code. Please try again.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Account via Edge Function (Auto-confirms email)
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl('placeholder'); // Just to get project URL
      const projectURL = publicUrl.split('/storage')[0];
      const functionURL = `${projectURL}/functions/v1/register-user`;

      const response = await fetch(functionURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          department: formData.department,
          faculty: formData.faculty,
          phone: formData.phone
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create account');
      }

      // Send Welcome SMS (Fire and forget to speed up flow)
      sendSMS(
        [formData.phone],
        `Welcome to Campus Connect! 🚀\nYour account has been created successfully.\n\nStart buying and selling here: https://pentvars-marketplace.vercel.app`
      ).catch(smsError => console.error('Failed to send welcome SMS:', smsError));

      // 2. Sign in the user since they are now confirmed
      try {
        await signIn(formData.email, formData.password);
        navigate('/marketplace');
      } catch (loginErr: any) {
        console.warn('Auto-login failed after registration:', loginErr);
        navigate('/login');
        alert('Account created! Please sign in with your credentials.');
      }

    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.message && err.message.includes('User already registered')) {
        setError('This email address is already registered. Please sign in instead.');
        // Go back to details to allow fixing
        setVerificationStep('details');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex font-sans overflow-x-hidden relative selection:bg-blue-500 selection:text-white">
      {/* Background Blobs (Global) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full mix-blend-multiply blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-multiply blur-3xl opacity-50 animate-blob" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full mix-blend-multiply blur-3xl opacity-50 animate-blob" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Visual Identity Panel - Hidden on Small Screens */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative p-12 flex-col justify-between overflow-hidden">
        {/* Background Image & Overlays */}
        <div className="absolute inset-0 z-0">
          <img
            src="/image%201.jpg"
            alt="Pentecost University"
            className="w-full h-full object-cover object-top opacity-40 scale-105 transition-transform duration-[20s] hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-slate-900/80 to-transparent"></div>
          {/* Animated Mesh Grid Overlay */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col gap-2">
          <Link to="/" className="w-48 h-48 transition-transform duration-500 hover:scale-110">
            <img src="/PU%20Connect%20logo.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-lg" />
          </Link>

          <div className="max-w-xl animate-fade-in-up">
            <h1 className="text-7xl font-extrabold text-white leading-[0.9] mb-6 tracking-tighter">
              Build your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Campus Identity.</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm opacity-90 border-l-2 border-blue-500/50 pl-6 backdrop-blur-sm bg-slate-900/30 py-2 rounded-r-lg">
              Join thousands of students in the most trusted marketplace on Campus. Sell, buy, and grow together.
            </p>
          </div>
        </div>

        {/* Mobile Mockup Image */}
        <div className="relative z-10 mt-auto -mb-24 flex justify-center perspective-1000">
          <img
            src="/app_mobile_mockup_1768321221445.png"
            alt="App Preview"
            className="w-[80%] h-auto drop-shadow-2xl animate-in slide-in-from-bottom-20 duration-1000 hover:-translate-y-4 transition-transform ease-out"
          />
        </div>

        {/* Decorative Elements */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full"></div>
      </div>

      {/* Auth Interface */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 lg:p-10 relative">
        <div className="w-full max-w-xl animate-fade-in-up">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link to="/" className="w-32 h-32 transition-transform duration-500 active:scale-95">
              <img src="/Compus%20Konnect%20logo.png" alt="Logo" className="w-full h-full object-contain" />
            </Link>
          </div>

          <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/50 dark:border-slate-800 rounded-3xl lg:rounded-[2.5rem] p-6 md:p-8 relative shadow-2xl overflow-hidden group/card hover:shadow-blue-500/10 transition-shadow duration-500">
            {/* Subtle Gradient Glow inside Card */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-purple-500/20 blur-[60px] rounded-full group-hover/card:bg-purple-500/30 transition-all duration-500"></div>

            <div className="mb-8 text-center lg:text-left relative z-10">
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                {verificationStep === 'details' ? 'Create Profile.' : 'Verify Phone.'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                {verificationStep === 'details'
                  ? 'Begin your academic journey with us.'
                  : `We sent a code to ${formData.phone}`
                }
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-300 animate-in shake duration-500">
                <i className="ri-error-warning-fill text-xl shrink-0"></i>
                <p className="font-bold text-xs tracking-tight">{error}</p>
              </div>
            )}

            {verificationStep === 'details' ? (
              // === STEP 1: REGISTRATION DETAILS ===
              <form onSubmit={handleInitiateRegistration} className="space-y-5 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Full Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <i className="ri-user-smile-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                      </div>
                      <input
                        required
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base md:text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Phone Number</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <i className="ri-phone-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                      </div>
                      <input
                        required
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base md:text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900"
                        placeholder="e.g. 0551234567"
                      />
                    </div>
                  </div>

                  {/* Faculty */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Faculty</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <i className="ri-community-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                      </div>
                      <select
                        required
                        value={formData.faculty}
                        onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                        className="block w-full pl-12 pr-10 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base md:text-sm font-semibold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none appearance-none focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-600 dark:text-slate-300"
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
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <i className="ri-mail-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                      </div>
                      <input
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base md:text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <i className="ri-lock-2-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                      </div>
                      <input
                        required
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="block w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-500 transition-colors cursor-pointer p-1"
                      >
                        <i className={`ri-${showPassword ? 'eye-off' : 'eye'}-line text-lg`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Confirm</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <i className="ri-shield-check-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                      </div>
                      <input
                        required
                        type={showPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-base md:text-sm font-semibold transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-blue-900/10 hover:shadow-blue-900/20 hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10"></div>
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/20 dark:border-slate-900/20 border-t-white dark:border-t-slate-900 rounded-full animate-spin"></div>
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform text-lg"></i>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              // === STEP 2: OTP VERIFICATION ===
              <form onSubmit={handleVerifyAndRegister} className="space-y-6 relative z-10 animate-in slide-in-from-right-8 duration-500">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Verification Code</label>
                  <p className="text-xs text-slate-400 mb-2">Please enter the 6-digit code sent to your phone number.</p>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                      <i className="ri-chat-check-line text-slate-400 group-focus-within:text-blue-500 transition-colors text-lg"></i>
                    </div>
                    <input
                      required
                      type="text"
                      maxLength={6}
                      value={otpInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // Only numbers
                        setOtpInput(val);
                      }}
                      className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xl tracking-[0.5em] font-bold text-center transition-all focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-900"
                      placeholder="000000"
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button
                    type="submit"
                    disabled={loading || otpInput.length !== 6}
                    className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-blue-900/10 hover:shadow-blue-900/20 hover:-translate-y-0.5 transition-all duration-300 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 -z-10"></div>
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/20 dark:border-slate-900/20 border-t-white dark:border-t-slate-900 rounded-full animate-spin"></div>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Create Account</span>
                        <i className="ri-check-line group-hover:scale-110 transition-transform text-lg"></i>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerificationStep('details')}
                    disabled={loading}
                    className="w-full py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Back to Details
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 text-center pt-2 relative z-10 border-t border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs mt-6">
                Already have an account?{' '}
                <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ml-1 font-bold hover:underline">
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