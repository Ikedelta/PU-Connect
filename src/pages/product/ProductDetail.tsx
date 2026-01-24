import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { type Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useProduct, useFavorites, useToggleFavorite } from '../../hooks/useProducts';
import { useCreateConversation, useConversations } from '../../hooks/useConversations';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: product, isLoading: loading } = useProduct(id);
  const { conversations = [] } = useConversations();
  const createConversationMutation = useCreateConversation();
  const { data: favoriteItems = [] } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();

  const isFavorited = favoriteItems.some(f => f.product_id === id);

  const [activeImage, setActiveImage] = useState<string | null>(null);

  useEffect(() => {
    if (product?.images && product.images.length > 0) {
      setActiveImage(product.images[0]);
    }
  }, [product]);

  const handleWhatsAppContact = () => {
    if (!product?.whatsapp_number) {
      alert('WhatsApp number not available');
      return;
    }

    const message = encodeURIComponent(
      `Hi! I'm interested in your product: ${product.name}`
    );
    const whatsappUrl = `https://wa.me/${product.whatsapp_number.replace(/[^0-9]/g, '')}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleInAppMessage = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!product) return;

    // Prevent messaging yourself
    if (user.id === product.seller_id) {
      alert("You cannot message yourself!");
      return;
    }

    // Check if conversation already exists for this product
    // A conversation exists if the current user is a participant (buyer or seller) AND the product matches
    const existing = conversations?.find(c =>
      c.product_id === product.id &&
      (c.buyer_id === user.id || c.seller_id === user.id)
    );

    if (existing) {
      navigate('/messages');
      return;
    }

    createConversationMutation.mutate({
      otherUserId: product.seller_id,
      productId: product.id
    }, {
      onSuccess: () => {
        navigate('/messages');
      },
      onError: (error: any) => {
        console.error('Error creating conversation:', error);
        alert(`Failed to start conversation: ${error.message || 'Unknown error'}`);
      }
    });
  };

  const handleShare = () => {
    const shareTitle = product?.name || 'Campus Connect Product';
    const shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        text: `Check out ${shareTitle} on Campus Marketplace`,
        url: shareUrl,
      }).catch(err => {
        if (err.name !== 'AbortError') console.error('Share failed:', err);
      });
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent('Check out ' + shareTitle + ' on Campus Connect: ' + shareUrl)}`;
      window.open(whatsappUrl, '_blank');
      navigator.clipboard.writeText(shareUrl);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 transition-colors duration-300">
        <Navbar />
        <div className="text-center py-24">
          <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 transition-colors duration-300">
        <Navbar />
        <div className="text-center py-24 max-w-md mx-auto">
          <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-shopping-bag-line text-5xl text-red-300 dark:text-red-500"></i>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Product not found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8">The product you are looking for might have been sold or removed by the seller.</p>
          <Link to="/marketplace" className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to marketplace
          </Link>
        </div>
      </div>
    );
  }

  const seller = product.seller as Profile;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-32 md:pt-32 pb-32 transition-colors duration-300 overflow-x-hidden">
      <Navbar />

      {/* Abstract Background Elements */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] opacity-60"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[80px] opacity-60"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-none">
        {/* Desktop Sticky Header / Mobile Absolute Overlay */}
        <div className="mb-8 md:mb-12 flex items-center justify-between sticky top-24 md:top-28 z-30 pointer-events-auto">
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 px-3 py-2 md:px-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-full border border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 transition-all cursor-pointer group shadow-lg"
          >
            <i className="ri-arrow-left-line text-lg group-hover:-translate-x-1 transition-transform"></i>
            <span className="font-bold text-xs uppercase tracking-widest hidden md:inline">Back</span>
          </Link>
          <button
            onClick={handleShare}
            className="w-10 h-10 md:w-12 md:h-12 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-full border border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-gray-800 transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-lg"
            title="Share Product"
          >
            <i className="ri-share-forward-line text-lg md:text-xl"></i>
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-gray-200/40 dark:shadow-none border border-gray-50 dark:border-gray-800 overflow-hidden relative pointer-events-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 md:gap-12">
            {/* Product Image Gallery */}
            <div className="flex flex-col gap-4 p-4 md:p-12 pb-0 md:pb-12 bg-gray-50 dark:bg-gray-800/20">
              {/* Main Image */}
              <div className="aspect-[4/5] md:aspect-square bg-gray-50 dark:bg-gray-800 rounded-[2rem] overflow-hidden border border-gray-50 dark:border-gray-800 flex items-center justify-center relative group select-none">
                {activeImage ? (
                  <>
                    <img
                      key={activeImage}
                      src={getOptimizedImageUrl(activeImage, 1000, 85)}
                      alt={product.name}
                      className="w-full h-full object-cover animate-in fade-in zoom-in-105 duration-500"
                      loading="eager"
                      decoding="async"
                    />

                    {/* Navigation Arrows (Only if multiple images) */}
                    {product.images && product.images.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentIdx = product.images!.indexOf(activeImage);
                            const prevIdx = (currentIdx - 1 + product.images!.length) % product.images!.length;
                            setActiveImage(product.images![prevIdx]);
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/30 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-95"
                        >
                          <i className="ri-arrow-left-s-line text-2xl"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const currentIdx = product.images!.indexOf(activeImage);
                            const nextIdx = (currentIdx + 1) % product.images!.length;
                            setActiveImage(product.images![nextIdx]);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/30 backdrop-blur-md text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 active:scale-95"
                        >
                          <i className="ri-arrow-right-s-line text-2xl"></i>
                        </button>

                        {/* Image Counter Badge */}
                        <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-white text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          {product.images.indexOf(activeImage) + 1} / {product.images.length}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <i className="ri-image-line text-6xl text-gray-200 dark:text-gray-700"></i>
                  </div>
                )}
                {product.is_active === false && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                    <span className="px-8 py-3 bg-red-600 text-white font-bold rounded-full text-lg uppercase tracking-widest shadow-xl">Sold Out</span>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {product.images && product.images.length > 1 && (
                <div className="grid grid-cols-5 gap-2 md:gap-3 overflow-x-auto pb-2 px-1">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(img)}
                      className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 relative group/thumb ${activeImage === img
                        ? 'border-blue-600 ring-4 ring-blue-600/10 scale-95 opacity-100'
                        : 'border-transparent opacity-50 hover:opacity-100 hover:scale-105'
                        }`}
                    >
                      <img
                        src={getOptimizedImageUrl(img, 200, 80)}
                        alt={`View ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {activeImage !== img && (
                        <div className="absolute inset-0 bg-black/10 group-hover/thumb:bg-transparent transition-colors"></div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col p-6 md:p-12 md:pt-12">
              <div className="flex items-center justify-between mb-8">
                <span className="px-4 py-1.5 bg-blue-600 text-white text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-full shadow-lg shadow-blue-500/20">
                  {product.category}
                </span>
                <div className="flex items-center text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest">
                  <i className="ri-eye-line mr-2 text-blue-600"></i>
                  {product.views_count || 0} Views
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">
                  {product.name}
                </h1>

                {/* Mobile Price (Visible here on small screens too) */}
                <div className="flex items-center gap-4">
                  <div className="md:hidden text-2xl font-black text-blue-600 tracking-tight">
                    {product.price_type === 'fixed' ? `GH₵${product.price?.toLocaleString()}` : 'Contact'}
                  </div>
                  <button
                    onClick={() => toggleFavoriteMutation.mutate(product.id)}
                    className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 flex-shrink-0 cursor-pointer ${isFavorited
                      ? 'bg-rose-500 text-white shadow-rose-200 dark:shadow-none'
                      : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-rose-500 border border-gray-100 dark:border-gray-800'
                      }`}
                  >
                    <i className={`${isFavorited ? 'ri-heart-fill' : 'ri-heart-line'} text-2xl`}></i>
                  </button>
                </div>
              </div>

              {/* Desktop Price Box (Hidden on mobile if redundant, but keeping for layout structure) */}
              <div className="hidden md:block mb-8 p-8 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border border-gray-100 dark:border-gray-800">
                {product.price_type === 'fixed' ? (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Listing Price</span>
                    <span className="text-3xl md:text-5xl font-bold text-blue-600 tracking-tight">GH₵{product.price?.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pricing Terms</span>
                    <p className="text-xl md:text-2xl font-bold text-blue-600 uppercase tracking-widest">Contact for Quote</p>
                  </div>
                )}
              </div>

              <div className="mb-10">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Product Description</h3>
                <div className="prose prose-blue max-w-none dark:prose-invert">
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-base font-medium">
                    {product.description || 'No detailed description provided by the seller.'}
                  </p>
                </div>
              </div>

              <div className="mb-10 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border-2 border-white dark:border-gray-700 bg-white dark:bg-black">
                    {/* Prefer Business Logo, fallback to Avatar */}
                    {(seller as any).business_logo || seller?.avatar_url ? (
                      <img
                        src={getOptimizedImageUrl((seller as any).business_logo || seller.avatar_url, 128, 80)}
                        alt={(seller as any).business_name || seller.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-900 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {((seller as any).business_name || seller?.full_name)?.charAt(0).toUpperCase() || 'S'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Sold By</p>
                    <p className="font-bold text-gray-900 dark:text-white text-base tracking-tight">
                      {(seller as any).business_name || seller?.full_name || 'Campus Seller'}
                    </p>
                    {/* If showing business name, maybe show contact name below? distinct from Department */}
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Faculty / Dept</p>
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{seller?.department || 'Verified Member'}</p>
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50 z-50 lg:static lg:p-0 lg:bg-transparent lg:border-none shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] lg:shadow-none animate-slide-in-up pb-8 lg:pb-0 safe-area-pb">
                <div className="max-w-6xl mx-auto grid grid-cols-3 gap-4 lg:gap-3">
                  <button
                    onClick={handleWhatsAppContact}
                    className="w-full flex flexDirection-col lg:flex-row items-center justify-center gap-2 px-2 lg:px-4 py-3.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold rounded-full hover:shadow-lg hover:shadow-emerald-500/30 transition-all cursor-pointer active:scale-95 group"
                    disabled={!product?.whatsapp_number}
                  >
                    <i className="ri-whatsapp-line text-2xl group-hover:scale-110 transition-transform"></i>
                    <span className="hidden sm:inline text-xs uppercase tracking-widest ml-1">WhatsApp</span>
                  </button>

                  <a
                    href={`tel:${seller?.phone}`}
                    className={`w-full flex items-center justify-center gap-2 px-2 lg:px-4 py-3.5 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 font-bold rounded-full hover:bg-blue-50 dark:hover:bg-gray-700 transition-all cursor-pointer active:scale-95 group ${!seller?.phone ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <i className="ri-phone-line text-2xl group-hover:rotate-12 transition-transform"></i>
                    <span className="hidden sm:inline text-xs uppercase tracking-widest ml-1">Call</span>
                  </a>

                  <button
                    onClick={handleInAppMessage}
                    className="w-full flex items-center justify-center gap-2 px-2 lg:px-4 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-full hover:scale-[1.02] shadow-lg hover:shadow-gray-900/20 transition-all cursor-pointer active:scale-95 group"
                    disabled={createConversationMutation.isPending}
                  >
                    <i className="ri-message-3-line text-2xl group-hover:-translate-y-0.5 transition-transform"></i>
                    <span className="hidden sm:inline text-xs uppercase tracking-widest ml-1">{createConversationMutation.isPending ? '...' : 'Chat'}</span>
                  </button>
                </div>
              </div>


            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
