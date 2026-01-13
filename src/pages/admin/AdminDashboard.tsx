import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type SellerApplication, type Profile } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Data State
  const [applications, setApplications] = useState<(SellerApplication & { user: Profile })[]>([]);
  const [stats, setStats] = useState({
    users: 0,
    sellers: 0,
    products: 0,
    pending: 0,
    approved: 0,
    total: 0,
    news: 0,
    messages: 0
  });

  // UI State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications'>('overview');
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;

    fetchData();

    // Realtime Subscriptions
    const channels = [
      supabase
        .channel('admin-dashboard-apps')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'seller_applications' },
          (payload) => {
            console.log('Realtime update:', payload);
            fetchData(); // Refresh data on any change
            if (payload.eventType === 'INSERT') {
              setNotification({ type: 'success', message: 'New seller application received' });
            }
          }
        )
        .subscribe(),

      supabase
        .channel('admin-dashboard-products')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          () => fetchData()
        )
        .subscribe(),

      supabase
        .channel('admin-dashboard-news')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'campus_news' },
          () => fetchData()
        )
        .subscribe(),

      supabase
        .channel('admin-dashboard-messages')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          () => fetchData()
        )
        .subscribe()
    ];

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authLoading]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [applicationsRes, usersRes, sellersRes, productsRes, newsRes, messagesRes] = await Promise.all([
        supabase
          .from('seller_applications')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('campus_news').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
      ]);

      if (applicationsRes.data) {
        // Fetch profiles separately to avoid join errors
        const userIds = [...new Set(applicationsRes.data.map(a => a.user_id))];
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);

        const appsWithUsers = applicationsRes.data.map((app: any) => ({
          ...app,
          user: userProfiles?.find(p => p.id === app.user_id)
        }));

        setApplications(appsWithUsers as any);
        const pendingCount = applicationsRes.data.filter((a: any) => a.status === 'pending').length;
        const approvedCount = applicationsRes.data.filter((a: any) => a.status === 'approved').length;

        setStats({
          users: usersRes.count || 0,
          sellers: sellersRes.count || 0,
          products: productsRes.count || 0,
          news: newsRes.count || 0,
          messages: messagesRes.count || 0,
          pending: pendingCount,
          approved: approvedCount,
          total: applicationsRes.count || applicationsRes.data.length,
        });
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (applicationId: string, userId: string) => {
    setProcessing(applicationId);
    try {
      const application = applications.find(app => app.id === applicationId);
      if (!application) throw new Error('Application not found');

      // 1. Update Application Status
      const { error: appError } = await supabase
        .from('seller_applications')
        .update({ status: 'approved', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
        .eq('id', applicationId);
      if (appError) throw appError;

      // 2. Create Seller Profile (idempotent)
      const { data: existingProfile } = await supabase.from('seller_profiles').select('*').eq('user_id', userId).single();
      if (!existingProfile) {
        const { error: profileError } = await supabase.from('seller_profiles').insert([{ user_id: userId, subscription_status: 'inactive', payment_status: 'pending' }]);
        if (profileError) throw profileError;
      }

      // 3. Update User Role
      const { error: roleError } = await supabase.from('profiles').update({ role: 'seller' }).eq('id', userId);
      if (roleError) throw roleError;

      // 4. Send SMS
      if (application.contact_phone) {
        import('../../lib/arkesel').then(({ sendSMS }) => {
          sendSMS([application.contact_phone], `Congratulations! Your seller application for ${application.business_name} on PU Connect has been approved.`);
        }).catch(console.error);
      }

      setNotification({ type: 'success', message: 'Seller approved successfully' });
      fetchData();
    } catch (error: any) {
      setNotification({ type: 'error', message: error.message || 'Approval failed' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    setProcessing(applicationId);
    try {
      await supabase
        .from('seller_applications')
        .update({ status: 'rejected', rejection_reason: reason, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
        .eq('id', applicationId);

      setNotification({ type: 'success', message: 'Application rejected' });
      fetchData();
    } catch (error: any) {
      setNotification({ type: 'error', message: error.message });
    } finally {
      setProcessing(null);
    }
  };

  const pendingApplicationsList = applications.filter((app) => app.status === 'pending');

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
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-widest border border-blue-200 dark:border-blue-800">
                System Admin
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
              Dashboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Manage users, approve sellers, and monitor platform activity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/marketplace" className="px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
              View Market
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-1.5 border border-gray-100 dark:border-gray-800 inline-flex mb-10 shadow-sm overflow-x-auto max-w-full">
          {[
            { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
            { id: 'applications', label: 'Applications', icon: 'ri-file-list-line', badge: pendingApplicationsList.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md transform scale-[1.02]'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
              <i className={`${tab.icon} text-lg`}></i>
              {tab.label}
              {tab.badge ? (
                <span className={`ml-1 px-2 py-0.5 rounded-md text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'}`}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'overview' ? (
            <div className="space-y-10">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                  { label: 'Total Users', value: stats.users, icon: 'ri-group-fill', color: 'bg-blue-500' },
                  { label: 'Active Sellers', value: stats.sellers, icon: 'ri-store-3-fill', color: 'bg-indigo-500' },
                  { label: 'Live Products', value: stats.products, icon: 'ri-shopping-bag-3-fill', color: 'bg-violet-500' },
                  { label: 'Pending Apps', value: stats.pending, icon: 'ri-time-fill', color: 'bg-amber-500' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-24 h-24 ${stat.color} opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform`}></div>
                    <div className={`w-12 h-12 rounded-2xl ${stat.color} bg-opacity-10 flex items-center justify-center mb-4 text-${stat.color.replace('bg-', '')} group-hover:scale-110 transition-transform`}>
                      <i className={`${stat.icon} text-xl ${stat.color.replace('bg-', 'text-')}`}></i>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{stat.value}</div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Quick Links Grid */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <i className="ri-flashlight-line text-amber-500"></i> Quick Actions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[
                    { title: 'Manage Users', desc: 'View and edit user accounts', path: '/admin/users', icon: 'ri-user-settings-line' },
                    { title: 'Publish News', desc: 'Create campus updates', path: '/admin/news', icon: 'ri-article-line' },
                    { title: 'Add Product', desc: 'List new inventory item', path: '/seller/add-product', icon: 'ri-add-circle-line' },
                    { title: 'SMS Broadcast', desc: 'Send alerts to students', path: '/admin/sms', icon: 'ri-message-3-line' },
                    { title: 'Newsletter List', desc: 'Manage subscribers', path: '/admin/newsletter', icon: 'ri-mail-open-line' },
                    { title: 'Website Content', desc: 'Update site images', path: '/admin/content', icon: 'ri-layout-masonry-line' },
                    { title: 'Internal Chat', desc: 'Team Communication', path: '/admin/messages', icon: 'ri-chat-smile-2-line' },
                    // Conditional Links for Super Admin
                    ...(profile?.role === 'super_admin' ? [
                      { title: 'Access Control', desc: 'Manage roles & permissions', path: '/admin/roles', icon: 'ri-shield-keyhole-line' },
                    ] : [])
                  ].map((item, i) => (
                    <Link key={i} to={item.path} className="flex flex-col p-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg transition-all group">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <i className={`${item.icon} text-lg`}></i>
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1">{item.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{item.desc}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Applications List */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Applications...</p>
                </div>
              ) : pendingApplicationsList.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 p-12 text-center">
                  <div className="w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="ri-check-double-line text-3xl text-gray-400"></i>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">All Caught Up!</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto text-sm">There are no pending seller applications needing review at this time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {pendingApplicationsList.map((app) => (
                    <div key={app.id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 md:p-8 hover:shadow-xl transition-shadow relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 transform scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom"></div>

                      <div className="flex flex-col md:flex-row gap-8">
                        {/* User Info */}
                        <div className="flex-shrink-0 flex flex-row md:flex-col items-center md:items-start gap-4 md:w-48">
                          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl font-bold text-gray-500 dark:text-gray-400">
                            {app.user?.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="text-center md:text-left">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{app.user?.full_name}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{new Date(app.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Business Details */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{app.business_name}</h3>
                            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-widest rounded-full">
                              {app.business_type}
                            </span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                            {app.business_description}
                          </p>
                          <div className="flex flex-wrap gap-6 text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">
                            <div className="flex items-center gap-2">
                              <i className="ri-mail-line text-blue-500"></i> {app.contact_email}
                            </div>
                            <div className="flex items-center gap-2">
                              <i className="ri-phone-line text-emerald-500"></i> {app.contact_phone}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-row md:flex-col justify-center gap-3 md:w-40 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 pt-6 md:pt-0 md:pl-6">
                          <button
                            onClick={() => handleApprove(app.id, app.user_id)}
                            disabled={!!processing}
                            className="flex-1 px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black dark:hover:bg-gray-100 transition-colors shadow-lg shadow-gray-200/50 dark:shadow-none flex items-center justify-center gap-2"
                          >
                            {processing === app.id ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(app.id)}
                            disabled={!!processing}
                            className="flex-1 px-4 py-3 bg-white dark:bg-gray-900 text-rose-500 border border-rose-100 dark:border-rose-900/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center justify-center gap-2"
                          >
                            <i className="ri-close-line"></i>
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
