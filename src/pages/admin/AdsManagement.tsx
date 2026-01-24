import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, Advertisement } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';
import ImageUploader from '../../components/base/ImageUploader';

export default function AdsManagement() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [ads, setAds] = useState<Advertisement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAd, setEditingAd] = useState<Advertisement | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        image_url: '',
        destination_url: '',
        placement_area: 'home_hero', // Default
        status: 'active',
        start_date: new Date().toISOString().slice(0, 16),
    });

    useEffect(() => {
        if (!profile) return;
        if (!['admin', 'super_admin', 'news_publisher', 'publisher_seller'].includes(profile?.role || '')) {
            navigate('/');
            return;
        }
        fetchAds();
    }, [profile, navigate]);

    const fetchAds = async () => {
        setLoading(true);
        try {
            // Check if table exists by trying to select
            const { data, error } = await supabase
                .from('advertisements')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') { // undefined_table
                    // Graceful handling if migration hasn't run
                    console.warn('Advertisements table missing');
                    setAds([]);
                } else {
                    throw error;
                }
            } else {
                setAds(data || []);
            }
        } catch (error) {
            console.error('Error fetching ads:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const adData = {
                title: formData.title,
                image_url: formData.image_url,
                destination_url: formData.destination_url,
                placement_area: formData.placement_area,
                status: formData.status,
                start_date: new Date(formData.start_date).toISOString(),
                created_by: profile?.id
            };

            if (editingAd) {
                const { error } = await supabase.from('advertisements').update(adData).eq('id', editingAd.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('advertisements').insert(adData);
                if (error) throw error;
            }

            setShowModal(false);
            setEditingAd(null);
            fetchAds();
        } catch (error: any) {
            alert('Failed to save ad: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        const { error } = await supabase.from('advertisements').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchAds();
    };

    const handleEdit = (ad: Advertisement) => {
        setEditingAd(ad);
        setFormData({
            title: ad.title,
            image_url: ad.image_url,
            destination_url: ad.destination_url || '',
            placement_area: ad.placement_area as any,
            status: ad.status as any,
            start_date: new Date(ad.start_date).toISOString().slice(0, 16),
        });
        setShowModal(true);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
            <Navbar />

            <div className="pt-32 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                            Ad Manager
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Manage promotional content and banners.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold uppercase tracking-wide text-xs hover:bg-slate-50 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => {
                                setEditingAd(null);
                                setFormData({
                                    title: '',
                                    image_url: '',
                                    destination_url: '',
                                    placement_area: 'home_hero',
                                    status: 'active',
                                    start_date: new Date().toISOString().slice(0, 16),
                                });
                                setShowModal(true);
                            }}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wide text-xs hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                        >
                            + New Ad Campaign
                        </button>
                    </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                                <i className="ri-megaphone-fill"></i>
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Ads</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">
                            {ads.filter(a => a.status === 'active').length}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                                <i className="ri-eye-fill"></i>
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Views</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">
                            {ads.reduce((acc, curr) => acc + (curr.impressions_count || 0), 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600">
                                <i className="ri-cursor-fill"></i>
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Clicks</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">
                            {ads.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0).toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
                                <i className="ri-percent-line"></i>
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg. CTR</span>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">
                            {(() => {
                                const totalImpressions = ads.reduce((acc, curr) => acc + (curr.impressions_count || 0), 0);
                                const totalClicks = ads.reduce((acc, curr) => acc + (curr.clicks_count || 0), 0);
                                return totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0.00%';
                            })()}
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-24">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-500 font-medium">Loading campaigns...</p>
                    </div>
                ) : ads.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-16 text-center border border-slate-100 dark:border-slate-700 shadow-xl">
                        <div className="w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <i className="ri-advertisement-fill text-5xl text-blue-500 dark:text-blue-400"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No Active Campaigns</h3>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">Create your first advertisement to start promoting content across the platform.</p>
                        <button
                            onClick={() => {
                                setEditingAd(null);
                                setFormData({
                                    title: '',
                                    image_url: '',
                                    destination_url: '',
                                    placement_area: 'home_hero',
                                    status: 'active',
                                    start_date: new Date().toISOString().slice(0, 16),
                                });
                                setShowModal(true);
                            }}
                            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:shadow-lg hover:-translate-y-1 transition-all"
                        >
                            + Create First Campaign
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ads.map(ad => (
                            <div key={ad.id} className="bg-white dark:bg-slate-800 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group duration-300">
                                <div className="h-56 bg-slate-100 dark:bg-slate-900 relative group-hover:brightness-110 transition-all">
                                    <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                                    <div className="absolute top-4 right-4">
                                        <span className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-full shadow-lg ${ad.status === 'active' ? 'bg-emerald-500 text-white' :
                                                ad.status === 'paused' ? 'bg-amber-500 text-white' : 'bg-slate-500 text-white'
                                            }`}>
                                            {ad.status}
                                        </span>
                                    </div>
                                    <div className="absolute bottom-4 left-4 right-4">
                                        <h3 className="font-bold text-white text-lg mb-1 line-clamp-1">{ad.title}</h3>
                                        <span className="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[10px] font-bold text-white uppercase tracking-wider">
                                            {ad.placement_area.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-6">
                                    {ad.destination_url && (
                                        <div className="flex items-center gap-2 mb-6 text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg truncate">
                                            <i className="ri-link-m"></i>
                                            <span className="truncate flex-1">{ad.destination_url}</span>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 border-t border-slate-50 dark:border-slate-700 pt-4 mb-6">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Impressions</p>
                                            <div className="flex items-baseline gap-1">
                                                <p className="text-xl font-black text-slate-900 dark:text-white">{ad.impressions_count?.toLocaleString() || 0}</p>
                                                <span className="text-[10px] text-emerald-500 font-bold">
                                                    <i className="ri-arrow-up-fill"></i>
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Clicks</p>
                                            <div className="flex items-baseline gap-1">
                                                <p className="text-xl font-black text-slate-900 dark:text-white">{ad.clicks_count?.toLocaleString() || 0}</p>
                                                <span className="text-[10px] text-slate-300">
                                                    CTR {((ad.clicks_count || 0) / (ad.impressions_count || 1) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(ad)}
                                            className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-slate-600 dark:text-slate-200"
                                        >
                                            Edit Campaign
                                        </button>
                                        <button
                                            onClick={() => handleDelete(ad.id)}
                                            className="w-12 h-10 flex items-center justify-center bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                                        >
                                            <i className="ri-delete-bin-line text-lg"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-800">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editingAd ? 'Edit Ad' : 'New Campaign'}</h3>
                            <button onClick={() => setShowModal(false)}><i className="ri-close-line text-2xl"></i></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Placement</label>
                                <select
                                    value={formData.placement_area}
                                    onChange={e => setFormData({ ...formData, placement_area: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                                >
                                    <option value="home_hero">Home Page Hero</option>
                                    <option value="marketplace_sidebar">Marketplace Sidebar</option>
                                    <option value="news_feed">News Feed</option>
                                    <option value="global_popup">Global Popup</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Creative</label>
                                <div className="flex gap-4 items-center">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="Image URL"
                                            value={formData.image_url}
                                            onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs"
                                        />
                                    </div>
                                    <div className="w-12 h-12">
                                        <ImageUploader
                                            onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                                            folder="ads"
                                            className="w-full h-full bg-slate-100 rounded-lg flex items-center justify-center cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Destination Link</label>
                                <input
                                    type="url"
                                    placeholder="https://"
                                    value={formData.destination_url}
                                    onChange={e => setFormData({ ...formData, destination_url: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                                    >
                                        <option value="active">Active</option>
                                        <option value="paused">Paused</option>
                                        <option value="expired">Expired</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Start Date</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl uppercase tracking-widest text-xs shadow-lg mt-4">
                                {editingAd ? 'Update Campaign' : 'Launch Campaign'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
