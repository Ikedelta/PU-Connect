import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

type SystemAdmin = {
  id: string;
  user_id: string;
  granted_at: string;
  is_active: boolean;
  profile?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
};

export default function SuperAdminManagement() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState<SystemAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (profile?.role !== 'super_admin') {
      navigate('/admin/dashboard');
      return;
    }
    fetchAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, navigate]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchAdmins = async () => {
    try {
      // 1. Fetch only the admin ID list (Simple query, no schema joining)
      const { data: adminList, error: adminError } = await supabase
        .from('system_admins')
        .select('*')
        .order('granted_at', { ascending: false });

      if (adminError) throw adminError;
      if (!adminList) return;

      // 2. Fetch profiles for these users manually
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', adminList.map(a => a.user_id));

      if (profileError) throw profileError;

      // 3. Merge the data
      const mergedAdmins = adminList.map(admin => ({
        ...admin,
        profile: profiles?.find(p => p.id === admin.user_id)
      }));

      setAdmins(mergedAdmins);
    } catch (error: any) {
      console.error('Error fetching admins:', error);
      setNotification({ type: 'error', message: 'Failed to load system administrators' });
    } finally {
      setLoading(false);
    }
  };

  const grantSuperAdmin = async () => {
    if (!searchEmail.trim()) {
      setNotification({ type: 'error', message: 'Please enter an email address' });
      return;
    }

    setLoading(true);
    try {
      // Find user by email
      const { data: userProfile, error: findError } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('email', searchEmail.trim())
        .single();

      if (findError || !userProfile) {
        setNotification({ type: 'error', message: 'User not found with this email' });
        setLoading(false);
        return;
      }

      // Update user role to super_admin
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', userProfile.id);

      if (updateError) throw updateError;

      // Add to system_admins table
      const { error: insertError } = await supabase
        .from('system_admins')
        .insert({
          user_id: userProfile.id,
          granted_by: profile?.id,
          is_active: true
        });

      if (insertError) throw insertError;

      setNotification({ type: 'success', message: `${userProfile.full_name} is now a Super Admin` });
      setSearchEmail('');
      fetchAdmins();
    } catch (error: any) {
      console.error('Error granting super admin:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to grant access' });
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminStatus = async (adminId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('system_admins')
        .update({ is_active: !currentStatus })
        .eq('id', adminId);

      if (error) throw error;

      setNotification({ type: 'success', message: `Admin account ${!currentStatus ? 'activated' : 'deactivated'}` });
      fetchAdmins();
    } catch (error: any) {
      console.error('Error updating admin status:', error);
      setNotification({ type: 'error', message: 'Failed to update status' });
    }
  };

  if (profile?.role !== 'super_admin') {
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-gray-950 transition-colors duration-300 pb-20 font-sans">
      <Navbar />

      {/* Floating Notification */}
      {notification && (
        <div className={`fixed top-24 right-4 md:right-8 z-50 animate-in fade-in slide-in-from-right-8 duration-300 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white' : 'bg-rose-500/90 border-rose-400/50 text-white'}`}>
          <i className={`${notification.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-xl`}></i>
          <span className="font-bold text-sm tracking-wide">{notification.message}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-widest border border-indigo-200 dark:border-indigo-800">
                Security Level: Highest
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] font-bold uppercase tracking-widest border border-rose-200 dark:border-rose-800">
                Super Admins
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
              System Root
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Manage the core administrators who have full system control.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Dashboard
          </button>
        </div>

        {/* Grant Panel */}
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-800 shadow-sm mb-12">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <i className="ri-shield-keyhole-line text-indigo-500 text-xl"></i>
            Grant Super Access
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <i className="ri-mail-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Enter user email address..."
                className="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 font-medium text-sm text-gray-900 dark:text-white placeholder-gray-400 transition-all outline-none"
              />
            </div>
            <button
              onClick={grantSuperAdmin}
              disabled={loading || !searchEmail.trim()}
              className="px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black dark:hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gray-200/50 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <i className="ri-loader-4-line animate-spin text-lg"></i>
              ) : (
                <>
                  <i className="ri-shield-check-line text-lg"></i>
                  Grant Privileges
                </>
              )}
            </button>
          </div>
        </div>

        {/* Admins Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {admins.map((admin) => (
            <div key={admin.id} className="bg-white dark:bg-gray-900 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all group relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-full opacity-50 bg-pattern-dots"></div>

              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center border border-gray-100 dark:border-gray-700">
                    <span className="font-bold text-2xl text-gray-900 dark:text-white">
                      {admin.profile?.full_name?.charAt(0) || 'A'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{admin.profile?.full_name}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">{admin.profile?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`w-2 h-2 rounded-full ${admin.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{admin.is_active ? 'Active' : 'Suspended'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => toggleAdminStatus(admin.id, admin.is_active)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${admin.is_active
                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-400'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400'
                      }`}
                    title={admin.is_active ? 'Suspend Account' : 'Activate Account'}
                  >
                    <i className={admin.is_active ? 'ri-prohibited-line' : 'ri-checkbox-circle-line'}></i>
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span>Since {new Date(admin.granted_at).toLocaleDateString()}</span>
                <span>ID: {admin.user_id.slice(0, 8)}...</span>
              </div>
            </div>
          ))}
        </div>

        {admins.length === 0 && !loading && (
          <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 border-dashed">
            <i className="ri-shield-keyhole-line text-4xl text-gray-300 dark:text-gray-600 mb-4 inline-block"></i>
            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">No other super admins found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
