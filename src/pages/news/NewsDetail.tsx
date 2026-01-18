import { Link, useParams } from 'react-router-dom';
import { useNewsArticle, useNews } from '../../hooks/useNews';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import Navbar from '../../components/feature/Navbar';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function NewsDetail() {
  const { id } = useParams();

  const { data: article, isLoading: loadingDocs } = useNewsArticle(id);

  const { data: relatedNews = [] } = useNews({
    category: article?.category,
    isPublished: true
  });

  const filteredRelatedNews = relatedNews
    .filter(n => n.id !== id)
    .slice(0, 3);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleShare = () => {
    const shareTitle = article?.title || 'Campus News';
    const shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        url: shareUrl,
      }).catch(err => {
        if (err.name !== 'AbortError') console.error('Share failed:', err);
      });
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareTitle + ': ' + shareUrl)}`;
      window.open(whatsappUrl, '_blank');
      navigator.clipboard.writeText(shareUrl);
    }
  };

  if (loadingDocs) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 transition-colors duration-300">
        <Navbar />
        <div className="text-center py-24">
          <div className="inline-block w-12 h-12 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pt-20 transition-colors duration-300">
        <Navbar />
        <div className="text-center py-20 max-w-md mx-auto">
          <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-file-damage-line text-5xl text-red-300 dark:text-red-500"></i>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Article not found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8">The news article you are looking for might have been removed or is temporarily unavailable.</p>
          <Link to="/news" className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to news
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300 pb-20">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 md:pt-40">
        <div className="mb-12 flex items-center justify-between">
          <Link
            to="/news"
            className="inline-flex items-center gap-3 text-blue-600 hover:text-blue-700 font-black text-[10px] md:text-xs uppercase tracking-[0.2em] transition-all cursor-pointer group"
          >
            <i className="ri-arrow-left-s-line text-xl group-hover:-translate-x-1 transition-transform"></i>
            Return to Feed
          </Link>
          <div className="flex gap-4">
            <button
              onClick={handleShare}
              className="w-12 h-12 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-gray-500 flex items-center justify-center cursor-pointer active:scale-95"
              title="Share Article"
            >
              <i className="ri-share-forward-fill text-xl"></i>
            </button>
          </div>
        </div>

        <article className="animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-out">
          {/* Header Section */}
          <div className="text-center mb-16 md:mb-24">
            <div className="inline-flex items-center gap-4 mb-8">
              <span className="px-5 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-blue-500/20">
                {article.category}
              </span>
              <span className="w-1.5 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full"></span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{formatDate(article.created_at)}</span>
            </div>

            <h1 className="text-4xl md:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-10 leading-[0.95] tracking-tighter">
              {article.title}
            </h1>

            <div className="flex items-center justify-center gap-8 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <i className="ri-eye-fill text-blue-500 text-lg"></i>
                {article.views_count.toLocaleString()} Reads
              </div>
              <div className="flex items-center gap-2">
                <i className="ri-discuss-fill text-blue-500 text-lg"></i>
                Verified Press
              </div>
            </div>
          </div>

          {/* Immersive Cover Image */}
          {article.image_url && (
            <div className="relative h-[30rem] md:h-[50rem] w-full rounded-[3rem] md:rounded-[4rem] overflow-hidden bg-gray-100 dark:bg-gray-800 mb-20 shadow-2xl border-8 border-white dark:border-gray-900 group">
              <img
                src={getOptimizedImageUrl(article.image_url, 1920, 85)}
                alt={article.title}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1920';
                }}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-[3s]"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent"></div>
            </div>
          )}

          <div className="max-w-4xl mx-auto">
            {/* Lead Paragraph */}
            {article.excerpt && (
              <div className="mb-12 border-l-4 border-blue-600 pl-8 md:pl-12">
                <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white leading-relaxed italic opacity-80">
                  {article.excerpt}
                </p>
              </div>
            )}

            <div className="prose prose-blue prose-xl max-w-none dark:prose-invert">
              <div className="text-gray-700 dark:text-gray-300 leading-[1.8] text-lg md:text-2xl font-medium selection:bg-blue-200 selection:text-blue-900">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {article.content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Author Footer Card */}
            {article.author && (
              <div className="mt-24 p-12 md:p-16 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-xl rounded-[3rem] border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center gap-10">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-blue-500/20">
                    {article.author.full_name?.charAt(0)}
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-white dark:border-gray-900 rounded-full flex items-center justify-center text-white text-xs">
                    <i className="ri-check-line"></i>
                  </div>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Authenticated Author</p>
                  <h4 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-2">{article.author.full_name}</h4>
                  <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-relaxed">Official Campus Communications Bureau / {article.category} Specialist</p>
                </div>
                <div className="flex gap-3">
                  <button className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 text-gray-400 flex items-center justify-center hover:text-blue-500 transition-colors shadow-sm">
                    <i className="ri-twitter-x-fill text-xl"></i>
                  </button>
                  <button className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 text-gray-400 flex items-center justify-center hover:text-blue-500 transition-colors shadow-sm">
                    <i className="ri-linkedin-box-fill text-xl"></i>
                  </button>
                </div>
              </div>
            )}
          </div>
        </article>

        {/* Related Intel Section */}
        {filteredRelatedNews.length > 0 && (
          <div className="mt-40 border-t border-gray-100 dark:border-gray-800 pt-24">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
              <div>
                <p className="text-blue-600 font-black uppercase tracking-[0.2em] text-[10px] mb-4">You might also like</p>
                <h2 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white tracking-tighter">Related<br /><span className="text-blue-600">Dispatches.</span></h2>
              </div>
              <Link to="/news" className="px-8 py-4 bg-gray-50 dark:bg-gray-800 text-gray-500 font-black uppercase tracking-[0.15em] text-[10px] rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95">
                View Repository Archives
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10">
              {filteredRelatedNews.map((news) => (
                <Link
                  key={news.id}
                  to={`/news/${news.id}`}
                  className="group relative bg-white dark:bg-gray-900 transition-all duration-700 overflow-hidden flex flex-col p-4 rounded-[2rem] border border-gray-100 dark:border-gray-800 hover:shadow-2xl hover:-translate-y-2"
                >
                  <div className="h-56 bg-gray-100 dark:bg-gray-800 relative overflow-hidden rounded-2xl mb-6">
                    {news.image_url ? (
                      <img
                        src={getOptimizedImageUrl(news.image_url, 800, 80)}
                        alt={news.title}
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1585829365234-781fcd504308?auto=format&fit=crop&q=80&w=600';
                        }}
                        className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-[2s]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ri-article-fill text-6xl text-gray-200 dark:text-gray-700"></i>
                      </div>
                    )}
                  </div>

                  <div className="px-2 pb-2">
                    <span className="text-[10px] font-black text-blue-600 tracking-[0.2em] uppercase mb-4 block">
                      {news.category}
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors tracking-tighter leading-[1.15] mb-4 line-clamp-2">
                      {news.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest pt-4 border-t border-gray-50 dark:border-gray-800">
                      <i className="ri-arrow-right-line text-blue-500"></i>
                      Scan Full Intel
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

