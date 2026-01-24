import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Internship } from '../../hooks/useInternships';

export default function InternshipManagement() {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Internship>>({
        title: '',
        company: '',
        location: 'Accra, Ghana',
        type: 'Internship',
        description: '',
        url: '#',
        source: 'Direct',
        logo_url: '/PU Connect logo.png',
        is_active: true
    });

    // Fetch Internships
    const { data: internships = [], isLoading } = useQuery({
        queryKey: ['admin-internships'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('internships')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as Internship[];
        }
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (newInternship: Partial<Internship>) => {
            const { data, error } = await supabase
                .from('internships')
                .insert([{
                    ...newInternship,
                    posted_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                }])
                .select();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-internships'] });
            queryClient.invalidateQueries({ queryKey: ['internships'] });
            setIsEditing(false);
            resetForm();
            showNotification('success', 'Internship posted successfully!');
        },
        onError: (err: any) => showNotification('error', err.message)
    });

    const updateMutation = useMutation({
        mutationFn: async (updates: Partial<Internship>) => {
            const { error } = await supabase
                .from('internships')
                .update(updates)
                .eq('id', editingId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-internships'] });
            queryClient.invalidateQueries({ queryKey: ['internships'] });
            setIsEditing(false);
            setEditingId(null);
            resetForm();
            showNotification('success', 'Internship updated successfully!');
        },
        onError: (err: any) => showNotification('error', err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('internships').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-internships'] });
            queryClient.invalidateQueries({ queryKey: ['internships'] });
            showNotification('success', 'Internship deleted.');
        },
        onError: (err: any) => showNotification('error', err.message)
    });

    const toggleActiveMutation = useMutation({
        mutationFn: async ({ id, currentState }: { id: string, currentState: boolean }) => {
            const { error } = await supabase
                .from('internships')
                .update({ is_active: !currentState })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-internships'] });
            queryClient.invalidateQueries({ queryKey: ['internships'] });
            showNotification('success', 'Status updated.');
        },
        onError: (err: any) => showNotification('error', err.message)
    });

    // Actions
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            updateMutation.mutate(formData);
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (internship: Internship) => {
        setFormData(internship);
        setEditingId(internship.id);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this listing?')) {
            deleteMutation.mutate(id);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            company: '',
            location: 'Accra, Ghana',
            type: 'Internship',
            description: '',
            url: '#',
            source: 'Direct',
            logo_url: '/PU Connect logo.png',
            is_active: true
        });
        setEditingId(null);
    };

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    // Filter Logic
    const filteredInternships = internships.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: internships.length,
        active: internships.filter(i => i.is_active).length,
        closed: internships.filter(i => !i.is_active).length
    };

    // Helper for relative time
    const timeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] font-sans pb-32 transition-colors duration-300">
            {/* Notification Toast */}
            {notification && (
                <div className="fixed top-24 right-6 z-50 animate-slide-in-right">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${notification.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                        }`}>
                        <i className={`text-xl ${notification.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}`}></i>
                        <span className="font-bold text-xs uppercase tracking-wide">{notification.message}</span>
                    </div>
                </div>
            )}

            {/* Header Area */}
            <div className="bg-white dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            {/* Back Button */}
                            <Link
                                to="/admin/dashboard"
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all shadow-sm group"
                            >
                                <i className="ri-arrow-left-line text-lg group-hover:-translate-x-0.5 transition-transform"></i>
                            </Link>

                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="p-2 bg-blue-600 rounded-lg">
                                        <i className="ri-briefcase-4-fill text-white text-lg"></i>
                                    </div>
                                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Internship Portal</h1>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest pl-12 hidden md:block">
                                    Manage Career Opportunities
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex gap-2 mr-4">
                                <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-100 dark:border-purple-500/10">
                                    <p className="text-[10px] uppercase font-black text-purple-400">Total</p>
                                    <p className="text-xl font-black text-purple-600 dark:text-purple-400 leading-none">{stats.total}</p>
                                </div>
                                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-500/10">
                                    <p className="text-[10px] uppercase font-black text-emerald-400">Active</p>
                                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{stats.active}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    resetForm();
                                    setIsEditing(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="h-12 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10 active:scale-95 flex items-center gap-2"
                            >
                                <i className="ri-add-line text-lg"></i>
                                <span>New Job</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Form Section */}
                    {isEditing && (
                        <div className="lg:col-span-4 sticky top-32 z-20 order-1 lg:order-2">
                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-fade-in-up">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        <i className={`ri-${editingId ? 'edit' : 'magic'}-line text-blue-500`}></i>
                                        {editingId ? 'Edit Listing' : 'New Listing'}
                                    </h3>
                                    <button onClick={() => setIsEditing(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                        <i className="ri-close-line text-lg"></i>
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Role Title</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.title}
                                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3.5 text-sm font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:ring-0 outline-none transition-all placeholder:font-medium"
                                            placeholder="e.g. Product Design Intern"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Company & Logo</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                value={formData.company}
                                                onChange={e => setFormData({ ...formData, company: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3.5 text-sm font-bold text-slate-900 dark:text-white focus:border-blue-500 outline-none transition-all"
                                                placeholder="Company Name"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Location</label>
                                            <input
                                                type="text"
                                                value={formData.location}
                                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-950/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-all dark:text-white"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Job Type</label>
                                            <div className="relative">
                                                <select
                                                    value={formData.type}
                                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                                    className="w-full bg-slate-50 dark:bg-slate-950/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3.5 text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer dark:text-white"
                                                >
                                                    <option value="Internship">Internship</option>
                                                    <option value="Full-time">Full-time</option>
                                                    <option value="Part-time">Part-time</option>
                                                    <option value="Contract">Contract</option>
                                                    <option value="National Service">NSS</option>
                                                </select>
                                                <i className="ri-arrow-down-s-line absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Application Link</label>
                                        <div className="relative">
                                            <i className="ri-link absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                            <input
                                                type="text"
                                                value={formData.url}
                                                onChange={e => setFormData({ ...formData, url: e.target.value })}
                                                className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3.5 pl-10 text-sm font-bold outline-none focus:border-blue-500 transition-all dark:text-white"
                                                placeholder="https://... or mailto:..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
                                        <textarea
                                            rows={5}
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3.5 text-sm font-medium outline-none focus:border-blue-500 transition-all resize-none dark:text-white/80"
                                            placeholder="Key responsibilities and requirements..."
                                        />
                                    </div>

                                    <div className="pt-2 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(false)}
                                            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={createMutation.isPending || updateMutation.isPending}
                                            className="flex-1 py-4 bg-blue-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:bg-blue-500 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            {createMutation.isPending || updateMutation.isPending ? <i className="ri-loader-4-line animate-spin text-lg"></i> : <i className="ri-check-line text-lg"></i>}
                                            {editingId ? 'Update' : 'Publish'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Listings Section */}
                    <div className={isEditing ? 'lg:col-span-8 order-2 lg:order-1' : 'lg:col-span-12'}>

                        {/* Search Bar */}
                        <div className="relative mb-8 group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <i className="ri-search-line text-slate-400 text-xl group-focus-within:text-blue-500 transition-colors"></i>
                            </div>
                            <input
                                type="text"
                                placeholder="Search internships by title or company..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 font-bold focus:border-blue-500 outline-none transition-all shadow-sm"
                            />
                        </div>

                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="bg-white dark:bg-slate-900 h-40 rounded-2xl animate-pulse border border-slate-100 dark:border-slate-800"></div>
                                ))}
                            </div>
                        ) : filteredInternships.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800/50">
                                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-600">
                                    <i className="ri-briefcase-line text-5xl"></i>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">No internships found</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium">Try adjusting your search terms or create a new listing.</p>
                            </div>
                        ) : (
                            <div className={isEditing ? 'flex flex-col gap-4' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'}>
                                {filteredInternships.map(job => (
                                    <div key={job.id} className="bg-white dark:bg-slate-900 p-6 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all group relative overflow-hidden">

                                        {/* Quick Actions (Floating) */}
                                        <div className="absolute top-4 right-4 flex gap-2">
                                            <button
                                                onClick={() => toggleActiveMutation.mutate({ id: job.id, currentState: job.is_active })}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${job.is_active ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-slate-100 text-slate-400'}`}
                                                title={job.is_active ? "Mark as Closed" : "Mark as Active"}
                                            >
                                                <i className={`ri-${job.is_active ? 'eye-fill' : 'eye-off-line'}`}></i>
                                            </button>
                                            <button
                                                onClick={() => handleEdit(job)}
                                                className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
                                            >
                                                <i className="ri-pencil-fill"></i>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(job.id)}
                                                className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
                                            >
                                                <i className="ri-delete-bin-line"></i>
                                            </button>
                                        </div>

                                        <div className="flex gap-4 mb-4 pr-24">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 p-2 border border-slate-100 dark:border-slate-700/50">
                                                <img src="/Compus%20Konnect%20logo.png" alt="Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight mb-1">{job.title}</h3>
                                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{job.company}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-6">
                                            <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <i className="ri-map-pin-line mr-1"></i> {job.location}
                                            </span>
                                            <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <i className="ri-briefcase-line mr-1"></i> {job.type}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Posted {timeAgo(job.created_at)}
                                            </div>
                                            <div className={`w-2 h-2 rounded-full ${job.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
