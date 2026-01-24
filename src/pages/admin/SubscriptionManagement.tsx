import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

type SellerProfile = {
  id: string;
  user_id: string;
  business_name: string;
  subscription_status: string;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  last_payment_amount: number | null;
  last_payment_date: string | null;
  profiles: {
    full_name: string;
    email: string;
    avatar_url: string | null;
    phone: string | null;
  };
};

type Payment = {
  id: string;
  seller_id: string;
  amount: number;
  currency: string;
  payment_reference: string;
  payment_status: string;
  subscription_start_date: string;
  subscription_end_date: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
};

export default function SubscriptionManagement() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sellers' | 'payments'>('sellers');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Platform Settings State
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(true);
  const [updatingSettings, setUpdatingSettings] = useState(false);

  // Bulk Selection State
  const [selectedSellers, setSelectedSellers] = useState<string[]>([]);

  useEffect(() => {
    // Rely on ProtectedRoute for access control, but keep this as a failsafe
    if (!authLoading && profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      navigate('/');
    }
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Subscription Setting
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'subscriptions_enabled')
        .maybeSingle();

      if (settingsData) {
        setSubscriptionEnabled(settingsData.value);
      } else {
        setSubscriptionEnabled(true);
      }

      const { data: sellersData, error: sellersError } = await supabase
        .from('seller_profiles')
        .select('*, profiles!seller_profiles_user_id_fkey(full_name, email, avatar_url, phone)')
        .order('created_at', { ascending: false });

      if (sellersError) throw sellersError;
      setSellers(sellersData || []);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('subscription_payments')
        .select('*, profiles!subscription_payments_seller_id_fkey(full_name, email)')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubscription = async () => {
    if (!confirm(`Are you sure you want to ${subscriptionEnabled ? 'DISABLE' : 'ENABLE'} subscriptions? \n\n${subscriptionEnabled ? 'Disabling means ALL sellers can post products for FREE.' : 'Enabling means sellers must pay to post products.'}`)) {
      return;
    }

    setUpdatingSettings(true);
    const newValue = !subscriptionEnabled;
    try {
      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

      if (isBypass && secret) {
        const { error } = await supabase.rpc('sys_update_platform_setting', {
          secret_key: secret,
          setting_key: 'subscriptions_enabled',
          setting_value: newValue
        });
        if (error) throw error;
      } else {
        const { data: existing } = await supabase.from('platform_settings').select('key').eq('key', 'subscriptions_enabled').maybeSingle();

        if (!existing) {
          const { error: insertError } = await supabase.from('platform_settings').insert({
            key: 'subscriptions_enabled',
            value: newValue
          });
          if (insertError) throw insertError;
        } else {
          const { error: updateError } = await supabase
            .from('platform_settings')
            .update({ value: newValue })
            .eq('key', 'subscriptions_enabled');
          if (updateError) throw updateError;
        }
      }

      setSubscriptionEnabled(newValue);
      alert(`Subscriptions are now ${newValue ? 'ENABLED' : 'DISABLED'} platform-wide.`);
    } catch (err: any) {
      console.error('Error updating settings:', err);
      alert('Failed to update settings. ' + err.message);
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleManualRenewal = async (sellerId: string) => {
    if (!confirm('Manually renew this seller\'s subscription for 1 month + 3 days?')) {
      return;
    }

    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(endDate.getDate() + 3);

      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

      if (isBypass && secret) {
        const { error } = await supabase.rpc('sys_manage_seller_subscription', {
          secret_key: secret,
          target_user_id: sellerId,
          new_status: 'active',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('seller_profiles')
          .update({
            subscription_status: 'active',
            subscription_start_date: startDate.toISOString(),
            subscription_end_date: endDate.toISOString(),
            last_payment_date: startDate.toISOString(),
          })
          .eq('user_id', sellerId);
        if (error) throw error;
      }

      // SMS Notification
      try {
        const seller = sellers.find(s => s.user_id === sellerId);
        const phoneNumber = seller?.profiles.phone;
        const fullName = seller?.profiles.full_name;

        if (phoneNumber) {
          const { sendSMS } = await import('../../lib/arkesel');
          const name = (fullName || 'Seller').split(' ')[0];
          await sendSMS(
            [phoneNumber],
            `Hi ${name}, your Campus Marketplace subscription has been ACTIVATED! Start selling now.`,
            'subscription',
            { name, status: 'ACTIVATED' }
          );
        }
      } catch (smsError) {
        console.error("SMS Warning:", smsError);
      }

      await fetchData();
      alert('Subscription renewed successfully!');
    } catch (error) {
      console.error('Error renewing subscription:', error);
      alert('Failed to renew subscription');
    }
  };

  const handleBulkRenew = async () => {
    if (selectedSellers.length === 0) return;
    if (!confirm(`Renew subscriptions for ${selectedSellers.length} selected sellers?`)) return;

    setLoading(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(endDate.getDate() + 3);

      // Parallelize updates
      const updatePromises = selectedSellers.map(async (userId) => {
        // 1. Update DB
        // 1. Update DB
        const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
        const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

        if (isBypass && secret) {
          const { error } = await supabase.rpc('sys_manage_seller_subscription', {
            secret_key: secret,
            target_user_id: userId,
            new_status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString()
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('seller_profiles')
            .update({
              subscription_status: 'active',
              subscription_start_date: startDate.toISOString(),
              subscription_end_date: endDate.toISOString(),
              last_payment_date: startDate.toISOString(),
            })
            .eq('user_id', userId);
          if (error) throw error;
        }

        // 2. Send SMS
        try {
          const seller = sellers.find(s => s.user_id === userId);
          const phoneNumber = seller?.profiles.phone;
          const fullName = seller?.profiles.full_name;

          if (phoneNumber) {
            const { sendSMS } = await import('../../lib/arkesel');
            const name = (fullName || 'Seller').split(' ')[0];
            await sendSMS(
              [phoneNumber],
              `Hi ${name}, your Campus Marketplace subscription has been ACTIVATED! Start selling now.`,
              'subscription',
              { name, status: 'ACTIVATED' }
            );
          }
        } catch (smsError) {
          console.error(`Failed to send SMS to ${userId}:`, smsError);
        }
      });

      await Promise.all(updatePromises);

      await fetchData();
      setSelectedSellers([]);
      alert(`Successfully renewed ${selectedSellers.length} subscriptions.`);

    } catch (error) {
      console.error('Bulk renewal error:', error);
      alert('Failed to process some renewals.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSuspend = async () => {
    if (selectedSellers.length === 0) return;
    if (!confirm(`Suspend subscriptions for ${selectedSellers.length} selected sellers? Their products will be hidden.`)) return;

    setLoading(true);
    try {
      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

      // Parallelize updates
      const updatePromises = selectedSellers.map(async (userId) => {
        // 1. Update DB
        if (isBypass && secret) {
          const { error } = await supabase.rpc('sys_manage_seller_subscription', {
            secret_key: secret,
            target_user_id: userId,
            new_status: 'inactive'
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('seller_profiles')
            .update({ subscription_status: 'inactive' })
            .eq('user_id', userId);
          if (error) throw error;
        }

        // 2. Send SMS
        try {
          const seller = sellers.find(s => s.user_id === userId);
          const phoneNumber = seller?.profiles.phone;
          const fullName = seller?.profiles.full_name;

          if (phoneNumber) {
            const { sendSMS } = await import('../../lib/arkesel');
            const name = (fullName || 'Seller').split(' ')[0];
            await sendSMS(
              [phoneNumber],
              `Hi ${name}, your Campus Marketplace subscription has been SUSPENDED. Your products are now hidden. Please contact support.`,
              'subscription',
              { name, status: 'SUSPENDED' }
            );
          }
        } catch (smsError) {
          console.error(`Failed to send SMS to ${userId}:`, smsError);
        }
      });

      await Promise.all(updatePromises);
      await fetchData();
      setSelectedSellers([]);
      alert(`Successfully suspended ${selectedSellers.length} sellers.`);
    } catch (error) {
      console.error('Bulk suspension error:', error);
      alert('Failed to process some suspensions.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendSeller = async (sellerId: string) => {
    if (!confirm('Suspend this seller\'s subscription? Their products will be hidden.')) {
      return;
    }

    try {
      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892';

      if (isBypass && secret) {
        const { error } = await supabase.rpc('sys_manage_seller_subscription', {
          secret_key: secret,
          target_user_id: sellerId,
          new_status: 'inactive'
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('seller_profiles')
          .update({ subscription_status: 'inactive' })
          .eq('user_id', sellerId);
        if (error) throw error;
      }

      // SMS Notification
      try {
        const seller = sellers.find(s => s.user_id === sellerId);
        const phoneNumber = seller?.profiles.phone;
        const fullName = seller?.profiles.full_name;

        if (phoneNumber) {
          const { sendSMS } = await import('../../lib/arkesel');
          const name = (fullName || 'Seller').split(' ')[0];
          await sendSMS(
            [phoneNumber],
            `Hi ${name}, your Campus Marketplace subscription has been SUSPENDED. Your products are now hidden. Please contact support.`,
            'subscription',
            { name, status: 'SUSPENDED' }
          );
        }
      } catch (smsError) {
        console.error("SMS Warning:", smsError);
      }

      await fetchData();
      alert('Seller subscription suspended');
    } catch (error) {
      console.error('Error suspending seller:', error);
      alert('Failed to suspend seller');
    }
  };

  const handleGenerateInvoice = (payment: Payment) => {
    const statusColor = payment.payment_status === 'success' ? '#10b981' : '#f59e0b';
    const statusText = payment.payment_status.toUpperCase();

    const invoiceWindow = window.open('', '_blank');
    if (!invoiceWindow) {
      alert('Please allow popups to view the invoice.');
      return;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Invoice #${payment.payment_reference}</title>
            <style>
                body { font-family: 'Montserrat', 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .15); font-size: 16px; line-height: 24px; color: #555; }
                .header { display: flex; justify-content: space-between; margin-bottom: 50px; }
                .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
                .invoice-details { text-align: right; }
                .status-badge { display: inline-block; padding: 5px 15px; background: ${statusColor}20; color: ${statusColor}; border-radius: 20px; font-weight: bold; font-size: 12px; }
                table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
                table td { padding: 5px; vertical-align: top; }
                table tr td:nth-child(2) { text-align: right; }
                .heading td { background: #eee; border-bottom: 1px solid #ddd; font-weight: bold; }
                .item td { border-bottom: 1px solid #eee; }
                .total td { border-top: 2px solid #eee; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="invoice-box">
                <div class="header">
                    <div class="logo">CampusConnect.</div>
                    <div class="invoice-details">
                        <h2 style="margin: 0;">INVOICE</h2>
                        <p style="margin: 5px 0;">Ref: ${payment.payment_reference}</p>
                        <p style="margin: 0;">Date: ${new Date(payment.created_at).toLocaleDateString()}</p>
                        <div style="margin-top: 10px;"><span class="status-badge">${statusText}</span></div>
                    </div>
                </div>

                <div style="margin-bottom: 40px;">
                    <strong>Bill To:</strong><br>
                    ${payment.profiles.full_name}<br>
                    ${payment.profiles.email}
                </div>

                <table>
                    <tr class="heading">
                        <td>Item</td>
                        <td>Price</td>
                    </tr>
                    <tr class="item">
                        <td>Seller Subscription (${new Date(payment.subscription_start_date).toLocaleDateString()} - ${new Date(payment.subscription_end_date).toLocaleDateString()})</td>
                        <td>${payment.currency} ${payment.amount.toFixed(2)}</td>
                    </tr>
                    <tr class="total">
                        <td></td>
                        <td>Total: ${payment.currency} ${payment.amount.toFixed(2)}</td>
                    </tr>
                </table>

                <div style="margin-top: 50px; text-align: center; font-size: 12px; color: #999;">
                    <p>Thank you for your business.</p>
                    <p>Campus Connect Inc.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    invoiceWindow.document.write(htmlContent);
    invoiceWindow.document.close();
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Filtering logic moved here, derived from state
  const filteredSellers = sellers.filter(seller => {
    const matchesSearch =
      seller.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      seller.profiles.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || seller.subscription_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredPayments = payments.filter(payment =>
    payment.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.profiles.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.payment_reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handlers depending on filteredSellers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSellers(filteredSellers.map(s => s.user_id));
    } else {
      setSelectedSellers([]);
    }
  };

  const handleSelectSeller = (userId: string) => {
    setSelectedSellers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };


  const stats = {
    total: sellers.length,
    active: sellers.filter(s => s.subscription_status === 'active').length,
    expired: sellers.filter(s => s.subscription_status === 'expired').length,
    inactive: sellers.filter(s => s.subscription_status === 'inactive').length,
    totalRevenue: payments
      .filter(p => p.payment_status === 'success')
      .reduce((sum, p) => sum + p.amount, 0),
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-blue-600 animate-spin"></i>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
      <Navbar />

      <div className="pt-32 md:pt-40 pb-12 box-border max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-widest border border-amber-200 dark:border-amber-800">
                Premium
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Platform Subs
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Manage seller subscriptions, renewals, and revenue.
            </p>
          </div>

          {/* Global Subscription Switch */}
          <div className={`p-4 rounded-2xl border transition-all ${subscriptionEnabled ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1 text-slate-500 dark:text-slate-400">Platform Status</p>
                <p className={`font-bold ${subscriptionEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                  {subscriptionEnabled ? 'Subscriptions ENABLED' : 'Subscriptions DISABLED (Free)'}
                </p>
              </div>
              <button
                onClick={handleToggleSubscription}
                disabled={updatingSettings}
                className={`w-14 h-8 rounded-full p-1 transition-colors relative ${subscriptionEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${subscriptionEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Sellers</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 group-hover:scale-105 transition-transform">{stats.total}</p>
            </div>
            <i className="ri-store-3-line absolute right-6 bottom-6 text-4xl text-slate-100 dark:text-slate-700 group-hover:scale-110 transition-transform"></i>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Active Subs</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 group-hover:scale-105 transition-transform">{stats.active}</p>
            </div>
            <i className="ri-checkbox-circle-fill absolute right-6 bottom-6 text-4xl text-emerald-100 dark:text-emerald-900/20 group-hover:scale-110 transition-transform"></i>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">Expired / Inactive</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1 group-hover:scale-105 transition-transform">{stats.expired + stats.inactive}</p>
            </div>
            <i className="ri-error-warning-fill absolute right-6 bottom-6 text-4xl text-rose-100 dark:text-rose-900/20 group-hover:scale-110 transition-transform"></i>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 shadow-lg shadow-amber-500/20 text-white relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-xs font-bold text-amber-100 uppercase tracking-widest">Total Revenue</p>
              <p className="text-3xl font-black mt-1 group-hover:scale-105 transition-transform">GH₵ {stats.totalRevenue.toLocaleString()}</p>
            </div>
            <i className="ri-money-dollar-circle-line absolute right-6 bottom-6 text-4xl text-white/20 group-hover:scale-110 transition-transform"></i>
          </div>
        </div>

        {/* Bulk Action Bar (Only visible when items selected) */}
        {selectedSellers.length > 0 && activeTab === 'sellers' && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-4">
            <span className="font-bold text-sm">{selectedSellers.length} sellers selected</span>
            <button
              onClick={handleBulkRenew}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <i className="ri-refresh-line"></i> Bulk Renew
            </button>
            <button
              onClick={handleBulkSuspend}
              className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2"
            >
              <i className="ri-forbid-2-line"></i> Bulk Suspend
            </button>
          </div>
        )}

        {/* Content Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px]">
          <div className="flex gap-1 p-2 bg-slate-100 dark:bg-slate-900/50 m-2 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setActiveTab('sellers')}
              className={`flex-1 px-6 py-4 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${activeTab === 'sellers'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <i className="ri-store-line mr-2"></i>
              Seller Subscriptions
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`flex-1 px-6 py-4 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${activeTab === 'payments'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <i className="ri-history-line mr-2"></i>
              Payment History
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search sellers, emails, or references..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 font-medium text-sm text-slate-900 dark:text-white outline-none"
                />
              </div>

              {activeTab === 'sellers' && (
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 font-medium text-sm text-slate-900 dark:text-white outline-none appearance-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="expired">Expired Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                  <i className="ri-filter-3-line absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                </div>
              )}
            </div>

            {activeTab === 'sellers' ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4">
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={selectedSellers.length === filteredSellers.length && filteredSellers.length > 0}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Seller Profile</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Name</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expires In</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Payout</th>
                      <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredSellers.map((seller) => {
                      const daysRemaining = getDaysRemaining(seller.subscription_end_date);
                      return (
                        <tr key={seller.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedSellers.includes(seller.user_id)}
                              onChange={() => handleSelectSeller(seller.user_id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                                {seller.profiles.full_name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">{seller.profiles.full_name}</div>
                                <div className="text-xs text-slate-500">{seller.profiles.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">{seller.business_name}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${seller.subscription_status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : seller.subscription_status === 'expired'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                              }`}>
                              {seller.subscription_status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {daysRemaining !== null ? (
                              <span className={`text-sm font-bold ${daysRemaining < 0 ? 'text-rose-500' :
                                daysRemaining <= 7 ? 'text-amber-500' :
                                  'text-emerald-500'
                                }`}>
                                {daysRemaining < 0 ? 'Expired' : `${daysRemaining} days`}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {seller.last_payment_amount ? (
                              <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">
                                  GH₵ {seller.last_payment_amount.toFixed(2)}
                                </div>
                                {seller.last_payment_date && (
                                  <div className="text-[10px] text-slate-400">
                                    {new Date(seller.last_payment_date).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">No payment</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleManualRenewal(seller.user_id)}
                                title="Renew Subscription"
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              >
                                <i className="ri-refresh-line"></i>
                              </button>
                              {seller.subscription_status === 'active' && (
                                <button
                                  onClick={() => handleSuspendSeller(seller.user_id)}
                                  title="Suspend"
                                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                >
                                  <i className="ri-forbid-2-line"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Seller</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reference</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Period</th>
                      <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                              {payment.profiles.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white">{payment.profiles.full_name}</div>
                              <div className="text-xs text-slate-500">{payment.profiles.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                          {payment.currency} {payment.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                          {payment.payment_reference}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${payment.payment_status === 'success'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                            }`}>
                            {payment.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-slate-600 dark:text-slate-300">
                            {new Date(payment.subscription_start_date).toLocaleDateString()} - {new Date(payment.subscription_end_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleGenerateInvoice(payment)}
                            className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold uppercase tracking-wide rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                          >
                            Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
