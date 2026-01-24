import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import { useProducts, useUpdateProduct, useDeleteProduct } from '../../hooks/useProducts';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import ImageUploader from '../../components/base/ImageUploader';

export default function SellerDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Redirect if not a seller
  useEffect(() => {
    if (profile && profile.role !== 'seller' && profile.role !== 'admin' && profile.role !== 'super_admin') {
      navigate('/seller/status');
    }
  }, [profile, navigate]);

  // Immediate protection: If application status changes (e.g. Admin re-evaluates), kick back to status page
  useEffect(() => {
    if (!user || profile?.role === 'admin' || profile?.role === 'super_admin') return;

    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    if (isBypass) return;

    const checkAppStatus = async () => {
      const { data, error } = await supabase
        .from('seller_applications')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data && data.status !== 'approved') {
        navigate('/seller/status');
      } else if (!error && !data) {
        // If no application record exists at all, they shouldn't be here
        navigate('/seller/status');
      }
    };

    checkAppStatus();

    const statusSubscription = supabase
      .channel(`seller-status-guard-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for ALL changes including DELETE
          schema: 'public',
          table: 'seller_applications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            navigate('/seller/status');
          } else if (payload.new.status !== 'approved') {
            navigate('/seller/status');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statusSubscription);
    };
  }, [user, profile, navigate]);

  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  // Subscription Check
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'expired' | 'inactive' | null>(null);
  const [globalSubsEnabled, setGlobalSubsEnabled] = useState(true);

  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [updatingLogo, setUpdatingLogo] = useState(false);

  // Edit Profile States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [settingsFormData, setSettingsFormData] = useState({
    businessName: '',
    businessCategory: '',
    businessDescription: ''
  });
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    'Electronics', 'Fashion & Clothing', 'Books & Stationery', 'Food & Beverages',
    'Accommodation', 'Services', 'Sports & Fitness', 'Beauty & Personal Care',
    'Home & Living', 'Other'
  ];

  const fetchSellerProfile = async () => {
    if (user?.id) {
      const { data } = await supabase
        .from('seller_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      setSellerProfile(data);
      if (data) {
        setSettingsFormData({
          businessName: data.business_name || '',
          businessCategory: data.business_category || '',
          businessDescription: data.business_description || ''
        });
        // Start with existing logo URL as preview
        setLogoPreview(data.business_logo || null);
      }
    }
  };

  useEffect(() => {
    fetchSellerProfile();
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingSettings(true);

    try {
      let finalLogoUrl = sellerProfile?.business_logo;

      // 1. Upload new logo if selected
      if (logoFile) {
        const { uploadImage, compressImage } = await import('../../lib/uploadImage');
        const compressed = await compressImage(logoFile);
        const { url } = await uploadImage(compressed, 'profiles', user.id);
        finalLogoUrl = url;
      }

      // 2. Update seller_profiles
      const { error: profileError } = await supabase
        .from('seller_profiles')
        .update({
          business_name: settingsFormData.businessName,
          business_category: settingsFormData.businessCategory,
          business_description: settingsFormData.businessDescription,
          business_logo: finalLogoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // 3. Sync to seller_applications so admins see the update
      await supabase
        .from('seller_applications')
        .update({
          business_name: settingsFormData.businessName,
          business_category: settingsFormData.businessCategory,
          business_description: settingsFormData.businessDescription,
          business_logo: finalLogoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      setNotification({ type: 'success', message: 'Business settings updated successfully!' });
      await fetchSellerProfile();
      setShowSettingsModal(false);
      setLogoPreview(null);
      setLogoFile(null);
    } catch (err: any) {
      console.error('Error updating settings:', err);
      setNotification({ type: 'error', message: 'Update failed: ' + err.message });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogoSelect = (file: File) => {
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    // Subscribe to Global Alerts
    const presenceChannel = supabase.channel('online-users');
    presenceChannel
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const user = newPresences[0];
        if (user && user.user_id !== profile?.id) {
          setNotification({
            type: 'info',
            message: `${user.full_name || 'A user'} came online`
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [profile]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const checkSubs = async () => {
      // Only proceed if user is a standard seller (admins bypass)
      if (profile?.role !== 'seller' || !profile?.id) return;

      const { data: settings } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'subscriptions_enabled')
        .maybeSingle();

      const enabled = settings ? settings.value : true;
      setGlobalSubsEnabled(enabled);

      if (enabled) {
        const { data: seller } = await supabase
          .from('seller_profiles')
          .select('subscription_status')
          .eq('user_id', profile.id)
          .maybeSingle();
        if (seller) setSubscriptionStatus(seller.subscription_status);
      }
    };
    checkSubs();
  }, [profile]);

  const { data: products = [], isLoading } = useProducts({
    sellerId: user?.id
  });

  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();

  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    views: products.reduce((sum, p) => sum + (p.views_count || 0), 0),
    totalValue: products.reduce((sum, p) => sum + (p.price || 0), 0),
    avgPrice: products.length > 0 ? (products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length) : 0
  };

  if (!user || (!['seller', 'admin', 'super_admin', 'publisher_seller'].includes(profile?.role || ''))) {
    navigate('/seller/status');
    return null;
  }

  // Helpers for System Admin Bypass
  const adminUpdateProduct = async (productId: string, updates: any) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');
    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_update_product', {
        product_id: productId,
        product_data: updates,
        secret_key: secret
      });
      if (error) throw error;
      // Manually invalidate since we bypassed the mutation hook
      supabase.channel('products-changes').send({
        type: 'broadcast',
        event: 'change',
        payload: {}
      });
      window.location.reload(); // Hard refresh to show change since RPC doesn't trigger react-query easily here
      return;
    }
    return updateProductMutation.mutateAsync({ id: productId, updates });
  };

  const adminDeleteProduct = async (productId: string) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');
    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_delete_product', {
        target_id: productId,
        secret_key: secret
      });
      if (error) throw error;
      window.location.reload();
      return;
    }
    return deleteProductMutation.mutateAsync(productId);
  };

  const handleToggleStatus = async (productId: string, currentStatus: boolean) => {
    try {
      await adminUpdateProduct(productId, { is_active: !currentStatus });
      setNotification({ type: 'success', message: `Product ${!currentStatus ? 'published' : 'hidden'} successfully` });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to update status' });
    }
  };

  const handleDelete = async (productId: string) => {
    if (window.confirm('Delete this product? This action cannot be undone.')) {
      try {
        await adminDeleteProduct(productId);
        setNotification({ type: 'success', message: 'Product deleted successfully' });
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message || 'Failed to delete product' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300 pb-20">
      <Navbar />

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-24 right-4 md:right-8 z-50 animate-in fade-in slide-in-from-right-8 duration-300 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white' :
          notification.type === 'error' ? 'bg-rose-500/90 border-rose-400/50 text-white' :
            'bg-blue-500/90 border-blue-400/50 text-white'
          }`}>
          <i className={`${notification.type === 'success' ? 'ri-checkbox-circle-fill' : notification.type === 'error' ? 'ri-error-warning-fill' : 'ri-notification-3-fill'} text-xl`}></i>
          <span className="font-bold text-sm tracking-wide">{notification.message}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-32 md:pt-40 box-border">

        {/* Subscription Warning Banner */}
        {globalSubsEnabled && subscriptionStatus && subscriptionStatus !== 'active' && profile?.role === 'seller' && (
          <div className="mb-10 bg-rose-500 rounded-2xl p-6 text-white shadow-xl shadow-rose-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                <i className="ri-alarm-warning-fill"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold">Subscription Expired</h3>
                <p className="text-white/80 font-medium text-sm">Your dashboard is view-only. Renew to list new products.</p>
              </div>
            </div>
            <button className="px-6 py-3 bg-white text-rose-600 font-bold rounded-xl text-sm uppercase tracking-wide hover:bg-rose-50 transition-colors shadow-lg">
              Renew Now
            </button>
          </div>
        )}

        {/* Digital Identity Card Header */}
        <div className="relative mb-12 group perspective-1000">
          <div className="relative w-full bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-blue-900/20 overflow-hidden transform transition-transform duration-500 hover:scale-[1.01]">

            {/* Background Patterns */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_2px,transparent_2px)] [background-size:24px_24px]"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col justify-between min-h-[280px] md:min-h-[320px]">

              {/* Top Row: Verification + Status */}
              <div className="flex justify-between items-start">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-lg">
                  <i className="ri-shield-check-fill text-emerald-400"></i>
                  <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white">Verified Merchant</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-1">Status</span>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-sm font-bold text-white tracking-wide">Active</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Identity & Logo */}
              <div className="flex flex-col-reverse md:flex-row items-end justify-between gap-8 mt-12">
                <div className="w-full md:w-auto">
                  <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                    <i className="ri-store-2-line"></i>
                    {sellerProfile?.business_category || 'Retail Store'}
                  </p>
                  <h1 className="text-4xl md:text-7xl font-black text-white tracking-tighter leading-none drop-shadow-lg mb-2">
                    {sellerProfile?.business_name || 'My Business'}
                  </h1>
                  <p className="text-white/60 font-medium text-sm md:text-base tracking-wide flex items-center gap-2">
                    ID: {profile?.id?.substring(0, 8).toUpperCase()} • Est. {new Date(sellerProfile?.created_at || Date.now()).getFullYear()}
                  </p>
                </div>

                {/* Card Logo (Bottom Right) */}
                <div className="relative group/logo flex-shrink-0">
                  <div className="w-28 h-28 md:w-40 md:h-40 bg-white rounded-[2rem] p-1.5 shadow-2xl rotate-3 group-hover/logo:rotate-0 transition-transform duration-500 ease-out">
                    <div className="w-full h-full rounded-[1.7rem] overflow-hidden bg-slate-50 border border-slate-100 relative">
                      {sellerProfile?.business_logo ? (
                        <img src={getOptimizedImageUrl(sellerProfile.business_logo, 200, 200)} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-blue-200 bg-blue-50"><i className="ri-store-fill text-5xl"></i></div>
                      )}

                      {/* Edit Overlay */}
                      <button
                        onClick={() => setShowSettingsModal(true)}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity cursor-pointer"
                      >
                        <i className="ri-edit-circle-fill text-white text-3xl"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-8 md:mb-12">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="group bg-white dark:bg-slate-800 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col justify-between min-h-[9rem] md:h-40 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-600 transition-colors">
                <i className="ri-settings-4-fill text-2xl"></i>
              </div>
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-full text-[10px] font-bold uppercase tracking-wider group-hover:bg-blue-600 group-hover:text-white transition-colors">
                Manage
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">Store Settings</h3>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Identity & Branding</p>
            </div>
          </button>

          {(!globalSubsEnabled || (subscriptionStatus === 'active' || profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'publisher_seller')) ? (
            <Link
              to="/seller/add-product"
              className="group bg-blue-600 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-1 transition-all text-left flex flex-col justify-between min-h-[9rem] md:h-40 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white backdrop-blur-md">
                <i className="ri-add-line text-2xl font-bold"></i>
              </div>
              <div className="relative z-10">
                <h3 className="text-lg font-bold text-white">Add New Product</h3>
                <p className="text-xs font-medium text-blue-100 mt-1">Create a new listing</p>
              </div>
            </Link>
          ) : (
            <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-40 opacity-70">
              <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-400">
                <i className="ri-lock-2-fill text-2xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-500">Add Product</h3>
                <p className="text-xs font-medium text-slate-400 mt-1">Subscription Required</p>
              </div>
            </div>
          )}

          {(profile?.role === 'admin' || profile?.role === 'super_admin') ? (
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="group bg-slate-900 dark:bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col justify-between min-h-[9rem] md:h-40"
            >
              <div className="w-12 h-12 bg-white/20 dark:bg-slate-200 rounded-2xl flex items-center justify-center text-white dark:text-slate-900">
                <i className="ri-shield-star-fill text-2xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white dark:text-slate-900">Admin Controls</h3>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">System management</p>
              </div>
            </button>
          ) : (
            <div className="group bg-white dark:bg-slate-800 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col justify-between min-h-[9rem] md:h-40">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-600">
                <i className="ri-line-chart-fill text-2xl"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Analytics</h3>
                <p className="text-xs font-medium text-slate-400 mt-1">View performance insights</p>
              </div>
            </div>
          )}
        </div>

        {/* Business Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Business Settings</h2>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">Configure your merchant identity</p>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>

              <form onSubmit={handleProfileUpdate} className="p-10 space-y-8 overflow-y-auto max-h-[70vh]">
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <div className="relative group/edit-logo">
                    <div className="w-32 h-32 rounded-3xl bg-slate-100 dark:bg-slate-800 overflow-hidden border-4 border-white dark:border-slate-700 shadow-xl">
                      <img
                        src={logoPreview || getOptimizedImageUrl(sellerProfile?.business_logo, 200, 85)}
                        className="w-full h-full object-cover"
                        alt="Preview"
                        onError={(e) => {
                          e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(settingsFormData.businessName || 'B');
                        }}
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/edit-logo:opacity-100 transition-opacity">
                      <div className="bg-black/40 inset-0 absolute rounded-2xl"></div>
                      <ImageUploader
                        folder="profiles"
                        autoUpload={false}
                        onFileSelected={handleLogoSelect}
                        hideInternalUI={true}
                        size="custom"
                        noBorder
                        className="absolute inset-0 z-20 cursor-pointer"
                      />
                      <i className="ri-camera-lens-line text-white text-3xl relative z-10 pointer-events-none"></i>
                    </div>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-sm font-black text-slate-900 dark:text-white mb-2">Merchant Branding</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                      Upload your business logo. Recommended size is 500x500 pixels.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Business Name</label>
                    <input
                      type="text"
                      required
                      value={settingsFormData.businessName}
                      onChange={(e) => setSettingsFormData({ ...settingsFormData, businessName: e.target.value })}
                      className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500/30 rounded-2xl px-6 font-bold outline-none text-slate-900 dark:text-white transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Industry Sector</label>
                    <select
                      required
                      value={settingsFormData.businessCategory}
                      onChange={(e) => setSettingsFormData({ ...settingsFormData, businessCategory: e.target.value })}
                      className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500/30 rounded-2xl px-6 font-bold outline-none text-slate-900 dark:text-white transition-all appearance-none"
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mission Statement (Description)</label>
                    <textarea
                      rows={4}
                      value={settingsFormData.businessDescription}
                      onChange={(e) => setSettingsFormData({ ...settingsFormData, businessDescription: e.target.value })}
                      className="w-full p-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500/30 rounded-2xl font-bold outline-none text-slate-900 dark:text-white transition-all resize-none"
                      placeholder="Describe your business..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(false)}
                    className="flex-1 h-16 bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="flex-[2] h-16 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSavingSettings ? (
                      <i className="ri-loader-4-line animate-spin text-xl"></i>
                    ) : (
                      <>
                        <i className="ri-save-3-line text-lg"></i>
                        Save Profile Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* System Stats Section */}
        {/* System Stats Section */}
        <div className="mb-24">
          <div className="flex items-center gap-2 mb-6 ml-2">
            <i className="ri-bar-chart-groupped-line text-blue-500 text-xl"></i>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Performance Analytics</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            {[
              { label: 'Inventory', value: stats.total, unit: 'Items', icon: 'ri-shopping-bag-3-fill', color: 'from-blue-600 to-indigo-600' },
              { label: 'Asset Value', value: stats.totalValue.toLocaleString(), unit: '', icon: 'ri-briefcase-4-fill', color: 'from-indigo-500 to-purple-600' },
              { label: 'Total Views', value: stats.views.toLocaleString(), unit: '', icon: 'ri-eye-fill', color: 'from-purple-500 to-pink-500' },
              { label: 'Active', value: stats.active, unit: 'Items', icon: 'ri-check-double-line', color: 'from-emerald-500 to-teal-500' },
              { label: 'Avg. Price', value: stats.avgPrice.toFixed(0), unit: 'GH₵', icon: 'ri-price-tag-3-fill', color: 'from-cyan-500 to-blue-500' }
            ].map((stat, i) => (
              <div key={i} className="group relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden cursor-default">
                <div className={`absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br ${stat.color} opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform duration-500`}></div>
                <div className="flex flex-col h-full justify-between gap-3 md:gap-4">
                  <div className="flex justify-between items-start">
                    <div className={`w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br ${stat.color} rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-md`}>
                      <i className={`${stat.icon} text-sm md:text-lg`}></i>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1 truncate">
                      <span className="text-[10px] md:text-xs font-bold text-slate-400 mr-0.5 align-top">{stat.unit === 'GH₵' ? 'GH₵' : ''}</span>
                      {stat.value}
                      <span className="text-[9px] md:text-xs font-bold text-slate-400 ml-1 hidden md:inline-block">{stat.unit !== 'GH₵' ? stat.unit : ''}</span>
                    </p>
                    <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
                Merchant Products
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 rounded-full uppercase tracking-widest">{products.length} Total</span>
              </h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Manage your active listings</p>
            </div>

            {/* Search Bar */}
            <div className="relative w-full md:w-96">
              <i className="ri-search-2-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"></i>
              <input
                type="text"
                placeholder="Search inventory by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold shadow-sm focus:border-blue-500 dark:focus:border-blue-500 outline-none transition-all focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            {isLoading ? (
              <div className="py-32 flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-slate-100 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin mb-8"></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Retrieving Inventory Data...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="py-24 text-center bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border border-slate-50 dark:border-slate-800">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <i className="ri-folder-add-line text-3xl text-slate-200 dark:text-slate-600"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">No Listings Found</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8 font-semibold text-xs leading-relaxed">Your inventory is currently empty. Add your first product to begin trading on the marketplace.</p>
                <Link
                  to="/seller/add-product"
                  className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 active:scale-95 uppercase tracking-widest text-[10px]"
                >
                  Create Your First Listing
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                {products.filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.category.toLowerCase().includes(searchQuery.toLowerCase())).map((product) => (
                  <div key={product.id} className="group relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-4 transition-all hover:shadow-xl hover:border-blue-100 dark:hover:border-blue-900 flex flex-row items-center gap-4 md:gap-8">
                    {/* Compact Image */}
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-700 flex-shrink-0 relative border border-slate-100 dark:border-slate-600">
                      {product.images?.[0] ? (
                        <img
                          src={getOptimizedImageUrl(product.images[0], 200, 85)}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200 dark:text-slate-600">
                          <i className="ri-image-2-line text-2xl"></i>
                        </div>
                      )}

                      {/* Active Status Dot */}
                      <div className={`absolute top-2 right-2 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${product.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider">{product.category}</span>
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                              <i className="ri-eye-line text-blue-500"></i>
                              {product.views_count || 0}
                            </div>
                          </div>
                          <h3 className="text-base md:text-xl font-bold text-slate-900 dark:text-white truncate pr-4">{product.name}</h3>
                        </div>
                        <p className="text-lg font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {product.price_type === 'fixed' ? `GH₵${product.price?.toLocaleString()}` : 'Contact'}
                        </p>
                      </div>

                      {/* Desktop Actions */}
                      <div className="hidden md:flex gap-3 mt-4">
                        <button
                          onClick={() => navigate(`/seller/edit-product/${product.id}`)}
                          className="px-4 py-2 bg-slate-50 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-600 dark:text-slate-200 hover:text-blue-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleStatus(product.id, product.is_active)}
                          className="px-4 py-2 bg-slate-50 dark:bg-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-600 dark:text-slate-200 hover:text-amber-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                        >
                          {product.is_active ? 'Hide' : 'Publish'}
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"><i className="ri-delete-bin-line"></i></button>
                      </div>

                      {/* Mobile Actions (Icon Only) */}
                      <div className="flex md:hidden gap-3 mt-2">
                        <button onClick={() => navigate(`/seller/edit-product/${product.id}`)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"><i className="ri-edit-line"></i></button>
                        <button onClick={() => handleToggleStatus(product.id, product.is_active)} className={`p-2 rounded-lg ${product.is_active ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                          <i className={product.is_active ? "ri-eye-off-line" : "ri-eye-line"}></i>
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 bg-rose-100 text-rose-600 rounded-lg"><i className="ri-delete-bin-line"></i></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
