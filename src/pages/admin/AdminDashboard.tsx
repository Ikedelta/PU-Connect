import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type SellerApplication, type Profile, type Product } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';
import SellerApplications from './SellerApplications';
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
import AdminProductCreator from '../../components/admin/AdminProductCreator';

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

  const [applications, setApplications] = useState<(SellerApplication & { profiles: Profile })[]>([]);
  const [allProducts, setAllProducts] = useState<(Product & { seller: Profile })[]>([]);
  const [smsHistory, setSmsHistory] = useState<SMSHistory[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [topupHistory, setTopupHistory] = useState<any[]>([]);
  const [recentSubscribers, setRecentSubscribers] = useState<any[]>([]);

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
    cancelled: 0,
    news: 0,
    tickets: 0,
    smsBalance: 0,
    smsSent: 0,
    onlineUsers: 0,
    smsEnabled: true,
    newsletter: 0,
    total_products: 0,
    subscriptionRequired: true
  });

  const [onlinePresence, setOnlinePresence] = useState<{
    total: number;
    buyers: number;
    sellers: number;
    admins: number;
  }>({ total: 0, buyers: 0, sellers: 0, admins: 0 });

  const [analyticsData, setAnalyticsData] = useState<{
    faculties: { name: string, count: number }[],
    departments: { name: string, count: number }[],
    recentGrowth: { date: string, count: number }[]
  }>({ faculties: [], departments: [], recentGrowth: [] });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'products' | 'analytics' | 'activity' | 'sms' | 'settings'>('overview');
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
  const [isSmsLoading, setIsSmsLoading] = useState(false);
  const [isProductCreatorOpen, setIsProductCreatorOpen] = useState(false);
  const [smsTemplates, setSmsTemplates] = useState<{ key: string, value: string, description: string }[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<{ key: string, value: string } | null>(null);

  const pendingApps = applications.filter(app => app.status?.toLowerCase() === 'pending');
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  useEffect(() => {
    if (authLoading) return;

    // If no profile or not admin, show access denied instead of random redirect
    if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return;
    }

    // Initial load: Show loaders
    fetchData(false);

    // Real-time subscriptions
    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_applications' }, (payload) => {
        console.log('Real-time: Application change', payload);
        if (payload.eventType === 'INSERT') {
          setNotification({ type: 'info', message: '🔔 New seller application received!' });
        }
        fetchData(true); // Real-time update: Silent
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => fetchActivityLogs())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `action_type=eq.sms_sent` }, () => fetchSMSHistory())
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    const presenceChannel = supabase.channel('online-presence');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineProfiles = Object.values(state).flat() as any[];

        setOnlinePresence({
          total: onlineProfiles.length,
          buyers: onlineProfiles.filter(p => p.role === 'buyer').length,
          sellers: onlineProfiles.filter(p => p.role === 'seller' || p.role === 'publisher_seller').length,
          admins: onlineProfiles.filter(p => p.role === 'admin' || p.role === 'super_admin').length
        });

        setStats(prev => ({ ...prev, onlineUsers: onlineProfiles.length }));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Alert admin about new user
        newPresences.forEach((presence: any) => {
          // Avoid alerting for self
          if (presence.user_id !== profile?.id) {
            setNotification({ type: 'info', message: `🟢 User Online: ${presence.full_name || 'Anonymous User'}` });
          }
        });
      })
      .subscribe();

    const interval = setInterval(() => {
      fetchData(true); // Background refresh: Silent
      setLastUpdate(new Date());
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
      clearInterval(interval);
    };
  }, [profile?.id, authLoading]);

  // Session Enforcement Heartbeat
  useEffect(() => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');
    const token = localStorage.getItem('sys_admin_session_token');

    if (!isBypass || !secret || !token) return;

    const pingSession = async () => {
      const { data, error } = await supabase.rpc('sys_ping_admin_session', {
        secret_key: secret,
        s_token: token
      });

      if (error || (data && !data.success)) {
        console.error('Session Heartbeat Failed:', error || data?.message);
        alert(data?.message || 'Access Denied: Your administrator session has been taken over by another user or has timed out.');
        localStorage.removeItem('sys_admin_bypass');
        localStorage.removeItem('sys_admin_secret');
        localStorage.removeItem('sys_admin_session_token');
        window.location.assign('/login');
      }
    };

    // Ping every 1 minute
    const pingInterval = setInterval(pingSession, 60000);

    // Initial ping on mount to verify session is still valid
    pingSession();

    return () => clearInterval(pingInterval);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);


  const fetchSMSBalance = async (silent = false) => {
    if (!silent) setIsSmsLoading(true);
    try {
      const { getSMSBalance } = await import('../../lib/arkesel');
      const balance = await getSMSBalance();
      console.log('📱 SMS Balance:', balance);
      setStats(prev => ({ ...prev, smsBalance: balance }));
    } catch (err) {
      console.error('SMS balance error:', err);
    } finally {
      if (!silent) setIsSmsLoading(false);
    }
  };

  const fetchSMSHistory = async () => {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('*, user:profiles!user_id(full_name)')
        .eq('action_type', 'sms_sent')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setSmsHistory(data as any);
        setStats(prev => ({ ...prev, smsSent: data.length }));
      }
    } catch (err) {
      console.error('SMS history error:', err);
    }
  };

  const fetchSMSTemplates = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('*')
        .ilike('key', 'sms_template_%');
      if (data) setSmsTemplates(data);
    } catch (err) {
      console.error('SMS templates error:', err);
    }
  };

  const saveSMSTemplate = async () => {
    if (!editingTemplate) return;
    setProcessing('save-template');
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({ value: editingTemplate.value })
        .eq('key', editingTemplate.key);
      if (error) throw error;
      setNotification({ type: 'success', message: 'SMS template updated successfully' });
      fetchSMSTemplates();
      setEditingTemplate(null);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setProcessing(null);
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

  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) console.log('📊 Fetching dashboard data...');

      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

      const [appsRes, usersRes, sellersRes, adminsRes, publishersRes, productsCountRes, servicesCountRes, newsRes, ticketsRes, logsRes, analyticsRes, allProductsRes, settingsRes, buyersRes, newsletterRes, totalProductsRes, topupsRes, newSubsRes, platformSettingsRes, pendingAppsRes, approvedAppsRes, rejectedAppsRes, cancelledAppsRes] = await Promise.all([
        supabase.from('seller_applications').select('*, user:profiles!user_id(*)').order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('seller_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['admin', 'super_admin']),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['news_publisher', 'publisher_seller']),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('category', 'product'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('category', 'service'),
        supabase.from('campus_news').select('id', { count: 'exact', head: true }).eq('is_published', true),
        (isBypass
          ? supabase.rpc('sys_get_support_tickets', { secret_key: secret }).then((res: any) => {
            const tickets = res.data || [];
            const pendingCount = tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
            return { count: pendingCount, error: res.error, data: null };
          })
          : supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress'])
        ),
        supabase.from('activity_logs').select('*, user:profiles!user_id(full_name)').order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('faculty, department, created_at').order('created_at', { ascending: false }).limit(1000),
        supabase.from('products').select('*, seller:profiles!products_seller_id_fkey(full_name, email, phone)').order('created_at', { ascending: false }).limit(50),
        (isBypass
          ? supabase.rpc('sys_get_website_settings', { secret_key: secret }).then((res: any) => ({ data: res.data || { enable_sms: true }, error: res.error }))
          : supabase.from('website_settings').select('enable_sms').single()
        ),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'buyer'),
        (isBypass
          ? supabase.rpc('sys_get_subs_count', { secret_key: secret }).then((res: any) => ({ count: res.data ?? 0, error: res.error, data: null }))
          : supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true })
        ),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('sms_topups').select('*').order('created_at', { ascending: false }).limit(20),
        (isBypass
          ? supabase.rpc('sys_get_subs_list', { secret_key: secret }).limit(5)
          : supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }).limit(5)
        ),
        supabase.from('platform_settings').select('value').eq('key', 'subscriptions_enabled').maybeSingle(),
        supabase.from('seller_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('seller_applications').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('seller_applications').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('seller_applications').select('id', { count: 'exact', head: true }).eq('status', 'cancelled')
      ]);

      if (logsRes.data) setRecentLogs(logsRes.data);

      if (allProductsRes.data) {
        setAllProducts(allProductsRes.data as any || []);
      }

      if (topupsRes.data) {
        setTopupHistory(topupsRes.data);
      }

      // Process Recent Subscribers from single table
      if (newSubsRes.error) console.error('Recent Subscribers Error:', newSubsRes.error);
      if (newsletterRes.error) console.error('Newsletter Count Error:', newsletterRes.error);

      setRecentSubscribers(newSubsRes.data || []);

      // Handle Applications - Robust Error Handling
      let fetchedApps = appsRes.data || [];
      if (appsRes.error) {
        console.error('Applications fetch error:', appsRes.error);
        // Fallback: If join fails, try fetching without profile join
        const { data: simpleApps } = await supabase.from('seller_applications').select('*').order('created_at', { ascending: false }).limit(50);
        fetchedApps = simpleApps || [];
      }
      setApplications(fetchedApps as any);

      // Stats Calculation
      const totalSystemUsers = (buyersRes.count || 0) + (sellersRes.count || 0) + (adminsRes.count || 0) + (publishersRes.count || 0);
      const totalUsers = totalSystemUsers || usersRes.count || 0;

      const pendingCount = pendingAppsRes.count || 0;
      const approvedCount = approvedAppsRes.count || 0;
      const rejectedCount = rejectedAppsRes.count || 0;
      const cancelledCount = cancelledAppsRes.count || 0;

      setStats(prev => ({
        ...prev,
        users: totalUsers,
        sellers: sellersRes.count || 0,
        admins: adminsRes.count || 0,
        publishers: publishersRes.count || 0,
        buyers: buyersRes.count || 0,
        products_count: productsCountRes.count || 0,
        services_count: servicesCountRes.count || 0,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        cancelled: cancelledCount,
        news: newsRes.count || 0,
        tickets: ticketsRes.count || 0,
        smsEnabled: settingsRes.data?.enable_sms ?? true,
        subscriptionRequired: platformSettingsRes?.data?.value ?? true,
        newsletter: newsletterRes.count || (newsletterRes.data instanceof Array ? newsletterRes.data.length : 0),
        total_products: totalProductsRes.count || 0
      }));

      // Analytics
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

      await Promise.all([fetchSMSBalance(isBackground), fetchSMSHistory(), fetchSMSTemplates()]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const adminUpdateSettings = async (settingKey: string, value: boolean) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

    // Check if it's a platform setting
    if (settingKey === 'subscriptions_enabled') {
      if (isBypass && secret) {
        const { error } = await supabase.rpc('sys_update_platform_setting', {
          secret_key: secret,
          setting_key: settingKey,
          setting_value: value
        });
        return { error };
      }

      const { data: existing } = await supabase.from('platform_settings').select('key').eq('key', settingKey).maybeSingle();
      if (!existing) {
        return await supabase.from('platform_settings').insert({ key: settingKey, value });
      }
      return await supabase.from('platform_settings').update({ value }).eq('key', settingKey);
    }

    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_update_settings', { setting_key: settingKey, setting_value: value, secret_key: secret });
      return { error };
    }
    return await supabase.from('website_settings').update({ [settingKey]: value }).eq('site_name', 'Campus Marketplace');
  };

  const toggleSMS = async () => {
    try {
      const newValue = !stats.smsEnabled;
      setStats(prev => ({ ...prev, smsEnabled: newValue })); // Optimistic update

      const { error } = await adminUpdateSettings('enable_sms', newValue);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: `Global SMS Notifications ${newValue ? 'Enabled' : 'Disabled'}`
      });

    } catch (error: any) {
      setStats(prev => ({ ...prev, smsEnabled: !stats.smsEnabled })); // Revert
      alert('Failed to update SMS setting: ' + error.message);
    }
  };

  const toggleSubscription = async () => {
    try {
      const newValue = !stats.subscriptionRequired;
      setStats(prev => ({ ...prev, subscriptionRequired: newValue })); // Optimistic update

      const { error } = await adminUpdateSettings('subscriptions_enabled', newValue);

      if (error) throw error;

      setNotification({ type: 'success', message: `Seller Subscriptions ${newValue ? 'Required' : 'Bypassed'}` });
    } catch (error: any) {
      setStats(prev => ({ ...prev, subscriptionRequired: !stats.subscriptionRequired })); // Revert
      alert('Failed to update Subscription setting: ' + error.message);
    }
  };

  // Helpers for System Admin Bypass
  const adminUpdateProfile = async (targetId: string, updates: any) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';
    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_update_profile', { target_id: targetId, new_data: updates, secret_key: secret });
      return { error };
    }
    return await supabase.from('profiles').update(updates).eq('id', targetId);
  };

  const adminHideAllProducts = async (targetUserId: string) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';
    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_hide_all_products', { target_user_id: targetUserId, secret_key: secret });
      return { error };
    }
    return await supabase.from('products').update({ is_active: false }).eq('seller_id', targetUserId);
  };

  const adminUpdateApplication = async (appId: string, status: string) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';
    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_update_application', { app_id: appId, new_status: status, secret_key: secret });
      return { error };
    }
    return await supabase.from('seller_applications').update({ status, updated_at: new Date().toISOString() }).eq('id', appId);
  };

  const adminUpsertSellerProfile = async (targetUserId: string, businessName: string, businessCategory: string, businessLogo?: string, businessDescription?: string, contactPhone?: string, contactEmail?: string) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

    // Fallback description
    const description = businessDescription || `Welcome to ${businessName}!`;

    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_upsert_seller_profile', {
        target_user_id: targetUserId,
        initial_name: businessName,
        category: businessCategory,
        secret_key: secret
      });
      return { error };
    }
    return await supabase.from('seller_profiles').upsert({
      user_id: targetUserId,
      business_name: businessName,
      business_category: businessCategory,
      business_logo: businessLogo,
      business_description: businessDescription || description,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      is_active: true,
      created_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  };

  const handleApprove = async (application: any) => {
    const applicationId = application.id;
    const userId = application.user_id;
    const businessName = application.business_name;
    const businessCategory = application.business_category;
    setProcessing(applicationId);

    // Get description from application list
    const app = applications.find(a => a.id === applicationId);
    const description = app?.business_description || '';

    // OPTIMISTIC UPDATE
    setApplications(prev => prev.map(app =>
      app.id === applicationId ? { ...app, status: 'approved' } : app
    ));

    try {
      // 1. Approve Application
      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

      if (isBypass && secret) {
        const { error } = await supabase.rpc('admin_update_application', { app_id: applicationId, new_status: 'approved', secret_key: secret });
        if (error) throw error;
      } else {
        // Standard Admin Update
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile?.id || '');
        const reviewedBy = isValidUUID ? profile?.id : null;

        const { error: appError } = await supabase
          .from('seller_applications')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: reviewedBy,
            updated_at: new Date().toISOString()
          })
          .eq('id', applicationId);

        if (appError) throw appError;
      }

      // 2. Grant Seller Role (Smart Role Transition)
      const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', userId).single();
      let newRole = 'seller';

      // If user is already a publisher (or dual role), assign dual role
      if (currentProfile?.role === 'news_publisher' || currentProfile?.role === 'publisher_seller') {
        newRole = 'publisher_seller';
      } else if (currentProfile?.role === 'admin' || currentProfile?.role === 'super_admin') {
        newRole = currentProfile.role; // Admins keep their higher-level role
      }

      const { error: profileError } = await adminUpdateProfile(userId, { role: newRole });
      if (profileError) throw profileError;

      // 3. Create Seller Profile Entry
      const { error: sellerProfileError } = await adminUpsertSellerProfile(
        userId,
        businessName || 'New Business',
        businessCategory || 'General',
        application.business_logo,
        application.business_description,
        application.contact_phone,
        application.contact_email
      );
      if (sellerProfileError) throw sellerProfileError;

      // 4. Activity Logging
      try {
        await supabase.from('activity_logs').insert({
          user_id: profile?.id,
          action_type: 'application_approved',
          action_details: {
            business_name: businessName,
            applicant_id: userId
          }
        });
      } catch (logErr) {
        console.error('Error logging approval:', logErr);
      }

      // 5. Send Notification
      const { data: userData } = await supabase.from('profiles').select('phone, full_name').eq('id', userId).single();
      if (userData?.phone) {
        try {
          const { sendSMS } = await import('../../lib/arkesel');
          const firstName = userData.full_name?.split(' ')[0] || 'User';
          await sendSMS(
            [userData.phone],
            `Congratulations ${firstName}! Your seller application for "${application.business_name}" has been APPROVED.`,
            'seller_approval',
            { name: firstName, business_name: application.business_name }
          );
        } catch (smsErr) {
          console.error('Failed to send approval SMS:', smsErr);
        }
      }

      setNotification({ type: 'success', message: 'Application approved and user promoted to Seller' });

      // Ensure data consistency
      setTimeout(() => fetchData(true), 500);

    } catch (err: any) {
      console.error('Approval error:', err);
      // Revert Optimistic Update
      setApplications(prev => prev.map(app =>
        app.id === applicationId ? { ...app, status: 'pending' } : app
      ));
      setNotification({ type: 'error', message: err.message || 'Failed to approve application' });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (applicationId: string) => {
    // Find the application details first for logging
    const app = applications.find(a => a.id === applicationId);
    if (!confirm(`Reject application for ${app?.business_name}?`)) return;

    setProcessing(applicationId);

    // Optimistic Update
    setApplications(prev => prev.map(app =>
      app.id === applicationId ? { ...app, status: 'rejected' } : app
    ));

    try {
      const { error } = await adminUpdateApplication(applicationId, 'rejected');
      if (error) throw error;

      // Log Activity
      try {
        await supabase.from('activity_logs').insert({
          user_id: profile?.id,
          action_type: 'application_rejected',
          action_details: {
            business_name: app?.business_name || 'Unknown',
            applicant_id: app?.user_id
          }
        });
      } catch (logErr) {
        console.error('Error logging rejection:', logErr);
      }

      setNotification({ type: 'info', message: 'Application rejected' });
      setTimeout(() => fetchData(true), 500);
    } catch (err: any) {
      // Revert Optimistic Update
      setApplications(prev => prev.map(app =>
        app.id === applicationId ? { ...app, status: 'pending' } : app
      ));
      setNotification({ type: 'error', message: err.message });
    } finally {
      setProcessing(null);
    }
  };

  const handleProductToggle = async (productId: string, currentStatus: boolean) => {
    setProcessing(productId);
    try {
      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret');

      if (isBypass && secret) {
        const { error } = await supabase.rpc('admin_update_product', {
          product_id: productId,
          product_data: { is_active: !currentStatus },
          secret_key: secret
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').update({ is_active: !currentStatus }).eq('id', productId);
        if (error) throw error;
      }

      setAllProducts(prev => prev.map(p => p.id === productId ? { ...p, is_active: !currentStatus } : p));
      setNotification({ type: 'success', message: `Product ${!currentStatus ? 'Activated' : 'Hidden'} successfully` });
      fetchData(true);
    } catch (err: any) {
      console.error('Toggle error', err);
      alert(err.message || 'Failed to toggle product status');
    } finally {
      setProcessing(null);
    }
  };

  const handleProductDelete = async (productId: string) => {
    if (!confirm('Permanently delete this product?')) return;
    setProcessing(productId);
    try {
      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret');

      if (isBypass && secret) {
        const { error } = await supabase.rpc('admin_delete_product', {
          target_id: productId,
          secret_key: secret
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').delete().eq('id', productId);
        if (error) throw error;
      }

      setAllProducts(prev => prev.filter(p => p.id !== productId));
      setNotification({ type: 'success', message: 'Product deleted successfully' });
      fetchData(true);
    } catch (err: any) {
      console.error('Delete error', err);
      alert(err.message || 'Failed to delete product');
    } finally {
      setProcessing(null);
    }
  };

  const handleSearchUsers = (term: string) => {
    setAdminSearchTerm(term);
    if (term.length > 2) {
      supabase.from('profiles').select('*').ilike('full_name', `%${term}%`).limit(5)
        .then(({ data }) => setAdminSearchResults(data || []));
    } else {
      setAdminSearchResults([]);
    }
  };

  const handleAddAdmin = async () => {
    if (!selectedAdminUser) return;
    try {
      const { error } = await adminUpdateProfile(selectedAdminUser.id, { role: 'admin' });
      if (error) throw error;

      // Notify new admin
      if (selectedAdminUser.phone) {
        try {
          const { sendSMS } = await import('../../lib/arkesel');
          await sendSMS(
            [selectedAdminUser.phone],
            `Congratulations! You have been promoted to an Administrator on Campus Connect.`,
            'admin_promo'
          );
        } catch (smsErr) {
          console.error('Failed to send admin promo SMS:', smsErr);
        }
      }

      setNotification({ type: 'success', message: `${selectedAdminUser.full_name} is now an Admin` });
      setShowAddAdminModal(false);
      setSelectedAdminUser(null);
      setAdminSearchTerm('');
      fetchData(); // Refresh stats
      setSelectedAdminUser(null);
      fetchData(true);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };


  return (
    <div className="min-h-screen bg-[#0B1120] bg-admin-pattern text-slate-200 font-sans selection:bg-blue-500/30">
      <Navbar />

      {/* Real-time Status - Pill Design */}
      <div className="fixed top-24 right-6 z-40 animate-fade-in">
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 backdrop-blur-md border shadow-2xl transition-all duration-500 ${isConnected
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/10'
          : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_currentColor]' : 'bg-rose-500'}`}></span>
          {isConnected ? 'System Online' : 'Reconnecting...'}
        </div>
      </div>

      {/* Access Denied Guard */}
      {(!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) && !authLoading && (
        <div className="fixed inset-0 z-50 bg-[#0B1120]/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full opacity-50"></div>
            <div className="relative z-10">
              <div className="w-24 h-24 bg-gradient-to-br from-rose-500 to-orange-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-rose-500/20 rotate-3 hover:rotate-6 transition-transform">
                <i className="ri-shield-keyhole-line text-4xl text-white"></i>
              </div>
              <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Restricted Area</h2>
              <p className="text-slate-400 mb-8 font-medium leading-relaxed">This admin dashboard is restricted to authorized personnel only. Your access attempt has been logged.</p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => navigate('/marketplace')} className="px-8 py-3.5 bg-slate-800/50 border border-white/10 text-white rounded-xl font-bold hover:bg-slate-800 hover:border-white/20 transition-all uppercase tracking-widest text-xs">
                  Return Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {notification && (
        <div className="fixed top-32 right-6 z-50 animate-slide-in-right">
          <div className={`px-6 py-4 rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] flex items-center gap-4 text-white font-bold backdrop-blur-2xl border ${notification.type === 'success' ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-100' :
            notification.type === 'error' ? 'bg-rose-600/20 border-rose-500/50 text-rose-100' : 'bg-blue-600/20 border-blue-500/50 text-blue-100'
            }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
              }`}>
              <i className={`text-lg ${notification.type === 'success' ? 'ri-check-line' : notification.type === 'error' ? 'ri-close-line' : 'ri-info-i'}`}></i>
            </div>
            <span className="text-sm tracking-wide">{notification.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-[1800px] mx-auto px-6 lg:px-12 pt-32 pb-72">

        {/* Dashboard Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 relative">
          {/* Decorative BG */}
          <div className="absolute top-[-20%] left-[-10%] w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

          <div className="relative z-10">
            <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter leading-[0.9]">
              Admin <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400">Dashboard.</span>
            </h1>
            <p className="text-slate-400 font-medium max-w-lg text-sm">
              Welcome back, <span className="text-white font-bold border-b-2 border-blue-500/30 pb-0.5">{profile?.full_name}</span>.
              System is running optimally.
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              <Link to="/admin/email-templates" className="px-4 py-2 rounded-lg bg-slate-800/50 border border-white/5 hover:border-blue-500/30 text-slate-300 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all flex items-center gap-2 group">
                <i className="ri-layout-3-line text-blue-500 group-hover:scale-110 transition-transform"></i> Email Templates
              </Link>
              <Link to="/admin/internships" className="px-4 py-2 rounded-lg bg-slate-800/50 border border-white/5 hover:border-purple-500/30 text-slate-300 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all flex items-center gap-2 group">
                <i className="ri-briefcase-4-line text-purple-500 group-hover:scale-110 transition-transform"></i> Jobs & Internships
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <button
              onClick={() => setShowAddAdminModal(true)}
              className="h-12 px-6 rounded-xl bg-slate-800/40 border border-white/5 text-white font-bold hover:bg-slate-800 transition-all flex items-center gap-3 group backdrop-blur-sm"
            >
              <span className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <i className="ri-shield-user-fill text-xs"></i>
              </span>
              <span className="text-xs uppercase tracking-wide">Access Control</span>
            </button>

            <button
              onClick={() => fetchData(false)}
              className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <i className={`ri-refresh-line text-lg ${loading ? 'animate-spin' : ''}`}></i>
            </button>
          </div>
        </div>


        {/* Overview Stats Grid */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">

              {/* Total Users - Glass Card */}
              <Link to="/admin/users" className="relative group overflow-hidden rounded-2xl bg-[#131c31] border border-white/5 p-5 transition-all duration-500 hover:border-blue-500/30 hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)]">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700">
                  <i className="ri-user-smile-fill text-5xl xl:text-6xl text-blue-500"></i>
                </div>

                <div className="relative z-10">
                  <div className="inline-flex p-2 rounded-lg bg-blue-500/10 text-blue-400 mb-3 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <i className="ri-user-heart-line text-lg"></i>
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl xl:text-3xl font-black text-white tracking-tight">{stats.users?.toLocaleString() || '0'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Users</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/10">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">{onlinePresence.total} Online</span>
                  </div>
                </div>
              </Link>

              {/* Buyers - Glass Card */}
              <div className="relative group overflow-hidden rounded-2xl bg-[#131c31] border border-white/5 p-5 transition-all duration-500 hover:border-indigo-500/30 hover:shadow-[0_0_40px_-10px_rgba(99,102,241,0.15)]">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700">
                  <i className="ri-shopping-bag-3-fill text-5xl xl:text-6xl text-indigo-500"></i>
                </div>

                <div className="relative z-10">
                  <div className="inline-flex p-2 rounded-lg bg-indigo-500/10 text-indigo-400 mb-3 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <i className="ri-group-line text-lg"></i>
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl xl:text-3xl font-black text-white tracking-tight">{stats.buyers?.toLocaleString() || '0'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Buyers</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Growth</span>
                  <span className="text-[9px] font-bold text-emerald-400">+{(analyticsData.recentGrowth?.slice(-1)[0]?.count || 0)} this week</span>
                </div>
              </div>

              {/* Sellers - Glass Card */}
              <div className="relative group overflow-hidden rounded-2xl bg-[#131c31] border border-white/5 p-5 transition-all duration-500 hover:border-emerald-500/30 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.15)]">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700">
                  <i className="ri-store-3-fill text-5xl xl:text-6xl text-emerald-500"></i>
                </div>

                <div className="relative z-10">
                  <div className="inline-flex p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mb-3 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <i className="ri-store-2-line text-lg"></i>
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl xl:text-3xl font-black text-white tracking-tight">{stats.sellers?.toLocaleString() || '0'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Sellers</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Applications</span>
                  <span className="text-[9px] font-bold text-amber-400">{stats.pending} Pending</span>
                </div>
              </div>

              {/* Products - Glass Card */}
              <div className="relative group overflow-hidden rounded-2xl bg-[#131c31] border border-white/5 p-5 transition-all duration-500 hover:border-purple-500/30 hover:shadow-[0_0_40px_-10px_rgba(168,85,247,0.15)] flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700">
                  <i className="ri-box-3-fill text-5xl xl:text-6xl text-purple-500"></i>
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start">
                    <div className="inline-flex p-2 rounded-lg bg-purple-500/10 text-purple-400 mb-3 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                      <i className="ri-box-3-line text-lg"></i>
                    </div>
                    <button
                      onClick={() => setIsProductCreatorOpen(true)}
                      className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-lg shadow-purple-900/40 active:scale-95 group/btn"
                    >
                      <i className="ri-add-line text-lg group-hover/btn:rotate-90 transition-transform"></i>
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl xl:text-3xl font-black text-white tracking-tight">{stats.total_products?.toLocaleString() || '0'}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Products</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between relative z-10">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Inventory</span>
                  <span className="text-[9px] font-bold text-emerald-400">{stats.products_count} Active</span>
                </div>
              </div>
            </div>

            {/* Quick Overview & Status Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-900/50 rounded-2xl p-5 xl:p-6 border border-white/5 backdrop-blur-xl relative overflow-hidden group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.25em]">Presence Terminal • LIVE</p>
                    </div>
                    <h4 className="text-2xl xl:text-3xl font-black text-white flex items-end gap-2 mb-2">
                      {onlinePresence.total}
                      <span className="text-xs font-bold text-slate-500 mb-1">Online Now</span>
                    </h4>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-all text-center min-w-[60px]">
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Buyers</p>
                      <p className="text-sm font-black text-white">{onlinePresence.buyers}</p>
                    </div>
                    <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-all text-center min-w-[60px]">
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Sellers</p>
                      <p className="text-sm font-black text-white">{onlinePresence.sellers}</p>
                    </div>
                    <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-all text-center min-w-[60px]">
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Admins</p>
                      <p className="text-sm font-black text-white">{onlinePresence.admins}</p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full -mr-20 -mt-20 blur-[100px] pointer-events-none"></div>
              </div>

              <div className="bg-slate-900/50 rounded-2xl p-5 xl:p-6 border border-white/5 backdrop-blur-xl flex flex-col justify-center gap-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Buyers</p>
                    <p className="text-xl xl:text-2xl font-black text-white">{stats.buyers?.toLocaleString() || '0'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mb-1">+{(analyticsData.recentGrowth?.slice(-1)[0]?.count || 0)} New</p>
                    <div className="w-16 h-1 bg-emerald-500/20 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-3/4 animate-pulse"></div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Admins</p>
                    <p className="text-lg font-black text-emerald-400">{stats.admins?.toLocaleString() || '0'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Publishers</p>
                    <p className="text-lg font-black text-purple-400">{stats.publishers?.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* PROMINENT ALERTS - SMS & Pending Applications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* SMS Balance Alert / System Status Reflection */}
          <div
            onClick={() => setActiveTab('sms')}
            className={`relative overflow-hidden rounded-2xl p-5 border flex flex-col justify-between transition-all duration-500 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${isSmsLoading
              ? 'bg-slate-800/50 border-slate-700/50'
              : !stats.smsEnabled
                ? 'bg-slate-800/50 border-slate-700 grayscale'
                : stats.smsBalance < 50
                  ? 'bg-gradient-to-br from-rose-950/50 to-rose-900/50 border-rose-500/30'
                  : 'bg-gradient-to-br from-indigo-950/50 to-violet-900/50 border-indigo-500/30'
              }`}>
            {!stats.smsEnabled && (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-6">
                <i className="ri-error-warning-line text-3xl text-slate-400 mb-2"></i>
                <div className="px-3 py-1 bg-slate-800 rounded-full border border-white/10 text-[9px] font-black text-slate-300 uppercase tracking-widest shadow-2xl">
                  SMS System Offline
                </div>
              </div>
            )}

            <div className="relative z-0 flex justify-between items-start mb-4">
              <div className="p-2 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
                <i className="ri-message-3-fill text-xl text-white"></i>
              </div>
              <div className={`px-2 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${stats.smsBalance < 50 ? 'bg-rose-500/20 border-rose-500/50 text-rose-300' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                }`}>
                {stats.smsBalance < 50 ? 'Balance Low' : 'Healthy'}
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mb-1">SMS Credit Balance</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-black text-white tracking-tighter">
                  {isSmsLoading ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    stats.smsBalance?.toFixed(0)
                  )}
                </h3>
                <span className="text-sm font-bold text-white/40">Points</span>
              </div>
              <p className="text-[9px] font-medium text-white/40 mt-1">
                {stats.smsSent} messages sent in current session
              </p>
            </div>

            {/* Background Decoration */}
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          {/* Pending Applications Alert */}
          <div className={`relative overflow-hidden rounded-2xl p-5 border flex flex-col justify-between transition-all duration-500 ${pendingApps.length > 0
            ? 'bg-gradient-to-br from-amber-950/50 to-orange-900/50 border-amber-500/30'
            : 'bg-gradient-to-br from-emerald-950/50 to-teal-900/50 border-emerald-500/30'
            }`}>
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 blur-[100px] pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
                  <i className={`text-xl ${pendingApps.length > 0 ? 'ri-file-list-3-fill text-amber-400' : 'ri-checkbox-circle-fill text-emerald-400'}`}></i>
                </div>
                <div className={`px-2 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${pendingApps.length > 0 ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  }`}>
                  {pendingApps.length > 0 ? 'Review Needed' : 'All Clear'}
                </div>
              </div>

              <div>
                <h4 className="text-4xl font-black text-white tracking-tighter mb-1">{pendingApps.length}</h4>
                <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest mb-3">Pending Applications</p>

                {pendingApps.length > 0 ? (
                  <button
                    onClick={() => setActiveTab('applications')}
                    className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-widest text-[9px] transition-all shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 group"
                  >
                    Review Now
                    <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform"></i>
                  </button>
                ) : (
                  <div className="w-full py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 cursor-default">
                    <i className="ri-check-double-line"></i>
                    System Optimized
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>        {/* Tabbed Navigation */}
        <div className="flex border-b border-slate-700/50 mb-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: 'ri-dashboard-2-line' },
            { id: 'applications', label: 'Applications', icon: 'ri-file-list-3-line', badge: pendingApps.length },
            { id: 'products', label: 'Products', icon: 'ri-shopping-bag-3-line' },
            { id: 'analytics', label: 'Analytics', icon: 'ri-line-chart-line' },
            { id: 'activity', label: 'Activity', icon: 'ri-history-line' },
            { id: 'sms', label: 'SMS & Credits', icon: 'ri-message-3-line' }
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
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  <h3 className="text-lg font-black text-white mb-5 uppercase tracking-wide">Quick Actions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'User Directory', path: '/admin/users', icon: 'ri-user-settings-line', color: 'blue' },
                      { label: 'Registered Sellers', path: '/admin/sellers', icon: 'ri-store-2-line', color: 'green' },
                      { label: 'CMS Content', path: '/admin/content', icon: 'ri-pages-line', color: 'indigo' },
                      { label: 'Ads Management', path: '/admin/ads', icon: 'ri-advertisement-line', color: 'rose' },
                      { label: 'Campus News', path: '/admin/news', icon: 'ri-newspaper-line', color: 'emerald' },
                      { label: 'Email Outreach', path: '/admin/newsletter', icon: 'ri-mail-send-line', color: 'cyan' },
                      { label: 'Platform Subs', path: '/admin/subscriptions', icon: 'ri-vip-crown-line', color: 'yellow' },
                      { label: 'In-App Support', path: '/admin/support', icon: 'ri-customer-service-2-line', color: 'orange', badge: stats.tickets },
                    ].map((action, i) => (
                      <Link
                        key={i}
                        to={action.path}
                        className="relative group bg-slate-900/40 hover:bg-slate-900 border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 transition-all shadow-sm hover:shadow-blue-500/10"
                      >
                        {action.badge ? (
                          <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full shadow-lg animate-pulse">
                            {action.badge}
                          </span>
                        ) : null}
                        <div className={`w-12 h-12 rounded-xl bg-${action.color}-500/10 flex items-center justify-center text-${action.color}-400 mb-4 group-hover:scale-110 transition-transform shadow-inner`}>
                          <i className={`${action.icon} text-2xl`}></i>
                        </div>
                        <h4 className="font-bold text-white text-[11px] uppercase tracking-wider">{action.label}</h4>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 relative overflow-hidden group">
                    <i className="ri-customer-service-2-line absolute -right-3 -bottom-3 text-white/10 text-7xl group-hover:block hidden transition-all"></i>
                    <i className="ri-customer-service-2-fill absolute -right-3 -bottom-3 text-white/10 text-7xl block group-hover:hidden transition-all"></i>
                    <div className="relative">
                      <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">Support</p>
                      <div className="text-3xl font-black text-white mb-1">{stats.tickets}</div>
                      <Link to="/admin/support" className="text-[10px] font-bold text-blue-200 hover:text-white transition-colors flex items-center gap-1">Manage <i className="ri-arrow-right-line"></i></Link>
                    </div>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-600 transition-colors">
                    <i className="ri-newspaper-line absolute -right-3 -bottom-3 text-white/5 text-7xl"></i>
                    <div className="relative">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">News Articles</p>
                      <div className="text-3xl font-black text-blue-400 mb-1">{stats.news}</div>
                      <Link to="/admin/news" className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1">Manage <i className="ri-arrow-right-line"></i></Link>
                    </div>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-600 transition-colors">
                    <i className="ri-shopping-bag-3-line absolute -right-3 -bottom-3 text-white/5 text-7xl"></i>
                    <div className="relative">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Products</p>
                      <div className="text-3xl font-black text-emerald-400 mb-1">{stats.products_count + stats.services_count}</div>
                      <button onClick={() => setActiveTab('products')} className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1">Manage <i className="ri-arrow-right-line"></i></button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Real-time Seller Applications Feed */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">Live Seller Applications</h4>
                    </div>
                    <button
                      onClick={() => setActiveTab('applications')}
                      className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest"
                    >
                      View All Tracking →
                    </button>
                  </div>

                  <div className="space-y-4">
                    {pendingApps.length > 0 ? (
                      pendingApps.slice(0, 3).map((app) => (
                        <div key={app.id} className="group flex items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all">
                          <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 font-black text-lg">
                            {app.profiles?.full_name?.charAt(0) || 'U'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white truncate">{app.business_name}</p>
                              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase rounded">New</span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">Applied by {app.profiles?.full_name}</p>
                          </div>
                          <button
                            onClick={() => setActiveTab('applications')}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-emerald-500 hover:text-white transition-all"
                          >
                            <i className="ri-arrow-right-line"></i>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-slate-500 border border-dashed border-slate-700/50 rounded-xl">
                        <i className="ri-checkbox-circle-line text-2xl mb-2 block text-emerald-500/50"></i>
                        <p className="text-xs font-medium">All applications processed!</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Subscribers */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">New Subscribers</h4>
                    <Link to="/admin/newsletter" className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest">
                      View List →
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {recentSubscribers.length > 0 ? (
                      recentSubscribers.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-all">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
                            {sub.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{sub.email}</p>
                            <p className="text-[10px] text-slate-500">{new Date(sub.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 text-xs py-4">No subscribers yet.</p>
                    )}
                  </div>
                </div>

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
                          <p className="text-xs font-bold text-slate-300 truncate">{log.action_type?.split('_').join(' ')}</p>
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
                        onClick={() => navigate(`/seller/edit-product/${product.id}`)}
                        className="px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl font-bold text-xs uppercase transition-all"
                        title="Edit Product Details"
                      >
                        Edit
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
            <SellerApplications isEmbedded={true} />
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
                          label={({ name, percent }: { name: string, percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
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

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                  <i className="ri-message-3-line text-violet-500"></i> Communication
                </h3>
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                  <div>
                    <h4 className="font-bold text-white mb-1">Global SMS Notifications</h4>
                    <p className="text-xs text-slate-400">Enable or disable all outbound system SMS.</p>
                  </div>
                  <button
                    onClick={toggleSMS}
                    className={`relative w-14 h-8 rounded-full transition-colors ${stats.smsEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${stats.smsEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                  <i className="ri-shield-keyhole-line text-amber-500"></i> Access & Billing
                </h3>
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                  <div>
                    <h4 className="font-bold text-white mb-1">Require Seller Subscriptions</h4>
                    <p className="text-xs text-slate-400">If disabled, subscription checks are bypassed.</p>
                  </div>
                  <button
                    onClick={toggleSubscription}
                    className={`relative w-14 h-8 rounded-full transition-colors ${stats.subscriptionRequired ? 'bg-blue-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${stats.subscriptionRequired ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
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
                            {log.action_type?.split('_').join(' ')}
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
          )
          }

          {
            activeTab === 'sms' && (
              <div className="space-y-8">
                {/* SMS Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                        <i className="ri-message-3-line text-2xl"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Sent</p>
                        <p className="text-2xl font-black text-white">{stats.smsSent?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <i className="ri-wallet-3-line text-2xl"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Credits</p>
                        <p className="text-2xl font-black text-white">{stats.smsBalance?.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center">
                    <Link to="/admin/sms" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm uppercase tracking-wider text-center transition-all shadow-lg shadow-blue-500/20">
                      Open SMS Console <i className="ri-arrow-right-line ml-2"></i>
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Sent History */}
                  <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                      <h3 className="text-lg font-black text-white uppercase tracking-wider">Recent Broadcasts</h3>
                      <div className="px-3 py-1 bg-slate-700/50 rounded-lg text-[10px] font-bold text-slate-400">LAST 10</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-900/50">
                          <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message</th>
                            <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recipients</th>
                            <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {smsHistory.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-slate-500 text-xs font-medium">No SMS history found</td></tr>
                          ) : (
                            smsHistory.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-700/20 transition-colors">
                                <td className="px-6 py-4">
                                  <p className="text-xs font-medium text-slate-300 line-clamp-2" title={(log.details as any)?.message || (log as any)?.action_details?.message}>
                                    {(log.details as any)?.message || (log as any)?.action_details?.message || 'Message content unavailable'}
                                  </p>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded">
                                    {(log.details as any)?.recipient_count || (log as any)?.action_details?.recipient_count || 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right text-[10px] text-slate-500 font-mono">
                                  {new Date(log.created_at).toLocaleString()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Topup History */}
                  <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                      <h3 className="text-lg font-black text-white uppercase tracking-wider">Credit Purchase History</h3>
                      <div className="px-3 py-1 bg-slate-700/50 rounded-lg text-[10px] font-bold text-slate-400">RECENT</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-900/50">
                          <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                            <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Units</th>
                            <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {topupHistory.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-slate-500 text-xs font-medium">No purchase history found</td></tr>
                          ) : (
                            topupHistory.map((topup) => (
                              <tr key={topup.id} className="hover:bg-slate-700/20 transition-colors">
                                <td className="px-6 py-4 text-[10px] text-slate-400 font-mono">
                                  {new Date(topup.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-xs font-black text-white">{topup.units?.toLocaleString()}</span>
                                  <span className="text-[10px] text-slate-500 ml-1">UNITS</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded ${topup.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
                                    topup.status === 'failed' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                                    }`}>
                                    {topup.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* SMS Template Editor */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <i className="ri-quill-pen-line text-blue-400"></i>
                        Automated SMS Templates
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Customize the messages sent by system triggers</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {smsTemplates.length > 0 ? (
                      smsTemplates.map((template) => (
                        <div key={template.key} className="p-6 bg-slate-900/50 rounded-2xl border border-white/5 hover:border-white/10 transition-all flex flex-col gap-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-xs text-blue-400 uppercase tracking-widest mb-1 truncate">
                                {template.key.replace('sms_template_', '').split('_').join(' ')}
                              </h4>
                              <p className="text-[10px] text-slate-500 line-clamp-1">{template.description}</p>
                            </div>
                            <button
                              onClick={() => setEditingTemplate({ key: template.key, value: template.value })}
                              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all"
                            >
                              <i className="ri-edit-line"></i>
                            </button>
                          </div>

                          <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5 font-medium text-xs text-slate-300 leading-relaxed italic">
                            "{template.value}"
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="lg:col-span-2 p-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-3xl">
                        <i className="ri-loader-4-line animate-spin text-2xl mb-2"></i>
                        <p className="text-sm">Fetching system templates...</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Template Edit Modal */}
                {editingTemplate && (
                  <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-300">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Edit Template</h2>
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mt-1">
                            {editingTemplate.key.replace('sms_template_', '').split('_').join(' ')}
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingTemplate(null)}
                          className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all"
                        >
                          <i className="ri-close-line text-xl"></i>
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-4">
                          <i className="ri-information-line text-xl text-blue-400"></i>
                          <p className="text-[10px] text-blue-200 leading-relaxed uppercase font-bold tracking-wide">
                            Placeholders like <span className="text-blue-400">{"{name}"}</span>, <span className="text-blue-400">{"{otp}"}</span>, or <span className="text-blue-400">{"{title}"}</span> will be replaced dynamically. Ensure you keep them for the system to work correctly.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Message Content</label>
                          <textarea
                            rows={5}
                            value={editingTemplate.value}
                            onChange={(e) => setEditingTemplate({ ...editingTemplate, value: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-5 text-sm font-medium text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                            placeholder="Enter message template..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => setEditingTemplate(null)}
                            className="py-4 bg-slate-800 text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-slate-700 transition-all"
                          >
                            Discard
                          </button>
                          <button
                            onClick={saveSMSTemplate}
                            disabled={processing === 'save-template'}
                            className="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2"
                          >
                            {processing === 'save-template' ? <i className="ri-loader-4-line animate-spin text-lg"></i> : 'Update Template'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          }
        </div >
        {/* Access Manager Modal */}
        {
          showAddAdminModal && (
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
          )
        }
      </div >

      <AdminProductCreator
        isOpen={isProductCreatorOpen}
        onClose={() => setIsProductCreatorOpen(false)}
        onSuccess={() => fetchData().then(() => setNotification({ type: 'success', message: 'Product added successfully' }))}
      />
    </div >
  );
}
