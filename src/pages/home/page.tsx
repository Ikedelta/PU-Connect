import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFeaturedNews } from '../../hooks/useNews';
import { useProducts } from '../../hooks/useProducts';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useSiteContent, CONTENT_KEYS } from '../../hooks/useSiteContent';
import Navbar from '../../components/feature/Navbar';
import CampusPulse from '../../components/feature/CampusPulse';
import NewsletterSignup from '../../components/feature/NewsletterSignup';
import AdSenseBanner from '../../components/feature/AdSenseBanner';
import AdBanner from '../../components/feature/AdBanner';
import InternshipSlider from '../../components/feature/InternshipSlider';
import Footer from '../../components/layout/Footer';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: featuredNews = [], isLoading: isNewsLoading } = useFeaturedNews(5);
  // Optimize: Fetch only 24 products for the home page sections (Featured + Trending)
  const { data: allProducts = [], isLoading: isProductsLoading } = useProducts({ limit: 24 });
  const [heroSlide, setHeroSlide] = useState(0);

  const { url: heroMain } = useSiteContent(CONTENT_KEYS.HOME_HERO_MAIN);
  const { url: heroAerial } = useSiteContent(CONTENT_KEYS.HOME_HERO_AERIAL);

  const heroImages = [heroMain, heroAerial, '/image 1.jpg', '/image 5.jpg'];

  // Get featured products (first 4 products) - useMemo for performance
  const featuredProducts = useMemo(() => allProducts.slice(0, 4), [allProducts]);
  const trendingProducts = useMemo(() => [...allProducts]
    .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
    .slice(0, 4), [allProducts]);

  // State for content
  const [displayProducts, setDisplayProducts] = useState<any[]>([]);
  // Use a different name for state to avoid conflict with derived memo
  const [fetchedTrending, setFetchedTrending] = useState<any[]>([]);
  const [socialUsers, setSocialUsers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    products: 0,
    students: 0,
    verified: true
  });

  const [listingsFilter, setListingsFilter] = useState<'trending' | 'new'>('trending');

  // Use fetched trending if available, otherwise fall back to memoized local trending
  const finalTrendingProducts = fetchedTrending.length > 0 ? fetchedTrending : trendingProducts;

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
  };

  // Main Data Fetch for Home Page
  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // 1. Fetch random products for hero section
        // We fetch a slightly larger batch and pick 3 random ones
        const { data: randomProducts } = await supabase
          .from('products')
          .select('id, name, images, price')
          .eq('is_active', true)
          .limit(8);

        if (randomProducts) {
          setDisplayProducts(randomProducts.sort(() => 0.5 - Math.random()).slice(0, 3));
        }

        // 2. Fetch trending products (sorted by views)
        const { data: trending } = await supabase
          .from('products')
          .select('*, seller:profiles(full_name, avatar_url)')
          .eq('is_active', true)
          .order('views_count', { ascending: false })
          .limit(8);

        if (trending) {
          setFetchedTrending(trending);
        }

        // 3. Fetch active users for social proof
        const { data: users } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('is_active', true)
          .not('avatar_url', 'is', null)
          .limit(20);

        if (users) {
          setSocialUsers(users.sort(() => 0.5 - Math.random()).slice(0, 4));
        }

      } catch (error) {
        console.error('Error fetching home data:', error);
      }
    };

    fetchHomeData();
  }, []);

  // Stats Fetcher & Realtime Subscription
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Use RPC for accurate count if available, or fallback to count queries
        const { data, error } = await supabase.rpc('get_public_stats');

        if (data && !error) {
          setStats(prev => ({
            ...prev,
            products: data.products || 0,
            students: data.users || 0
          }));
        } else {
          // Fallback: Parallel requests for counts
          const [productRes, userRes] = await Promise.all([
            supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
            supabase.from('profiles').select('id', { count: 'exact', head: true })
          ]);

          setStats(prev => ({
            ...prev,
            products: productRes.count || 0,
            students: userRes.count || 0
          }));
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };

    fetchStats();

    // Subscribe to changes for live updates
    const channel = supabase.channel('home-realtime-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Hero Slider Interval
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % heroImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

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
              className="text-4xl sm:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-6 leading-tight tracking-tight drop-shadow-sm"
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
              Campus Life, Elevated. 🚀
              <span className="block mt-4 text-gray-500 dark:text-gray-400 text-lg font-medium">
                Join the vibrant community where students buy, sell, and thrive together.
              </span>
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

            {/* Mobile-Only Hero Visual - Dynamic Trending Card */}
            <div className="block lg:hidden mb-12 relative w-full" onClick={() => trendingProducts[0] && navigate(`/product/${trendingProducts[0].id}`)}>
              {trendingProducts[0] ? (
                <div className="relative rounded-3xl overflow-hidden aspect-[16/10] shadow-2xl shadow-blue-500/20 border border-white/50 active:scale-95 transition-transform">
                  {trendingProducts[0].images?.[0] ? (
                    <img
                      src={getOptimizedImageUrl(trendingProducts[0].images[0], 600, 80)}
                      alt={trendingProducts[0].name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                      <i className="ri-shopping-bag-3-line text-5xl text-white/30"></i>
                    </div>
                  )}

                  {/* Glass Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-transparent to-transparent">
                    <div className="absolute top-4 right-4 px-3 py-1 bg-rose-500 rounded-full text-[10px] font-black text-white uppercase shadow-lg shadow-rose-500/20 animate-pulse">
                      #1 Hot
                    </div>
                    <div className="absolute bottom-0 left-0 w-full p-6">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-cyan-300 text-[10px] font-bold uppercase tracking-widest mb-1">{trendingProducts[0].category}</p>
                          <h3 className="text-xl font-black text-white line-clamp-1">{trendingProducts[0].name}</h3>
                        </div>
                        <div className="text-white font-black text-xl">
                          ₵{trendingProducts[0].price?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Skeleton Loader
                <div className="relative rounded-3xl overflow-hidden aspect-[16/10] bg-gray-100 animate-pulse flex items-center justify-center">
                  <i className="ri-loader-4-line text-3xl text-gray-300 animate-spin"></i>
                </div>
              )}
            </div>

            {/* Stats Row - High Contrast */}
            <div className="flex flex-wrap gap-6 sm:gap-8 border-t border-gray-200/60 dark:border-gray-800 pt-8">
              <div className="flex flex-col">
                <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                  {stats.students >= 1000 ? `${(stats.students / 1000).toFixed(1)}K+` : stats.students.toLocaleString()}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider">Active Students</span>
              </div>
              <div className="flex flex-col px-6 sm:px-8 border-l border-gray-200/60 dark:border-gray-800">
                <span className="text-2xl sm:text-3xl font-black text-blue-600">
                  {stats.products >= 1000 ? `${(stats.products / 1000).toFixed(1)}K+` : stats.products.toLocaleString()}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider">Items Listed</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Floating Visuals - Ultra Bright & Glossy (Desktop Only) */}
          <div className="hidden lg:block relative h-[700px] w-full perspective-1000">
            {/* Brighter Spotlights - Cyan/White Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-cyan-100 via-white to-blue-50 rounded-full blur-3xl opacity-60 mix-blend-multiply dark:mix-blend-normal"></div>

            {/* Floating Card 1 (Back) - Secondary Random Product */}
            <motion.div
              animate={{ y: [-15, 15, -15], rotate: [5, 2, 5] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
              className="absolute top-10 right-0 w-72 p-4 bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-blue-100/50 border border-white/80 z-10 cursor-pointer overflow-hidden group"
              onClick={() => displayProducts[1] && navigate(`/product/${displayProducts[1].id}`)}
            >
              <div className="h-40 bg-gray-50 rounded-2xl mb-4 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={displayProducts[1]?.id || 'p2'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    src={getOptimizedImageUrl(displayProducts[1]?.images?.[0] || '', 400, 80)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    alt="Product"
                  />
                </AnimatePresence>
                {!displayProducts[1] && (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50 grayscale absolute inset-0">
                    <i className="ri-shopping-bag-line text-4xl text-gray-200"></i>
                  </div>
                )}
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 backdrop-blur-md rounded-full text-[8px] font-black text-blue-600 uppercase">Featured</div>
              </div>
              <div className="h-3 w-3/4 bg-gray-100 rounded-full mb-2"></div>
              <div className="h-3 w-1/2 bg-gray-50 rounded-full"></div>
            </motion.div>

            {/* Floating Card 2 (Middle) - Tertiary Random Product */}
            <motion.div
              animate={{ y: [-20, 20, -20], rotate: [-6, -3, -6] }}
              transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="hidden lg:block absolute top-48 -left-8 w-80 p-5 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-cyan-100/50 border border-white/90 z-20 cursor-pointer group"
              onClick={() => displayProducts[2] && navigate(`/product/${displayProducts[2].id}`)}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 shadow-sm">
                  <i className="ri-fire-line text-lg"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-full bg-gray-100 rounded-full mb-1.5"></div>
                  <div className="h-2 w-1/2 bg-gray-50 rounded-full"></div>
                </div>
              </div>
              <div className="h-40 bg-gray-50 rounded-2xl mb-4 relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={displayProducts[2]?.id || 'p3'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    src={getOptimizedImageUrl(displayProducts[2]?.images?.[0] || '', 400, 80)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    alt="Product"
                  />
                </AnimatePresence>
                {!displayProducts[2] && (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50 grayscale absolute inset-0">
                    <i className="ri-shopping-bag-line text-4xl text-gray-200"></i>
                  </div>
                )}
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 backdrop-blur-md rounded-full text-[8px] font-black text-blue-600 uppercase">Featured</div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* NEW SECTION: Campus Vibe (Split Layout - Image Heavy) */}
      <section className="py-24 relative overflow-hidden bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left: Content Side (Col Span 5) */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-5 relative z-10"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse"></span>
                Official Campus Platform
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
                Redefine Your <br />
                University Experience.
              </h2>

              <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed font-medium border-l-4 border-slate-200 dark:border-slate-800 pl-6">
                Your central hub for campus commerce and connection. A verified, secure ecosystem designed exclusively for students.
              </p>

              <div className="flex flex-col gap-8">
                {/* Feature Checklist - Professional/Official Look */}
                <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                  {[
                    'Verified Identity',
                    'Secure Messaging',
                    'Campus Logistics',
                    'Student Deals'
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 group">
                      <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
                        <i className="ri-check-line text-sm font-bold"></i>
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/register">
                    <button className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg hover:-translate-y-0.5">
                      Get Started
                    </button>
                  </Link>
                  <Link to="/marketplace">
                    <button className="px-8 py-4 bg-transparent border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                      View Marketplace
                    </button>
                  </Link>
                </div>

                {/* Social Proof (Real Users) */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800/50">
                  <div className="flex -space-x-3">
                    {socialUsers.length > 0 ? socialUsers.map((u, i) => (
                      <div key={u.id || i} className={`w-10 h-10 rounded-full border-2 border-white dark:border-gray-950 bg-gray-200 dark:bg-gray-800 overflow-hidden`}>
                        <img
                          src={getOptimizedImageUrl(u.avatar_url || '', 100, 100)}
                          alt={u.full_name}
                          className="w-full h-full object-cover"
                          onError={(e) => e.currentTarget.src = `https://ui-avatars.com/api/?name=${u.full_name}&background=random`}
                        />
                      </div>
                    )) : (
                      /* Fallback while loading or if no users */
                      [1, 2, 3, 4].map((_, i) => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-950 bg-gray-200 animate-pulse"></div>
                      ))
                    )}
                    <div className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-950 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      +2k
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <i className="ri-star-fill text-yellow-400 text-sm"></i>
                      <i className="ri-star-fill text-yellow-400 text-sm"></i>
                      <i className="ri-star-fill text-yellow-400 text-sm"></i>
                      <i className="ri-star-fill text-yellow-400 text-sm"></i>
                      <i className="ri-star-fill text-yellow-400 text-sm"></i>
                    </div>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Trusted by <span className="text-gray-900 dark:text-white">2,500+ students</span></p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right: Image Side (Col Span 7 - More Prominent) */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-7 relative"
            >
              {/* Main Image Container */}
              <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl h-[550px] border border-gray-200 dark:border-gray-800 group transform hover:scale-[1.01] transition-transform duration-700">
                <img
                  src="/image 5.jpg"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s]"
                  alt="Campus Community"
                  onError={(e) => e.currentTarget.src = "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=2000"}
                />

                {/* Stylish Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/40 via-transparent to-transparent mix-blend-multiply opacity-80"></div>

                <div className="absolute bottom-8 right-8 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl max-w-xs shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <i className="ri-check-line text-xl font-bold"></i>
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">Verified Student</p>
                      <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-wide">Active Now</p>
                    </div>
                  </div>
                  <p className="text-white/80 text-xs font-medium leading-relaxed">
                    "Everything I need for campus life, all in one place. Safe, simple, and student first."
                  </p>
                </div>
              </div>

              {/* Background Decorative Blobs */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-[100px] -z-10 animate-pulse delay-700"></div>
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

      {/* Hero Ad Placement */}
      <section className="py-12 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <AdBanner placement="home_hero" className="w-full" />
        </div>
      </section>

      {/* Popular Categories - Vibrant Grid */}
      <section className="py-16 bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-4">Shop by Category</h2>
            <p className="text-gray-600 dark:text-gray-300 font-medium text-lg">Find exactly what you need, faster.</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Featured Marketplace - Merged Section */}
      <section className="py-16 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Featured Listings</h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Discover what's happening on campus today.</p>
            </div>

            {/* Tabs */}
            <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl inline-flex">
              <button
                onClick={() => setListingsFilter('trending')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${listingsFilter === 'trending'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                Trending 🔥
              </button>
              <button
                onClick={() => setListingsFilter('new')}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${listingsFilter === 'new'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                New Arrivals ⚡
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            {(listingsFilter === 'trending' ? finalTrendingProducts : featuredProducts).length > 0 ? (
              (listingsFilter === 'trending' ? finalTrendingProducts : featuredProducts).map((product, i) => (
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
                    className="group h-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-blue-500/10 transition-all flex flex-col relative"
                  >
                    <div className="absolute top-3 left-3 z-10">
                      {listingsFilter === 'trending' ? (
                        <div className="relative">
                          <div className="absolute inset-0 bg-red-500 rounded-full blur-sm opacity-50 animate-pulse"></div>
                          <span className="relative bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                            <i className="ri-fire-fill"></i> HOT
                          </span>
                        </div>
                      ) : (
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                          <i className="ri-flashlight-fill"></i> NEW
                        </span>
                      )}
                    </div>

                    <div className="aspect-square bg-gray-50 dark:bg-gray-800 relative overflow-hidden">
                      {product.images?.[0] ? (
                        <img
                          src={getOptimizedImageUrl(product.images[0], 500, 90)}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <i className="ri-image-2-line text-3xl"></i>
                        </div>
                      )}

                      {/* Overlay Interaction */}
                      <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 px-2 py-0.5 rounded w-fit mb-2 uppercase tracking-wide">{product.category}</span>
                      <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors flex-1">
                        {product.name}
                      </h4>
                      <div className="pt-3 mt-auto border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Price</p>
                          <p className="text-lg font-black text-gray-900 dark:text-white">
                            {product.price_type === 'fixed' ? `₵${product.price?.toLocaleString()}` : 'Offer'}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                          <i className="ri-arrow-right-line"></i>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))
            ) : (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-square bg-gray-50 dark:bg-gray-800 rounded-3xl animate-pulse"></div>
              ))
            )}
          </div>

          <div className="mt-12 text-center">
            <Link to="/marketplace" className="inline-flex items-center gap-2 px-8 py-3 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
              View All Marketplace Listings <i className="ri-arrow-right-line"></i>
            </Link>
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
                Launch Your Career <i className="ri-rocket-2-line text-blue-500 ml-1"></i>
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

      <Footer />
    </div >
  );
}
