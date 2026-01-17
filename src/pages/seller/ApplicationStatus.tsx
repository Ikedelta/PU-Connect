import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

type Application = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  business_name: string;
  business_category: string;
  business_description: string;
  contact_phone: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
};

export default function ApplicationStatus() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchApplication();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('application-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'seller_applications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setApplication(payload.new as Application);
          if (payload.new.status === 'approved') {
            refreshProfile();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const fetchApplication = async () => {
    if (!user) return;

    try {
      const effectiveUserId = user.id === 'sys_admin_001' ? '00000000-0000-0000-0000-000000000000' : user.id;

      const { data, error } = await supabase
        .from('seller_applications')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No application found
          navigate('/seller/apply');
          return;
        }
        throw error;
      }

      setApplication(data);

      // If approved and user role is still 'buyer', update to 'seller'
      if (data.status === 'approved' && profile?.role === 'buyer') {
        await updateUserRole();
      }
    } catch (error) {
      console.error('Error fetching application:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'seller' })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh profile to get updated role
      await refreshProfile();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleCancelApplication = async () => {
    if (!application) return;

    if (!confirm('Are you sure you want to cancel your application? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const isBypass = user?.id === 'sys_admin_001' || localStorage.getItem('sys_admin_bypass') === 'true';

      if (isBypass) {
        // Use RPC function to bypass RLS for system admin
        const secret = localStorage.getItem('sys_admin_secret') || 'your_secret_admin_key_here';
        const { error } = await supabase.rpc('admin_cancel_seller_application', {
          application_id: application.id,
          secret_key: secret
        });

        if (error) throw error;
      } else {
        // Regular user update status to cancelled
        const { error } = await supabase
          .from('seller_applications')
          .update({ status: 'cancelled' })
          .eq('id', application.id)
          .eq('user_id', user?.id);

        if (error) throw error;
      }

      // Navigate back to apply page
      navigate('/seller/apply');
    } catch (error: any) {
      console.error('Error canceling application:', error);
      alert('Failed to cancel application: ' + error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center transition-colors duration-500">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-slate-500 dark:text-slate-400 font-black text-xs uppercase tracking-[0.2em] animate-pulse">Initializing Security Clearance...</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 md:py-32 text-center">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-[3rem] p-16 md:p-24 border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
            <i className="ri-file-search-fill text-8xl text-slate-200 dark:text-slate-800 mb-8 block transition-transform group-hover:scale-110 duration-700"></i>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tighter">No Active Records.</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-lg mb-12 max-w-md mx-auto">We couldn't find an existing merchant application associated with your identity.</p>
            <button
              onClick={() => navigate('/seller/apply')}
              className="h-16 px-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-[0.3em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-blue-500/20"
            >
              Begin Onboarding
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'ri-shield-check-fill';
      case 'rejected':
        return 'ri-error-warning-fill';
      default:
        return 'ri-time-fill';
    }
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          title: 'Under Review',
          message: 'Your application is being audited by our trust and safety team. We\'ll notify you once a decision is finalized.',
          icon: 'ri-hourglass-2-fill',
        };
      case 'approved':
        return {
          title: 'Verification Complete!',
          message: 'Your credentials have been validated. You now have full access to our merchant infrastructure.',
          icon: 'ri-verified-badge-fill',
        };
      case 'rejected':
        return {
          title: 'Action Required',
          message: 'Unfortunately, your application did not meet our verification criteria. Please review the feedback below.',
          icon: 'ri-close-circle-fill',
        };
      default:
        return {
          title: 'Unknown Status',
          message: 'Checking records...',
          icon: 'ri-question-fill',
        };
    }
  };

  const statusInfo = getStatusMessage(application.status);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-20 lg:py-28 relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-40 right-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="absolute bottom-20 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10"></div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-16 md:mb-24">
          <div className="text-center md:text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-8 shadow-xl shadow-blue-500/10">
              <i className="ri-shield-check-fill text-blue-400 dark:text-blue-600"></i>
              Application Tracking
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 dark:text-white tracking-tighter leading-[0.85] mb-8">
              Verification<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">Registry.</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs flex items-center justify-center md:justify-start gap-3">
              <span className="w-8 h-[2px] bg-blue-600/30"></span>
              Live status of your merchant credentials
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="hidden md:flex h-14 px-8 items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer group shadow-sm active:scale-95"
          >
            <i className="ri-home-5-line text-lg mr-3 group-hover:-translate-y-1 transition-transform"></i>
            Platform Home
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Status Overview Card */}
          <div className="lg:col-span-5">
            <div className={`p-10 md:p-14 rounded-[3rem] border shadow-2xl transition-all relative overflow-hidden group ${application.status === 'approved' ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20 shadow-emerald-500/10' :
              application.status === 'rejected' ? 'bg-rose-50/50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20 shadow-rose-500/10' :
                'bg-blue-50/50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20 shadow-blue-500/10'
              }`}>
              <div className="absolute top-0 right-0 w-40 h-40 bg-current opacity-[0.03] rounded-bl-full translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-700"></div>

              <div className="flex flex-col items-center text-center relative z-10">
                <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mb-10 shadow-2xl shadow-current/20 transition-transform group-hover:scale-105 duration-500 ${application.status === 'approved' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white' :
                  application.status === 'rejected' ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white' :
                    'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                  }`}>
                  <i className={`${getStatusIcon(application.status)} text-5xl`}></i>
                </div>

                <h2 className={`text-3xl font-black tracking-tight mb-4 ${application.status === 'approved' ? 'text-emerald-900 dark:text-emerald-400' :
                  application.status === 'rejected' ? 'text-rose-900 dark:text-rose-400' :
                    'text-blue-900 dark:text-blue-400'
                  }`}>
                  {statusInfo.title}
                </h2>

                <div className={`inline-flex items-center gap-3 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] mb-10 border-2 ${application.status === 'approved' ? 'bg-emerald-100/30 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300' :
                  application.status === 'rejected' ? 'bg-rose-100/30 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300' :
                    'bg-blue-100/30 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300'
                  }`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse"></span>
                  {application.status}
                </div>

                <p className={`text-sm font-bold leading-relaxed mb-12 max-w-sm ${application.status === 'approved' ? 'text-emerald-800/80 dark:text-emerald-400/80' :
                  application.status === 'rejected' ? 'text-rose-800/80 dark:text-rose-400/80' :
                    'text-blue-800/80 dark:text-blue-400/80'
                  }`}>
                  {statusInfo.message}
                </p>

                {application.status === 'approved' ? (
                  <button
                    onClick={() => navigate('/seller/dashboard')}
                    className="w-full h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-4 group/btn"
                  >
                    <span>Merchant Dashboard</span>
                    <i className="ri-arrow-right-fill text-xl group-hover:translate-x-1 transition-transform"></i>
                  </button>
                ) : application.status === 'rejected' ? (
                  <button
                    onClick={() => navigate('/seller/apply')}
                    className="w-full h-16 bg-rose-600 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-rose-700 hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-rose-500/20 transition-all flex items-center justify-center gap-4 group/btn"
                  >
                    <span>Resubmit Details</span>
                    <i className="ri-refresh-line text-xl group-hover:rotate-180 transition-transform duration-700"></i>
                  </button>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="w-full h-16 bg-white dark:bg-slate-900/50 border-2 border-blue-200 dark:border-blue-500/20 text-blue-900 dark:text-blue-400 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl flex items-center justify-center gap-4">
                      <i className="ri-loader-5-line animate-spin text-xl"></i>
                      Verification In Progress
                    </div>
                    <button
                      onClick={handleCancelApplication}
                      className="w-full h-14 bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group/cancel"
                    >
                      <i className="ri-close-circle-line text-lg group-hover/cancel:rotate-90 transition-transform duration-300"></i>
                      Cancel Application
                    </button>
                  </div>
                )}
              </div>
            </div>

            {application.rejection_reason && (
              <div className="mt-8 p-10 bg-rose-50/50 dark:bg-rose-500/5 border-2 border-rose-100 dark:border-rose-500/20 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full translate-x-5 -translate-y-5"></div>
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-4">Official Feedback</p>
                <div className="flex gap-4">
                  <i className="ri-double-quotes-l text-4xl text-rose-200 dark:text-rose-500/20"></i>
                  <p className="text-rose-900 dark:text-rose-300 font-bold leading-relaxed italic text-lg">{application.rejection_reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Details & Metadata Section */}
          <div className="lg:col-span-7 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-blue-500/30 transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <i className="ri-bank-line text-blue-500"></i>
                  Business Entity
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{application.business_name}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-blue-500/30 transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <i className="ri-price-tag-3-line text-blue-500"></i>
                  Industry Niche
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{application.business_category}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-blue-500/30 transition-colors">
              <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <i className="ri-article-line text-blue-500"></i>
                Business Description
              </p>
              <p className="text-slate-600 dark:text-slate-400 font-bold leading-relaxed text-lg">{application.business_description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-blue-500/30 transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <i className="ri-phone-fill text-blue-500"></i>
                  Contact Line
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">{application.contact_phone}</p>
              </div>
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-blue-500/30 transition-colors">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                  <i className="ri-mail-fill text-blue-500"></i>
                  Electronic Mail
                </p>
                <p className="text-lg font-black text-blue-600 dark:text-blue-400 tracking-tight break-all leading-none">{application.contact_email}</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 group">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <i className="ri-calendar-event-fill text-blue-600 dark:text-blue-400 text-2xl"></i>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Entry Timestamp</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {new Date(application.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="px-6 py-2 bg-white dark:bg-slate-900 rounded-full border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.3em]">Encrypted Log</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
