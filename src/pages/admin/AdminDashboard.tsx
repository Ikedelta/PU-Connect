import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type SellerApplication, type Profile, type Product } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
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
  Cell
} from 'recharts';

type SMSHistory = {
  id: string;
  action_type: string;
  details: any;
  created_at: string;
  user: { full_name: string } | null;
};

export default function AdminDashboard() {
  const { profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<(SellerApplication & { user: Profile })[]>([]);
  const [allProducts, setAllProducts] = useState<(Product & { seller: Profile })[]>([]);
  const [smsHistory, setSmsHistory] = useState<SMSHistory[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const [stats, setStats] = useState({
    users: 0,
    sellers: 0,
    admins: 0,
    publishers: 0,
    buyers: 0,
    products_count: 0,
    services_count: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    news: 0,
    tickets: 0,
    smsBalance: 0,
    smsSent: 0,
    onlineUsers: 0
  });

  const [analyticsData, setAnalyticsData] = useState<{
    faculties: { name: string, count: number }[],
    departments: { name: string, count: number }[],
    recentGrowth: { date: string, count: number }[]
  }>({ faculties: [], departments: [], recentGrowth: [] });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'products' | 'analytics' | 'activity'>('overview');
  const [processing, setProcessing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminSearchResults, setAdminSearchResults] = useState<Profile[]>([]);
  const [selectedAdminUser, setSelectedAdminUser] = useState<Profile | null>(null);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [newPersonData, setNewPersonData] = useState({ full_name: '', email: '', password: '', role: 'buyer' as 'buyer' | 'admin' | 'news_publisher' });

  useEffect(() => {
    if (authLoading) return;

    console.log('Admin Dashboard Access Check:', {
      role: profile?.role,
      id: profile?.id,
      hasProfile: !!profile
    });

    // If no profile or not admin, show access denied instead of random redirect
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      // navigate('/marketplace'); // Commented out to debug
      return;
    }

    if (profile) {
      refreshProfile();
      fetchData();
    }

    // Real-time subscriptions
    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_applications' }, (payload) => {
        console.log('Real-time: Application change', payload);
        if (payload.eventType === 'INSERT') {
          setNotification({ type: 'info', message: '🔔 New seller application received!' });
        }
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => fetchActivityLogs())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `action_type=eq.sms_sent` }, () => fetchSMSHistory())
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    const presenceChannel = supabase.channel('online-presence');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setStats(prev => ({ ...prev, onlineUsers: Object.keys(state).length }));
      })
      .subscribe();

    const interval = setInterval(() => {
      fetchData();
      setLastUpdate(new Date());
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
      clearInterval(interval);
    };
  }, [profile, authLoading]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchData = async () => {
    try {
      console.log('📊 Fetching dashboard data...');

      const [appsRes, usersRes, sellersRes, adminsRes, publishersRes, productsCountRes, servicesCountRes, newsRes, ticketsRes, logsRes, analyticsRes, allProductsRes] = await Promise.all([
        supabase.from('seller_applications').select('*, user:profiles!user_id(*)').order('created_at', { ascending: false }).limit(100),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('seller_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'super_admin']),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'news_publisher'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('category', 'product'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('category', 'service'),
        supabase.from('campus_news').select('id', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('activity_logs').select('*, user:profiles!user_id(full_name)').order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('faculty, department, created_at'),
        // Fetch ALL products for admin management
        supabase.from('products').select('*, seller:profiles!products_seller_id_fkey(full_name, email, phone)').order('created_at', { ascending: false }).limit(200)
      ])
      setRecentLogs(logsRes.data || []);

      // Set Products Data
      if (allProductsRes && allProductsRes.data) {
        setAllProducts(allProductsRes.data as any || []);
      } else {
        // Fallback if index shifted (it shouldn't if added at end)
        // Actually Promise.all returns array in order. The last item is the new one (index 11).
        // But typescript inference might be tricky here.
        // Let's use a separate query or trust the array index 11.
        // Wait, I added it as the 12th element (index 11).
        // Let's be safe and refetch active products separately? No, that's wasteful.
        // I'll cast the 12th result.
      }

      console.log('📋 Applications response:', {
        error: appsRes.error,
        count: appsRes.data?.length
      });

      // TEST: Try a simple query without join
      const testQuery = await supabase.from('seller_applications').select('*');
      console.log('🧪 TEST - Simple query (no join):', {
        error: testQuery.error,
        count: testQuery.data?.length,
        data: testQuery.data
      });

      // Handle applications - robust fallback mechanism
      if (appsRes.error) {
        console.warn('⚠️ Applications fetch with join failed, using fallback:', appsRes.error.message);

        const { data: simpleApps, error: simpleError } = await supabase
          .from('seller_applications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (simpleError) {
          console.error('❌ Simple applications fetch failed:', simpleError);
          setApplications([]);
        } else if (simpleApps && simpleApps.length > 0) {
          console.log(`✅ Fetched ${simpleApps.length} applications without join`);

          const userIds = simpleApps.map(a => a.user_id).filter(Boolean);
          if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);

            const appsWithUsers = simpleApps.map(app => ({
              ...app,
              user: (profiles || []).find(p => p.id === app.user_id) || {
                full_name: 'Unknown User',
                email: 'no-email@example.com',
                id: app.user_id
              }
            }));

            console.log(`✅ Mapped ${appsWithUsers.length} applications with user data`);
            setApplications(appsWithUsers as any);
          } else {
            setApplications(simpleApps.map(app => ({
              ...app,
              user: { full_name: 'Unknown User', email: 'no-email@example.com', id: app.user_id }
            })) as any);
          }
        } else {
          console.log('ℹ️ No applications found');
          setApplications([]);
        }
      } else {
        console.log(`✅ Fetched ${appsRes.data?.length || 0} applications with join`);
        setApplications(appsRes.data || []);
      }

      // Use the fetched applications for stats calculation
      let fetchedApps = appsRes.data || [];

      // If we had to use fallback, get the applications from state after setting them
      if (appsRes.error) {
        // We'll calculate from the fallback data we just set
        fetchedApps = applications;
      }

      const totalUsers = usersRes.count || 0;

      const pendingCount = fetchedApps.filter(a => a.status?.toLowerCase() === 'pending').length;
      const approvedCount = fetchedApps.filter(a => a.status?.toLowerCase() === 'approved').length;
      const rejectedCount = fetchedApps.filter(a => a.status?.toLowerCase() === 'rejected').length;

      console.log(`📊 Applications stats - Pending: ${pendingCount}, Approved: ${approvedCount}, Rejected: ${rejectedCount}`);

      setStats(prev => ({
        ...prev,
        users: totalUsers,
        sellers: sellersRes.count || 0,
        admins: adminsRes.count || 0,
        publishers: publishersRes.count || 0,
        buyers: totalUsers - (sellersRes.count || 0) - (adminsRes.count || 0) - (publishersRes.count || 0),
        products_count: productsCountRes.count || 0,
        services_count: servicesCountRes.count || 0,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        news: newsRes.count || 0,
        tickets: ticketsRes.count || 0
      }));

      if (logsRes.data) setRecentLogs(logsRes.data);

      if (analyticsRes.data) {
        const facMap: Record<string, number> = {};
        const depMap: Record<string, number> = {};
        const growthMap: Record<string, number> = {};

        analyticsRes.data.forEach(p => {
          if (p.faculty) facMap[p.faculty] = (facMap[p.faculty] || 0) + 1;
          if (p.department) depMap[p.department] = (depMap[p.department] || 0) + 1;
          const date = new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          growthMap[date] = (growthMap[date] || 0) + 1;
        });

        setAnalyticsData({
          faculties: Object.entries(facMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
          departments: Object.entries(depMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
          recentGrowth: Object.entries(growthMap).map(([date, count]) => ({ date, count })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-10)
        });
      }

      await Promise.all([fetchSMSBalance(), fetchSMSHistory()]);
    } catch (err) {
      console.error('❌ Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSMSBalance = async () => {
    try {
      const { getSMSBalance } = await import('../../lib/arkesel');
      const balance = await getSMSBalance();
      console.log('📱 SMS Balance:', balance);
      setStats(prev => ({ ...prev, smsBalance: balance }));
    } catch (err) {
      console.error('SMS balance error:', err);
    }
  };

  const fetchSMSHistory = async () => {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('*, user:profiles!user_id(full_name)')
        .eq('action_type', 'sms_sent')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setSmsHistory(data as any);
        setStats(prev => ({ ...prev, smsSent: data.length }));
      }
    } catch (err) {
      console.error('SMS history error:', err);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('*, user:profiles!user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) setRecentLogs(data);
    } catch (err) {
      console.error('Activity logs error:', err);
    }
  };

  const handleApprove = async (applicationId: string, userId: string) => {
    setProcessing(applicationId);
    try {
      const app = applications.find(a => a.id === applicationId);
      if (!app) throw new Error('Application not found');

      // Check if admin ID is a valid UUID (system admin has text ID)
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile?.id || '');
      const reviewedBy = isValidUUID ? profile?.id : null;

      const { error: appError } = await supabase.from('seller_applications').update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy
      }).eq('id', applicationId);
      if (appError) throw appError;

      const { error: profileError } = await supabase.from('seller_profiles').insert({
        user_id: userId,
        business_name: app.business_name,
        business_category: app.business_category || 'General',
        business_description: app.business_description,
        contact_phone: app.contact_phone,
        contact_email: app.contact_email,
        subscription_status: 'inactive',
        is_active: true
      });
      if (profileError && profileError.code !== '23505') throw profileError;

      // Update the user's role to 'seller' in the profiles table ONLY if they are not already an admin
      const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();

      if (userProfile?.role !== 'admin' && userProfile?.role !== 'super_admin') {
        const { error: roleError } = await supabase.from('profiles').update({ role: 'seller' }).eq('id', userId);
        if (roleError) throw roleError;
      }

      setNotification({ type: 'success', message: '✅ Seller approved and role updated!' });
      fetchData();
    } catch (err: any) {
      console.error('Approval error:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to approve' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;

    setProcessing(applicationId);
    try {
      const { error } = await supabase.from('seller_applications').update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString(), reviewed_by: profile?.id }).eq('id', applicationId);
      if (error) throw error;

      setNotification({ type: 'success', message: 'Application rejected' });
      fetchData();
    } catch (err: any) {
      console.error('Rejection error:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to reject' });
    } finally {
      setProcessing(null);
    }
  };

  const handleSearchUsers = async (term: string) => {
    setAdminSearchTerm(term);
    if (term.length > 2) {
      const { data } = await supabase.from('profiles').select('*').or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(5);
      setAdminSearchResults(data || []);
    } else {
      setAdminSearchResults([]);
    }
  };

  const handleAddAdmin = async () => {
    if (!selectedAdminUser) return;
    setProcessing('add-admin');
    try {
      const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', selectedAdminUser.id);
      if (error) throw error;

      setNotification({ type: 'success', message: `${selectedAdminUser.full_name} is now an Admin` });
      setShowAddAdminModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Role update error:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to update role' });
    } finally {
      setProcessing(null);
    }
  };

  const handleProductToggle = async (productId: string, currentStatus: boolean) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this product?`)) return;
    setProcessing(productId);
    try {
      const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', productId);
      if (error) throw error;
      setNotification({ type: 'success', message: `Product ${currentStatus ? 'deactivated' : 'activated'} successfully` });
      fetchData();
    } catch (error: any) {
      console.error('Error toggling product:', error);
      setNotification({ type: 'error', message: 'Failed to update product status' });
    } finally {
      setProcessing(null);
    }
  };

  const handleProductDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to DELETE this product? This action cannot be undone.')) return;
    setProcessing(productId);
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      setNotification({ type: 'success', message: 'Product deleted permanently' });
      fetchData();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      setNotification({ type: 'error', message: 'Failed to delete product' });
    } finally {
      setProcessing(null);
    }
  };

  const pendingApps = applications.filter(a => a.status?.toLowerCase() === 'pending');
  console.log('🔍 Pending Apps Calculation:', { totalApps: applications.length, pendingApps: pendingApps.length, applications });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navbar />

      {/* Real-time Status */}
      <div className="fixed top-20 right-6 z-40">
        <div className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-xl border ${isConnected ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-700/50 border-slate-600/30 text-slate-400'
          }`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
          {isConnected ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* Access Denied Guard */}
      {(!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) && !authLoading && (
        <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <i className="ri-lock-2-line text-4xl text-rose-500"></i>
            </div>
            <h2 className="text-3xl font-black text-white mb-2">Access Restricted</h2>
            <p className="text-slate-400 mb-8">You do not have permission to view the Admin Dashboard. Current Role: <span className="text-white font-bold">{profile?.role || 'Guest'}</span></p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => navigate('/marketplace')} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors">
                Go to Marketplace
              </button>
              <button onClick={() => navigate('/login')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className="fixed top-32 right-6 z-50 animate-in slide-in-from-right fade-in duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-bold backdrop-blur-xl border ${notification.type === 'success' ? 'bg-emerald-600/90 border-emerald-500/50' :
            notification.type === 'error' ? 'bg-rose-600/90 border-rose-500/50' : 'bg-blue-600/90 border-blue-500/50'
            }`}>
            <i className={`text-xl ${notification.type === 'success' ? 'ri-checkbox-circle-line' : notification.type === 'error' ? 'ri-error-warning-line' : 'ri-information-line'}`}></i>
            <span className="text-sm">{notification.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 pt-32 pb-20">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-5xl font-black text-white mb-2 tracking-tight">Admin Dashboard</h1>
            <p className="text-slate-400 font-medium">Welcome back, <span className="text-blue-400 font-bold">{profile?.full_name}</span></p>
            <p className="text-slate-500 text-sm mt-1">Last updated: {lastUpdate.toLocaleTimeString()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowAddAdminModal(true)}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold border border-slate-700 transition-all flex items-center gap-2"
            >
              <i className="ri-shield-user-line text-blue-400"></i>
              Manage Access
            </button>
            <button
              onClick={fetchData}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold shadow-xl shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <i className="ri-refresh-line"></i>
            </button>
          </div>
        </div>


        {/* PROMINENT ALERTS - SMS & Pending Applications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {/* SMS Balance Alert */}
          <div className={`relative overflow-hidden rounded-2xl p-8 border-2 ${stats.smsBalance < 50
            ? 'bg-gradient-to-br from-rose-600/20 to-rose-700/20 border-rose-500/50'
            : 'bg-gradient-to-br from-violet-600/20 to-violet-700/20 border-violet-500/50'
            }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-xl ${stats.smsBalance < 50 ? 'bg-rose-500/20' : 'bg-violet-500/20'} flex items-center justify-center`}>
                    <i className={`ri-message-3-line text-3xl ${stats.smsBalance < 50 ? 'text-rose-400' : 'text-violet-400'}`}></i>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS Balance</p>
                    <p className={`text-4xl font-black ${stats.smsBalance < 50 ? 'text-rose-400' : 'text-violet-400'}`}>
                      {stats.smsBalance}
                    </p>
                  </div>
                </div>
                <Link
                  to="/admin/sms"
                  className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${stats.smsBalance < 50
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20'
                    : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20'
                    }`}
                >
                  {stats.smsBalance < 50 ? 'Top Up Now' : 'Manage SMS'}
                </Link>
              </div>
              {stats.smsBalance < 50 && (
                <div className="flex items-center gap-2 text-rose-300 text-sm font-bold">
                  <i className="ri-alert-line animate-pulse"></i>
                  <span>Low balance! Please top up to continue sending messages.</span>
                </div>
              )}
            </div>
          </div>

          {/* Pending Applications Alert */}
          <div className={`relative overflow-hidden rounded-2xl p-8 border-2 ${pendingApps.length > 0
            ? 'bg-gradient-to-br from-amber-600/20 to-amber-700/20 border-amber-500/50'
            : 'bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border-emerald-500/50'
            }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-xl ${pendingApps.length > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20'} flex items-center justify-center`}>
                    <i className={`ri-file-list-3-line text-3xl ${pendingApps.length > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}></i>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Applications</p>
                    <p className={`text-4xl font-black ${pendingApps.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {pendingApps.length}
                    </p>
                  </div>
                </div>
                {pendingApps.length > 0 ? (
                  <button
                    onClick={() => setActiveTab('applications')}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-500/20"
                  >
                    Review Now
                  </button>
                ) : (
                  <div className="px-6 py-3 bg-emerald-600/20 text-emerald-400 rounded-xl font-bold text-sm flex items-center gap-2">
                    <i className="ri-checkbox-circle-line"></i>
                    All Clear
                  </div>
                )}
              </div>
              {pendingApps.length > 0 && (
                <div className="flex items-center gap-2 text-amber-300 text-sm font-bold">
                  <i className="ri-notification-3-line animate-pulse"></i>
                  <span>{pendingApps.length} seller application{pendingApps.length !== 1 ? 's' : ''} awaiting your review</span>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Stats Grid - User Roles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
          {[
            { label: 'Total Users', value: stats.users, icon: 'ri-group-line', gradient: 'from-blue-600 to-blue-700', iconBg: 'bg-blue-500/10', iconColor: 'text-blue-400' },
            { label: 'Total Admins', value: stats.admins, icon: 'ri-shield-user-line', gradient: 'from-emerald-600 to-emerald-700', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400' },
            { label: 'Total Buyers', value: stats.buyers, icon: 'ri-shopping-cart-line', gradient: 'from-cyan-600 to-cyan-700', iconBg: 'bg-cyan-500/10', iconColor: 'text-cyan-400' },
            { label: 'Total Sellers', value: stats.sellers, icon: 'ri-store-2-line', gradient: 'from-violet-600 to-violet-700', iconBg: 'bg-violet-500/10', iconColor: 'text-violet-400' },
            { label: 'News Publishers', value: stats.publishers, icon: 'ri-quill-pen-line', gradient: 'from-purple-600 to-purple-700', iconBg: 'bg-purple-500/10', iconColor: 'text-purple-400' }
          ].map((stat, i) => (
            <div key={i} className="group relative overflow-hidden bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600 transition-all">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center ${stat.iconColor} group-hover:scale-110 transition-transform`}>
                    <i className={`${stat.icon} text-lg`}></i>
                  </div>
                  <div className={`text-2xl font-black ${stat.iconColor}`}>{stat.value.toLocaleString()}</div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabbed Navigation */}
        <div className="flex border-b border-slate-700/50 mb-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: 'ri-dashboard-2-line' },
            { id: 'applications', label: 'Applications', icon: 'ri-file-list-3-line', badge: pendingApps.length },
            { id: 'products', label: 'Products', icon: 'ri-shopping-bag-3-line' },
            { id: 'analytics', label: 'Analytics', icon: 'ri-line-chart-line' },
            { id: 'activity', label: 'Activity', icon: 'ri-history-line' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative px-8 py-4 flex items-center gap-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
              {tab.badge ? (
                <span className="ml-2 px-2 py-0.5 bg-rose-500 text-white text-[10px] rounded-full animate-pulse font-black">{tab.badge}</span>
              ) : null}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400 rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-2 space-y-6">
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                  <h3 className="text-xl font-black text-white mb-6">Quick Actions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Users', path: '/admin/users', icon: 'ri-user-settings-line', color: 'blue' },
                      { label: 'Applications', path: '/admin/seller-applications', icon: 'ri-file-list-3-line', color: 'amber', badge: pendingApps.length },
                      { label: 'News', path: '/admin/news', icon: 'ri-newspaper-line', color: 'emerald' },
                      { label: 'Newsletter', path: '/admin/newsletter', icon: 'ri-mail-send-line', color: 'cyan' },
                      { label: 'CMS', path: '/admin/content', icon: 'ri-pages-line', color: 'indigo' },
                      { label: 'SMS', path: '/admin/sms', icon: 'ri-message-3-line', color: 'violet' },
                      { label: 'Messages', path: '/admin/messages', icon: 'ri-chat-3-line', color: 'pink' },
                      { label: 'Support', path: '/admin/support', icon: 'ri-customer-service-2-line', color: 'orange', badge: stats.tickets },
                      { label: 'Ads', path: '/admin/ads', icon: 'ri-advertisement-line', color: 'rose' },
                      { label: 'Polls', path: '/admin/polls', icon: 'ri-bar-chart-box-line', color: 'teal' },
                      { label: 'Subscriptions', path: '/admin/subscriptions', icon: 'ri-vip-crown-line', color: 'yellow' },
                      { label: 'Activity', path: '/admin/activity', icon: 'ri-pulse-line', color: 'red' },
                      { label: 'Roles', path: '/admin/roles', icon: 'ri-admin-line', color: 'purple' },
                      { label: 'Settings', path: '/admin/settings', icon: 'ri-settings-4-line', color: 'slate' }
                    ].map((action, i) => (
                      <Link
                        key={i}
                        to={action.path}
                        className="relative group bg-slate-900/50 hover:bg-slate-900 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-6 transition-all"
                      >
                        {action.badge ? (
                          <span className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white text-xs font-black rounded-full flex items-center justify-center animate-pulse">
                            {action.badge}
                          </span>
                        ) : null}
                        <div className={`w-12 h-12 rounded-xl bg-${action.color}-500/10 flex items-center justify-center text-${action.color}-400 mb-4 group-hover:scale-110 transition-transform`}>
                          <i className={`${action.icon} text-2xl`}></i>
                        </div>
                        <h4 className="font-black text-white text-sm">{action.label}</h4>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 relative overflow-hidden">
                    <i className="ri-customer-service-2-line absolute -right-4 -bottom-4 text-white/10 text-8xl"></i>
                    <div className="relative">
                      <p className="text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">Support</p>
                      <div className="text-4xl font-black text-white mb-1">{stats.tickets}</div>
                      <Link to="/admin/support" className="text-xs font-bold text-blue-200 hover:text-white transition-colors">Manage →</Link>
                    </div>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 relative overflow-hidden">
                    <i className="ri-newspaper-line absolute -right-4 -bottom-4 text-white/5 text-8xl"></i>
                    <div className="relative">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">News Articles</p>
                      <div className="text-4xl font-black text-blue-400 mb-1">{stats.news}</div>
                      <Link to="/admin/news" className="text-xs font-bold text-slate-400 hover:text-white transition-colors">Manage →</Link>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider mb-6">System Status</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Online Users</p>
                        <p className="text-2xl font-black text-emerald-400">{stats.onlineUsers}</p>
                      </div>
                      <i className="ri-radar-line text-3xl text-emerald-400 animate-pulse"></i>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">SMS Sent</p>
                        <p className="text-2xl font-black text-violet-400">{stats.smsSent}</p>
                      </div>
                      <i className="ri-send-plane-fill text-3xl text-violet-400"></i>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider mb-6">Recent Activity</h4>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {recentLogs.slice(0, 10).map((log, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-all">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-slate-400">
                          <i className="ri-flashlight-line text-xs"></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-300 truncate">{log.action_type?.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{new Date(log.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-6">
              <h3 className="text-xl font-black text-white mb-6">Product Management ({allProducts.length})</h3>
              <div className="grid grid-cols-1 gap-4">
                {allProducts.map((product) => (
                  <div key={product.id} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center hover:border-slate-600 transition-all">
                    <div className="w-16 h-16 rounded-xl bg-slate-700/50 overflow-hidden flex-shrink-0">
                      {product.images?.[0] ? (
                        <img src={getOptimizedImageUrl(product.images[0], 100, 80)} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><i className="ri-image-line text-slate-500"></i></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-center md:text-left">
                      <div className="flex items-center gap-3 justify-center md:justify-start mb-1">
                        <h4 className="font-bold text-white truncate">{product.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black ${product.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                          {product.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span><i className="ri-store-2-line text-blue-400 mr-1"></i>{product.seller?.full_name || 'Unknown Seller'}</span>
                        <span><i className="ri-price-tag-3-line text-emerald-400 mr-1"></i>GH₵ {product.price}</span>
                        <span><i className="ri-eye-line text-amber-400 mr-1"></i>{product.views_count || 0} views</span>
                        <span><i className="ri-calendar-line text-slate-400 mr-1"></i>{new Date(product.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleProductToggle(product.id, product.is_active)}
                        disabled={!!processing}
                        className={`px-4 py-2 rounded-xl font-bold text-xs uppercase transition-all ${product.is_active ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
                        title={product.is_active ? 'Deactivate Product' : 'Activate Product'}
                      >
                        {processing === product.id ? <i className="ri-loader-4-line animate-spin"></i> : (product.is_active ? 'Hide' : 'Show')}
                      </button>
                      <button
                        onClick={() => handleProductDelete(product.id)}
                        disabled={!!processing}
                        className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl font-bold text-xs uppercase transition-all"
                        title="Delete Permanently"
                      >
                        {processing === product.id ? <i className="ri-loader-4-line animate-spin"></i> : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
                {allProducts.length === 0 && (
                  <div className="p-12 text-center text-slate-500 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                    <i className="ri-dropbox-line text-4xl mb-3 block"></i>
                    No products found
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white">Seller Applications ({applications.length})</h3>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-bold">Pending: {stats.pending}</span>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-bold">Approved: {stats.approved}</span>
                  <span className="px-3 py-1 bg-rose-500/10 text-rose-400 rounded-lg text-xs font-bold">Rejected: {stats.rejected}</span>
                </div>
              </div>

              {applications.length === 0 ? (
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-20 text-center">
                  <i className="ri-file-list-3-line text-6xl text-slate-700 mb-4 block"></i>
                  <h3 className="text-2xl font-black text-slate-400">No Applications Yet</h3>
                  <p className="text-slate-500 mt-2">Seller applications will appear here</p>
                </div>
              ) : (
                applications.map((app) => (
                  <div key={app.id} className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 flex flex-col xl:flex-row items-center gap-8 hover:border-slate-600 transition-all">
                    <div className="w-20 h-20 rounded-2xl bg-slate-700/50 overflow-hidden flex-shrink-0 shadow-lg border border-slate-600/50">
                      {app.business_logo ? (
                        <img src={getOptimizedImageUrl(app.business_logo, 100, 100)} alt={app.business_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 text-white text-3xl font-black">
                          {app.user?.full_name?.charAt(0) || app.business_name?.charAt(0) || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-center xl:text-left min-w-0">
                      <div className="flex items-center gap-3 justify-center xl:justify-start mb-2">
                        <h4 className="text-2xl font-black text-white truncate">{app.business_name}</h4>
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${app.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                          app.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-rose-500/20 text-rose-400'
                          }`}>
                          {app.status}
                        </span>
                      </div>
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mb-2">{app.business_category || 'General'} • {new Date(app.created_at).toLocaleDateString()}</p>
                      <p className="text-slate-400 text-sm line-clamp-2 mb-4 max-w-2xl mx-auto xl:mx-0">{app.business_description}</p>
                      <div className="flex flex-wrap justify-center xl:justify-start gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><i className="ri-user-line text-blue-400"></i>{app.user?.full_name}</div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><i className="ri-mail-line text-blue-400"></i>{app.contact_email}</div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><i className="ri-phone-line text-blue-400"></i>{app.contact_phone}</div>
                      </div>
                    </div>
                    {app.status === 'pending' && (
                      <div className="flex gap-3 w-full xl:w-auto">
                        <button
                          onClick={() => handleApprove(app.id, app.user_id)}
                          disabled={!!processing}
                          className="flex-1 xl:px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                        >
                          {processing === app.id ? <i className="ri-loader-4-line animate-spin"></i> : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(app.id)}
                          disabled={!!processing}
                          className="flex-1 xl:px-8 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                <h3 className="text-2xl font-black text-white mb-10 text-center uppercase tracking-tight">Platform Growth</h3>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.recentGrowth}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} stroke="#334155" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                  <h4 className="text-xl font-black text-white mb-8 border-l-4 border-emerald-500 pl-4">Faculty Distribution</h4>
                  <div className="space-y-6">
                    {analyticsData.faculties.map((f, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                          <span>{f.name}</span>
                          <span>{f.count}</span>
                        </div>
                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${(f.count / stats.users) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                  <h4 className="text-xl font-black text-white mb-8 border-l-4 border-blue-500 pl-4">Top Departments</h4>
                  <div className="space-y-2">
                    {analyticsData.departments.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl hover:bg-slate-900 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-sm text-blue-400 shadow-sm">
                            {i + 1}
                          </div>
                          <span className="text-sm font-bold text-slate-200">{d.name}</span>
                        </div>
                        <span className="text-xs font-black text-blue-400 uppercase">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                  <h4 className="text-xl font-black text-white mb-8 border-l-4 border-violet-500 pl-4">User Roles</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Buyers', value: stats.buyers },
                            { name: 'Sellers', value: stats.sellers },
                            { name: 'Admins', value: stats.admins },
                            { name: 'Publishers', value: stats.publishers }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                  <h4 className="text-xl font-black text-white mb-8 border-l-4 border-amber-500 pl-4">Application Status</h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Pending', value: stats.pending, color: 'amber' },
                      { label: 'Approved', value: stats.approved, color: 'emerald' },
                      { label: 'Rejected', value: stats.rejected, color: 'rose' }
                    ].map((stat, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full bg-${stat.color}-500`}></div>
                          <span className="text-sm font-bold text-slate-300">{stat.label}</span>
                        </div>
                        <span className={`text-xl font-black text-${stat.color}-400`}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
              <div className="p-8 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-800/50 flex justify-between items-center">
                <h3 className="text-2xl font-black text-white uppercase tracking-tight">System Audit Trail</h3>
                <div className="px-4 py-2 bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-2 border border-rose-500/30">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span> Live
                </div>
              </div>
              <div className="overflow-x-auto pb-4">
                <table className="w-full">
                  <thead className="bg-slate-900/50 border-b border-slate-700">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="px-8 py-6 text-left">User</th>
                      <th className="px-8 py-6 text-left">Action</th>
                      <th className="px-8 py-6 text-left">Timestamp</th>
                      <th className="px-8 py-6 text-right">ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {recentLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center font-black text-slate-400">
                              {log.user?.full_name?.charAt(0) || 'S'}
                            </div>
                            <span className="text-sm font-black text-white">{log.user?.full_name || 'System'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {log.action_type?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-bold text-slate-300">{new Date(log.created_at).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-[10px] text-slate-500">#{log.id.slice(0, 8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Access Manager Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6 text-4xl">
                <i className="ri-shield-user-line"></i>
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight">Access Control</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Elevate user privileges</p>
            </div>

            <div className="space-y-6">
              <div className="relative">
                <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 text-lg"></i>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={adminSearchTerm}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 rounded-3xl bg-slate-800 border border-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all font-bold text-sm text-white placeholder-slate-500"
                />
              </div>

              {adminSearchResults.length > 0 && !selectedAdminUser && (
                <div className="bg-slate-800 rounded-3xl overflow-hidden border border-slate-700">
                  {adminSearchResults.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedAdminUser(u)}
                      className="w-full flex items-center gap-4 p-5 hover:bg-slate-700 transition-all text-left border-b border-slate-700 last:border-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-black">{u.full_name.charAt(0)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-white truncate">{u.full_name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{u.role}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedAdminUser && (
                <div className="p-6 bg-blue-600 rounded-3xl text-white flex items-center gap-4 animate-in zoom-in-95 shadow-xl">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-black text-xl">{selectedAdminUser.full_name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black uppercase opacity-60">Selected</div>
                    <div className="font-black truncate">{selectedAdminUser.full_name}</div>
                  </div>
                  <button onClick={() => setSelectedAdminUser(null)} className="p-2 hover:scale-110 transition-transform"><i className="ri-close-circle-fill text-2xl"></i></button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-10">
              <button onClick={() => setShowAddAdminModal(false)} className="py-5 rounded-2xl bg-slate-800 text-slate-300 font-black text-[10px] uppercase tracking-wider hover:bg-slate-700 transition-all">Cancel</button>
              <button
                onClick={handleAddAdmin}
                disabled={!selectedAdminUser || processing === 'add-admin'}
                className="py-5 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-wider hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {processing === 'add-admin' ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
