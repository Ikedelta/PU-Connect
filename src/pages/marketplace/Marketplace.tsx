import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../../components/feature/Navbar';
import { useProducts, useToggleFavorite, useFavorites } from '../../hooks/useProducts';
import { useAuth } from '../../contexts/AuthContext';
import { type Profile } from '../../lib/supabase';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useSiteContent, CONTENT_KEYS } from '../../hooks/useSiteContent';

import AdSenseBanner from '../../components/feature/AdSenseBanner';

function Marketplace() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const { url: bannerUrl } = useSiteContent(CONTENT_KEYS.MARKETPLACE_BANNER);

  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priceRange, setPriceRange] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync category state with URL
  useEffect(() => {
    const cat = searchParams.get('category') || 'all';
    setSelectedCategory(cat);
  }, [searchParams]);

  const { data: products = [], isLoading: productsLoading } = useProducts({
    category: selectedCategory,
    search: debouncedSearch,
  });

  const { data: favoriteItems = [] } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();

  const favorites = useMemo(() => favoriteItems.map(f => f.product_id), [favoriteItems]);

  const categories = [
    { id: 'all', name: 'Discover All', icon: 'ri-command-fill', color: 'bg-blue-600' },
    { id: 'Electronics', name: 'Electronics', icon: 'ri-macbook-line', color: 'bg-indigo-600' },
    { id: 'Books & Stationery', name: 'Textbooks', icon: 'ri-book-read-line', color: 'bg-emerald-600' },
    { id: 'Fashion & Accessories', name: 'Fashion', icon: 'ri-t-shirt-line', color: 'bg-rose-600' },
    { id: 'Food & Beverages', name: 'Nutrition', icon: 'ri-restaurant-2-line', color: 'bg-amber-600' },
    { id: 'Sports & Fitness', name: 'Sports', icon: 'ri-basketball-line', color: 'bg-orange-600' },
    { id: 'Home & Living', name: 'Home', icon: 'ri-home-smile-line', color: 'bg-teal-600' },
    { id: 'Services', name: 'Services', icon: 'ri-service-line', color: 'bg-purple-600' },
    { id: 'Other', name: 'Miscellaneous', icon: 'ri-grid-line', color: 'bg-slate-600' }
  ];

  const filteredAndSortedProducts = useMemo(() => {
    return [...products]
      .filter(product => {
        let matchesPrice = true;
        if (product.price_type === 'fixed' && product.price) {
          if (priceRange === 'under50') matchesPrice = product.price < 50;
          else if (priceRange === '50-200') matchesPrice = product.price >= 50 && product.price <= 200;
          else if (priceRange === 'over200') matchesPrice = product.price > 200;
        }
        return matchesPrice;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return (a.price || 0) - (b.price || 0);
        if (sortBy === 'price-high') return (b.price || 0) - (a.price || 0);
        if (sortBy === 'popular') return (b.views_count || 0) - (a.views_count || 0);
        if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return 0;
      });
  }, [products, priceRange, sortBy]);

  const handleCategorySelect = useCallback((id: string) => {
    setSelectedCategory(id);
    const newParams = new URLSearchParams(searchParams);
    if (id === 'all') {
      newParams.delete('category');
    } else {
      newParams.set('category', id);
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300 font-sans">

      <Navbar />

      {/* Hero Section - Clean Marketplace */}
      <section className="relative pt-32 pb-12 md:pt-40 md:pb-16 overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-white dark:bg-gray-950">
        <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/40 to-white/60 dark:from-gray-950/90 dark:to-gray-950"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-full mb-6 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-gray-900 dark:text-white">Live Marketplace</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Shop Campus <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">Marketplace</span>
          </h1>

          {/* Search Bar - Clean Design */}
          <div className="max-w-2xl mx-auto relative">
            <form
              onSubmit={(e) => { e.preventDefault(); setDebouncedSearch(searchQuery); }}
              className="relative flex items-center bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <i className="ri-search-2-line text-xl md:text-2xl text-gray-400 ml-4 pointer-events-none"></i>
              <input
                type="text"
                placeholder="Find textbooks, gadgets, services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 text-base font-medium px-4 h-12"
              />
              <button
                type="submit"
                className="px-6 md:px-8 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 text-sm"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Sticky Categories Bar - Clean Marketplace */}
      <div className="sticky top-20 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-blue-100 dark:border-gray-800">
        <div className="max-w-[1720px] mx-auto">
          <div className="flex items-center gap-2 md:gap-3 overflow-x-auto py-4 px-4 md:px-8 no-scrollbar scroll-smooth">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 border text-sm font-bold whitespace-nowrap ${selectedCategory === category.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-lg scale-105'
                  : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-800 hover:border-blue-200 dark:hover:border-gray-600'
                  }`}
              >
                <i className={`${category.icon} text-lg`}></i>
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
        <div className="py-8 md:py-12">

          <AdSenseBanner className="mb-12 rounded-[2rem] overflow-hidden shadow-lg" />

          {/* Results Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
            <div>
              <p className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-2">
                {selectedCategory === 'all' ? 'Marketplace' : 'Category'}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                {selectedCategory === 'all' ? 'Fresh Listings' : categories.find(c => c.id === selectedCategory)?.name}
                <span className="text-sm font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                  {filteredAndSortedProducts.length}
                </span>
              </h2>
            </div>

            <div className="w-full md:w-auto">
              <div className="relative group z-30 w-full md:w-48">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-3 pl-4 pr-10 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm hover:shadow-md transition-shadow text-gray-700 dark:text-gray-200"
                >
                  <option value="newest">Newest First</option>
                  <option value="popular">Popularity</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
                <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
              </div>
            </div>
          </div>

          {/* Product Grid - Refined */}
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-3xl p-4 h-[350px] animate-pulse">
                  <div className="bg-gray-100 dark:bg-gray-800 h-48 rounded-2xl mb-4"></div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedProducts?.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-8">
              {filteredAndSortedProducts.map((product) => {
                const seller = product.seller as Profile;
                return (
                  <div
                    key={product.id}
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="group flex flex-col bg-transparent cursor-pointer"
                  >
                    {/* Image Container - Clean Hover */}
                    <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden bg-gray-100 dark:bg-gray-800 mb-4 shadow-sm group-hover:shadow-2xl group-hover:shadow-blue-900/10 transition-all duration-500 group-hover:-translate-y-1 ring-1 ring-black/5 dark:ring-white/5">
                      {product.images?.[0] ? (
                        <img
                          src={getOptimizedImageUrl(product.images[0], 500, 90)}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700 bg-gray-50 dark:bg-gray-900">
                          <i className="ri-image-2-line text-6xl opacity-50"></i>
                        </div>
                      )}

                      {/* Dark Gradient Overlay on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                      {/* Floating Actions */}
                      <div className="absolute top-3 right-3 z-10 transition-transform duration-300 group-hover:scale-110">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteMutation.mutate(product.id);
                          }}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 backdrop-blur-xl ${favorites.includes(product.id)
                            ? 'bg-rose-500 text-white shadow-rose-500/30'
                            : 'bg-white/80 dark:bg-black/50 text-gray-500 dark:text-white hover:bg-white hover:text-rose-500'
                            }`}
                        >
                          <i className={`${favorites.includes(product.id) ? 'ri-heart-fill' : 'ri-heart-fill'} text-lg`}></i>
                        </button>
                      </div>

                      {/* Price Tag - Premium Gradient Pill */}
                      <div className="absolute bottom-3 left-3 right-auto">
                        <div className="px-4 py-2 bg-white/95 dark:bg-gray-900/90 backdrop-blur-md rounded-full shadow-lg group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                          <p className="text-sm font-black text-gray-900 dark:text-white group-hover:text-white leading-none">
                            {product.price_type === 'fixed' ? `₵${product.price?.toLocaleString()}` : 'Contact'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Minimal Content */}
                    <div className="px-2">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1.5 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center text-[10px] text-blue-600 dark:text-blue-300 font-bold overflow-hidden">
                          {(seller as any).avatar_url ? (
                            <img src={getOptimizedImageUrl((seller as any).avatar_url, 40, 40)} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span>{(seller as any).full_name?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 line-clamp-1">
                          {((seller as any).business_name || seller?.full_name)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-32 text-center bg-white dark:bg-gray-900 rounded-[3rem] border border-gray-100 dark:border-gray-800">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-50 dark:bg-gray-800 rounded-full mb-6">
                <i className="ri-search-line text-3xl text-gray-400"></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No matches found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">Adjust your filters or try a broader search term.</p>
              <button
                onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
              >
                Reset Search
              </button>
            </div>
          )}
        </div>
      </div>
    </div >
  );
}

export default Marketplace;
