import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import ImageUploader from '../../components/base/ImageUploader';
import { supabase } from '../../lib/supabase';
import { CONTENT_KEYS } from '../../hooks/useSiteContent';

// Define the shape of our config
interface SiteConfig {
    [key: string]: string;
}

interface ContentItem {
    label: string;
    key: string;
    type: 'image' | 'text';
    placeholder?: string;
}

interface ContentSection {
    title: string;
    description: string;
    items: ContentItem[];
}

export default function ContentManagement() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('images');
    const [config, setConfig] = useState<SiteConfig>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Notifications
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

    // Fetch current config from Storage (site_config.json)
    useEffect(() => {
        if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
            navigate('/marketplace');
            return;
        }
        fetchConfig();

        // Subscribe to Global Alerts
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
    }, []);

    // Auto-hide notification
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase.storage
                .from('uploads')
                .download('site_config.json');

            if (error) {
                console.warn('No config found or error:', error.message);
                // If not found, ignore (use defaults)
                setLoading(false);
                return;
            }

            if (data) {
                const text = await data.text();
                setConfig(JSON.parse(text));
            }
        } catch (err) {
            console.error('Error fetching config:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateConfig = async (key: string, value: string) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);

        // Auto-save to cloud
        setSaving(true);
        try {
            const blob = new Blob([JSON.stringify(newConfig)], { type: 'application/json' });
            const { error } = await supabase.storage
                .from('uploads')
                .upload('site_config.json', blob, {
                    contentType: 'application/json',
                    upsert: true
                });

            if (error) throw error;

            // Also update localStorage for immediate local feedback
            localStorage.setItem(`site_content_${key}`, value);

        } catch (err) {
            console.error('Failed to save config:', err);
            setNotification({ type: 'error', message: 'Failed to save changes' });
        } finally {
            setSaving(false);
        }
    };

    const imageSections: ContentSection[] = [
        {
            title: 'Home Page Hero',
            description: 'The main slider images visible on the landing page.',
            items: [
                { label: 'Main Hero Image', key: CONTENT_KEYS.HOME_HERO_MAIN, type: 'image' },
                { label: 'Secondary/Aerial Image', key: CONTENT_KEYS.HOME_HERO_AERIAL, type: 'image' },
            ]
        },
        {
            title: 'Section Banners',
            description: 'Header images for specific site sections.',
            items: [
                { label: 'Marketplace Header', key: CONTENT_KEYS.MARKETPLACE_BANNER, type: 'image' },
                { label: 'Campus News Header', key: CONTENT_KEYS.NEWS_BANNER, type: 'image' },
            ]
        }
    ];

    const textSections: ContentSection[] = [
        {
            title: 'Vital Announcements',
            description: 'Important text displayed on the home page.',
            items: [
                { label: 'Announcement 1', key: 'home_announcement_1', type: 'text', placeholder: 'e.g. SRC Week starts next Monday!' },
                { label: 'Announcement 2', key: 'home_announcement_2', type: 'text', placeholder: 'e.g. Exam registration deadline extended.' },
                { label: 'Hero Headline', key: 'home_hero_headline', type: 'text', placeholder: 'e.g. The Future of Campus Living' },
            ]
        }
    ];

    const activeSections = activeTab === 'images' ? imageSections : textSections;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
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

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 md:pt-40 pb-12 box-border">
                <div className="mb-12">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-600 dark:bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-[0.2em] rounded-full mb-6">
                                <i className="ri-layout-masonry-line"></i>
                                CMS Portal 1.0
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-4">
                                Content<br /><span className="text-slate-400 dark:text-slate-600">Manager.</span>
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
                                Update site imagery and assets in real-time.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer flex items-center gap-2"
                            >
                                <i className="ri-arrow-left-line text-lg"></i>
                                Dashboard
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-8 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 inline-flex">
                        <button
                            onClick={() => setActiveTab('images')}
                            className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'images'
                                ? 'bg-cyan-600 text-white shadow-md'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            <i className="ri-image-line mr-2"></i>
                            Imagery
                        </button>
                        <button
                            onClick={() => setActiveTab('text')}
                            className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'text'
                                ? 'bg-cyan-600 text-white shadow-md'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            <i className="ri-text mr-2"></i>
                            Text Content
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 text-center">
                        <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Configuration...</p>
                    </div>
                ) : (
                    <div className="space-y-16">
                        {activeSections.map((section, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 dark:border-slate-700">
                                <div className="mb-10">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{section.title}</h2>
                                    <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">{section.description}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    {section.items.map((item) => (
                                        <div key={item.key} className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.label}</span>
                                                {config[item.key] && (
                                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full uppercase tracking-wide">
                                                        Live
                                                    </span>
                                                )}
                                            </div>

                                            {item.type === 'image' ? (
                                                <>
                                                    <div className="relative group">
                                                        <ImageUploader
                                                            currentImage={config[item.key]}
                                                            onImageUploaded={(url) => updateConfig(item.key, url)}
                                                            folder="cms"
                                                            size="large"
                                                            shape="square"
                                                            className="w-full aspect-video h-auto rounded-2xl overflow-hidden"
                                                        />
                                                        {saving && (
                                                            <div className="absolute top-4 right-4 bg-black/80 text-white text-[10px] font-bold px-3 py-1 rounded-full animate-pulse">
                                                                Saving...
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl break-all border border-slate-100 dark:border-slate-700">
                                                        <p className="text-[10px] font-mono text-slate-400 mb-1 uppercase">Asset URL</p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                                            {config[item.key] || 'Using System Default'}
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="relative">
                                                    <textarea
                                                        value={config[item.key] || ''}
                                                        onChange={(e) => updateConfig(item.key, e.target.value)}
                                                        placeholder={item.placeholder}
                                                        rows={4}
                                                        className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500/20 focus:bg-white dark:focus:bg-slate-800 transition-all resize-none"
                                                    />
                                                    <p className="text-xs text-slate-400 mt-2 text-right">
                                                        {config[item.key]?.length || 0} characters
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
