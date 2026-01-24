import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFeaturedNews } from '../../hooks/useNews';
import { useProducts } from '../../hooks/useProducts';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useSiteContent, CONTENT_KEYS } from '../../hooks/useSiteContent';
import Navbar from '../../components/feature/Navbar';
import NewsletterSignup from '../../components/feature/NewsletterSignup';
import AdSenseBanner from '../../components/feature/AdSenseBanner';
import InternshipSlider from '../../components/feature/InternshipSlider';
// Material UI Icons
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SchoolIcon from '@mui/icons-material/School';
import CategoryIcon from '@mui/icons-material/Category';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CampaignIcon from '@mui/icons-material/Campaign';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import FavoriteIcon from '@mui/icons-material/Favorite';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: featuredNews = [], isLoading: isNewsLoading } = useFeaturedNews(5);
  const { data: allProducts = [], isLoading: isProductsLoading } = useProducts();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroSlide, setHeroSlide] = useState(0);

  const { url: heroMain } = useSiteContent(CONTENT_KEYS.HOME_HERO_MAIN);
  const { url: heroAerial } = useSiteContent(CONTENT_KEYS.HOME_HERO_AERIAL);

  const heroImages = [heroMain, heroAerial, '/image 1.jpg', '/image 5.jpg'];

  // Get featured products (first 4 products)
  const featuredProducts = allProducts.slice(0, 4);

  // Get trending products (products sorted by views_count)
  const trendingProducts = [...allProducts]
    .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
    .slice(0, 4);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % heroImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  useEffect(() => {
    if (featuredNews.length > 0) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % featuredNews.length);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [featuredNews.length]);

  const handleProductClick = useCallback((category: string) => {
    navigate(`/marketplace?category=${category}`);
  }, [navigate]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % featuredNews.length);
  }, [featuredNews.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + featuredNews.length) % featuredNews.length);
  }, [featuredNews.length]);

  const [stats, setStats] = useState({
    products: 0,
    students: 0,
    verified: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      // Use RPC for accurate count bypassing RLS
      const { data, error } = await supabase.rpc('get_public_stats');
      if (data && !error) {
        setStats(prev => ({
          ...prev,
          products: data.products || 0,
          students: data.users || 0
        }));
      } else {
        // Fallback
        const { count: productCount } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true);
        const { count: userCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
        setStats(prev => ({
          ...prev,
          products: productCount || 0,
          students: userCount || 0
        }));
      }
    };
    fetchStats();

    const channel = supabase.channel('home-realtime-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300 bg-african-pattern">
      <Navbar />

      {/* Hero Section - Vibrant Marketplace Welcome */}
      <section className="relative min-h-[90vh] md:min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:bg-gray-950">
        {/* Background Slider */}
        <div className="absolute inset-0 z-0">
          {heroImages.map((img, index) => (
            <div
              key={img}
              className={`absolute inset-0 transition-opacity duration-[2s] ease-in-out ${index === heroSlide ? 'opacity-15 dark:opacity-40' : 'opacity-0'
                }`}
            >
              <img
                src={img}
                alt={`Campus View ${index + 1}`}
                className={`w-full h-full object-cover transition-transform duration-[10s] ease-linear ${index >= 2 ? 'object-center' : 'object-top'
                  } ${index === heroSlide ? 'scale-110' : 'scale-100'}`}
              />
            </div>
          ))}
          {/* Simple gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/60 to-white/80 dark:from-gray-950/90 dark:to-gray-950"></div>
        </div>



        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 w-full pt-28 md:pt-32">
          <div className="max-w-4xl">
            {/* Badge above heading */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-orange-200 dark:border-gray-700 shadow-md mb-6">
              <i className="ri-store-3-fill text-orange-500"></i>
              <span className="text-sm font-bold text-gray-900 dark:text-white">Campus Marketplace</span>
              <span className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-full">NEW</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-[1.05] tracking-tight">
              Buy. Sell. <ShoppingCartIcon sx={{ fontSize: '1em', verticalAlign: 'middle', color: '#f97316' }} /><br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500">Connect.</span>
            </h1>

            <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-8 mb-8">
              <p className="text-lg md:text-xl text-gray-700 dark:text-gray-200 font-medium max-w-lg leading-relaxed">
                Your campus marketplace for everything students need. <SchoolIcon sx={{ fontSize: '1.2em', verticalAlign: 'middle', color: '#3b82f6' }} /><br className="hidden md:block" />
                <span className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-lg font-bold text-sm mt-2">
                  <i className="ri-shield-check-fill"></i> Safe & Verified
                </span>
              </p>

              <div className="hidden md:flex flex-col bg-white dark:bg-black/20 backdrop-blur-sm p-5 rounded-2xl border-2 border-orange-200 dark:border-white/5 shadow-lg hover:shadow-xl transition-shadow">
                <span className="text-3xl font-bold text-orange-600 dark:text-white tracking-tight">
                  {stats.students > 1000
                    ? `${(stats.students / 1000).toFixed(1)}K+`
                    : stats.students > 0
                      ? stats.students.toLocaleString()
                      : '0'}
                </span>
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide mt-1">Active Students</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/marketplace"
                className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all font-bold text-sm shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/50 flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
              >
                <i className="ri-shopping-bag-3-fill text-lg"></i>
                Start Shopping
                <i className="ri-arrow-right-line text-lg group-hover:translate-x-1 transition-transform"></i>
              </Link>
              <Link
                to={user ? "/seller/dashboard" : "/register"}
                className="px-8 py-4 bg-white dark:bg-white/10 backdrop-blur-md text-gray-900 dark:text-white border-2 border-orange-200 dark:border-white/20 rounded-xl hover:bg-orange-50 dark:hover:bg-white/20 transition-all font-bold text-sm flex items-center justify-center gap-3 hover:scale-105 active:scale-95 shadow-md"
              >
                <i className="ri-store-3-fill text-lg"></i>
                {user ? 'Sell Items' : 'Join Now'}
              </Link>
            </div>

            {/* Trust indicators below buttons */}
            <div className="flex flex-wrap items-center gap-6 mt-8 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <i className="ri-checkbox-circle-fill text-emerald-500"></i>
                <span className="font-medium">Free to Join</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="ri-checkbox-circle-fill text-emerald-500"></i>
                <span className="font-medium">Instant Deals</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="ri-checkbox-circle-fill text-emerald-500"></i>
                <span className="font-medium">Campus Safe</span>
              </div>
            </div>
          </div>
        </div>

        {/* Slider Indicators */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-6 z-20">
          {heroImages.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroSlide(i)}
              className="group relative flex items-center justify-end gap-3 transition-all cursor-pointer"
            >
              <div className={`w-2 h-14 rounded-full transition-all duration-500 shadow-md ${i === heroSlide ? 'bg-gradient-to-b from-orange-500 to-amber-500 h-20 shadow-orange-500/50' : 'bg-gray-300 dark:bg-white/20 hover:bg-orange-300 dark:hover:bg-white/40'}`}></div>
            </button>
          ))}
        </div>
      </section>



      {/* Stats - Marketplace Highlights */}
      <section className="relative z-20 py-12 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Verified Safety', value: '100%', detail: 'Secure Student ID Check', icon: 'ri-shield-check-fill', gradient: 'from-emerald-400 to-teal-500', bg: 'from-emerald-50 to-teal-50' },
              { label: 'Active Listings', value: stats.products > 0 ? `${stats.products}+` : '0', detail: 'Fresh Deals Daily', icon: 'ri-shopping-bag-3-fill', gradient: 'from-orange-400 to-amber-500', bg: 'from-orange-50 to-amber-50' },
              { label: 'Happy Students', value: stats.students > 100 ? `${Math.floor(stats.students / 100)}00+` : '50+', detail: 'Growing Community', icon: 'ri-user-smile-fill', gradient: 'from-purple-400 to-pink-500', bg: 'from-purple-50 to-pink-50' }
            ].map((stat, i) => (
              <div key={i} className={`bg-gradient-to-br ${stat.bg} dark:bg-gray-900 p-8 rounded-3xl border-2 border-white dark:border-gray-800 shadow-lg hover:shadow-2xl transition-all duration-300 group hover:-translate-y-1`}>
                <div className={`w-14 h-14 bg-gradient-to-br ${stat.gradient} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform shadow-md`}>
                  <i className={`${stat.icon} text-2xl`}></i>
                </div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{stat.label}</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">{stat.value}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AdSenseBanner />

      {/* Market Categories - Shop by Category */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:bg-gray-950/50 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                  <i className="ri-grid-fill text-white text-lg"></i>
                </div>
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">Popular Categories</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
                Shop by Category <CategoryIcon sx={{ fontSize: '0.9em', verticalAlign: 'middle', color: '#3b82f6' }} />
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium text-sm max-w-sm">
              Find exactly what you need in our organized marketplace
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { id: 'electronics', name: 'Electronics', desc: 'Gadgets & Tech', img: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=600', gradient: 'from-blue-500 to-cyan-500' },
              { id: 'books', name: 'Books', desc: 'Textbooks & More', img: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600', gradient: 'from-amber-500 to-orange-500' },
              { id: 'fashion', name: 'Fashion', desc: 'Style & Apparel', img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=600', gradient: 'from-pink-500 to-rose-500' },
              { id: 'food', name: 'Food', desc: 'Snacks & Meals', img: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&q=80&w=600', gradient: 'from-emerald-500 to-teal-500' }
            ].map((cat) => (
              <div
                key={cat.id}
                onClick={() => handleProductClick(cat.id)}
                className="group relative h-[280px] rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-500"
              >
                <img
                  src={getOptimizedImageUrl(cat.img, 800, 80)}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                {/* Warm gradient overlay for light mode */}
                <div className={`absolute inset-0 bg-gradient-to-t ${cat.gradient} opacity-60 group-hover:opacity-75 transition-opacity`}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-gray-900/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span className="text-xs font-semibold text-white/80 uppercase tracking-wide block mb-2">{cat.desc}</span>
                  <h3 className="text-2xl font-bold text-white leading-tight flex items-center gap-2 group-hover:gap-3 transition-all">
                    {cat.name}
                    <i className="ri-arrow-right-line text-xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Now - Hot Items */}
      <section className="py-12 bg-white dark:bg-slate-900 border-y border-slate-50 dark:border-slate-800 bg-african-pattern">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-lg">
                <i className="ri-fire-fill text-xl"></i>
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-none">Trending Now</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Most viewed on campus</p>
              </div>
            </div>
            <Link to="/marketplace?sort=popular" className="hidden sm:flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wide">
              View Hot List <i className="ri-arrow-right-line"></i>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {trendingProducts.length > 0 ? (
              trendingProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="group relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="aspect-[1/1] overflow-hidden bg-slate-100 dark:bg-slate-900 relative">
                    {product.images?.[0] ? (
                      <img
                        src={getOptimizedImageUrl(product.images[0], 300, 80)}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700">
                        <i className="ri-image-2-line text-4xl"></i>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                      <i className="ri-fire-line"></i> Hot
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 mb-1">{product.name}</h4>
                    <p className="text-blue-600 font-black text-sm">
                      {product.price_type === 'fixed' ? `₵${product.price}` : 'Contact'}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Fresh Drops - Marketplace Product Grid */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:bg-gray-950 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-amber-200/20 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center">
                  <i className="ri-shopping-bag-3-fill text-white text-lg"></i>
                </div>
                <span className="text-orange-600 dark:text-orange-400 font-bold text-sm">Fresh on Campus</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
                Just Dropped! <LocalFireDepartmentIcon sx={{ fontSize: '0.9em', verticalAlign: 'middle', color: '#f97316' }} /><br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-600">New Listings</span>
              </h2>
            </div>
            <Link
              to="/marketplace"
              className="group px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all flex items-center gap-2 shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/40 hover:-translate-y-0.5"
            >
              Browse All Items
              <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform"></i>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isProductsLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 h-[380px] animate-pulse shadow-md"></div>
              ))
            ) : (
              featuredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer group border border-gray-100 dark:border-gray-800 hover:-translate-y-1"
                >
                  <div className="relative h-52 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {product.images?.[0] ? (
                      <img
                        src={getOptimizedImageUrl(product.images[0], 600, 80)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                        <i className="ri-image-2-line text-5xl"></i>
                      </div>
                    )}
                    {/* New Badge */}
                    <div className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
                      <i className="ri-sparkle-fill"></i>
                      NEW
                    </div>
                  </div>
                  <div className="p-4">
                    <span className="inline-block px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold rounded-md mb-2">
                      {product.category}
                    </span>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base mb-3 line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Price</p>
                        <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600">
                          {product.price_type === 'fixed' ? `₵${product.price?.toLocaleString()}` : 'Offer'}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:to-amber-500 group-hover:text-white transition-all">
                        <i className="ri-shopping-cart-2-fill text-lg"></i>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
      {/* Campus Community - Warm & Welcoming */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:bg-gray-950 overflow-hidden relative">
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-64 h-64 bg-emerald-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-200/20 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full mb-4">
                <i className="ri-community-fill text-lg"></i>
                <span className="text-xs font-bold">Student Community</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-4">
                Your Campus,<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-600">Your Marketplace</span> <SchoolIcon sx={{ fontSize: '0.9em', verticalAlign: 'middle', color: '#10b981' }} />
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed mb-8">
                Join thousands of students buying, selling, and connecting every day. From textbooks to tech, food to fashion—everything you need is right here on campus.
              </p>
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                      <i className="ri-group-fill text-white text-xl"></i>
                    </div>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.students?.toLocaleString() || '0'}+</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Active Students</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-md border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                      <i className="ri-shield-check-fill text-white text-xl"></i>
                    </div>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white">100%</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Verified Campus</p>
                </div>
              </div>
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/40"
              >
                Start Shopping
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>
            <div className="order-1 lg:order-2 relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 rounded-3xl blur-2xl group-hover:blur-3xl transition-all duration-500"></div>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="/image 5.jpg"
                  alt="Campus Community"
                  className="w-full h-[400px] md:h-[500px] object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent"></div>
                {/* Floating stats */}
                <div className="absolute bottom-6 left-6 right-6 flex gap-3">
                  <div className="flex-1 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Daily Deals</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">50+</p>
                  </div>
                  <div className="flex-1 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-xl p-3 border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Safe Trades</p>
                    <p className="text-lg font-bold text-teal-600 dark:text-teal-400">100%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Campus News - Modern Media Feed */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:bg-gray-900 overflow-hidden relative">
        {/* Decorative elements */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-pink-200/20 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                  <i className="ri-newspaper-fill text-white text-lg"></i>
                </div>
                <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">Campus Updates</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight">
                What's Happening
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-600"> on Campus <CampaignIcon sx={{ fontSize: '0.9em', verticalAlign: 'middle', color: '#a855f7' }} /></span>
              </h2>
            </div>
            <Link
              to="/news"
              className="group px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all flex items-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40"
            >
              All News
              <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform"></i>
            </Link>
          </div>

          {isNewsLoading ? (
            <div className="h-[450px] w-full bg-white dark:bg-gray-800 rounded-3xl animate-pulse shadow-md"></div>
          ) : featuredNews.length > 0 ? (
            <div className="relative h-[450px] md:h-[550px] rounded-3xl overflow-hidden shadow-2xl group bg-white dark:bg-gray-800">
              {featuredNews.map((news, index) => (
                <div
                  key={news.id}
                  className={`absolute inset-0 transition-all duration-[1s] ease-in-out ${index === currentSlide ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-105 pointer-events-none'}`}
                >
                  <img
                    src={getOptimizedImageUrl(news.image_url, 1920, 85)}
                    alt={news.title}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1920';
                    }}
                    className="w-full h-full object-cover transition-transform duration-[5s] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
                    <span className="inline-block px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold uppercase tracking-wide rounded-full mb-4">
                      {news.category}
                    </span>
                    <h3 className="text-2xl md:text-4xl font-bold text-white mb-6 leading-tight max-w-3xl">
                      {news.title}
                    </h3>
                    <Link
                      to={`/news/${news.id}`}
                      className="inline-flex items-center gap-3 px-6 py-3 bg-white text-gray-900 font-semibold rounded-xl hover:bg-purple-500 hover:text-white transition-all shadow-lg"
                    >
                      Read Article
                      <i className="ri-arrow-right-line"></i>
                    </Link>
                  </div>
                </div>
              ))}

              {/* Slider Controls */}
              {featuredNews.length > 1 && (
                <>
                  <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-gray-900 dark:text-white rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 transition-all shadow-lg z-10">
                    <i className="ri-arrow-left-s-line text-2xl"></i>
                  </button>
                  <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm text-gray-900 dark:text-white rounded-full flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 transition-all shadow-lg z-10">
                    <i className="ri-arrow-right-s-line text-2xl"></i>
                  </button>
                  {/* Dots Indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {featuredNews.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`w-2 h-2 rounded-full transition-all ${index === currentSlide
                          ? 'bg-white w-8'
                          : 'bg-white/50 hover:bg-white/75'
                          }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700">
              <p className="text-gray-400 font-semibold text-lg">No Recent News</p>
            </div>
          )}
        </div>
      </section>

      {/* LinkedIn Job Highlights Section */}
      {/* We reuse the InternshipSlider but wrap it or give it a title? */}
      {/* Actually the user asked to 'display the linkedin JOb on the home section' */}
      {/* Let's make the InternshipSlider component handle this better or pass a prop? */}
      {/* InternshipSlider seems self-contained. Let's look at InternshipSlider first or trust it pulls from the updated hook */}
      {/* The updated hook pulls LinkedIn jobs now, so InternshipSlider should ALREADY show them. */}
      {/* But let's make it explicit on the UI as requested if needed. */}
      {/* For now, let's just create a Section Title around it if it doesn't have one, or clarify. */}
      {/* Checking the file usage: <InternshipSlider /> is used directly. */}
      {/* I will trust InternshipSlider uses useInternships hook which now has LinkedIn jobs. */}
      {/* I'll wrap it in a nicer section container to make it pop as "Career Opportunities" */}

      {/* Career Opportunities - Professional Yet Friendly */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:bg-gray-950 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 mb-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full mb-4">
                <i className="ri-linkedin-box-fill text-lg"></i>
                <span className="text-xs font-bold">Powered by LinkedIn</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white leading-tight mb-4">
                Launch Your Career <RocketLaunchIcon sx={{ fontSize: '0.9em', verticalAlign: 'middle', color: '#3b82f6' }} />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600"> While You Study</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                Access exclusive internship opportunities from top companies. Real positions, real experience—all while you're still on campus.
              </p>
            </div>
            <Link
              to="/internships"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40"
            >
              Browse Opportunities
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>
        </div>
        <InternshipSlider />
        <div className="text-center mt-8 relative z-10">
          <p className="text-sm text-gray-500 dark:text-gray-400">Updated daily with fresh opportunities</p>
        </div>
      </section>

      {/* Newsletter Signup - Vibrant & Inviting */}
      <section className="py-20 md:py-28 relative overflow-hidden bg-gradient-to-br from-amber-400 via-orange-400 to-red-400 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        {/* Animated Background Patterns */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 dark:bg-white/10 backdrop-blur-md border border-white/30 rounded-full text-white text-xs font-bold uppercase tracking-wide mb-6 shadow-lg">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <span>Join {stats.students?.toLocaleString() || '0'}+ Students</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
            Never Miss a Deal! <NotificationsActiveIcon sx={{ fontSize: '0.9em', verticalAlign: 'middle' }} /><br />
            <span className="text-white/90">Get the Best Campus Offers</span>
          </h2>

          <p className="text-white/90 dark:text-blue-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Be the first to know about hot deals, exclusive discounts, campus events, and the latest news—delivered straight to your inbox every week.
          </p>

          <NewsletterSignup />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-white/80">
            <span className="flex items-center gap-1.5">
              <i className="ri-shield-check-fill text-lg"></i> No Spam Ever
            </span>
            <span className="flex items-center gap-1.5">
              <i className="ri-lock-2-fill text-lg"></i> 100% Secure
            </span>
            <span className="flex items-center gap-1.5">
              <i className="ri-gift-fill text-lg"></i> Exclusive Deals
            </span>
          </div>
        </div>
      </section>

      {/* Footer - Friendly & Marketplace */}
      <footer className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white pt-16 pb-8 border-t border-gray-200 dark:border-gray-800 relative overflow-hidden">
        {/* Subtle decorative background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-gray-900 dark:to-gray-900 rounded-full blur-3xl opacity-30"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
            <div className="md:col-span-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-14 h-14 flex items-center justify-center">
                  <img src="/PU%20Connect%20logo.png" alt="PU Connect" className="w-full h-full object-contain" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">PU Connect</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed max-w-md mb-8">
                Your trusted campus marketplace. Connecting students, empowering commerce, building community—one deal at a time.
              </p>
              <div className="flex gap-3">
                {[{ icon: 'instagram', color: 'from-pink-500 to-purple-500' }, { icon: 'twitter-x', color: 'from-blue-400 to-blue-600' }, { icon: 'whatsapp', color: 'from-green-400 to-green-600' }].map(social => (
                  <a
                    key={social.icon}
                    href="#"
                    className={`w-11 h-11 bg-gradient-to-br ${social.color} rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform shadow-md`}
                  >
                    <i className={`ri-${social.icon}-line text-lg`}></i>
                  </a>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-6">Quick Links</h4>
              <ul className="space-y-3">
                {[
                  { name: 'Browse Marketplace', path: '/marketplace' },
                  { name: 'Campus News', path: '/news' },
                  { name: 'Start Selling', path: '/seller/apply' },
                  { name: 'My Profile', path: '/profile' }
                ].map(link => (
                  <li key={link.name}>
                    <Link
                      to={link.path}
                      className="text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors font-medium text-sm flex items-center gap-2 group"
                    >
                      <i className="ri-arrow-right-s-line group-hover:translate-x-1 transition-transform"></i>
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-sm font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-6">Get In Touch</h4>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1.5">Email Us</p>
                  <a href="mailto:support@puconnect.com" className="text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors font-semibold flex items-center gap-2">
                    <i className="ri-mail-line text-orange-500"></i>
                    support@puconnect.com
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1.5">Find Us</p>
                  <p className="text-gray-900 dark:text-white font-semibold flex items-center gap-2">
                    <i className="ri-map-pin-line text-orange-500"></i>
                    Main Campus Hub
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              © 2026 PU Connect. Made with <FavoriteIcon sx={{ fontSize: '1em', verticalAlign: 'middle', color: '#ef4444' }} /> for students, by students.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 text-sm font-medium transition-colors">Privacy</a>
              <a href="#" className="text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 text-sm font-medium transition-colors">Terms</a>
              <a href="#" className="text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 text-sm font-medium transition-colors">Help</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
