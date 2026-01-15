import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type SellerApplication, type Profile } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

export default function AdminDashboard() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Data State
  const [applications, setApplications] = useState<(SellerApplication & { user: Profile })[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    users: 0,
    sellers: 0,
    admins: 0,
    publishers: 0,
    buyers: 0,
    products: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
    news: 0,
    messages: 0
  });

  // UI State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications'>('overview');
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);

  // Add Admin Search State
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminSearchResults, setAdminSearchResults] = useState<Profile[]>([]);
  const [selectedAdminUser, setSelectedAdminUser] = useState<Profile | null>(null);

  // Realtime Online Users
  const [onlineUsers, setOnlineUsers] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    fetchData();

    // Subscribe to Data Changes
    const dataChannels = [
      supabase.channel('admin-dashboard-apps').on('postgres_changes', { event: '*', schema: 'public', table: 'seller_applications' }, (payload) => {
        fetchData();
        if (payload.eventType === 'INSERT') setNotification({ type: 'info', message: 'New seller application received' });
      }).subscribe(),
      supabase.channel('admin-dashboard-products').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData()).subscribe(),
      supabase.channel('admin-dashboard-news').on('postgres_changes', { event: '*', schema: 'public', table: 'campus_news' }, () => fetchData()).subscribe(),
      supabase.channel('admin-dashboard-messages').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchData()).subscribe()
    ];

    // Presence Channel for "Online Users"
    const presenceChannel = supabase.channel('online-users');

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        // Count distinct user_ids
        const uniqueUsers = new Set(Object.keys(state)).size;
        setOnlineUsers(uniqueUsers);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Alert admin when someone comes online
        const user = newPresences[0];
        if (user && user.user_id !== profile?.id) {
          setNotification({
            type: 'success',
            message: `${user.full_name || 'A user'} is now online`
          });
        }
      })
      .subscribe();

    return () => {
      dataChannels.forEach(channel => supabase.removeChannel(channel));
      supabase.removeChannel(presenceChannel);
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



  // RE-WRITING THE FETCHDATA FUNCTION COMPLETELY TO BE SAFE
  const fetchData = async () => {
    setLoading(true);
    try {
      const [applicationsRes, usersRes, sellersRes, adminsRes, publishersRes, productsRes, newsRes, messagesRes, logsRes] = await Promise.all([
        supabase.from('seller_applications').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('id', { count: 'exact', head: true }), // Total profiles
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'super_admin']),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'news_publisher'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('campus_news').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
        supabase.from('activity_logs').select(`*, user:profiles!user_id(full_name)`).order('created_at', { ascending: false }).limit(5)
      ]);

      if (applicationsRes.data) {
        const userIds = [...new Set(applicationsRes.data.map(a => a.user_id))];
        const { data: userProfiles } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds);
        const appsWithUsers = applicationsRes.data.map((app: any) => ({ ...app, user: userProfiles?.find(p => p.id === app.user_id) }));
        setApplications(appsWithUsers as any);

        setStats({
          users: usersRes.count || 0,
          sellers: sellersRes.count || 0,
          admins: adminsRes.count || 0,
          publishers: publishersRes.count || 0,
          buyers: (usersRes.count || 0) - (sellersRes.count || 0) - (adminsRes.count || 0) - (publishersRes.count || 0), // Rough estimate
          products: productsRes.count || 0,
          news: newsRes.count || 0,
          messages: messagesRes.count || 0,
          pending: applicationsRes.data.filter((a: any) => a.status === 'pending').length,
          approved: applicationsRes.data.filter((a: any) => a.status === 'approved').length,
          rejected: applicationsRes.data.filter((a: any) => a.status === 'rejected').length,
          total: applicationsRes.count || applicationsRes.data.length,
        });

        if (logsRes.data) setRecentLogs(logsRes.data);
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

  const handleSearchUsers = async (term: string) => {
    setAdminSearchTerm(term);
    setSelectedAdminUser(null);

    if (term.length > 2) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${term}%`)
        .neq('role', 'admin')
        .neq('role', 'super_admin')
        .limit(5);
      setAdminSearchResults(data || []);
    } else {
      setAdminSearchResults([]);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminUser) return;

    setProcessing('add-admin');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', selectedAdminUser.id);

      if (updateError) throw updateError;

      setNotification({ type: 'success', message: `${selectedAdminUser.full_name} is now an Admin.` });

      // Reset State
      setAdminSearchTerm('');
      setAdminSearchResults([]);
      setSelectedAdminUser(null);
      setShowAddAdminModal(false);

      fetchData(); // Refresh stats
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setProcessing(null);
    }
  };

  const pendingApplicationsList = applications.filter((app) => app.status === 'pending');

  // Chart Data Preparation
  const pieData = [
    { name: 'Buyers', value: stats.users - stats.sellers, color: '#3b82f6' }, // blue-500
    { name: 'Sellers', value: stats.sellers, color: '#8b5cf6' }, // violet-500
  ];

  const barData = [
    { name: 'Pending', count: stats.pending, fill: '#f59e0b' }, // amber-500
    { name: 'Approved', count: stats.approved, fill: '#10b981' }, // emerald-500
    { name: 'Rejected', count: stats.rejected, fill: '#f43f5e' }, // rose-500
  ];

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'login': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10';
      case 'product_created': return 'text-blue-500 bg-blue-50 dark:bg-blue-500/10';
      case 'message_sent': return 'text-pink-500 bg-pink-50 dark:bg-pink-500/10';
      default: return 'text-slate-500 bg-slate-50 dark:bg-slate-500/10';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
      <Navbar />

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                <i className="ri-user-star-line"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Promote to Admin</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Search and select a user to grant admin privileges.</p>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-4">
              {/* Search User */}
              <div className="space-y-2 relative">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Search User</label>
                <div className="relative">
                  <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10"></i>
                  <input
                    type="text"
                    value={adminSearchTerm}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
                    placeholder="Type name to search..."
                  />
                  {/* Results Dropdown */}
                  {adminSearchResults.length > 0 && !selectedAdminUser && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2">
                      {adminSearchResults.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setSelectedAdminUser(user);
                            setAdminSearchTerm(user.full_name);
                            setAdminSearchResults([]);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-xs">
                            {user.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{user.full_name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected User Confirmation */}
              {selectedAdminUser && (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in zoom-in-95">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center text-lg">
                    <i className="ri-check-line"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Selected User</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedAdminUser.full_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAdminUser(null);
                      setAdminSearchTerm('');
                    }}
                    className="text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <i className="ri-close-circle-fill text-xl"></i>
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="flex-1 py-4 text-slate-500 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!!processing || !selectedAdminUser}
                  className="flex-1 py-4 bg-blue-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing === 'add-admin' ? <i className="ri-loader-4-line animate-spin"></i> : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Notification */}
      {notification && (
        <div className={`fixed top-24 right-4 md:right-8 z-50 animate-in fade-in slide-in-from-right-8 duration-300 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white' :
          notification.type === 'error' ? 'bg-rose-500/90 border-rose-400/50 text-white' :
            'bg-blue-500/90 border-blue-400/50 text-white'
          }`}>
          <i className={`${notification.type === 'success' ? 'ri-checkbox-circle-fill' : notification.type === 'error' ? 'ri-error-warning-fill' : 'ri-notification-3-fill'} text-xl`}></i>
          <span className="font-bold text-sm tracking-wide">{notification.message}</span>
        </div>
      )}

      <div className="pt-28 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20">
                Super Admin
              </span>
              <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                System Operational
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
              Dashboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
              Welcome back, <span className="text-slate-900 dark:text-white font-bold">{profile?.full_name?.split(' ')[0]}</span>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddAdminModal(true)}
              className="px-5 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wide hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
            >
              <i className="ri-user-add-line text-lg"></i> Add Admin
            </button>
            <Link to="/marketplace" className="px-5 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm group">
              <i className="ri-store-2-line mr-2 group-hover:text-blue-500 transition-colors"></i>
              View Market
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-1.5 border border-slate-200 dark:border-slate-700 inline-flex mb-10 shadow-sm overflow-x-auto max-w-full">
          {[
            { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
            { id: 'applications', label: 'Applications', icon: 'ri-file-list-line', badge: pendingApplicationsList.length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md transform scale-[1.02]'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              <i className={`${tab.icon} text-lg`}></i>
              {tab.label}
              {tab.badge ? (
                <span className={`ml-1 px-2 py-0.5 rounded-md text-[10px] ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-red-500 text-white animate-pulse'}`}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'overview' ? (
            <div className="space-y-8">

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  { label: 'Total Users', value: stats.users, icon: 'ri-group-line', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                  { label: 'Buyers', value: stats.buyers, icon: 'ri-shopping-cart-2-line', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                  { label: 'Sellers', value: stats.sellers, icon: 'ri-store-2-line', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
                  { label: 'Admins', value: stats.admins, icon: 'ri-shield-user-line', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                  { label: 'Publishers', value: stats.publishers, icon: 'ri-newspaper-line', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
                  { label: 'Products', value: stats.products, icon: 'ri-box-3-line', color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center text-xl mb-3`}>
                      <i className={stat.icon}></i>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mb-1">{stat.value}</div>
                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{stat.label}</div>
                  </div>
                ))}
              </div>
              {/* Alert for Pending Apps */}
              {stats.pending > 0 && (
                <div
                  onClick={() => setActiveTab('applications')}
                  className="bg-amber-500 text-white p-4 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-between cursor-pointer hover:bg-amber-600 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <i className="ri-alarm-warning-line text-2xl"></i>
                    </div>
                    <div>
                      <h4 className="font-bold text-lg">Action Required</h4>
                      <p className="text-amber-100 text-sm font-medium">You have {stats.pending} pending seller application{stats.pending !== 1 ? 's' : ''}.</p>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <i className="ri-bar-chart-2-fill text-blue-500"></i> Application Status
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                          cursor={{ fill: 'transparent' }}
                        />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                          {barData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 2. Pie Chart */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <i className="ri-pie-chart-2-fill text-violet-500"></i> User Distribution
                </h3>
                <div className="h-64 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Split Section: Quick Actions & Live Logs */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Quick Links (Takes 2/3 width on large screens) */}
                <div className="xl:col-span-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <i className="ri-flashlight-line text-amber-500"></i> Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { title: 'Manage Users', desc: 'Accounts & Roles', path: '/admin/users', icon: 'ri-user-settings-line', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                      { title: 'Seller Portal', desc: 'Manage Listings', path: '/seller/dashboard', icon: 'ri-store-2-line', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                      { title: 'Add Inventory', desc: 'Post Product', path: '/seller/add-product', icon: 'ri-add-circle-line', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                      { title: 'Publish News', desc: 'Campus Updates', path: '/admin/news', icon: 'ri-article-line', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                      { title: 'Manage Ads', desc: 'Promote Content', path: '/admin/ads', icon: 'ri-advertisement-line', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
                      { title: 'Polls', desc: 'Student Opinions', path: '/admin/polls', icon: 'ri-bar-chart-2-line', color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
                      { title: 'Support Tickets', desc: 'User Inquiries', path: '/admin/support', icon: 'ri-customer-service-2-line', color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
                      { title: 'SMS Broadcast', desc: 'Send Alerts', path: '/admin/sms', icon: 'ri-message-3-line', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                      { title: 'Newsletter', desc: 'Subscribers List', path: '/admin/newsletter', icon: 'ri-mail-send-line', color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/20' },
                      { title: 'Audit Logs', desc: 'Monitor Activity', path: '/admin/activity', icon: 'ri-eye-line', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                      { title: 'Message Logs', desc: 'View User Chats', path: '/admin/activity?filter=message_sent', icon: 'ri-chat-history-line', color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-900/20' },
                      { title: 'Management', desc: 'Site Content', path: '/admin/content', icon: 'ri-layout-masonry-line', color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
                      { title: 'System Settings', desc: 'Configuration', path: '/admin/settings', icon: 'ri-settings-3-line', color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-900/20' },
                    ].map((item, i) => (
                      <Link key={i} to={item.path} className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-lg transition-all group">
                        <div className={`w-12 h-12 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <i className={`${item.icon} text-xl`}></i>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">{item.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{item.desc}</p>
                        </div>
                        <i className="ri-arrow-right-s-line ml-auto text-slate-300 group-hover:text-slate-600 transition-colors"></i>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Live Audit Feed (Right Column) */}
                <div className="xl:col-span-1">
                  <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm p-6 h-full">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <i className="ri-radar-line text-rose-500 animate-pulse"></i> Live Activity
                      </h3>
                      <Link to="/admin/activity" className="text-xs font-bold text-blue-500 hover:text-blue-600 uppercase tracking-widest">View All</Link>
                    </div>

                    <div className="space-y-4">
                      {recentLogs.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-8">No recent activity detected.</p>
                      ) : (
                        recentLogs.map((log) => (
                          <div key={log.id} className="flex gap-3 items-start group">
                            <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center ${getActionColor(log.action_type)}`}>
                              <i className={`${log.action_type === 'login' ? 'ri-login-box-line' :
                                log.action_type === 'product_created' ? 'ri-add-box-line' :
                                  log.action_type === 'message_sent' ? 'ri-chat-smile-2-line' :
                                    'ri-information-line'
                                }`}></i>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {log.user?.full_name || 'System'}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {log.action_type.replace(/_/g, ' ')}
                              </p>
                              <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-6">
              {/* Applications List */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Applications...</p>
                </div>
              ) : pendingApplicationsList.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-12 text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="ri-check-double-line text-3xl text-slate-400"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">All Caught Up!</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">There are no pending seller applications needing review at this time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {pendingApplicationsList.map((app) => (
                    <div key={app.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 md:p-8 hover:shadow-xl transition-shadow relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 transform scale-y-0 group-hover:scale-y-100 transition-transform origin-bottom"></div>

                      <div className="flex flex-col md:flex-row gap-8">
                        {/* User Info */}
                        <div className="flex-shrink-0 flex flex-row md:flex-col items-center md:items-start gap-4 md:w-48">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl font-bold text-slate-500 dark:text-slate-400 uppercase">
                            {app.user?.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="text-center md:text-left">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{app.user?.full_name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{new Date(app.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Business Details */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{app.business_name}</h3>
                            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-widest rounded-full">
                              {app.business_type}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                            {app.business_description}
                          </p>
                          <div className="flex flex-wrap gap-6 text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide uppercase">
                            <div className="flex items-center gap-2">
                              <i className="ri-mail-line text-blue-500"></i> {app.contact_email}
                            </div>
                            <div className="flex items-center gap-2">
                              <i className="ri-phone-line text-emerald-500"></i> {app.contact_phone}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-row md:flex-col justify-center gap-3 md:w-40 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-6 md:pt-0 md:pl-6">
                          <button
                            onClick={() => handleApprove(app.id, app.user_id)}
                            disabled={!!processing}
                            className="flex-1 px-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black dark:hover:bg-slate-100 transition-colors shadow-lg shadow-slate-200/50 dark:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {processing === app.id ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-check-line"></i>}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(app.id)}
                            disabled={!!processing}
                            className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 text-rose-500 border border-rose-100 dark:border-rose-900/30 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
    </div >
  );
}
