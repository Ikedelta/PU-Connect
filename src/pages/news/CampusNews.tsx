import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/feature/Navbar';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useNews } from '../../hooks/useNews';
import { useSiteContent, CONTENT_KEYS } from '../../hooks/useSiteContent';
import AdSenseBanner from '../../components/feature/AdSenseBanner';

export default function CampusNews() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { url: bannerUrl } = useSiteContent(CONTENT_KEYS.NEWS_BANNER);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: news = [], isLoading: loading } = useNews({
    category: selectedCategory,
    search: debouncedSearch,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
      <Navbar />

      <section className="relative py-24 md:py-40 overflow-hidden bg-gray-950">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={bannerUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1920'}
            alt="Campus"
            className="w-full h-full object-cover opacity-20 mix-blend-luminosity scale-110 animate-pulse"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent"></div>
          {/* Cyberpunk grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 w-full">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-8 backdrop-blur-md">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping"></span>
                Official Press Network
              </div>
              <h1 className="text-5xl md:text-8xl font-black text-white leading-none tracking-tighter mb-8 drop-shadow-2xl">
                Campus<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Chronicle.</span>
              </h1>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-3">
                <span className="w-12 h-[1px] bg-blue-500/30"></span>
                The pulse of Pentecost University communication
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto self-end">
              <form
                onSubmit={(e) => { e.preventDefault(); setDebouncedSearch(searchQuery); }}
                className="relative group w-full sm:min-w-[400px]"
              >
                <i className="ri-search-2-line absolute left-6 top-1/2 -translate-y-1/2 text-2xl text-gray-400 group-focus-within:text-blue-400 transition-all pointer-events-none"></i>
                <input
                  type="text"
                  placeholder="Scan for articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-32 py-6 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:border-blue-400/50 outline-none transition-all font-bold text-white placeholder-gray-500 text-lg backdrop-blur-xl"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-3 bottom-3 px-8 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/40 active:scale-95 cursor-pointer"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 md:py-24">
        {/* Google AdSense Banner */}
        <AdSenseBanner className="mb-20" />

        {/* Categories Matrix */}
        <div className="mb-20 overflow-x-auto pb-4 no-scrollbar">
          <div className="flex gap-4 min-w-max px-2">
            {[
              { id: 'all', label: 'All Updates', icon: 'ri-apps-2-fill' },
              { id: 'General', label: 'General News', icon: 'ri-newspaper-fill' },
              { id: 'Announcements', label: 'Official Dispatches', icon: 'ri-megaphone-fill' },
              { id: 'Academic', label: 'Knowledge Hub', icon: 'ri-book-3-fill' },
              { id: 'Events', label: 'Campus Live', icon: 'ri-calendar-event-fill' },
              { id: 'Sports', label: 'Athletics', icon: 'ri-trophy-fill' },
              { id: 'Ads', label: 'Spotlight', icon: 'ri-lightbulb-flash-fill' }
            ].map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-4 px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all active:scale-95 cursor-pointer border ${selectedCategory === category.id
                  ? 'bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-500/30'
                  : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-blue-500/30 hover:text-blue-500'
                  }`}
              >
                <i className={`${category.icon} text-xl`}></i>
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Intelligence Feed */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-[600px] bg-gray-50 dark:bg-gray-900/50 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 animate-pulse"></div>
            ))}
          </div>
        ) : news.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {news.map((article) => (
              <Link
                key={article.id}
                to={`/news/${article.id}`}
                className="group relative bg-white dark:bg-gray-900/30 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-700 flex flex-col overflow-hidden"
              >
                <div className="relative h-72 w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img
                    src={getOptimizedImageUrl(article.image_url, 800, 85)}
                    alt={article.title}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1585829365234-781fcd504308?auto=format&fit=crop&q=80&w=800';
                    }}
                    className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
                  />
                  <div className="absolute top-6 left-6">
                    <span className="px-5 py-2 bg-blue-600/90 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg">
                      {article.category}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>

                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex items-center gap-4 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                      <i className="ri-time-line text-blue-500"></i>
                      {formatDate(article.created_at)}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <i className="ri-bar-chart-2-line text-blue-500"></i>
                      {article.views_count || 0}
                    </div>
                  </div>

                  <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-6 leading-[1.15] tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                    {article.title}
                  </h3>

                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mb-8">
                    {(article.excerpt || article.content)
                      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
                      .replace(/[#*`_~]/g, '') // Remove basic formatting
                      .substring(0, 150)}
                    ...
                  </p>

                  <div className="mt-auto flex items-center justify-between pt-8 border-t border-gray-50 dark:border-gray-800/50">
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] group-hover:text-blue-600 transition-colors">Digital Library / {article.category}</span>
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-500">
                      <i className="ri-arrow-right-line text-xl"></i>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-40 text-center bg-gray-50/50 dark:bg-gray-900/30 rounded-[4rem] border border-dashed border-gray-200 dark:border-gray-800">
            <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-10 rotate-3 group-hover:rotate-0 transition-transform">
              <i className="ri-article-line text-4xl text-gray-200 dark:text-gray-700"></i>
            </div>
            <h3 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter">No signals found.</h3>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] max-w-sm mx-auto leading-relaxed">The communication network is currently silent for this frequency. Please check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
}
