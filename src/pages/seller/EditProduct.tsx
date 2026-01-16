import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Product } from '../../lib/supabase';
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

export default function EditProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    priceType: 'fixed' as 'fixed' | 'contact',
    images: [] as string[],
    whatsapp_number: '',
  });

  useEffect(() => {
    if (!user || (profile?.role !== 'seller' && profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
      navigate('/marketplace');
      return;
    }

    if (id) {
      fetchProduct();
    }
  }, [id, user, profile, navigate]);

  const fetchProduct = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        // Check if user owns this product or is admin/super_admin
        if (data.seller_id !== user?.id && profile?.role !== 'admin' && profile?.role !== 'super_admin') {
          navigate('/seller/dashboard');
          return;
        }

        setFormData({
          name: data.name || '',
          description: data.description || '',
          category: data.category || '',
          price: data.price?.toString() || '',
          priceType: data.price_type || 'fixed',
          images: data.images || [],
          whatsapp_number: data.whatsapp_number || '',
        });
      }
    } catch (err: any) {
      console.error('Error fetching product:', err);
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  // Helper for System Admin Bypass
  const adminUpdateProduct = async (productId: string, productData: any) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');
    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_update_product', {
        product_id: productId,
        product_data: productData,
        secret_key: secret
      });
      return { error };
    }
    return await supabase.from('products').update(productData).eq('id', productId);
  };

  const adminDeleteProduct = async (productId: string) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');
    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_delete_product', {
        target_id: productId,
        secret_key: secret
      });
      return { error };
    }
    return await supabase.from('products').delete().eq('id', productId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const productData = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        price: formData.priceType === 'fixed' ? parseFloat(formData.price) : null,
        price_type: formData.priceType,
        images: formData.images.length > 0 ? formData.images : null,
        whatsapp_number: formData.whatsapp_number || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await adminUpdateProduct(id!, productData);

      if (error) throw error;

      navigate('/seller/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Delete this product? Action cannot be undone.')) return;
    setSaving(true);
    try {
      const { error } = await adminDeleteProduct(id);
      if (error) throw error;
      navigate('/seller/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to delete product');
    } finally {
      setSaving(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-teal-600 animate-spin"></i>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
        <div className="text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-6">
            <i className="ri-edit-circle-line text-blue-400"></i>
            Manage Listing
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight leading-tight mb-4">
            Update<br /><span className="text-blue-600">Product.</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">
            Review and refine your marketplace listing
          </p>
        </div>
        <button
          onClick={() => navigate('/seller/dashboard')}
          className="text-[10px] font-bold text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-2 group"
        >
          <i className="ri-arrow-left-s-line text-lg group-hover:-translate-x-1 transition-transform"></i>
          Exit Editor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Form Section */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-gray-200/40 border border-gray-100 p-8 md:p-12">
            {error && (
              <div className="mb-10 p-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <i className="ri-error-warning-fill text-2xl text-rose-600"></i>
                <p className="text-sm font-bold text-rose-900 uppercase tracking-tight">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Product Info */}
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                      Product Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 transition-all"
                      placeholder="e.g. Vintage Denim Jacket"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <i className="ri-arrow-down-s-line absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                    Product Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 transition-all resize-none"
                    placeholder="Provide detailed information about the product..."
                  />
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  Pricing Terms
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, priceType: 'fixed' })}
                    className={`p-6 rounded-[2rem] border-2 text-left transition-all ${formData.priceType === 'fixed' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-50 border-gray-100 text-gray-900'
                      }`}
                  >
                    <i className={`ri-price-tag-3-line text-2xl mb-4 block ${formData.priceType === 'fixed' ? 'text-blue-200' : 'text-blue-600'}`}></i>
                    <p className="font-bold text-sm uppercase tracking-widest leading-none mb-1">Fixed Price</p>
                    <p className={`text-[10px] font-semibold ${formData.priceType === 'fixed' ? 'text-blue-100' : 'text-gray-400'}`}>Standard selling price</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, priceType: 'contact' })}
                    className={`p-6 rounded-[2rem] border-2 text-left transition-all ${formData.priceType === 'contact' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-50 border-gray-100 text-gray-900'
                      }`}
                  >
                    <i className={`ri-customer-service-2-line text-2xl mb-4 block ${formData.priceType === 'contact' ? 'text-blue-200' : 'text-blue-600'}`}></i>
                    <p className="font-bold text-sm uppercase tracking-widest leading-none mb-1">Negotiable</p>
                    <p className={`text-[10px] font-semibold ${formData.priceType === 'contact' ? 'text-blue-100' : 'text-gray-400'}`}>Price discussed via chat</p>
                  </button>
                </div>

                {formData.priceType === 'fixed' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="relative max-w-xs">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-xl text-gray-400">GH₵</span>
                      <input
                        type="number"
                        step="0.01"
                        required={formData.priceType === 'fixed'}
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        className="w-full pl-14 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-bold outline-none text-2xl text-gray-900 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp Contact */}
              <div className="space-y-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  WhatsApp Contact (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 font-semibold outline-none text-sm text-gray-900 transition-all"
                  placeholder="+233 XX XXX XXXX"
                />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Customers can contact you directly on WhatsApp</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-8 py-5 bg-rose-50 text-rose-600 font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-rose-600 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <i className="ri-delete-bin-line text-lg"></i>
                  <span>Delete Listing</span>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-5 bg-gray-900 text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-black shadow-xl shadow-gray-900/10 transition-all disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  {saving ? (
                    <i className="ri-loader-4-line animate-spin text-xl"></i>
                  ) : (
                    <>
                      <span>Save Changes</span>
                      <i className="ri-save-3-fill text-lg"></i>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Media Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-gray-900 text-white p-8 rounded-[2.5rem] shadow-xl">
            <h3 className="text-xl font-bold mb-8 tracking-tight flex items-center gap-3">
              <i className="ri-image-edit-line text-blue-400"></i>
              Manage Media
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {formData.images.map((url, index) => (
                <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden bg-gray-800 border border-white/5">
                  <img
                    src={url}
                    alt={`Product image ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 w-7 h-7 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-700 active:scale-90"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                  {index === 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-blue-600/90 text-white text-[8px] font-bold uppercase tracking-widest text-center py-1.5">
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
                    className="w-full h-full bg-gray-800 hover:bg-gray-700 transition-colors rounded-2xl border-2 border-dashed border-gray-700 flex items-center justify-center cursor-pointer group"
                  />
                </div>
              )}
            </div>

            <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Product Reference</p>
              <p className="text-[10px] font-semibold text-gray-500 leading-relaxed break-all">
                ID: {id}
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-8 rounded-[2rem] border border-blue-100/50">
            <i className="ri-shield-check-fill text-3xl text-blue-600 mb-4 block"></i>
            <p className="text-sm font-bold text-blue-950 uppercase tracking-widest mb-2">Security Note</p>
            <p className="text-xs font-semibold text-blue-800/80 leading-relaxed">
              Updated information is synchronized instantly across the PU Connect marketplace ecosystem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
