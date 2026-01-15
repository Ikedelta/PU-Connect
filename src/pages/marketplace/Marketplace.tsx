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
    { id: 'electronics', name: 'Electronics', icon: 'ri-macbook-line', color: 'bg-indigo-600' },
    { id: 'books', name: 'Textbooks', icon: 'ri-book-read-line', color: 'bg-emerald-600' },
    { id: 'fashion', name: 'Fashion', icon: 'ri-t-shirt-line', color: 'bg-rose-600' },
    { id: 'food', name: 'Nutrition', icon: 'ri-restaurant-2-line', color: 'bg-amber-600' },
    { id: 'health', name: 'Essentials', icon: 'ri-capsule-line', color: 'bg-teal-600' },
    { id: 'academics', name: 'Academic Gear', icon: 'ri-pencil-ruler-2-line', color: 'bg-sky-600' },
    { id: 'other', name: 'Miscellaneous', icon: 'ri-grid-line', color: 'bg-slate-600' }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <Navbar />

      {/* Hero Section - Marketplace Hub */}
      <section className="relative pt-28 pb-12 md:pt-48 md:pb-32 overflow-hidden bg-gray-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-gray-900 to-gray-900 z-0"></div>
        {/* Animated Orbs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] opacity-40 animate-blob mix-blend-screen"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] opacity-40 animate-blob animation-delay-2000 mix-blend-screen"></div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 backdrop-blur-md rounded-full mb-8 shadow-lg animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Live Market</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-white mb-8 md:mb-12 tracking-tighter leading-[0.85] animate-fade-in-up delay-100 drop-shadow-2xl">
            Campus <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Market.</span>
          </h1>

          {/* Search Bar - Glassmorphism */}
          <div className="max-w-2xl mx-auto relative group animate-fade-in-up delay-200 z-20">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-focus-within:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <form
              onSubmit={(e) => { e.preventDefault(); setDebouncedSearch(searchQuery); }}
              className="relative flex items-center bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 shadow-2xl"
            >
              <i className="ri-search-2-line text-2xl text-gray-400 ml-4 pointer-events-none"></i>
              <input
                type="text"
                placeholder="Search for textbooks, gadgets, services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-lg font-medium px-4 h-12"
              />
              <button
                type="submit"
                className="px-5 md:px-8 h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 text-[10px] md:text-xs uppercase tracking-widest"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        {/* Category Pills - Floating Scroll */}
        <div className="flex gap-4 overflow-x-auto pb-8 md:pb-12 pt-4 no-scrollbar mask-gradient px-4 justify-start md:justify-center snap-x">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              className={`flex items-center gap-3 px-8 py-5 rounded-[2rem] border transition-all duration-500 font-bold text-xs uppercase tracking-widest shadow-2xl whitespace-nowrap group snap-center ${selectedCategory === category.id
                ? 'bg-blue-600 border-blue-500 text-white shadow-blue-600/40 scale-105'
                : 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-white/20 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:scale-105'
                }`}
            >
              <i className={`${category.icon} text-xl ${selectedCategory === category.id ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`}></i>
              {category.name}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="py-12">

          <AdSenseBanner className="mb-10" />

          {/* Results Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                {selectedCategory === 'all' ? 'All Collections' : categories.find(c => c.id === selectedCategory)?.name}
                <span className="text-sm font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-md border border-gray-200 dark:border-white/5">
                  {filteredAndSortedProducts.length}
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              {/* Sort Dropdown */}
              <div className="relative group z-30 w-full md:w-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-3 pl-4 pr-10 rounded-xl font-bold text-xs uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm hover:shadow-md transition-all w-full md:w-auto"
                >
                  <option value="newest">Newest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
                <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-[2rem] p-4 h-[450px] animate-pulse border border-gray-100 dark:border-gray-800">
                  <div className="bg-gray-100 dark:bg-gray-800 h-64 rounded-[1.5rem] mb-4"></div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedProducts?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {filteredAndSortedProducts.map((product) => {
                const seller = product.seller as Profile;
                return (
                  <div
                    key={product.id}
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="group relative bg-white dark:bg-gray-900 rounded-[1.5rem] sm:rounded-[2rem] p-2 sm:p-3 border border-gray-100 dark:border-gray-800 hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-900/10 transition-all duration-500 cursor-pointer hover:-translate-y-2 dark:hover:bg-gray-800/50"
                  >
                    {/* Image Container */}
                    <div className="relative aspect-[4/5] rounded-[1rem] sm:rounded-[1.5rem] overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3 sm:mb-4 ">
                      {product.images?.[0] ? (
                        <img
                          src={getOptimizedImageUrl(product.images[0], 600, 85)}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                          <i className="ri-image-2-line text-6xl"></i>
                        </div>
                      )}

                      {/* Overlay Gradient on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteMutation.mutate(product.id);
                          }}
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 backdrop-blur-md ${favorites.includes(product.id)
                            ? 'bg-rose-500 text-white'
                            : 'bg-white/80 dark:bg-black/50 text-gray-600 dark:text-white hover:bg-rose-500 hover:text-white'
                            }`}
                        >
                          <i className={`${favorites.includes(product.id) ? 'ri-heart-fill' : 'ri-heart-line'} text-base sm:text-xl`}></i>
                        </button>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <button className="w-full py-3 bg-white text-gray-900 font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg hover:bg-blue-50 transition-colors">
                          View Details
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-3 pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                          {product.category}
                        </span>
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wide">
                          <i className="ri-time-line"></i>
                          <span>New</span>
                        </div>
                      </div>

                      <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>

                      <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
                        <div className="flex flex-col">
                          <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Price</span>
                          <span className="text-sm sm:text-xl font-black text-gray-900 dark:text-white leading-none">
                            {product.price_type === 'fixed' ? `₵${product.price?.toLocaleString()}` : 'Contact'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pl-3 border-l border-gray-100 dark:border-gray-800">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <img src={getOptimizedImageUrl(seller?.avatar_url || "", 50, 50)} alt="" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-32 text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full mb-8">
                <i className="ri-search-line text-4xl text-gray-400"></i>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No results found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">We couldn't find any products matching your search.</p>
              <button
                onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all uppercase tracking-widest text-xs"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Marketplace;
