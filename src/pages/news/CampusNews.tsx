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

      <section className="relative py-24 md:py-32 overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:bg-gray-950">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={bannerUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1920'}
            alt="Campus"
            className="w-full h-full object-cover opacity-10 dark:opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/40 to-white/60 dark:from-gray-950/90 dark:to-gray-950"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10 w-full">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-3 px-4 py-2 bg-white dark:bg-orange-600/10 border border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-400 text-xs font-bold rounded-full mb-6 shadow-sm">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
                Official News Feed
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight mb-6">
                Campus <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500">News</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400 font-medium text-base">
                Stay informed with the latest campus updates
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto self-end">
              <form
                onSubmit={(e) => { e.preventDefault(); setDebouncedSearch(searchQuery); }}
                className="relative group w-full sm:min-w-[400px]"
              >
                <i className="ri-search-2-line absolute left-5 top-1/2 -translate-y-1/2 text-xl text-gray-400 pointer-events-none"></i>
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-28 py-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl focus:border-orange-500 dark:focus:border-orange-500 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder-gray-400 text-base shadow-sm hover:shadow-md"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95"
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

        {/* Categories */}
        <div className="mb-16 overflow-x-auto pb-4 no-scrollbar">
          <div className="flex gap-3 min-w-max px-2">
            {[
              { id: 'all', label: 'All News', icon: 'ri-apps-2-line' },
              { id: 'General', label: 'General', icon: 'ri-newspaper-line' },
              { id: 'Announcements', label: 'Announcements', icon: 'ri-megaphone-line' },
              { id: 'Academic', label: 'Academic', icon: 'ri-book-3-line' },
              { id: 'Events', label: 'Events', icon: 'ri-calendar-event-line' },
              { id: 'Sports', label: 'Sports', icon: 'ri-trophy-line' },
              { id: 'Ads', label: 'Spotlight', icon: 'ri-lightbulb-flash-line' }
            ].map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-3 px-6 py-3 rounded-full font-bold text-sm transition-all active:scale-95 border ${selectedCategory === category.id
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 border-transparent text-white shadow-lg'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-400 hover:border-orange-300 dark:hover:border-orange-700 hover:text-orange-600 dark:hover:text-orange-400'
                  }`}
              >
                <i className={`${category.icon} text-lg`}></i>
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
                <div className="relative h-72 w-full overflow-hidden bg-gray-100 dark:bg-gray-800 rounded-t-[2.5rem]">
                  <img
                    src={getOptimizedImageUrl(article.image_url, 800, 85)}
                    alt={article.title}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1585829365234-781fcd504308?auto=format&fit=crop&q=80&w=800';
                    }}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-6 left-6">
                    <span className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-xl shadow-lg">
                      {article.category}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>

                <div className="p-8 flex-1 flex flex-col">
                  <div className="flex items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-500 mb-5">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                      <i className="ri-time-line text-orange-500"></i>
                      {formatDate(article.created_at)}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <i className="ri-eye-line text-orange-500"></i>
                      {article.views_count || 0}
                    </div>
                  </div>

                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-5 leading-tight line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {article.title}
                  </h3>

                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed mb-8">
                    {(article.excerpt || article.content)
                      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
                      .replace(/[#*`_~]/g, '') // Remove basic formatting
                      .substring(0, 150)}
                    ...
                  </p>

                  <div className="mt-auto flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{article.category}</span>
                    <div className="w-10 h-10 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-xl flex items-center justify-center group-hover:bg-gradient-to-r group-hover:from-orange-500 group-hover:to-amber-500 group-hover:text-white group-hover:shadow-lg transition-all duration-500">
                      <i className="ri-arrow-right-line text-lg"></i>
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
