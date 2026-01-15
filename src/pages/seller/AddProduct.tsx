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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    priceType: 'fixed' as 'fixed' | 'contact',
    images: [] as string[],
    sellerId: '',
    whatsappNumber: '',
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.category) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.sellerId) {
      alert('Please select a seller');
      return;
    }

    setLoading(true);

    try {
      const productData = {
        seller_id: formData.sellerId,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        price: formData.priceType === 'fixed' ? parseFloat(formData.price) : null,
        price_type: formData.priceType,
        images: formData.images.length > 0 ? formData.images : null,
        whatsapp_number: formData.whatsappNumber,
        is_active: true,
      };

      const { error } = await supabase
        .from('products')
        .insert([productData]);

      if (error) throw error;

      alert('Product added successfully!');
      if (isAdmin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/seller/dashboard');
      }
    } catch (error: any) {
      console.error('Error adding product:', error);
      alert(error.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUploaded = (url: string) => {
    setFormData(prev => ({
      ...prev,
      images: [...prev.images, url],
    }));
  };

  const removeImage = (index: number) => {
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold uppercase tracking-widest rounded-full mb-6">
              <i className="ri-add-circle-line text-blue-400 dark:text-blue-600"></i>
              Post New Product
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
              Create<br /><span className="text-blue-600 dark:text-blue-500">Listing.</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">
              {isAdmin ? "Global Inventory Management System" : "List your product on the campus marketplace"}
            </p>
          </div>
          <button
            onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/seller/dashboard')}
            className="text-[10px] font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2 group"
          >
            <i className="ri-arrow-left-s-line text-lg group-hover:-translate-x-1 transition-transform"></i>
            Cancel & Exit
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Form Section */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-700 p-8 md:p-12 transition-all">
              <form onSubmit={handleSubmit} className="space-y-10">

                {/* Admin Selection */}
                {isAdmin && (
                  <div className="bg-blue-50/50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100/50 dark:border-blue-900/30 space-y-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Select Merchant
                    </label>
                    <div className="relative">
                      <select
                        value={formData.sellerId}
                        onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                        className="w-full px-6 py-4 bg-white dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer placeholder-slate-400"
                        required
                      >
                        <option value="" className="dark:bg-slate-900">Select a registered seller...</option>
                        {sellers.map((seller) => (
                          <option key={seller.id} value={seller.id} className="dark:bg-slate-900">
                            {seller.full_name} ({seller.email})
                          </option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                    </div>
                  </div>
                )}

                {/* Basic Information */}
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Product Name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                        placeholder="e.g. Vintage Denim Jacket"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Category
                      </label>
                      <div className="relative">
                        <select
                          required
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-slate-900 dark:text-white transition-all appearance-none cursor-pointer"
                        >
                          <option value="" className="dark:bg-slate-900">Select Category</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat} className="dark:bg-slate-900">{cat}</option>
                          ))}
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Product Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-slate-900 dark:text-white transition-all resize-none placeholder:text-slate-400"
                      placeholder="Provide detailed information about the product's condition and features..."
                    />
                  </div>
                </div>

                {/* Pricing & Contact */}
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        Pricing Method
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, priceType: 'fixed' })}
                          className={`p-6 rounded-[2rem] border-2 text-left transition-all ${formData.priceType === 'fixed' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-300'
                            }`}
                        >
                          <i className={`ri-price-tag-3-line text-2xl mb-4 block ${formData.priceType === 'fixed' ? 'text-blue-200' : 'text-blue-600 dark:text-blue-500'}`}></i>
                          <p className="font-bold text-sm uppercase tracking-widest leading-none mb-1">Fixed Price</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, priceType: 'contact' })}
                          className={`p-6 rounded-[2rem] border-2 text-left transition-all ${formData.priceType === 'contact' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-300'
                            }`}
                        >
                          <i className={`ri-customer-service-2-line text-2xl mb-4 block ${formData.priceType === 'contact' ? 'text-blue-200' : 'text-blue-600 dark:text-blue-500'}`}></i>
                          <p className="font-bold text-sm uppercase tracking-widest leading-none mb-1">Negotiable</p>
                        </button>
                      </div>

                      {formData.priceType === 'fixed' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="relative max-w-xs">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-xl text-slate-400">GH₵</span>
                            <input
                              type="number"
                              step="0.01"
                              required={formData.priceType === 'fixed'}
                              value={formData.price}
                              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                              className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-bold outline-none text-2xl text-slate-900 dark:text-white transition-all placeholder:text-slate-300"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        WhatsApp Contact
                      </label>
                      <div className="relative group">
                        <i className="ri-whatsapp-line absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors text-xl"></i>
                        <input
                          type="tel"
                          required
                          value={formData.whatsappNumber}
                          onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                          className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-bold outline-none text-lg text-slate-900 dark:text-white transition-all placeholder-slate-400"
                          placeholder="054 123 4567"
                        />
                        <p className="text-[10px] text-slate-400 font-semibold mt-2 ml-1">
                          Customers will be redirected to chat with you on this number.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex pt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-5 bg-blue-600 dark:bg-blue-500 text-white font-bold text-xs uppercase tracking-wide rounded-2xl hover:bg-blue-700 dark:hover:bg-blue-600 shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
                  >
                    {loading ? (
                      <i className="ri-loader-4-line animate-spin text-xl"></i>
                    ) : (
                      <>
                        <span>Complete Listing</span>
                        <i className="ri-check-line text-lg"></i>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Media Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-900 dark:bg-black text-white p-8 rounded-[2.5rem] shadow-xl border border-slate-800">
              <h3 className="text-xl font-bold mb-8 tracking-tight flex items-center gap-3">
                <i className="ri-image-add-line text-blue-400"></i>
                Product Media
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {formData.images.map((url, index) => (
                  <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-800 border border-slate-700">
                    <img
                      src={url}
                      alt={`Product image ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 w-7 h-7 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-700 active:scale-90"
                    >
                      <i className="ri-close-line"></i>
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-600/90 text-white text-[8px] font-bold uppercase tracking-wide text-center py-1.5">
                        Main Cover
                      </div>
                    )}
                  </div>
                ))}

                {formData.images.length < 8 && (
                  <div className="aspect-square">
                    <ImageUploader
                      onImageUploaded={handleImageUploaded}
                      folder="products"
                      shape="square"
                      size="medium"
                      className="w-full h-full bg-slate-800 hover:bg-slate-700 transition-colors rounded-2xl border-2 border-dashed border-slate-700 flex items-center justify-center cursor-pointer group"
                    />
                  </div>
                )}
              </div>

              <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Media Requirement</p>
                <p className="text-[11px] font-semibold text-slate-400 leading-relaxed uppercase tracking-wide">
                  Clear, high-quality images increase trust and conversion. You can upload up to 8 photos.
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-[2rem] border border-blue-100/50 dark:border-blue-800/30">
              <i className="ri-shield-check-fill text-3xl text-blue-600 dark:text-blue-400 mb-4 block"></i>
              <p className="text-sm font-bold text-blue-950 dark:text-blue-100 uppercase tracking-wide mb-2">Security Note</p>
              <p className="text-xs font-semibold text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
                All listings are monitored for safety and compliance with university policies.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
