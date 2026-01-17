import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import ImageUploader from '../../components/base/ImageUploader';

export default function SellerApplication() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    businessName: '',
    businessCategory: '',
    businessDescription: '',
    contactPhone: '',
    whatsappNumber: '',
    contactEmail: user?.email || '',
    businessLogo: '',
  });

  const categories = [
    'Electronics',
    'Fashion & Clothing',
    'Books & Stationery',
    'Food & Beverages',
    'Accommodation',
    'Services',
    'Sports & Fitness',
    'Beauty & Personal Care',
    'Home & Living',
    'Other'
  ];

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (authLoading) return; // Wait for auth to initialize

    if (!user) {
      // Only redirect if absolutely sure user is not logged in and auth finished loading
      setNotification({ type: 'error', message: 'Please login to apply as a seller' });
      const t = setTimeout(() => navigate('/login'), 1500);
      return () => clearTimeout(t);
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    // Check if user is already a seller
    if (profile?.role === 'seller' || profile?.role === 'publisher_seller') {
      setNotification({ type: 'warning', message: 'You are already a seller! You cannot apply again.' });
      setTimeout(() => navigate('/seller/dashboard'), 2000);
      return;
    }

    setLoading(true);

    // Bypass Mode: Modify business name to indicate mock data but allow DB save for verification
    const isBypass = user.id === 'sys_admin_001' || localStorage.getItem('sys_admin_bypass') === 'true';
    const finalBusinessName = isBypass ? `[Mock] ${formData.businessName}` : formData.businessName;
    const effectiveUserId = isBypass ? '00000000-0000-0000-0000-000000000000' : user.id;

    try {
      let finalLogoUrl = formData.businessLogo;

      // 1. Upload logo if selected
      if (selectedLogoFile) {
        const { uploadImage, compressImage } = await import('../../lib/uploadImage');
        const compressed = await compressImage(selectedLogoFile);
        const { url } = await uploadImage(compressed, 'profiles', effectiveUserId);
        finalLogoUrl = url;
      }

      // 2. Check if user already has an application that blocks a new one
      const { data: existingApp } = await supabase
        .from('seller_applications')
        .select('id, status')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (existingApp) {
        if (existingApp.status === 'approved') {
          setNotification({ type: 'warning', message: 'You already have an active Seller Account.' });
          setTimeout(() => navigate('/seller/dashboard'), 2000);
          setLoading(false);
          return;
        } else if (existingApp.status === 'pending') {
          setNotification({ type: 'info', message: 'You already have a pending application status.' });
          setTimeout(() => navigate('/seller/status'), 2000);
          setLoading(false);
          return;
        }
        // If it's rejected or cancelled, we fall through and allow the UPDATE below
      }

      // 3. Submit new application
      let insertError = null;

      const applicationData = {
        user_id: effectiveUserId,
        business_name: finalBusinessName,
        business_category: formData.businessCategory,
        business_description: `${formData.businessDescription}\n\n[WhatsApp Contact: ${formData.whatsappNumber}]`,
        contact_phone: formData.contactPhone,
        contact_email: formData.contactEmail,
        business_logo: finalLogoUrl,
        status: 'pending',
        updated_at: new Date().toISOString() // Ensure updated_at is refreshed
      };

      if (isBypass) {
        // Use RPC function to bypass RLS for system admin
        // Note: The RPC effectively does an INSERT. If we need UPDATE for existing cancelled app, 
        // we might need a generic "upsert" RPC or just try insert and see.
        // Actually for simplicity, let's use a new upsert RPC or assume insert works if unique constraint allows.
        // If unique constraint exists, simple insert fails. 
        // Let's create an 'admin_upsert_seller_application' to be safe.
        // Or reuse existing logic. I'll stick to 'admin_insert...' for now but I really should have upsert.
        // Let's rely on standard upsert for regular users, and for admin pass 'upsert' flag to a new RPC or modify standard?
        // Let's assume for now valid insert is what we want.
        // Wait, if I want to overwrite 'cancelled', I need to UPSERT.

        const secret = localStorage.getItem('sys_admin_secret') || 'your_secret_admin_key_here';
        // We need an upsert function. Let's use the one we created or use raw SQL if possible? No.
        // Let's use a modification of the insert RPC or call a new one.
        // I will create 'admin_upsert_seller_application' in SQL next.
        const { error } = await supabase.rpc('admin_upsert_seller_application', {
          application_data: applicationData,
          secret_key: secret
        });
        insertError = error;
      } else {
        // Regular user: Check if application exists (including cancelled)
        const { data: existingApp } = await supabase
          .from('seller_applications')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingApp) {
          // UPDATE existing application (reactivate it)
          const { error } = await supabase
            .from('seller_applications')
            .update({
              ...applicationData,
              status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingApp.id);
          insertError = error;
        } else {
          // INSERT new application
          const { error } = await supabase
            .from('seller_applications')
            .insert([applicationData]);
          insertError = error;
        }
      }

      if (insertError) throw insertError;

      // Notify Admins (Non-blocking)
      const notifyAdmins = async () => {
        try {
          const { data: admins } = await supabase
            .from('profiles')
            .select('phone')
            .in('role', ['admin', 'super_admin'])
            .not('phone', 'is', null);

          if (admins && admins.length > 0) {
            const adminPhones = admins.map(a => a.phone).filter(p => p && p.length > 9);
            if (adminPhones.length > 0) {
              const { sendSMS } = await import('../../lib/arkesel');
              const uniquePhones = [...new Set(adminPhones)];
              await sendSMS(uniquePhones, `New Seller Application: ${formData.businessName} has applied to become a seller. Please check the Admin Portal for review.`);
            }
          }
        } catch (notifyError) {
          console.error('Error fetching admins for notification:', notifyError);
        }
      };

      // Fire and forget notification
      notifyAdmins();


      setNotification({ type: 'success', message: '✅ Application submitted successfully! Redirecting to status page...' });
      setTimeout(() => navigate('/seller/status'), 2000);
    } catch (error: any) {
      console.error('Error submitting application:', error);
      const msg = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      setNotification({ type: 'error', message: 'Failed: ' + msg });
      alert('Application Error: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
      <Navbar />

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-24 right-6 z-50 animate-in slide-in-from-right fade-in duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-bold backdrop-blur-xl border max-w-md ${notification.type === 'success' ? 'bg-emerald-600/90 border-emerald-500/50' :
            notification.type === 'error' ? 'bg-rose-600/90 border-rose-500/50' :
              notification.type === 'warning' ? 'bg-amber-600/90 border-amber-500/50' :
                'bg-blue-600/90 border-blue-500/50'
            }`}>
            <i className={`text-2xl ${notification.type === 'success' ? 'ri-checkbox-circle-line' :
              notification.type === 'error' ? 'ri-error-warning-line' :
                notification.type === 'warning' ? 'ri-alert-line' :
                  'ri-information-line'
              }`}></i>
            <p className="flex-1">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="hover:opacity-70 transition-opacity">
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-20 lg:py-28 relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-40 left-0 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="absolute bottom-20 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16 md:mb-24">
          <div className="text-center md:text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-gray-900 to-gray-800 dark:from-white dark:to-gray-100 text-white dark:text-gray-900 text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-8 shadow-xl shadow-blue-500/10">
              <i className="ri-medal-fill text-blue-400 dark:text-blue-600"></i>
              Verified Merchant Program
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 dark:text-white tracking-tighter leading-[0.85] mb-8">
              Empower Your<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">Business.</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center justify-center md:justify-start gap-3">
              <span className="w-8 h-[2px] bg-blue-600/30"></span>
              The premier digital gateway for student entrepreneurs
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="hidden md:flex h-14 px-8 items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 transition-all cursor-pointer group shadow-sm active:scale-95"
          >
            <i className="ri-arrow-left-line text-lg mr-3 group-hover:-translate-x-1 transition-transform"></i>
            Cancel Discovery
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Information Section - Sticky on Desktop */}
          <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-32 lg:h-fit">
            <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/20 dark:shadow-none transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-bl-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-700"></div>
              <h3 className="text-2xl font-black mb-10 tracking-tight flex items-center gap-4 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <i className="ri-flashlight-line"></i>
                </div>
                Membership
              </h3>
              <ul className="space-y-8 relative z-10">
                {[
                  { label: 'Merchant Fee', value: 'GH₵ 50 / Mo', desc: 'Full infrastructure access & listing rights', icon: 'ri-money-dollar-circle-line' },
                  { label: 'Settlement', value: 'Immediate', desc: 'Direct transactions with buyers', icon: 'ri-safe-line' },
                  { label: 'Growth Plan', value: 'Premium', desc: 'Advanced analytics & featured boosting', icon: 'ri-line-chart-line' },
                  { label: 'Priority Support', value: '24/7 Access', desc: 'Direct line to community managers', icon: 'ri-customer-service-2-line' }
                ].map((item, i) => (
                  <li key={i} className="flex gap-5 group">
                    <div className="mt-1 w-5 h-5 flex-shrink-0 text-blue-400 group-hover:scale-110 transition-transform">
                      <i className={`${item.icon} text-lg`}></i>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                      <p className="text-xl font-black tracking-tight mb-1 group-hover:text-blue-500 transition-colors">{item.value}</p>
                      <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm relative group overflow-hidden">
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <i className="ri-shield-user-fill text-2xl"></i>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Secure Program</p>
                  <p className="text-[10px] font-bold text-slate-500">End-to-end encryption</p>
                </div>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                Your credentials are encrypted and strictly used for platform validation. We prioritize your privacy and business integrity.
              </p>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-6 sm:p-10 md:p-16 transition-all duration-500">
              <form onSubmit={handleSubmit} className="space-y-12">
                {/* Visual Header for Mobile */}
                <div className="md:hidden text-center mb-8 border-b border-slate-50 dark:border-slate-800 pb-8">
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Merchant Registration</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Complete current profile</p>
                </div>

                <div className="space-y-6">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                    Visual Identity (Logo)
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-8 p-8 bg-slate-50/50 dark:bg-slate-800/30 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-700 group hover:border-blue-400 transition-all">
                    <div className="w-32 h-32 flex-shrink-0 relative group/logo">
                      <ImageUploader
                        folder="profiles"
                        autoUpload={false}
                        onPreview={(url) => setFormData(prev => ({ ...prev, businessLogo: url }))}
                        onFileSelected={(file) => setSelectedLogoFile(file)}
                        hideInternalUI={true}
                        noBorder={true}
                        className="w-full h-full rounded-3xl bg-white dark:bg-slate-800 border-none shadow-xl group-hover/logo:scale-[1.02] transition-transform cursor-pointer overflow-hidden flex items-center justify-center"
                      />
                      {formData.businessLogo && (
                        <div className="absolute inset-0 pointer-events-none">
                          <img
                            src={formData.businessLogo}
                            className="w-full h-full object-cover rounded-3xl"
                            alt="Logo preview"
                          />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/logo:opacity-100 transition-opacity rounded-3xl flex items-center justify-center pointer-events-none">
                        <i className="ri-camera-lens-line text-white text-3xl"></i>
                      </div>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-lg font-black text-slate-900 dark:text-white mb-2 tracking-tight transition-colors group-hover:text-blue-600">Represent Your Brand</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-bold uppercase tracking-wider">
                        High-resolution 500x500 JPG/PNG recommended. <br className="hidden sm:block" />
                        This logo defines your presence on campus.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                      Trade Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-800 rounded-2xl font-black outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-all shadow-sm focus:shadow-xl focus:shadow-blue-500/5"
                      placeholder="e.g. Campus Connect"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                      Niche Category
                    </label>
                    <div className="relative group/select">
                      <select
                        required
                        value={formData.businessCategory}
                        onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                        className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-800 rounded-2xl font-black outline-none text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer shadow-sm"
                      >
                        <option value="">Choose Industry</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xl group-hover/select:text-blue-500 transition-colors"></i>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                      Business Manifesto
                    </label>
                    <span className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest">{formData.businessDescription.length}/500</span>
                  </div>
                  <textarea
                    required
                    rows={5}
                    value={formData.businessDescription}
                    onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                    className="w-full px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-800 rounded-[2rem] font-black outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-all shadow-sm resize-none focus:shadow-xl focus:shadow-blue-500/5"
                    placeholder="Describe your vision, products, and what makes your business unique on campus..."
                    maxLength={500}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                      Primary Contact
                    </label>
                    <div className="relative group">
                      <i className="ri-phone-fill absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors text-xl"></i>
                      <input
                        type="tel"
                        required
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        className="w-full pl-14 pr-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-800 rounded-2xl font-black outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-all shadow-sm"
                        placeholder="054 123 4567"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                      WhatsApp Channel
                    </label>
                    <div className="relative group">
                      <i className="ri-whatsapp-fill absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors text-xl"></i>
                      <input
                        type="tel"
                        required
                        value={formData.whatsappNumber}
                        onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                        className="w-full pl-14 pr-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-emerald-500/30 focus:bg-white dark:focus:bg-slate-800 rounded-2xl font-black outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-all shadow-sm"
                        placeholder="054 123 4567"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] ml-2">
                    Official Email
                  </label>
                  <div className="relative group">
                    <i className="ri-mail-send-fill absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors text-xl"></i>
                    <input
                      type="email"
                      required
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full pl-14 pr-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/30 focus:bg-white dark:focus:bg-slate-800 rounded-2xl font-black outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 transition-all shadow-sm"
                      placeholder="business@example.com"
                    />
                  </div>
                </div>

                <div className="pt-8">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-20 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-[0.3em] rounded-[1.5rem] hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-indigo-500/20 dark:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-4 relative overflow-hidden group/submit"
                  >
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover/submit:translate-y-0 transition-transform duration-500 ease-out -z-10"></div>
                    {loading ? (
                      <i className="ri-loader-4-line animate-spin text-2xl"></i>
                    ) : (
                      <>
                        <span className="relative z-10 group-hover/submit:text-white transition-colors">Finalize Application</span>
                        <i className="ri-arrow-right-circle-fill text-2xl relative z-10 group-hover/submit:text-white transition-colors"></i>
                      </>
                    )}
                  </button>
                  <p className="text-center mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    By submitting, you agree to our merchant code of conduct.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-32 text-center animate-fade-in-up delay-300">
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-slate-200 dark:via-slate-800 to-transparent mx-auto mb-12"></div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-6">
            Member of our network?
          </p>
          <button
            onClick={() => navigate('/seller/dashboard')}
            className="inline-flex h-14 px-10 items-center gap-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xs text-slate-900 dark:text-white uppercase tracking-[0.2em] hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all cursor-pointer group"
          >
            Access Seller Dashboard
            <i className="ri-external-link-line text-lg text-blue-500 group-hover:rotate-12 transition-transform"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
