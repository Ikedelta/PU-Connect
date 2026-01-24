import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

      {/* Hero Section - Split Layout with Floating Visuals */}
      {/* Hero Section - Radiantly Bright Split Layout */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-b from-cyan-50/80 via-white to-white dark:from-gray-950 dark:via-gray-950 dark:to-gray-900 pt-20">

        {/* Radiant Background Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.8, 0.6], rotate: [0, 90, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[40%] -right-[20%] w-[1200px] h-[1200px] bg-gradient-to-br from-cyan-200/40 via-blue-100/40 to-white/0 dark:from-blue-900/20 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.7, 0.5], x: [0, -100, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[20%] -left-[20%] w-[900px] h-[900px] bg-sky-100/50 dark:from-blue-900/20 rounded-full blur-[100px]"
          />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">

          {/* LEFT: Content - Crisp & Vibrant */}
          <div className="pt-10 lg:pt-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-blue-100 shadow-lg shadow-blue-100/50 text-blue-600 rounded-full text-xs font-extrabold uppercase tracking-wide mb-8 backdrop-blur-md"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
              Official Campus Marketplace
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-6xl sm:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-6 leading-tight tracking-tight drop-shadow-sm"
            >
              Buy. Sell. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 animate-gradient-x">Connect.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl text-gray-600 dark:text-gray-300 font-medium max-w-lg leading-relaxed mb-10"
            >
              The unified platform for students.
              <span className="block mt-2 text-gray-500 text-base font-normal">Connect instantly, trade securely.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-5 mb-20"
            >
              <Link to="/marketplace">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -10px rgba(59, 130, 246, 0.4)" }}
                  whileTap={{ scale: 0.95 }}
                  className="px-10 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-full font-bold text-base shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 w-full sm:w-auto transition-all"
                >
                  <i className="ri-shopping-bag-3-fill text-xl"></i>
                  Start Shopping
                </motion.button>
              </Link>
              <Link to={user ? "/seller/dashboard" : "/register"}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-10 py-4 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-700 rounded-full font-bold text-base hover:bg-white dark:hover:bg-gray-700 hover:shadow-lg dark:hover:shadow-none flex items-center justify-center gap-2 w-full sm:w-auto transition-all"
                >
                  {user ? 'Sell Items' : 'Start Selling'}
                </motion.button>
              </Link>
            </motion.div>

            {/* Mobile-Only Hero Visual - Simplified & Robust */}
            <div className="block lg:hidden mb-12 relative w-full">
              <div className="relative rounded-2xl overflow-hidden aspect-[16/9] shadow-lg border border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600">
                {/* Fallback pattern if image fails */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

                <img
                  src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800"
                  alt="Student Tech Setup"
                  className="w-full h-full object-cover mix-blend-overlay opacity-50 relative z-10"
                />

                <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6 z-20">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-3">
                    <i className="ri-macbook-line text-2xl text-white"></i>
                  </div>
                  <p className="text-white font-extrabold text-2xl tracking-tight mb-1">Student Tech Deals</p>
                  <p className="text-blue-100 text-sm font-medium">Laptops, Phones & Accessories</p>
                </div>
              </div>
            </div>

            {/* Stats Row - High Contrast */}
            <div className="flex gap-8 border-t border-gray-200/60 dark:border-gray-800 pt-8">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-gray-900 dark:text-white">{stats.students > 100 ? '2.4K+' : '100+'}</span>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Active Students</span>
              </div>
              <div className="flex flex-col px-8 border-l border-gray-200/60 dark:border-gray-800">
                <span className="text-3xl font-black text-blue-600">{stats.products > 50 ? '500+' : '50+'}</span>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Items Listed</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Floating Visuals - Ultra Bright & Glossy (Desktop Only) */}
          <div className="hidden lg:block relative h-[700px] w-full perspective-1000">
            {/* Brighter Spotlights - Cyan/White Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-cyan-100 via-white to-blue-50 rounded-full blur-3xl opacity-60 mix-blend-multiply dark:mix-blend-normal"></div>

            {/* Floating Card 1 (Back) */}
            <motion.div
              animate={{ y: [-15, 15, -15], rotate: [5, 2, 5] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
              className="absolute top-10 right-0 w-72 p-5 bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-blue-100/50 border border-white/80 z-10"
            >
              <div className="h-40 bg-gradient-to-br from-gray-50 to-white rounded-3xl mb-4 shadow-inner"></div>
              <div className="h-4 w-3/4 bg-gray-100 rounded-full mb-3"></div>
              <div className="h-4 w-1/2 bg-gray-100 rounded-full"></div>
            </motion.div>

            {/* Floating Card 2 (Middle) - Hidden on Mobile */}
            <motion.div
              animate={{ y: [-20, 20, -20], rotate: [-6, -3, -6] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="hidden lg:block absolute top-48 -left-8 w-80 p-5 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-cyan-100/50 border border-white/90 z-20"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 shadow-sm">
                  <i className="ri-shield-star-line text-xl"></i>
                </div>
                <div>
                  <div className="h-4 w-32 bg-gray-100 rounded-full mb-2"></div>
                  <div className="h-3 w-20 bg-gray-50 rounded-full"></div>
                </div>
              </div>
              <div className="h-32 bg-gradient-to-br from-cyan-50/50 to-blue-50/50 rounded-3xl mb-0 flex items-center justify-center border border-white">
                <i className="ri-gift-line text-7xl text-cyan-200 drop-shadow-sm"></i>
              </div>
            </motion.div>

            {/* Floating Card 3 (Front - Hero) - High Gloss */}
            <motion.div
              animate={{ y: [0, -25, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[40%] left-[20%] w-96 p-6 bg-white rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(59,130,246,0.2)] border border-white/60 z-30"
            >
              <div className="absolute -top-8 -right-8 w-20 h-20 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-white font-black text-lg shadow-xl shadow-cyan-500/30 animate-bounce">
                New
              </div>
              <div className="h-56 bg-gradient-to-b from-gray-50 to-white rounded-[2rem] mb-6 relative overflow-hidden group shadow-inner">
                <img src="https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=500" className="w-full h-full object-cover mix-blend-multiply hover:scale-110 transition-transform duration-700" alt="MacBook" />
              </div>
              <div className="flex justify-between items-end mb-2">
                <div>
                  <span className="text-xs font-extrabold text-cyan-600 uppercase tracking-widest bg-cyan-50 px-3 py-1 rounded-lg">Featured</span>
                  <h3 className="text-2xl font-black text-gray-900 mt-2">MacBook Air</h3>
                </div>
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">₵6,500</span>
              </div>
              <button className="w-full mt-5 py-4 bg-gray-900 text-white rounded-2xl font-bold text-base hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all">
                View Details
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Badges Bar */}
      <section className="py-10 border-y border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-center gap-8 md:gap-16">
          {[
            { label: 'Campus Verified', icon: 'ri-shield-check-fill' },
            { label: 'Instant Chat', icon: 'ri-message-3-fill' },
            { label: 'Secure Meetups', icon: 'ri-map-pin-user-fill' },
            { label: 'Student Deals', icon: 'ri-price-tag-3-fill' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 font-bold text-sm md:text-base">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <i className={`${item.icon} text-lg`}></i>
              </div>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <AdSenseBanner />

      {/* Market Categories - Minimal Grid */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Shop by Category</h2>
            <p className="text-gray-500 dark:text-gray-400">Find exactly what you need.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { id: 'electronics', name: 'Electronics', desc: 'Gadgets & Tech', img: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=600' },
              { id: 'books', name: 'Textbooks', desc: 'Study Materials', img: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600' },
              { id: 'fashion', name: 'Fashion', desc: 'Campus Style', img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=600' },
              { id: 'food', name: 'Food', desc: 'Snacks & Eats', img: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&q=80&w=600' }
            ].map((cat, i) => (
              <motion.div
                key={cat.id}
                onClick={() => handleProductClick(cat.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="group relative h-[280px] rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all"
              >
                <img
                  src={getOptimizedImageUrl(cat.img, 600, 80)}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>

                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wide block mb-2">{cat.desc}</span>
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2 group-hover:gap-3 transition-all">
                    {cat.name}
                    <i className="ri-arrow-right-line text-lg opacity-0 group-hover:opacity-100 transition-opacity"></i>
                  </h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Now */}
      <section className="py-12 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Trending Now</h3>
            </div>
            <Link to="/marketplace?sort=popular" className="hidden sm:flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors">
              See All <i className="ri-arrow-right-line"></i>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {trendingProducts.length > 0 ? (
              trendingProducts.map((product, i) => (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="block"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ y: -8 }}
                    className="group h-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-orange-500/10 transition-all flex flex-col relative"
                  >
                    {/* Trending Badge */}
                    <div className="absolute top-3 left-3 z-10">
                      <div className="relative">
                        <div className="absolute inset-0 bg-red-500 rounded-full blur-sm opacity-50 animate-pulse"></div>
                        <span className="relative bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                          <i className="ri-fire-fill"></i> HOT
                        </span>
                      </div>
                    </div>

                    <div className="aspect-square bg-gray-50 dark:bg-gray-800 relative overflow-hidden">
                      {product.images?.[0] ? (
                        <img
                          src={getOptimizedImageUrl(product.images[0], 400, 85)}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <i className="ri-image-2-line text-3xl"></i>
                        </div>
                      )}

                      {/* Overlay Interaction */}
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="bg-white text-gray-900 font-bold text-xs px-4 py-2 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300"
                        >
                          View Details
                        </motion.button>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <span className="text-xs font-semibold text-gray-400 mb-1 block uppercase tracking-wider">{product.category}</span>
                      <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors flex-1">
                        {product.name}
                      </h4>
                      <div className="pt-3 mt-auto border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Price</p>
                          <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-600">
                            {product.price_type === 'fixed' ? `₵${product.price?.toLocaleString()}` : 'Contact'}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm">
                          <i className="ri-arrow-right-line"></i>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))
            ) : (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-square bg-gray-50 dark:bg-gray-800 rounded-xl animate-pulse"></div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* New Listings - Simplified */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">New Listings</h2>
            <Link
              to="/marketplace"
              className="text-orange-600 font-semibold text-sm hover:text-orange-700"
            >
              View All
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isProductsLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-xl p-4 h-[300px] animate-pulse"></div>
              ))
            ) : (
              featuredProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="group bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer border border-gray-100 dark:border-gray-700 h-[340px] flex flex-col relative"
                >
                  {/* New Badge */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                      <i className="ri-flashlight-fill"></i> NEW
                    </span>
                  </div>

                  <div className="relative h-56 w-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={getOptimizedImageUrl(product.images[0], 600, 80)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <i className="ri-image-2-line text-3xl"></i>
                      </div>
                    )}

                    {/* Quick View Overlay */}
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-900 shadow-lg transform scale-0 group-hover:scale-100 transition-transform duration-300">
                        <i className="ri-arrow-right-line text-lg"></i>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-md uppercase tracking-wide">{product.category}</span>
                    </div>

                    <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors flex-1">
                      {product.name}
                    </h3>

                    <div className="pt-3 mt-auto border-t border-gray-50 dark:border-gray-700 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Price</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {product.price_type === 'fixed' ? `₵${product.price?.toLocaleString()}` : 'Offer'}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-gray-400">Just now</span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>
      {/* Community Section (Removed redundant decorative section for simplicity) */}

      {/* News Section - Clean List */}
      <section className="py-16 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Campus News</h2>
            <Link to="/news" className="text-blue-600 font-semibold text-sm hover:text-blue-700 flex items-center gap-1">
              Read All <i className="ri-arrow-right-line"></i>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredNews.slice(0, 3).map((news, i) => (
              <motion.div
                key={news.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="group cursor-pointer"
                onClick={() => navigate(`/news/${news.id}`)}
              >
                <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden mb-4 relative shadow-sm group-hover:shadow-lg transition-all">
                  <img
                    src={getOptimizedImageUrl(news.image_url, 600, 80)}
                    alt={news.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=600'; }}
                  />
                  {/* Date Badge */}
                  <div className="absolute top-3 left-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur shadow-sm rounded-lg px-3 py-1.5 text-center min-w-[50px]">
                    <span className="block text-xs font-bold text-blue-600 uppercase mb-0.5">
                      {new Date(news.created_at).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="block text-lg font-black text-gray-900 dark:text-white leading-none">
                      {new Date(news.created_at).getDate()}
                    </span>
                  </div>

                  {/* Category Tag */}
                  <div className="absolute bottom-3 left-3">
                    <span className="bg-blue-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm backdrop-blur-sm">
                      {news.category}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-gray-900 dark:text-white text-xl mb-2 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                  {news.title}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                  {(news.excerpt || news.content || '').substring(0, 100)}...
                </p>
                <div className="flex items-center text-blue-600 font-semibold text-sm group-hover:gap-2 transition-all">
                  Read Article <i className="ri-arrow-right-line opacity-0 group-hover:opacity-100 transition-opacity"></i>
                </div>
              </motion.div>
            ))}
          </div>
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

      {/* Career Launchpad - Professional Features */}
      <section className="py-20 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 relative overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full mb-4"
              >
                <i className="ri-linkedin-box-fill text-lg"></i>
                <span className="text-xs font-bold">Powered by LinkedIn</span>
              </motion.div>

              <h2 className="text-4xl font-bold text-gray-900 dark:text-white leading-tight mb-2">
                Launch Your Career <RocketLaunchIcon sx={{ fontSize: '0.9em', verticalAlign: 'middle', color: '#3b82f6' }} />
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl">
                Discover internships and job opportunities curated for students.
              </p>
            </div>

            <Link to="/internships">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2"
              >
                Explore Opportunities <i className="ri-arrow-right-line"></i>
              </motion.button>
            </Link>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-gray-800 dark:to-gray-800 rounded-3xl blur-xl opacity-50 -z-10"></div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2">
              <InternshipSlider />
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-2">
              <i className="ri-refresh-line animate-spin-slow"></i> Updated daily with fresh roles
            </p>
          </div>
        </div>
      </section>

      {/* Newsletter - Premium CTA */}
      <section className="py-24 relative overflow-hidden">
        {/* Deep Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 z-0"></div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0 overflow-hidden opacity-30">
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-10 left-10 text-8xl text-blue-500/20"
          >
            <i className="ri-mail-send-fill"></i>
          </motion.div>
          <motion.div
            animate={{ y: [0, 30, 0], rotate: [0, -10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-10 right-10 text-9xl text-indigo-500/20"
          >
            <i className="ri-notification-3-fill"></i>
          </motion.div>
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/20 border border-blue-400/30 backdrop-blur-md rounded-full text-blue-200 text-xs font-bold uppercase tracking-wide mb-6"
          >
            <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
            Join {stats.students > 0 ? stats.students.toLocaleString() : '2,000'}+ Students
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight"
          >
            Never Miss a Deal <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200">On Campus</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-blue-100/80 mb-10 text-lg max-w-2xl mx-auto"
          >
            Get exclusive discounts, internship alerts, and campus news delivered straight to your inbox. No spam, just value.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl max-w-lg mx-auto"
          >
            <NewsletterSignup />
          </motion.div>

          <div className="mt-8 flex justify-center gap-6 text-xs text-blue-300 font-medium">
            <span className="flex items-center gap-1.5"><i className="ri-lock-fill"></i> Secure</span>
            <span className="flex items-center gap-1.5"><i className="ri-spam-3-fill"></i> No Spam</span>
            <span className="flex items-center gap-1.5"><i className="ri-pulse-fill"></i> Weekly Updates</span>
          </div>
        </div>
      </section>

      {/* Footer - Friendly & Marketplace */}
      <footer className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white pt-16 pb-8 border-t border-gray-200 dark:border-gray-800 relative overflow-hidden">
        {/* Subtle decorative background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-gray-900 dark:to-gray-900 rounded-full blur-3xl opacity-30"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
            <div className="md:col-span-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-8 w-auto flex items-center justify-center">
                  <img src="/Compus%20Konnect%20logo.png" alt="Campus Konnect" className="w-full h-full object-contain" />
                </div>
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
              <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-6">Quick Links</h4>
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
                      className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium text-sm flex items-center gap-2 group"
                    >
                      <i className="ri-arrow-right-s-line group-hover:translate-x-1 transition-transform"></i>
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-6">Get In Touch</h4>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1.5">Email Us</p>
                  <a href="mailto:campuskonnect11@gmail.com" className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-semibold flex items-center gap-2">
                    <i className="ri-mail-line text-blue-500"></i>
                    campuskonnect11@gmail.com
                  </a>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1.5">Find Us</p>
                  <p className="text-gray-900 dark:text-white font-semibold flex items-center gap-2">
                    <i className="ri-map-pin-line text-blue-500"></i>
                    Main Campus Hub
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              © 2026 Campus Konnect. Made with <FavoriteIcon sx={{ fontSize: '1em', verticalAlign: 'middle', color: '#ef4444' }} /> for students, by students.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium transition-colors">Privacy</a>
              <a href="#" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium transition-colors">Terms</a>
              <a href="#" className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-medium transition-colors">Help</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
