import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';
import { uploadImage, compressImage } from '../../lib/uploadImage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQueryClient } from '@tanstack/react-query';

type NewsArticle = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  image_url: string | null;
  author_id: string;
  is_published: boolean;
  published_at: string | null;
  scheduled_at: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
  sms_sent?: boolean;
  author?: { full_name: string };
};

export default function NewsManagement() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [previewMode, setPreviewMode] = useState<'write' | 'preview'>('write');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'scheduled'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingNews, setEditingNews] = useState<NewsArticle | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    category: 'General',
    image_url: '',
    status: 'draft' as 'draft' | 'published' | 'scheduled',
    scheduled_at: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contentUploading, setContentUploading] = useState(false);

  useEffect(() => {
    if (['admin', 'super_admin', 'news_publisher', 'publisher_seller'].includes(profile?.role || '')) {
      fetchNews();
    }
  }, [filter]);

  useEffect(() => {
    if (!['admin', 'super_admin', 'news_publisher', 'publisher_seller'].includes(profile?.role || '')) {
      navigate('/marketplace');
      return;
    }
    fetchNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, navigate]);

  const fetchNews = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('campus_news')
        .select(`
          *,
          author:profiles(full_name)
        `)
        .order('updated_at', { ascending: false });

      if (filter === 'published') {
        query = query.eq('is_published', true);
      } else if (filter === 'draft') {
        query = query.eq('is_published', false).is('scheduled_at', null);
      } else if (filter === 'scheduled') {
        query = query.not('scheduled_at', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      console.log('Fetched News from Server:', data);
      setNews(data as any || []);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const compressed = await compressImage(file, 1200, 800, 0.85);
      const { url } = await uploadImage(compressed, 'cms');
      if (url) {
        setFormData(prev => ({ ...prev, image_url: url }));
      }
    } catch (error: any) {
      alert(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleContentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setContentUploading(true);
    try {
      const file = e.target.files[0];
      const compressed = await compressImage(file, 800, 800, 0.8);
      const { url } = await uploadImage(compressed, 'cms');
      if (url) {
        // Insert markdown image at cursor position or end
        const imageMarkdown = `\n![${file.name}](${url})\n`;
        setFormData(prev => ({ ...prev, content: prev.content + imageMarkdown }));
      }
    } catch (error: any) {
      alert(error.message || 'Failed to upload image');
    } finally {
      setContentUploading(false);
    }
  };

  const broadcastNewsSMS = async (title: string) => {
    try {
      // 1. Check if SMS is enabled globally and for news specifically
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['enable_sms', 'sms_enabled_news']);

      const globalEnabled = settings?.find(s => s.key === 'enable_sms')?.value ?? true;
      const newsEnabled = settings?.find(s => s.key === 'sms_enabled_news')?.value ?? true;

      if (!globalEnabled || !newsEnabled) {
        console.log('SMS Broadcast skipped: Disabled in platform settings.');
        return false;
      }

      const { data: users } = await supabase
        .from('profiles')
        .select('phone')
        .not('phone', 'is', null)
        .eq('is_active', true);

      if (users && users.length > 0) {
        const phones = users.map(u => u.phone).filter(p => p && p.length > 9);
        const uniquePhones = [...new Set(phones)];

        if (uniquePhones.length > 0) {
          const { sendSMS } = await import('../../lib/arkesel');
          await sendSMS(uniquePhones, `📢 Campus News: "${title}" has just been published! Read now on Campus Connect.`, 'news', { title });
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error('SMS Broadcast failed:', err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { status, scheduled_at, ...rest } = formData;

      // Auto-generate excerpt if empty
      const finalExcerpt = rest.excerpt || rest.content.substring(0, 160).replace(/[#*`]/g, '') + '...';

      const newsData = {
        title: rest.title,
        content: rest.content,
        category: rest.category,
        image_url: rest.image_url,
        author_id: profile?.id,
        is_published: status === 'published',
        scheduled_at: status === 'scheduled' && scheduled_at ? new Date(scheduled_at).toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      let shouldBroadcast = false;

      if (editingNews) {
        // Explicitly define update fields to avoid any schema mismatch or hidden fields (like 'excerpt')
        const updateData = {
          title: newsData.title,
          content: newsData.content,
          category: newsData.category,
          image_url: newsData.image_url,
          is_published: newsData.is_published,
          scheduled_at: newsData.scheduled_at,
          updated_at: newsData.updated_at
        };

        console.log('Sending Update to Supabase:', editingNews.id, updateData);

        // We use a specific select here to avoid PostgREST cache issues with '*'
        const { data: verifyData, error } = await supabase
          .from('campus_news')
          .update(updateData)
          .eq('id', editingNews.id)
          .select('id, title, image_url');

        if (error) throw error;

        if (!verifyData || verifyData.length === 0) {
          throw new Error('Permission Error (RLS): Your account is authorized on the site, but the Supabase Database is blocking this specific update. Please run the "RLS SQL Fix" provided in the chat to grant the System Administrator full editing permissions.');
        }

        console.log('Update Verified:', verifyData[0]);

        if (newsData.is_published && !editingNews.is_published && !editingNews.sms_sent) {
          shouldBroadcast = true;
        }

        logActivity('news_updated', { title: newsData.title, id: editingNews.id });

      } else {
        const { data: inserted, error } = await supabase
          .from('campus_news')
          .insert([newsData])
          .select()
          .single();

        if (error) throw error;

        if (newsData.is_published) {
          shouldBroadcast = true;
        }

        logActivity('news_created', { title: newsData.title, id: inserted?.id });
      }

      if (shouldBroadcast) {
        broadcastNewsSMS(newsData.title);
      }

      // Sync with React Query cache used by CampusNews and NewsDetail
      queryClient.invalidateQueries({ queryKey: ['news'] });
      if (editingNews) {
        queryClient.invalidateQueries({ queryKey: ['news', 'article', editingNews.id] });
      }

      alert(editingNews ? 'Story updated successfully!' : 'New story created successfully!');
      setShowModal(false);
      setEditingNews(null);
      setFormData({
        title: '',
        content: '',
        excerpt: '',
        category: 'General',
        image_url: '',
        status: 'draft',
        scheduled_at: '',
      });
      await fetchNews();
    } catch (error: any) {
      console.error('Submit Error:', error);
      alert(error.message || 'Failed to save news');
    } finally {
      setSaving(false);
    }
  };

  // Activity Logger
  const logActivity = async (action: string, details: any) => {
    try {
      await supabase.from('activity_logs').insert({
        user_id: profile?.id,
        action_type: action,
        action_details: details
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const handleEdit = (article: NewsArticle) => {
    console.log('Editing article data:', article);
    setEditingNews(article);
    setFormData({
      title: article.title,
      content: article.content,
      excerpt: article.excerpt || '',
      category: article.category,
      image_url: article.image_url || '',
      status: article.scheduled_at ? 'scheduled' : (article.is_published ? 'published' : 'draft'),
      scheduled_at: article.scheduled_at ? new Date(article.scheduled_at).toISOString().slice(0, 16) : '',
    });
    setPreviewMode('write');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this news article?')) return;
    try {
      const { error } = await supabase.from('campus_news').delete().eq('id', id);
      if (error) throw error;

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news', 'article', id] });

      await fetchNews();
    } catch (error: any) {
      alert(error.message || 'Failed to delete news');
    }
  };

  const handlePublish = async (id: string, isPublished: boolean) => {
    try {
      const newPublishedState = !isPublished;
      let shouldSendSMS = false;
      let articleTitle = '';

      if (newPublishedState) {
        // Check if SMS was already sent
        const { data: art } = await supabase.from('campus_news').select('sms_sent, title').eq('id', id).single();
        // Strict check: Only send if NOT sent before. 
        if (art && art.sms_sent === false) {
          shouldSendSMS = true;
          articleTitle = art.title;
        }
      }

      // Update status immediately
      const { error } = await supabase.from('campus_news').update({
        is_published: newPublishedState,
        scheduled_at: null,
        sms_sent: shouldSendSMS ? true : undefined // Mark as sent if we are triggering it
      }).eq('id', id);

      if (error) throw error;

      logActivity('news_published', { id, status: newPublishedState ? 'published' : 'unpublished' });

      // Trigger SMS Broadcast if needed
      if (shouldSendSMS) {
        const sent = await broadcastNewsSMS(articleTitle);
        if (sent) alert('News published & SMS broadcast sent!');
        else alert('News published (SMS broadcast failed/skipped)');

        logActivity('sms_sent', { type: 'news_broadcast', title: articleTitle });
      }

      await fetchNews();
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news', 'article', id] });
    } catch (error: any) {
      alert(error.message || 'Failed to update status');
    }
  };

  const filteredNews = news.filter((article) => {
    if (filter !== 'all') {
      if (filter === 'scheduled') { if (!article.scheduled_at) return false; }
      else {
        const isPublished = filter === 'published';
        if (article.is_published !== isPublished) return false;
        if (article.scheduled_at) return false;
      }
    }
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      return (
        article.title.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query) ||
        (article.author?.full_name || '').toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
      <Navbar />

      <div className="pt-32 md:pt-40 pb-12 box-border max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase tracking-widest border border-purple-200 dark:border-purple-800">
                Editorial Dashboard
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              News Management
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Create and manage campus news articles</p>
          </div>

          <div className="flex gap-3">
            {profile?.role === 'admin' || profile?.role === 'super_admin' ? (
              <>
                <button
                  onClick={() => navigate('/admin/dashboard')}
                  className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer flex items-center gap-2"
                >
                  <i className="ri-dashboard-line text-lg"></i>
                  Admin Dash
                </button>
                <button
                  onClick={() => navigate('/publisher')}
                  className="hidden md:flex px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer items-center gap-2"
                >
                  <i className="ri-article-line text-lg"></i>
                  Publisher Portal
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/publisher')}
                className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer flex items-center gap-2"
              >
                <i className="ri-arrow-left-line text-lg"></i>
                Dashboard
              </button>
            )}
            <button
              onClick={() => {
                setEditingNews(null);
                setFormData({
                  title: '',
                  content: '',
                  excerpt: '',
                  category: 'General',
                  image_url: '',
                  status: 'draft',
                  scheduled_at: ''
                });
                setShowModal(true);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none"
            >
              <i className="ri-add-line text-lg"></i>
              Create News
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search news by title, category, or author..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-white outline-none transition-all shadow-sm"
            />
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-1.5 flex-shrink-0 shadow-sm overflow-x-auto">
            <div className="flex space-x-1">
              {[
                { id: 'all', label: 'All Articles' },
                { id: 'published', label: 'Published' },
                { id: 'draft', label: 'Drafts' },
                { id: 'scheduled', label: 'Scheduled' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id as any)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-xl transition-colors whitespace-nowrap cursor-pointer ${filter === f.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* News List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">Loading news...</p>
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 p-16 text-center shadow-sm">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-newspaper-line text-4xl text-slate-300 dark:text-slate-500"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No items found</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">Try adjusting your filters or create a new article to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredNews.map((article) => (
              <div
                key={article.id}
                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-shadow group"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="w-full h-48 md:w-64 md:h-auto flex-shrink-0 relative overflow-hidden bg-slate-100 dark:bg-slate-700">
                    {article.image_url && article.image_url.trim() !== '' ? (
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          // Show placeholder on error
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const icon = document.createElement('i');
                            icon.className = 'ri-image-line text-4xl text-slate-300 absolute inset-0 flex items-center justify-center';
                            parent.appendChild(icon);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                        <i className="ri-image-line text-4xl"></i>
                      </div>
                    )}
                    <div className="absolute top-4 left-4 md:hidden">
                      <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg ${article.is_published
                        ? 'bg-emerald-500 text-white'
                        : article.scheduled_at
                          ? 'bg-purple-500 text-white'
                          : 'bg-slate-800 text-white'
                        }`}>
                        {article.is_published ? 'Published' : article.scheduled_at ? 'Scheduled' : 'Draft'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-widest rounded-full border border-blue-200 dark:border-blue-800">
                          {article.category}
                        </span>
                        <span className={`hidden md:inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full border ${article.is_published
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
                          : article.scheduled_at
                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                          {article.is_published ? 'Published' : article.scheduled_at ? 'Scheduled' : 'Draft'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 ml-auto md:ml-0 uppercase tracking-wider">
                          <i className="ri-time-line"></i> {new Date(article.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-3 leading-tight tracking-tight">{article.title}</h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-2 md:line-clamp-2 mb-6 leading-relaxed">{article.content}</p>

                      {article.scheduled_at && (
                        <div className="flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-xl mb-6 w-fit border border-purple-100 dark:border-purple-800">
                          <i className="ri-calendar-event-line text-lg"></i>
                          Scheduled for: {new Date(article.scheduled_at).toLocaleString()}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mt-auto pt-6 border-t border-slate-50 dark:border-slate-800">
                      <div className="flex items-center gap-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        <span className="flex items-center gap-1.5">
                          <i className="ri-user-smile-line text-lg text-slate-300"></i>
                          {article.author?.full_name || 'Unknown'}
                        </span>
                        <button
                          onClick={() => alert(`This article has ${article.views_count.toLocaleString()} views. (Detailed viewer list coming soon)`)}
                          className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer"
                          title="Click to see who viewed"
                        >
                          <i className="ri-eye-line text-lg text-slate-300 group-hover:text-blue-400 transition-colors"></i>
                          {article.views_count.toLocaleString()}
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleEdit(article)}
                          className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors whitespace-nowrap"
                        >
                          <i className="ri-edit-line mr-1"></i> Edit
                        </button>
                        <button
                          onClick={() => handlePublish(article.id, article.is_published)}
                          className={`flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors whitespace-nowrap border ${article.is_published
                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                            }`}
                        >
                          <i className={`${article.is_published ? 'ri-eye-off-line' : 'ri-send-plane-line'} mr-1`}></i>
                          {article.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => handleDelete(article.id)}
                          className="flex-none px-4 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
            <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between z-10 backdrop-blur">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {editingNews ? 'Edit Story' : 'Compose News'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                  Headline *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-medium text-slate-900 dark:text-white"
                  placeholder="Enter a catchy headline"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                  Short Summary
                </label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-medium text-slate-900 dark:text-white resize-none"
                  placeholder="A brief teaser for the news feed (optional)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-medium text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="General">General</option>
                  <option value="Events">Events</option>
                  <option value="Academic">Academic</option>
                  <option value="Sports">Sports</option>
                  <option value="Announcements">Announcements</option>
                  <option value="Ads">Advertisements</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Content *
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('write')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${previewMode === 'write'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('preview')}
                      className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${previewMode === 'preview'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {previewMode === 'write' ? (
                  <div className="relative">
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      required
                      rows={12}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none font-medium text-slate-800 dark:text-gray-200 resize-y min-h-[300px] leading-relaxed"
                      placeholder="Write your story here... Markdown is supported."
                    />
                    <div className="absolute top-4 right-4">
                      <label className={`
                            flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-700 rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors
                            ${contentUploading ? 'opacity-50 cursor-not-allowed' : ''}
                         `}>
                        {contentUploading ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-image-add-line"></i>}
                        {contentUploading ? 'Uploading...' : 'Insert Image'}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleContentImageUpload}
                          disabled={contentUploading}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="w-full px-6 py-6 bg-slate-50 dark:bg-slate-800 border-none rounded-xl min-h-[300px] overflow-y-auto">
                    <div className="prose prose-blue dark:prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {formData.content || '_No content to preview._'}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-2">
                  * Pro Tip: Use Markdown for formatting. Images uploaded are automatically inserted.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                  Cover Image & Graphics
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <div className="flex gap-4 items-center">
                      <div className="flex-1 relative group">
                        <i className="ri-link-m absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                        <input
                          type="url"
                          value={formData.image_url}
                          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                          className="w-full pl-11 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none font-bold text-xs text-slate-900 dark:text-white"
                          placeholder="https://images.unsplash.com/..."
                        />
                      </div>
                      <label className={`
                            flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-2xl cursor-pointer hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex-shrink-0
                            ${uploading ? 'opacity-50 pointer-events-none' : ''}
                        `}>
                        {uploading ? (
                          <i className="ri-loader-4-line animate-spin text-xl"></i>
                        ) : (
                          <i className="ri-camera-lens-fill text-xl"></i>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleFeaturedImageUpload}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                      Upload a high-resolution banner (16:9 recommended) to serve as the visual hook for your story.
                    </p>
                  </div>

                  <div className="h-32 md:h-full bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                    {formData.image_url ? (
                      <>
                        <img
                          src={formData.image_url}
                          alt="Preview"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                          className="absolute top-2 right-2 w-8 h-8 bg-black/50 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <i className="ri-delete-bin-fill"></i>
                        </button>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 opacity-50">
                        <i className="ri-image-2-fill text-3xl mb-1"></i>
                        <span className="text-[9px] font-black uppercase tracking-widest">No Graphics</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                    Publishing Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-medium text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="draft">Save as Draft</option>
                    <option value="published">Publish Immediately</option>
                    <option value="scheduled">Schedule for Later</option>
                  </select>
                </div>

                {formData.status === 'scheduled' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                      Schedule Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.scheduled_at}
                      onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                      required={formData.status === 'scheduled'}
                      className="w-full px-4 py-3 bg-blue-50/50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-900 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none font-bold text-blue-900 dark:text-blue-200"
                    />
                  </div>
                )}
              </div>

              <div className="flex space-x-4 pt-6 sticky bottom-0 bg-white dark:bg-slate-900 z-10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="flex-[2] py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-lg"></i>
                      <span>Saving...</span>
                    </>
                  ) : uploading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-lg"></i>
                      <span>Uploading Image...</span>
                    </>
                  ) : (
                    <>
                      <i className="ri-save-line text-lg"></i>
                      <span>{editingNews ? 'Update Story' : 'Create Story'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
