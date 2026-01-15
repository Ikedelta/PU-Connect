import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

type ArticlePreview = {
    id: string;
    title: string;
    views_count: number;
    is_published: boolean;
    created_at: string;
    category: string;
};

export default function NewsPublisherDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        published: 0,
        drafts: 0,
        totalViews: 0
    });
    const [recentArticles, setRecentArticles] = useState<ArticlePreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

    useEffect(() => {
        if (!['news_publisher', 'admin', 'super_admin'].includes(profile?.role || '')) {
            navigate('/marketplace');
            return;
        }

        fetchStats();

        // Subscribe to Global Alerts (e.g. online users)
        const presenceChannel = supabase.channel('online-users');
        presenceChannel
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                const user = newPresences[0];
                if (user && user.user_id !== profile?.id) {
                    setNotification({
                        type: 'info',
                        message: `${user.full_name || 'A user'} came online`
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(presenceChannel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    // Auto-hide notification
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchStats = async () => {
        if (!profile) return;
        setLoading(true);

        try {
            const { data: articles, error } = await supabase
                .from('campus_news')
                .select('is_published, views_count')
                .eq('author_id', profile.id);

            if (error) throw error;

            if (articles) {
                setStats({
                    published: articles.filter(a => a.is_published).length,
                    drafts: articles.filter(a => !a.is_published).length,
                    totalViews: articles.reduce((acc, curr) => acc + (curr.views_count || 0), 0)
                });
            }

            const { data: recent, error: recentError } = await supabase
                .from('campus_news')
                .select('id, title, views_count, is_published, created_at, category')
                .eq('author_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentError) throw recentError;
            setRecentArticles(recent || []);

        } catch (error) {
            console.error('Error fetching publisher data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4 mx-auto"></div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

    return (
        <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20 font-sans">
            <Navbar />

            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-24 right-4 md:right-8 z-50 animate-in fade-in slide-in-from-right-8 duration-300 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white' :
                        notification.type === 'error' ? 'bg-rose-500/90 border-rose-400/50 text-white' :
                            'bg-blue-500/90 border-blue-400/50 text-white'
                    }`}>
                    <i className={`${notification.type === 'success' ? 'ri-checkbox-circle-fill' : notification.type === 'error' ? 'ri-error-warning-fill' : 'ri-notification-3-fill'} text-xl`}></i>
                    <span className="font-bold text-sm tracking-wide">{notification.message}</span>
                </div>
            )}

            <div className="pt-32 md:pt-40 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600 dark:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full shadow-lg shadow-indigo-500/30">
                                <i className="ri-article-line"></i>
                                Publisher Portal 2.0
                            </div>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-2">
                            Newsroom<span className="text-indigo-600 dark:text-indigo-400">.</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
                            Create, manage, and distribute campus stories.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        {isAdmin && (
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 text-xs uppercase tracking-wide flex items-center justify-center gap-2"
                            >
                                <i className="ri-arrow-left-line text-lg"></i>
                                Admin Dash
                            </button>
                        )}
                        <Link
                            to="/admin/news"
                            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 text-xs uppercase tracking-wide shadow-lg shadow-indigo-200/50 dark:shadow-none flex items-center justify-center gap-2"
                        >
                            <i className="ri-add-line text-lg"></i>
                            Compose Story
                        </Link>
                    </div>
                </div>

                {/* Stats Grid - Lively Style */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    {[
                        { label: 'Published News', value: stats.published, icon: 'ri-checkbox-circle-fill', color: 'from-emerald-500 to-emerald-600', sub: 'Live Audience' },
                        { label: 'Drafts Saved', value: stats.drafts, icon: 'ri-draft-fill', color: 'from-amber-500 to-amber-600', sub: 'In Progress' },
                        { label: 'Total Reads', value: stats.totalViews.toLocaleString(), icon: 'ri-eye-fill', color: 'from-blue-500 to-blue-600', sub: 'Engagement' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-[0.08] rounded-bl-full group-hover:scale-110 transition-transform duration-500`}></div>
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${stat.color} text-white flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}>
                                <i className={`${stat.icon} text-2xl`}></i>
                            </div>
                            <div className="text-4xl font-black text-slate-900 dark:text-white mb-1 tracking-tight">{stat.value}</div>
                            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">{stat.label}</div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <i className="ri-bar-chart-fill text-slate-300 dark:text-slate-600"></i>
                                {stat.sub}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions Grid */}
                <div className="mb-10">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Admin Quick Actions (Visible to Admins only) */}
                        {isAdmin && (
                            <div className="lg:col-span-1 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                    <i className="ri-shield-star-line text-blue-500"></i> Admin Controls
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {[
                                        { title: 'Users', path: '/admin/users', icon: 'ri-user-settings-line', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
                                        { title: 'Polls', path: '/admin/polls', icon: 'ri-bar-chart-grouped-line', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
                                        { title: 'Support', path: '/admin/support', icon: 'ri-customer-service-2-line', color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20' }
                                    ].map((action, i) => (
                                        <Link key={i} to={action.path} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all group">
                                            <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center`}>
                                                <i className={`${action.icon} text-lg`}></i>
                                            </div>
                                            <span className="font-bold text-xs uppercase tracking-wide text-slate-700 dark:text-slate-300">{action.title}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Editorial Actions */}
                        <div className={`lg:col-span-${isAdmin ? '3' : '4'}`}>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <i className="ri-flashlight-line text-amber-500"></i> Editorial Actions
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                                {[
                                    { title: 'Write Article', desc: 'New Story', path: '/admin/news', icon: 'ri-edit-line', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
                                    { title: 'My Drafts', desc: 'Continue Writing', path: '/admin/news?filter=draft', icon: 'ri-file-edit-line', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                                    { title: 'Media Library', desc: 'Manage Images', path: '/admin/content', icon: 'ri-image-line', color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
                                    { title: 'Public News', desc: 'View Live Site', path: '/news', icon: 'ri-global-line', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                                ].map((item, i) => (
                                    <Link key={i} to={item.path} className="flex flex-col items-center text-center p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-xl hover:-translate-y-1 transition-all group">
                                        <div className={`w-16 h-16 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm`}>
                                            <i className={`${item.icon} text-3xl`}></i>
                                        </div>
                                        <h4 className="font-black text-slate-900 dark:text-white mb-1 text-sm">{item.title}</h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{item.desc}</p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Uploads Table */}
                    <div className="lg:col-span-2">
                        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Recent Uploads</h3>
                                <Link to="/admin/news" className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-full transition-colors">
                                    View Repository
                                </Link>
                            </div>

                            {recentArticles.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <i className="ri-folder-open-line text-3xl text-slate-300 dark:text-slate-600"></i>
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No articles yet</p>
                                    <button onClick={() => navigate('/admin/news')} className="mt-4 text-xs font-bold text-indigo-600 hover:underline">Create your first story</button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Article Details</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Impact</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {recentArticles.map((article) => (
                                                <tr key={article.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer" onClick={() => navigate('/admin/news')}>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{article.title}</div>
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide mt-1">{article.category}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${article.is_published
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                            }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${article.is_published ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                                            {article.is_published ? 'Published' : 'Draft'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            <i className="ri-eye-line text-slate-400"></i>
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{article.views_count.toLocaleString()}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-bold text-slate-400">
                                                        {new Date(article.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pro Tip Card */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-500/30 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-700"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-12 -mb-12"></div>
                            <div className="relative z-10">
                                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 shadow-inner border border-white/10">
                                    <i className="ri-lightbulb-flash-fill text-2xl text-amber-300"></i>
                                </div>
                                <h3 className="text-2xl font-black mb-3 tracking-tight">Pro Tip</h3>
                                <p className="text-indigo-100 text-sm leading-relaxed mb-8 font-medium bg-black/10 p-5 rounded-2xl backdrop-blur-sm border border-white/5">
                                    "Articles with engaging headlines and high-quality cover images receive up to <span className="text-white font-bold">3x more views</span> from the campus community."
                                </p>
                                <button onClick={() => navigate('/admin/news')} className="w-full py-4 bg-white text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl active:scale-95">
                                    Compose Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
