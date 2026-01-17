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

  const { data: products = [], isLoading } = useProducts({
    sellerId: user?.id
  });

  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();

  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    views: products.reduce((sum, p) => sum + (p.views_count || 0), 0)
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
    return updateProductMutation.mutate({ id: productId, updates });
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
    return deleteProductMutation.mutate(productId);
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 mb-16 md:mb-24 text-center md:text-left bg-slate-50 dark:bg-slate-800/50 p-8 md:p-12 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-8 flex-1">
            <div className="relative group/logo">
              <div className={`w-32 h-32 rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-700 bg-white transition-all ${updatingLogo ? 'opacity-50' : ''}`}>
                {sellerProfile?.business_logo ? (
                  <img
                    src={getOptimizedImageUrl(sellerProfile.business_logo, 200, 85)}
                    alt={sellerProfile.business_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-4xl">
                    <i className="ri-store-3-line"></i>
                  </div>
                )}
              </div>

              {/* Modal Trigger Overlay */}
              <button
                onClick={() => setShowSettingsModal(true)}
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity z-10"
              >
                <div className="bg-black/60 backdrop-blur-sm inset-0 absolute rounded-3xl"></div>
                <div className="relative z-30 text-white text-center">
                  <i className="ri-edit-circle-line text-2xl mb-1 block"></i>
                  <span className="text-[8px] font-black uppercase tracking-widest leading-none">Edit Profile</span>
                </div>
              </button>

              {updatingLogo && (
                <div className="absolute inset-0 flex items-center justify-center z-40">
                  <i className="ri-loader-4-line animate-spin text-3xl text-blue-600"></i>
                </div>
              )}
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-900 dark:bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-6">
                <i className="ri-shield-star-line text-blue-400"></i>
                Official Seller Portal
              </div>
              <h1 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight mb-4">
                {sellerProfile?.business_name || 'Merchant'}<br />
                <span className="text-blue-600">Operations.</span>
              </h1>
              <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                {sellerProfile?.business_category || 'General'} • Established {new Date(sellerProfile?.created_at || Date.now()).getFullYear()}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-10 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <i className="ri-settings-4-line text-lg text-blue-500"></i>
              <span>Edit Business Information</span>
            </button>
            <Link
              to="/seller/add-product"
              className="group px-10 py-5 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-4 active:scale-95 shadow-lg shadow-blue-500/20"
            >
              <span>Add New Product</span>
              <i className="ri-add-line text-xl"></i>
            </Link>
            {(profile?.role === 'admin' || profile?.role === 'super_admin') && (
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="group px-10 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-widest rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <i className="ri-arrow-left-line text-lg"></i>
                <span>Admin Dashboard</span>
              </button>
            )}
          </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
          {[
            { label: 'Inventory Count', value: stats.total, icon: 'ri-shopping-bag-3-fill', color: 'from-slate-700 to-slate-900' },
            { label: 'Published Items', value: stats.active, icon: 'ri-check-double-line', color: 'from-blue-500 to-blue-600' },
            { label: 'Cumulative Views', value: stats.views.toLocaleString(), icon: 'ri-eye-line', color: 'from-emerald-500 to-emerald-600' }
          ].map((stat, i) => (
            <div key={i} className="relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-8 rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-between overflow-hidden group">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-[0.05] rounded-bl-full group-hover:scale-110 transition-transform duration-500`}></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
              </div>
              <div className={`w-14 h-14 bg-gradient-to-tr ${stat.color} rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                <i className={`${stat.icon} text-2xl`}></i>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-50 dark:border-slate-800">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
              Merchant Products
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 rounded-full uppercase tracking-widest">{products.length} Total</span>
            </h2>
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Online</span>
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
              <div className="grid grid-cols-1 gap-10">
                {products.map((product) => (
                  <div key={product.id} className="group relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-6 transition-all hover:shadow-xl hover:border-blue-100 dark:hover:border-blue-900 flex flex-col lg:flex-row items-center gap-10">
                    {/* Product Image */}
                    <div className="w-full lg:w-48 h-48 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-700 border border-slate-50 dark:border-slate-700 flex-shrink-0 relative">
                      {product.images?.[0] ? (
                        <img
                          src={getOptimizedImageUrl(product.images[0], 400, 85)}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200 dark:text-slate-600">
                          <i className="ri-image-2-line text-4xl"></i>
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg shadow-md ${product.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'}`}>
                          {product.is_active ? 'Active' : 'Private'}
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 w-full flex flex-col justify-between">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                        <div>
                          <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors tracking-tight mb-2">{product.name}</h3>
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <i className="ri-eye-line text-blue-600 dark:text-blue-400"></i>
                              {product.views_count || 0} Views
                            </div>
                            <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">{product.category}</span>
                          </div>
                        </div>
                        <div className="md:text-right">
                          <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {product.price_type === 'fixed' ? (
                              <>
                                <span className="text-sm text-blue-600 dark:text-blue-400 font-bold mr-1">GH₵</span>
                                {product.price?.toLocaleString()}
                              </>
                            ) : (
                              'Negotiable'
                            )}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{product.price_type === 'fixed' ? 'Fixed Price' : 'Flexible Pricing'}</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => navigate(`/seller/edit-product/${product.id}`)}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-all border border-slate-100 dark:border-slate-600 active:scale-95 uppercase tracking-widest text-[10px]"
                        >
                          <i className="ri-edit-line text-base"></i>
                          Edit Details
                        </button>
                        <button
                          onClick={() => handleToggleStatus(product.id, product.is_active)}
                          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 font-bold rounded-xl transition-all active:scale-95 uppercase tracking-widest text-[10px] ${product.is_active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30'
                            }`}
                        >
                          <i className={product.is_active ? 'ri-eye-off-line text-base' : 'ri-eye-line text-base'}></i>
                          {product.is_active ? 'Hide Listing' : 'Publish Listing'}
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="sm:flex-none flex items-center justify-center w-12 h-12 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all border border-rose-100 dark:border-rose-900/30 active:scale-95"
                          title="Delete Listing"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
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
