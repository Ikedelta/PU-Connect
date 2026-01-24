import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';
import ImageUploader from '../../components/base/ImageUploader';

const categories = [
  'Electronics',
  'Books & Stationery',
  'Fashion & Accessories',
  'Food & Beverages',
  'Sports & Fitness',
  'Home & Living',
  'Services',
  'Other',
];

type Seller = {
  id: string;
  full_name: string;
  email: string;
};

export default function AddProduct() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    priceType: 'fixed' as 'fixed' | 'contact',
    images: [] as string[], // Local blob URLs for previews
    sellerId: '',
    whatsappNumber: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const NAME_LIMIT = 60;
  const DESC_LIMIT = 1000;

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const checkEligibility = async () => {
      if (authLoading) return;

      // 1. Role Check
      if (profile?.role !== 'seller' && profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        navigate('/seller/status');
        return;
      }

      // 2. Subscription Check (Only for non-admins)
      if (profile?.role === 'seller' && !isAdmin) {
        try {
          const { data: settings } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'subscriptions_enabled')
            .maybeSingle();

          const isSubsEnabled = settings ? settings.value : true; // Default true

          if (isSubsEnabled) {
            const { data: seller } = await supabase
              .from('seller_profiles')
              .select('subscription_status')
              .eq('user_id', profile.id)
              .maybeSingle();

            if (seller && seller.subscription_status !== 'active') {
              alert('You must have an active subscription to verify and list products.');
              navigate('/seller/dashboard');
            }
          }
        } catch (err) {
          console.error('Error checking subscription:', err);
        }
      }
    };

    checkEligibility();
  }, [profile, authLoading, navigate, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchSellers();
    } else if (profile?.id) {
      setFormData(prev => ({ ...prev, sellerId: profile.id }));
    }

    // Attempt to pre-fill phone if available
    if (profile?.phone && !formData.whatsappNumber) {
      setFormData(prev => ({ ...prev, whatsappNumber: profile.phone || '' }));
    }
  }, [isAdmin, profile]);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['seller', 'admin', 'super_admin'])
        .order('full_name');

      if (error) throw error;
      setSellers(data || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    else if (formData.name.length > NAME_LIMIT) newErrors.name = `Name must be less than ${NAME_LIMIT} characters`;

    if (!formData.category) newErrors.category = 'Please select a category';

    if (formData.priceType === 'fixed') {
      if (!formData.price) newErrors.price = 'Price is required';
      else if (parseFloat(formData.price) <= 0) newErrors.price = 'Price must be greater than 0';
    }

    if (!formData.whatsappNumber) newErrors.whatsappNumber = 'WhatsApp number is required';

    // Image validation: At least 1, max 8
    if (formData.images.length === 0) newErrors.images = 'At least 1 image is required';
    if (formData.images.length > 8) newErrors.images = 'Maximum 8 images allowed';

    if (isAdmin && !formData.sellerId) newErrors.sellerId = 'Please select a merchant';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper for System Admin Bypass
  const adminInsertProduct = async (productData: any) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');
    if (isBypass && secret) {
      const { data, error } = await supabase.rpc('admin_insert_product', {
        product_data: productData,
        secret_key: secret
      });
      return { error };
    }
    return await supabase.from('products').insert([productData]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      const firstError = Object.values(errors)[0];
      if (firstError) setNotification({ type: 'error', message: 'Please fix the errors in the form' });
      return;
    }

    setLoading(true);

    try {
      // 1. Upload all selected images (Parallelized)
      const { uploadImage, compressImage } = await import('../../lib/uploadImage');

      const uploadPromises = selectedFiles.map(async (file) => {
        const compressed = await compressImage(file);
        const { url } = await uploadImage(compressed, 'products', isAdmin ? formData.sellerId : profile?.id);
        return url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      // 2. Prepare final data
      const productData = {
        seller_id: isAdmin ? formData.sellerId : profile?.id,
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        price: formData.priceType === 'fixed' ? parseFloat(formData.price) : null,
        price_type: formData.priceType,
        images: uploadedUrls,
        whatsapp_number: formData.whatsappNumber,
        is_active: true,
      };

      const { error } = await adminInsertProduct(productData);

      if (error) throw error;

      setNotification({ type: 'success', message: 'Product successfully listed!' });
      setTimeout(() => {
        if (isAdmin) {
          navigate('/admin/dashboard');
        } else {
          navigate('/seller/dashboard');
        }
      }, 1500);
    } catch (error: any) {
      console.error('Error adding product:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to add product' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setSelectedFiles(prev => [...prev, file]);
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, previewUrl],
    }));
  };

  const removeImage = (index: number) => {
    // Revoke object URL to avoid memory leak
    if (formData.images[index].startsWith('blob:')) {
      URL.revokeObjectURL(formData.images[index]);
    }
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-teal-600 animate-spin"></i>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
      <Navbar />

      {/* Global Notification */}
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300`}>
          <div className={`px-6 py-3 rounded-2xl shadow-xl border flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' :
            notification.type === 'error' ? 'bg-rose-500 border-rose-400 text-white' :
              'bg-blue-500 border-blue-400 text-white'
            }`}>
            <i className={
              notification.type === 'success' ? 'ri-checkbox-circle-line' :
                notification.type === 'error' ? 'ri-error-warning-line' :
                  'ri-information-line'
            }></i>
            <p className="text-sm font-bold uppercase tracking-wide">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 md:gap-10 mb-12 md:mb-20">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-6 md:mb-8 shadow-xl shadow-blue-500/20">
              <i className="ri-shopping-bag-3-line"></i>
              Inventory Console
            </div>
            <h1 className="text-4xl md:text-8xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-4 md:mb-6">
              Stock Your<br /><span className="text-blue-600">Storefront.</span>
            </h1>
            <p className="max-w-xl text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-3 justify-center lg:justify-start">
              <span className="w-10 h-[2px] bg-blue-600/30"></span>
              {isAdmin ? "Global Merchant Operations Center" : "Launch your next product to the campus community"}
            </p>
          </div>
          <button
            onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/seller/dashboard')}
            className="h-14 md:h-16 px-8 bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 border border-slate-100 dark:border-slate-700 font-black rounded-2xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 group w-full md:w-auto"
          >
            <i className="ri-close-circle-line text-xl group-hover:rotate-90 transition-transform duration-500"></i>
            Discard Entry
          </button>
        </div>

        <div className="flex flex-col-reverse xl:grid xl:grid-cols-5 gap-8 xl:gap-16 items-start relative">
          {/* Form Section */}
          <div className="xl:col-span-3 space-y-10">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

              <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
                {/* Admin Merchant Selection */}
                {isAdmin && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Target Merchant Account
                    </label>
                    <div className="relative group">
                      <select
                        value={formData.sellerId}
                        onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                        className="w-full px-6 py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 focus:border-blue-500/30 rounded-2xl font-bold outline-none text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                        required
                      >
                        <option value="">Select Merchant...</option>
                        {sellers.map((seller) => (
                          <option key={seller.id} value={seller.id}>{seller.full_name}</option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-6 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    </div>
                  </div>
                )}

                {/* Main Details */}
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Identity</label>
                      <span className="text-[9px] font-bold text-slate-300">{formData.name.length}/{NAME_LIMIT}</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500/20 rounded-2xl font-bold outline-none text-base text-slate-900 dark:text-white transition-all placeholder:text-slate-300"
                      placeholder="e.g. MacBook Pro M1 2021"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Market Category</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { name: 'Electronics', icon: 'ri-macbook-line' },
                        { name: 'Books & Stationery', icon: 'ri-book-3-line' },
                        { name: 'Fashion & Accessories', icon: 'ri-t-shirt-line' },
                        { name: 'Food & Beverages', icon: 'ri-restaurant-line' },
                        { name: 'Sports & Fitness', icon: 'ri-basketball-line' },
                        { name: 'Home & Living', icon: 'ri-home-smile-line' },
                        { name: 'Services', icon: 'ri-service-line' },
                        { name: 'Other', icon: 'ri-more-fill' }
                      ].map((cat) => (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat.name })}
                          className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 text-center group ${formData.category === cat.name
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'bg-slate-50 dark:bg-slate-950 border-transparent hover:border-blue-100 dark:hover:border-blue-900/50 text-slate-500 dark:text-slate-400'
                            }`}
                        >
                          <i className={`${cat.icon} text-xl ${formData.category === cat.name ? 'text-white' : 'text-slate-300 group-hover:text-blue-500'} transition-colors`}></i>
                          <span className="text-[9px] font-bold uppercase tracking-wide leading-tight">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inventory Story</label>
                    <span className="text-[9px] font-bold text-slate-300">{formData.description.length}/{DESC_LIMIT}</span>
                  </div>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500/20 rounded-3xl font-medium outline-none text-sm text-slate-900 dark:text-white transition-all resize-none placeholder:text-slate-300 leading-relaxed"
                    placeholder="Describe your product in detail. Mention condition, features, and specific reasons to buy..."
                  />
                </div>

                {/* Pricing Strategy */}
                <div className="bg-slate-50 dark:bg-slate-950 p-6 md:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-6">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pricing Model</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    {['fixed', 'contact'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, priceType: type as any })}
                        className={`flex-1 p-4 rounded-2xl border-2 transition-all group flex items-center justify-center gap-3 ${formData.priceType === type
                          ? 'bg-white dark:bg-slate-900 border-blue-500 text-blue-600 shadow-sm'
                          : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300'
                          }`}
                      >
                        <i className={`${type === 'fixed' ? 'ri-price-tag-3-fill' : 'ri-chat-1-fill'} text-lg`}></i>
                        <span className="text-xs font-bold uppercase tracking-widest">{type === 'fixed' ? 'Fixed Price' : 'Negotiable'}</span>
                      </button>
                    ))}
                  </div>

                  {formData.priceType === 'fixed' && (
                    <div className="relative animate-in slide-in-from-top-2 duration-200">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-xl text-slate-400">GH₵</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full pl-20 pr-6 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-2xl font-black text-2xl text-slate-900 dark:text-white placeholder:text-slate-200 outline-none transition-all"
                        placeholder="0.00"
                        required={formData.priceType === 'fixed'}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Business Contact</label>
                  <div className="relative group">
                    <div className="absolute left-0 top-0 bottom-0 w-14 flex items-center justify-center bg-emerald-500/10 rounded-l-2xl border-y border-l border-emerald-500/20">
                      <i className="ri-whatsapp-fill text-emerald-500 text-xl"></i>
                    </div>
                    <input
                      type="tel"
                      required
                      value={formData.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      className="w-full pl-16 pr-6 py-5 bg-slate-50 dark:bg-slate-950 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl font-bold text-lg text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-300"
                      placeholder="054XXXXXXX"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 pl-1 font-medium">Buyers will contact you via this WhatsApp number.</p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-blue-600/20 disabled:opacity-70 disabled:grayscale flex items-center justify-center gap-3 cursor-pointer"
                  >
                    {loading ? <i className="ri-loader-4-line animate-spin text-xl"></i> : (
                      <>
                        <span>Publish Listing</span>
                        <i className="ri-arrow-right-line text-lg"></i>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Media Sidebar - Sticky on Desktop */}
          <div className="xl:col-span-2 space-y-8 xl:sticky xl:top-36 h-fit">
            <div className="bg-slate-900 dark:bg-black p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden ring-1 ring-white/10">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-slate-900/0 to-transparent"></div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black tracking-tight flex items-center gap-3">
                    <i className="ri-image-add-line text-blue-400"></i>
                    Gallery
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${formData.images.length >= 1 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                    {formData.images.length} / 8
                  </span>
                </div>

                {formData.images.length === 0 ? (
                  /* Empty State - Big Drop Zone */
                  <div className="w-full aspect-[4/5] bg-white/5 border-2 border-dashed border-white/10 rounded-3xl relative group hover:bg-white/10 hover:border-blue-500/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-6 p-4 text-center">
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-600/30 group-hover:scale-110 transition-transform duration-300">
                      <i className="ri-camera-lens-line text-3xl"></i>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white mb-2">Add Photos</p>
                      <p className="text-xs font-medium text-slate-400 leading-relaxed max-w-[150px] mx-auto">
                        Upload high-quality images to attract more buyers.
                      </p>
                    </div>
                    <ImageUploader
                      folder="products"
                      autoUpload={false}
                      onFileSelected={handleFileSelect}
                      hideInternalUI={true}
                      size="custom"
                      noBorder
                      className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                ) : (
                  /* Populated Grid */
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in zoom-in-95 duration-300">
                      {formData.images.map((url, idx) => (
                        <div key={idx} className={`aspect-square rounded-2xl overflow-hidden bg-slate-800 relative group border ${idx === 0 ? 'border-blue-500 ring-2 ring-blue-500/30 col-span-2 aspect-[16/9]' : 'border-slate-700/50'}`}>
                          <img src={url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={`Product ${idx}`} />

                          <button
                            onClick={() => removeImage(idx)}
                            type="button"
                            className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-rose-500 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-90"
                          >
                            <i className="ri-close-line"></i>
                          </button>

                          {idx === 0 && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6">
                              <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                                <i className="ri-star-fill text-yellow-500"></i> Cover Image
                              </span>
                            </div>
                          )}
                        </div>
                      ))}

                      {formData.images.length < 8 && (
                        <div className="aspect-square bg-white/5 border-2 border-dashed border-white/10 rounded-2xl relative group hover:bg-white/10 hover:border-blue-500/30 transition-all cursor-pointer flex items-center justify-center">
                          <i className="ri-add-line text-2xl text-slate-500 group-hover:text-blue-400 transition-colors"></i>
                          <ImageUploader
                            folder="products"
                            autoUpload={false}
                            onFileSelected={handleFileSelect}
                            hideInternalUI={true}
                            size="custom"
                            noBorder
                            className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-800/30 flex items-start gap-4">
              <i className="ri-information-fill text-blue-500 text-xl mt-0.5"></i>
              <div>
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 mb-1">Selling Tip</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                  Products with 3+ images and detailed descriptions sell 2x faster. Be honest about item condition.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
