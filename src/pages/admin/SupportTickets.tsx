import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import { useNavigate } from 'react-router-dom';

type Ticket = {
    id: string;
    subject: string;
    message: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    created_at: string;
    user_id: string;
    user?: {
        full_name: string;
        email: string;
        phone: string;
    };
};

export default function SupportTickets() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

    useEffect(() => {
        if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
            navigate('/marketplace');
            return;
        }
        fetchTickets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('support_tickets')
                .select('*, user:profiles!user_id(full_name, email, phone)')
                .order('created_at', { ascending: false });

            if (filter !== 'all') {
                if (filter === 'open') {
                    query = query.in('status', ['open', 'in_progress']);
                } else {
                    query = query.in('status', ['resolved', 'closed']);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            setTickets(data as any || []);
        } catch (error) {
            console.error('Error fetching tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            const { error } = await supabase.from('support_tickets').update({ status: newStatus }).eq('id', id);
            if (error) throw error;
            fetchTickets();
        } catch (err) {
            console.error('Error updating ticket', err);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
            <Navbar />

            <div className="pt-32 md:pt-40 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-[10px] font-bold uppercase tracking-widest border border-pink-200 dark:border-pink-800">
                                Help Desk
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                            Support Tickets
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Manage user inquiries and issues.</p>
                    </div>

                    <button
                        onClick={() => navigate('/admin')}
                        className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer flex items-center gap-2"
                    >
                        <i className="ri-arrow-left-line text-lg"></i>
                        Back to Dashboard
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {['all', 'open', 'resolved'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${filter === f
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                    : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="text-center py-20">
                        <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-[2rem]">
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                            <i className="ri-customer-service-2-line text-4xl text-slate-300"></i>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No tickets found</h3>
                        <p className="text-slate-500 text-sm">Great job! All caught up.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {tickets.map(ticket => (
                            <div key={ticket.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${ticket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                                    ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-blue-100 text-blue-700'
                                                }`}>
                                                {ticket.priority}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">
                                                #{ticket.id.slice(0, 8)}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                • {new Date(ticket.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{ticket.subject}</h3>
                                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                            {ticket.message}
                                        </p>

                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                {ticket.user?.full_name?.charAt(0)}
                                            </div>
                                            <div className="text-xs">
                                                <p className="font-bold text-slate-900 dark:text-white">{ticket.user?.full_name || 'Unknown User'}</p>
                                                <p className="text-slate-500">{ticket.user?.email} • {ticket.user?.phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-row md:flex-col gap-2 justify-center md:border-l md:border-slate-100 md:dark:border-slate-700 md:pl-6 min-w-[150px]">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 hidden md:block">Actions</p>
                                        {ticket.status !== 'resolved' && (
                                            <button
                                                onClick={() => updateStatus(ticket.id, 'resolved')}
                                                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <i className="ri-check-line text-lg"></i>
                                                Resolve
                                            </button>
                                        )}
                                        {ticket.status !== 'in_progress' && ticket.status !== 'resolved' && (
                                            <button
                                                onClick={() => updateStatus(ticket.id, 'in_progress')}
                                                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <i className="ri-loader-2-line text-lg"></i>
                                                Process
                                            </button>
                                        )}
                                        <div className="mt-auto pt-2 text-center">
                                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${ticket.status === 'resolved' ? 'bg-gray-100 text-gray-500' :
                                                    ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                                                        'bg-purple-100 text-purple-600'
                                                }`}>
                                                {ticket.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
