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

      <section className="relative py-16 md:py-32 overflow-hidden bg-gray-950">
        {/* Background Image Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={bannerUrl}
            alt="Campus"
            className="w-full h-full object-cover opacity-30 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-950/60 to-gray-950"></div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
          {/* News Feed Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide rounded-full mb-6">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                Official Press
              </div>
              <h1 className="text-5xl md:text-[6rem] font-bold text-white leading-[0.9] tracking-tight mb-6">
                University<br /><span className="text-indigo-400">News.</span>
              </h1>
              <p className="text-gray-400 font-bold uppercase tracking-wide text-[10px]">
                OFFICIAL CAMPUS INFORMATION NETWORK
              </p>
            </div>


            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <form
                onSubmit={(e) => { e.preventDefault(); setDebouncedSearch(searchQuery); }}
                className="relative group flex-1 sm:w-80"
              >
                <i className="ri-search-line absolute left-6 top-1/2 -translate-y-1/2 text-xl text-gray-400 group-focus-within:text-indigo-400 transition-all pointer-events-none"></i>
                <input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-32 py-5 bg-white/10 border border-white/10 rounded-2xl focus:bg-white/20 focus:border-indigo-400 outline-none transition-all font-semibold text-white placeholder-gray-400 text-lg backdrop-blur-md"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bottom-2 px-6 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-500 transition-all shadow-lg active:scale-95"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 md:py-20">

        {/* Google AdSense Banner */}
        <AdSenseBanner className="mb-12" />

        {/* Matrix Categories */}
        <div className="mb-20 overflow-x-auto pb-4 no-scrollbar">
          <div className="flex gap-4 md:gap-6 min-w-max px-2">
            {[
              { id: 'all', label: 'All News', icon: 'ri-apps-2-line' },
              { id: 'Events', label: 'Campus Events', icon: 'ri-calendar-event-line' },
              { id: 'Academics', label: 'Academics', icon: 'ri-book-open-line' },
              { id: 'Campus Life', label: 'Student Life', icon: 'ri-team-line' },
              { id: 'Notices', label: 'Official Notices', icon: 'ri-notification-3-line' }
            ].map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-4 px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${selectedCategory === category.id
                  ? 'bg-gray-900 dark:bg-blue-600 text-white shadow-lg'
                  : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-700'
                  }`}
              >
                <i className={`${category.icon} text-xl`}></i>
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Intel Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-[550px] bg-gray-50 dark:bg-gray-900 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : news.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {news.map((article) => (
              <Link
                key={article.id}
                to={`/news/${article.id}`}
                className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-700 group cursor-pointer"
              >
                <div className="relative h-72 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 mb-8">
                  <img
                    src={getOptimizedImageUrl(article.image_url, 800, 85)}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
                  />
                  <div className="absolute top-6 right-6">
                    <span className="px-4 py-2 bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wide rounded-lg">
                      {article.category}
                    </span>
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-6">
                    <div className="flex items-center gap-2">
                      <i className="ri-calendar-line text-indigo-500 text-base"></i>
                      {formatDate(article.created_at)}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <i className="ri-eye-line text-base"></i>
                      {article.views_count || 0}
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 leading-tight tracking-tight group-hover:text-indigo-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                    {article.title}
                  </h3>

                  <div className="flex items-center justify-between pt-6 border-t border-gray-50 dark:border-gray-800">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Read Article</p>
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <i className="ri-arrow-right-line text-xl"></i>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-40 text-center bg-gray-50 dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
            <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-10 shadow-lg">
              <i className="ri-article-line text-4xl text-gray-200 dark:text-gray-700"></i>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">No articles found.</h3>
            <p className="text-gray-400 font-semibold uppercase tracking-wide text-xs">There are no updates available for this category at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
