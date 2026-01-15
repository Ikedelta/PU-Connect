import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFeaturedNews } from '../../hooks/useNews';
import { useProducts } from '../../hooks/useProducts';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useSiteContent, CONTENT_KEYS } from '../../hooks/useSiteContent';
import Navbar from '../../components/feature/Navbar';
import NewsletterSignup from '../../components/feature/NewsletterSignup';
import AdSenseBanner from '../../components/feature/AdSenseBanner';
import InternshipSlider from '../../components/feature/InternshipSlider';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: featuredNews = [], isLoading: isNewsLoading } = useFeaturedNews(5);
  const { data: allProducts = [], isLoading: isProductsLoading } = useProducts();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroSlide, setHeroSlide] = useState(0);

  const { url: heroMain } = useSiteContent(CONTENT_KEYS.HOME_HERO_MAIN);
  const { url: heroAerial } = useSiteContent(CONTENT_KEYS.HOME_HERO_AERIAL);

  const heroImages = [heroMain, heroAerial, '/image 1.jpg'];

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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
      <Navbar />

      {/* Hero Section - Immersive Terminal */}
      <section className="relative min-h-[90vh] md:min-h-screen flex items-center overflow-hidden bg-gray-950">
        {/* Background Slider */}
        <div className="absolute inset-0 z-0">
          {heroImages.map((img, index) => (
            <div
              key={img}
              className={`absolute inset-0 transition-opacity duration-[2s] ease-in-out ${index === heroSlide ? 'opacity-40' : 'opacity-0'
                }`}
            >
              <img
                src={img}
                alt={`Campus View ${index + 1}`}
                className={`w-full h-full object-cover object-top transition-transform duration-[10s] ease-linear ${index === heroSlide ? 'scale-110' : 'scale-100'
                  }`}
              />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-900/80 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent"></div>

          {/* High-tech grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 w-full pt-28 md:pt-32">
          <div className="max-w-4xl bg-gray-900/10 backdrop-blur-sm p-8 md:p-12 rounded-[2.5rem] border border-white/5 shadow-2xl animate-fade-in-up">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white mb-4 md:mb-6 leading-[1.1] md:leading-[0.95] tracking-tight drop-shadow-lg">
              Connect.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 drop-shadow-none">Succeed.</span>
            </h1>

            <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-10 mb-8 md:mb-10 animate-fade-in-up delay-100">
              <p className="text-base md:text-xl text-gray-200 font-medium max-w-lg leading-relaxed drop-shadow-md">
                The premier digital platform for campus commerce. <br className="hidden md:block" />
                <span className="text-white font-bold bg-blue-600/20 px-2 py-0.5 rounded-md border border-blue-500/30">Secure</span> transactions within your student community.
              </p>

              <div className="hidden md:flex flex-col border-l-2 border-blue-500/50 pl-4 mt-1 backdrop-blur-sm bg-black/20 p-4 rounded-r-2xl border-y border-r border-white/5">
                <span className="text-2xl font-bold text-white tracking-tight">2.5K+</span>
                <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wide mt-1">Active Students</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 animate-fade-in-up delay-200">
              <Link
                to="/marketplace"
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/30 hover:shadow-blue-600/40 flex items-center justify-center gap-3 active:scale-95 border border-white/10"
              >
                Start Trading
                <i className="ri-arrow-right-line text-lg group-hover:translate-x-1 transition-transform"></i>
              </Link>
              <Link
                to={user ? "/seller/dashboard" : "/register"}
                className="px-8 py-4 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-xl hover:bg-white/20 transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-lg"
              >
                {user ? 'My Dashboard' : 'Join Community'}
                <i className="ri-user-add-line text-lg"></i>
              </Link>
            </div>
          </div>
        </div>

        {/* Slider Indicators - Desktop Only */}
        <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-8 z-20">
          {heroImages.map((_, i) => (
            <button
              key={i}
              onClick={() => setHeroSlide(i)}
              className="group relative flex items-center justify-end gap-4 transition-all cursor-pointer"
            >
              <div className="text-right opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
                <p className="text-[9px] font-bold text-blue-300 uppercase tracking-widest">View {i + 1}</p>
              </div>
              <div className={`w-1.5 h-12 rounded-full transition-all duration-500 overflow-hidden shadow-lg ${i === heroSlide ? 'bg-blue-500 h-16 shadow-blue-500/50' : 'bg-white/20 hover:bg-white/40'}`}></div>
            </button>
          ))}
        </div>
      </section>



      {/* Stats Cluster - Catchy Overlay */}
      <section className="relative z-20 pb-12 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: 'Network Security', value: 'Verified', detail: 'Student Identity Protection', icon: 'ri-shield-check-line', color: 'blue' },
              { label: 'Active Listings', value: '450+', detail: 'Live Campus Postings', icon: 'ri-compass-line', color: 'indigo' },
              { label: 'Community Growth', value: 'Daily', detail: 'Increasing Daily Trades', icon: 'ri-line-chart-line', color: 'emerald' }
            ].map((stat, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-900 p-10 rounded-[2rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.05)] border border-gray-100 dark:border-gray-800 group hover:shadow-xl transition-all duration-500">
                <div className={`w-14 h-14 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-${stat.color}-600 dark:text-${stat.color}-400 mb-8 group-hover:scale-110 transition-transform shadow-sm`}>
                  <i className={`${stat.icon} text-2xl`}></i>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">{stat.value}</p>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AdSenseBanner />

      {/* Featured Collections - Redefined */}
      <section className="py-12 md:py-24 bg-gray-50/50 dark:bg-gray-950/50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16 gap-8">
            <div>
              <p className="text-blue-600 font-bold uppercase tracking-wide text-xs mb-3">Market Categories</p>
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white leading-[1] tracking-tight">University<br />Catalogue.</h2>
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-wide text-[10px] md:text-sm max-w-sm text-right">
              OFFICIAL CATEGORIES FOR STREAMLINED COMMERCE
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {[
              { id: 'electronics', name: 'Electronics', desc: 'Hardware & Gear', img: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=600', color: 'blue' },
              { id: 'books', name: 'Knowledge', desc: 'Books & Resources', img: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600', color: 'indigo' },
              { id: 'fashion', name: 'Fashion', desc: 'Clothing & Trends', img: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=600', color: 'rose' },
              { id: 'food', name: 'Nutrition', desc: 'Food & Groceries', img: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&q=80&w=600', color: 'emerald' }
            ].map((cat) => (
              <div
                key={cat.id}
                onClick={() => handleProductClick(cat.id)}
                className="group relative h-[260px] md:h-[450px] rounded-[2rem] overflow-hidden cursor-pointer shadow-lg hover:-translate-y-2 transition-all duration-700"
              >
                <img
                  src={getOptimizedImageUrl(cat.img, 800, 80)}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-all duration-[2s] group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/10 to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-8 w-full">
                  <div className={`w-10 h-0.5 bg-${cat.color}-500 group-hover:w-full transition-all duration-700 mb-4`}></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 group-hover:text-white transition-colors block mb-2">{cat.desc}</span>
                  <h3 className="text-2xl font-bold text-white leading-tight tracking-tight group-hover:translate-x-2 transition-transform duration-700">{cat.name}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Now - Hot Items */}
      <section className="py-12 bg-white dark:bg-slate-900 border-y border-slate-50 dark:border-slate-800">
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
                    <img
                      src={getOptimizedImageUrl(product.images?.[0] || '', 300, 80)}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
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

      {/* Fresh Drops - Grid Layout Refined */}
      <section className="py-12 md:py-24 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
            <div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-4">Latest Additions</p>
              <h2 className="text-4xl md:text-[4rem] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">New<br /><span className="text-blue-600">Listings.</span></h2>
            </div>
            <Link
              to="/marketplace"
              className="group px-8 py-4 bg-gray-50 dark:bg-gray-900 border border-transparent dark:border-gray-800 text-gray-900 dark:text-white font-bold rounded-2xl hover:bg-gray-900 dark:hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-4 text-xs uppercase tracking-widest"
            >
              Examine Full Catalogue
              <i className="ri-arrow-right-line group-hover:translate-x-2 transition-transform"></i>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {isProductsLoading ? (
              [1, 2, 3, 4].map(i => (
                <div key={i} className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 h-[400px] animate-pulse"></div>
              ))
            ) : (
              featuredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-700 cursor-pointer group"
                >
                  <div className="relative h-56 w-full overflow-hidden rounded-xl mb-4 bg-gray-50 dark:bg-gray-800 shadow-inner">
                    {product.images?.[0] ? (
                      <img
                        src={getOptimizedImageUrl(product.images[0], 600, 80)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-200 dark:text-gray-700">
                        <i className="ri-image-2-line text-6xl"></i>
                      </div>
                    )}
                  </div>
                  <div className="px-2 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2 block">{product.category}</span>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-4 line-clamp-1 group-hover:text-blue-600 transition-colors tracking-tight">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Price</span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                          {product.price_type === 'fixed' ? `₵${product.price?.toLocaleString()}` : 'Contact'}
                        </span>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <i className="ri-arrow-right-line text-lg"></i>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
      {/* Campus Environment - Aerial Insight */}
      <section className="py-12 md:py-24 bg-gray-50 dark:bg-gray-950 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <p className="text-blue-600 font-bold uppercase tracking-widest text-[10px] mb-3">Our Environment</p>
              <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white tracking-tight leading-[0.9] mb-6">Academic<br /><span className="text-blue-600">Horizon.</span></h2>
              <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg font-medium leading-relaxed mb-8 max-w-xl">
                Experience the vibrant campus of Pentecost University. Our specialized digital infrastructure is built to serve this thriving academic community.
              </p>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h4 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">5K+</h4>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Active Students</p>
                </div>
                <div>
                  <h4 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">Verified</h4>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Campus Ecosystem</p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 relative group">
              <div className="absolute -inset-4 bg-blue-600/5 rounded-[2rem] md:rounded-[3rem] blur-2xl group-hover:bg-blue-600/10 transition-all duration-700"></div>
              <div className="relative h-[300px] md:h-[500px] rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl skew-y-0 md:skew-y-1 md:group-hover:skew-y-0 transition-all duration-700">
                <img
                  src={heroAerial}
                  alt="Campus Aerial View"
                  className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-all duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-gray-950/20 to-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Campus News Slideshow - Immersive Focus */}
      <section className="py-12 md:py-24 bg-gray-900 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-blue-500/20"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 px-2 gap-8">
            <div>
              <p className="text-blue-500 font-bold uppercase tracking-widest text-xs mb-4">University News</p>
              <h2 className="text-5xl md:text-[5rem] font-bold text-white tracking-tight leading-[0.9]">Campus<br />Spotlight.</h2>
            </div>
          </div>

          {isNewsLoading ? (
            <div className="h-[400px] w-full bg-white/5 rounded-[2.5rem] animate-pulse"></div>
          ) : featuredNews.length > 0 ? (
            <div className="relative h-[400px] md:h-[600px] rounded-[2.5rem] overflow-hidden shadow-2xl group border border-white/5">
              {featuredNews.map((news, index) => (
                <div
                  key={news.id}
                  className={`absolute inset-0 transition-all duration-[1.2s] ease-in-out transform ${index === currentSlide ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-105 pointer-events-none'
                    }`}
                >
                  <img
                    src={getOptimizedImageUrl(news.image_url, 1920, 85)}
                    alt={news.title}
                    className="w-full h-full object-cover opacity-70"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-900/40 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-8 md:p-16 max-w-4xl">
                    <span className="px-5 py-2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-6 inline-block">
                      {news.category}
                    </span>
                    <h3 className="text-3xl md:text-5xl font-bold text-white mb-8 leading-[1.1] tracking-tight">
                      {news.title}
                    </h3>
                    <Link
                      to={`/news/${news.id}`}
                      className="inline-flex items-center gap-4 px-8 py-4 bg-white text-gray-900 font-bold rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-xl active:scale-95 text-xs md:text-sm uppercase tracking-widest"
                    >
                      Read Full Article
                      <i className="ri-arrow-right-line text-xl"></i>
                    </Link>
                  </div>
                </div>
              ))}

              {/* Slider Controls */}
              {featuredNews.length > 1 && (
                <div className="absolute bottom-12 right-12 hidden md:flex gap-4 z-10">
                  <button onClick={prevSlide} className="h-14 w-14 bg-white/5 backdrop-blur-md border border-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-gray-900 transition-all group cursor-pointer">
                    <i className="ri-arrow-left-s-line text-2xl"></i>
                  </button>
                  <button onClick={nextSlide} className="h-14 w-14 bg-white/5 backdrop-blur-md border border-white/10 text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-gray-900 transition-all group cursor-pointer">
                    <i className="ri-arrow-right-s-line text-2xl"></i>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-white/5 rounded-[2.5rem] border border-white/5">
              <p className="text-gray-500 font-bold uppercase tracking-widest text-lg">No Recent Updates</p>
            </div>
          )}
        </div>
      </section>

      {/* Internship Opportunities Slider */}
      <InternshipSlider />
      <section className="py-24 relative overflow-hidden bg-gray-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-indigo-800 to-gray-900 opacity-90"></div>

        {/* Animated Background Mesh */}
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500 rounded-full blur-[120px] opacity-30 translate-x-1/3 -translate-y-1/3 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[100px] opacity-30 -translate-x-1/3 translate-y-1/3"></div>

        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-[10px] font-bold uppercase tracking-widest mb-8 shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Join 3,000+ Students</span>
          </div>

          <h2 className="text-4xl md:text-7xl font-bold text-white mb-8 tracking-tight leading-none drop-shadow-lg">
            Always Be <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200">The First To Know.</span>
          </h2>

          <p className="text-blue-100 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
            Get exclusive access to top-tier market deals, breaking campus news, and community events delivered straight to your inbox.
          </p>

          <NewsletterSignup />

          <div className="mt-8 flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-widest text-blue-200/60">
            <span className="flex items-center gap-1"><i className="ri-shield-check-fill"></i> No Spam</span>
            <span className="flex items-center gap-1"><i className="ri-lock-2-fill"></i> Secure</span>
            <span className="flex items-center gap-1"><i className="ri-time-line"></i> Weekly Updates</span>
          </div>
        </div>
      </section>

      {/* Global Finishing - Professional Network */}
      <footer className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white pt-12 pb-8 border-t border-gray-100 dark:border-gray-900 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
            <div className="md:col-span-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img src="/PU%20Connect%20logo.png" alt="PU Connect" className="w-full h-full object-contain" />
                </div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium leading-relaxed max-w-lg mb-10">
                Providing specialized digital infrastructure for secure campus-based commerce and communication.
              </p>
              <div className="flex gap-3">
                {['instagram', 'twitter-x', 'whatsapp'].map(social => (
                  <a key={social} href="#" className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-center hover:bg-gray-900 dark:hover:bg-white hover:text-white dark:hover:text-gray-900 transition-all shadow-sm border border-gray-100 dark:border-gray-800">
                    <i className={`ri-${social}-line text-lg`}></i>
                  </a>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wide mb-8 text-blue-600">Main Categories</h4>
              <ul className="space-y-4">
                {['Marketplace', 'Campus News', 'Become a Seller', 'Account Profile'].map(link => (
                  <li key={link}>
                    <Link to={link === 'Marketplace' ? '/marketplace' : link === 'Campus News' ? '/news' : link === 'Become a Seller' ? '/seller/apply' : '/profile'} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all font-bold text-xs uppercase tracking-wide hover:translate-x-2 inline-block">
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wide mb-8 text-blue-600">Service Support</h4>
              <div className="space-y-6">
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Electronic Mail</span>
                  <a href="mailto:support@puconnect.com" className="text-base font-bold text-gray-900 dark:text-white hover:text-blue-600 transition-colors">support@puconnect.com</a>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Campus Location</span>
                  <p className="text-base font-bold text-gray-900 dark:text-white">Main Campus, Information Hub</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-12 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wide">&copy; 2024 PU Connect. All professional rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-[10px] font-bold uppercase tracking-wide transition-colors">Privacy Policy</a>
              <a href="#" className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-[10px] font-bold uppercase tracking-wide transition-colors">Service Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
