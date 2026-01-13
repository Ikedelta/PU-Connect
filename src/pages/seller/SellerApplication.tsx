import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';

export default function SellerApplication() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    businessCategory: '',
    businessDescription: '',
    contactPhone: '',
    contactEmail: user?.email || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('Please login to apply as a seller');
      navigate('/login');
      return;
    }

    setLoading(true);

    try {
      // Check if user already has an application
      const { data: existingApp } = await supabase
        .from('seller_applications')
        .select('id, status')
        .eq('user_id', user.id)
        .single();

      if (existingApp) {
        if (existingApp.status === 'approved') {
          alert('You already have an active Seller Account. You are limited to one shop per user.');
          navigate('/seller/dashboard');
        } else {
          alert('You already have a pending seller application. Please wait for the admin to approve your request.');
          navigate('/seller/status');
        }
        return;
      }

      // Submit new application
      const { error } = await supabase
        .from('seller_applications')
        .insert([
          {
            user_id: user.id,
            business_name: formData.businessName,
            business_category: formData.businessCategory,
            business_description: formData.businessDescription,
            contact_phone: formData.contactPhone,
            contact_email: formData.contactEmail,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      // Notify Admins via SMS
      try {
        const { data: admins } = await supabase
          .from('profiles')
          .select('phone')
          .in('role', ['admin', 'super_admin'])
          .not('phone', 'is', null);

        if (admins && admins.length > 0) {
          const adminPhones = admins.map(a => a.phone).filter(p => p && p.length > 9); // Basic validation
          if (adminPhones.length > 0) {
            import('../../lib/arkesel').then(({ sendSMS }) => {
              // Send mostly to unique numbers to save cost/avoid spam if duplicate admins
              const uniquePhones = [...new Set(adminPhones)];
              sendSMS(uniquePhones, `New Seller Application: ${formData.businessName} has applied to become a seller. Please check the Admin Portal for review.`)
                .catch(err => console.error('Failed to notify admins:', err));
            });
          }
        }
      } catch (notifyError) {
        console.error('Error fetching admins for notification:', notifyError);
      }

      alert('Application submitted successfully! Redirecting to status page...');
      navigate('/seller/status');
    } catch (error: any) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-bold uppercase tracking-widest rounded-full mb-6">
              <i className="ri-medal-line text-blue-400 dark:text-blue-600"></i>
              Seller Registration
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight mb-4">Start Your<br /><span className="text-blue-600">Business.</span></h1>
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">Join the PU Connect official student marketplace</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-[10px] font-bold text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2 group"
          >
            <i className="ri-arrow-left-s-line text-lg group-hover:-translate-x-1 transition-transform"></i>
            Cancel Application
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Information Section */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-gray-900 dark:bg-gray-800 text-white p-8 rounded-[2rem] shadow-xl shadow-gray-900/10 dark:shadow-none transition-colors">
              <h3 className="text-xl font-bold mb-8 tracking-tight flex items-center gap-3">
                <i className="ri-information-line text-blue-400"></i>
                Program Details
              </h3>
              <ul className="space-y-6">
                {[
                  { label: 'Registration Fee', value: 'GH₵ 50 / Mo', desc: 'Secure platform listing rights' },
                  { label: 'Validity Period', value: '30 Days', desc: 'Renewable monthly cycle' },
                  { label: 'Product Limit', value: 'Unlimited', desc: 'No restrictions on listings' },
                  { label: 'Verification', value: 'Required', desc: 'Official student status' }
                ].map((item, i) => (
                  <li key={i} className="group">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 group-hover:text-blue-400 transition-colors">{item.label}</p>
                    <p className="text-lg font-bold tracking-tight mb-1">{item.value}</p>
                    <p className="text-[10px] text-gray-400 font-semibold">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-[2rem] border border-blue-100/50 dark:border-blue-800/30 transition-colors">
              <i className="ri-shield-check-fill text-3xl text-blue-600 dark:text-blue-400 mb-4 block"></i>
              <p className="text-sm font-bold text-blue-950 dark:text-blue-200 uppercase tracking-widest mb-2">Data Protection</p>
              <p className="text-xs font-semibold text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                Your business information is securely stored and synchronized across the PU Connect marketplace ecosystem.
              </p>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-100 dark:border-gray-800 p-8 md:p-12 transition-colors duration-300">
              <form onSubmit={handleSubmit} className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                      Business Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 transition-all"
                      placeholder="e.g. Trendy Campus Gear"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                      Business Category
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={formData.businessCategory}
                        onChange={(e) => setFormData({ ...formData, businessCategory: e.target.value })}
                        className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 dark:text-white transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                    Business Description
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.businessDescription}
                    onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 transition-all resize-none"
                    placeholder="Provide a detailed description of your products or services..."
                    maxLength={500}
                  />
                  <div className="flex justify-end pr-2">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest">{formData.businessDescription.length}/500</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 transition-all"
                      placeholder="e.g. 054 123 4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 transition-all"
                      placeholder="business@example.com"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-8 py-5 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {loading ? (
                      <i className="ri-loader-4-line animate-spin text-xl"></i>
                    ) : (
                      <>
                        <span>Submit Application</span>
                        <i className="ri-check-line text-lg"></i>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
            Already registered?
          </p>
          <button
            onClick={() => navigate('/seller/dashboard')}
            className="inline-flex items-center gap-2 group text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Access Seller Dashboard
            <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
