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
    if (!authLoading && profile?.role !== 'seller' && profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      navigate('/seller/status');
    }
  }, [profile, authLoading, navigate]);

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

    // Images are now optional - removed validation

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-36">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 mb-20">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-8 shadow-xl shadow-blue-500/20">
              <i className="ri-shopping-bag-3-line"></i>
              Inventory Console
            </div>
            <h1 className="text-5xl md:text-8xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-6">
              Stock Your<br /><span className="text-blue-600">Storefront.</span>
            </h1>
            <p className="max-w-xl text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-3 justify-center lg:justify-start">
              <span className="w-10 h-[2px] bg-blue-600/30"></span>
              {isAdmin ? "Global Merchant Operations Center" : "Launch your next product to the campus community"}
            </p>
          </div>
          <button
            onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/seller/dashboard')}
            className="h-16 px-8 bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 border border-slate-100 dark:border-slate-700 font-black rounded-2xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 group"
          >
            <i className="ri-close-circle-line text-xl group-hover:rotate-90 transition-transform duration-500"></i>
            Discard Entry
          </button>
        </div>

        <div className="flex flex-col-reverse xl:grid xl:grid-cols-5 gap-10">
          {/* Form Section */}
          <div className="xl:col-span-3 space-y-10">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 md:p-14 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32"></div>

              <form onSubmit={handleSubmit} className="space-y-12 relative z-10">
                {/* Admin Merchant Selection */}
                {isAdmin && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Target Merchant Account
                    </label>
                    <div className="relative group">
                      <select
                        value={formData.sellerId}
                        onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                        className="w-full px-8 py-5 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 focus:border-blue-500/30 rounded-2xl font-bold outline-none text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
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
                      className="w-full px-8 py-5 bg-slate-50/50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500/20 rounded-2xl font-bold outline-none text-sm text-slate-900 dark:text-white transition-all placeholder:text-slate-300"
                      placeholder="e.g. MacBook Pro 2021"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Market Category</label>
                    <div className="relative">
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-8 py-5 bg-slate-50/50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500/20 rounded-2xl font-bold outline-none text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Choose category...</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-6 top-1/2 -translate-y-1/2 text-slate-400"></i>
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
                    rows={5}
                    className="w-full px-8 py-6 bg-slate-50/50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500/20 rounded-3xl font-bold outline-none text-sm text-slate-900 dark:text-white transition-all resize-none placeholder:text-slate-300"
                    placeholder="Tell buyers why they need this..."
                  />
                </div>

                {/* Pricing Strategy */}
                <div className="bg-slate-50/50 dark:bg-slate-950 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-8">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {['fixed', 'contact'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, priceType: type as any })}
                        className={`flex-1 p-6 rounded-3xl border-2 transition-all group flex flex-col items-center gap-3 ${formData.priceType === type
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20'
                          : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-500'
                          }`}
                      >
                        <i className={`${type === 'fixed' ? 'ri-price-tag-3-line' : 'ri-exchange-line'} text-2xl`}></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">{type === 'fixed' ? 'Set Price' : 'Negotiable'}</span>
                      </button>
                    ))}
                  </div>

                  {formData.priceType === 'fixed' && (
                    <div className="relative max-w-xs transition-all ring-offset-2 focus-within:ring-4 ring-blue-500/10 rounded-2xl">
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 font-black text-2xl text-slate-300">GH₵</span>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full pl-24 pr-8 py-6 bg-white dark:bg-slate-900 border-none rounded-2xl font-black text-3xl text-slate-900 dark:text-white placeholder:text-slate-200 outline-none"
                        placeholder="0.00"
                        required={formData.priceType === 'fixed'}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Business Line (WhatsApp)</label>
                  <div className="relative group">
                    <i className="ri-whatsapp-fill absolute left-8 top-1/2 -translate-y-1/2 text-emerald-500 text-2xl"></i>
                    <input
                      type="tel"
                      required
                      value={formData.whatsappNumber}
                      onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                      className="w-full pl-16 pr-8 py-6 bg-slate-50/50 dark:bg-slate-950 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl font-black text-lg text-slate-900 dark:text-white outline-none transition-all"
                      placeholder="054XXXXXXXX"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-20 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[2.2rem] font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-4 cursor-pointer"
                >
                  {loading ? <i className="ri-loader-4-line animate-spin text-2xl"></i> : (
                    <>
                      Publish to Marketplace
                      <i className="ri-rocket-fill text-xl text-blue-400 dark:text-blue-600"></i>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Media Sidebar */}
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-slate-900 dark:bg-black p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-blue-600/10 to-transparent"></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-10 tracking-tight flex items-center gap-4">
                  <i className="ri-gallery-fill text-blue-400"></i>
                  Media Gallery
                </h3>

                <div className="grid grid-cols-2 gap-5 mb-10">
                  {formData.images.map((url, idx) => (
                    <div key={idx} className="aspect-square rounded-3xl overflow-hidden bg-slate-800 relative group border border-slate-700/50">
                      <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-3 right-3 w-8 h-8 bg-rose-600 rounded-full flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                      >
                        <i className="ri-close-line"></i>
                      </button>
                      {idx === 0 && (
                        <div className="absolute inset-x-0 bottom-0 bg-blue-600/90 py-2 text-[8px] font-black uppercase tracking-widest text-center backdrop-blur-md">Headline Image</div>
                      )}
                    </div>
                  ))}

                  {formData.images.length < 8 && (
                    <div className="aspect-square bg-white/5 border-2 border-dashed border-white/10 rounded-3xl relative group hover:bg-white/10 transition-all cursor-pointer">
                      {/* Visual UI Layer */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 group-hover:text-blue-400 transition-colors pointer-events-none z-0">
                        <i className="ri-image-add-line text-3xl group-hover:scale-110 transition-transform duration-300"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest">Add Photo</span>
                      </div>

                      {/* Functional Click Layer */}
                      <ImageUploader
                        folder="products"
                        autoUpload={false}
                        onFileSelected={handleFileSelect}
                        hideInternalUI={true}
                        size="custom"
                        noBorder
                        className="absolute inset-0 z-10 w-full h-full"
                      />
                    </div>
                  )}
                </div>

                <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inventory Slot</span>
                    <span className="text-xs font-black text-blue-400">{formData.images.length}/8</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(formData.images.length / 8) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 rounded-[3rem] text-white shadow-2xl shadow-blue-500/20 group translate-y-0 hover:-translate-y-2 transition-transform duration-500">
              <i className="ri-shield-user-fill text-4xl text-blue-200 mb-8 block group-hover:rotate-12 transition-transform"></i>
              <h4 className="text-xl font-black mb-4 tracking-tight">Enterprise Safety</h4>
              <p className="text-blue-100 text-xs font-bold leading-relaxed uppercase tracking-wider opacity-80">
                All campus listings are cryptographically signed and monitored for community compliance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
