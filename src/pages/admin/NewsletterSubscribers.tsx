import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function NewsletterSubscribers() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [subscribers, setSubscribers] = useState<{ id: string; email: string; created_at: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile && profile.role !== 'admin' && profile.role !== 'super_admin') {
            navigate('/');
            return;
        }
        fetchSubscribers();
    }, [profile, navigate]);

    const fetchSubscribers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('newsletter_subscribers')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // If table doesn't exist yet, just show empty
                if (error.code === '42P01') {
                    setSubscribers([]);
                } else {
                    console.error('Error fetching subscribers:', error);
                }
            } else {
                setSubscribers(data || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans pb-20 transition-colors duration-300">
            <Navbar />

            <div className="pt-32 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
                            Newsletter
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                            Manage your email subscribers.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => window.history.back()}
                            className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            Back
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
                            Loading Subscribers...
                        </div>
                    ) : subscribers.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                                <i className="ri-mail-open-line text-4xl text-slate-300"></i>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Subscribers Yet</h3>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                                No one has subscribed to the newsletter yet. Make sure the subscription form on the home page is working!
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                                        <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-500">Email Address</th>
                                        <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-slate-500 text-right">Subscribed Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subscribers.map(sub => (
                                        <tr key={sub.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">
                                                {sub.email}
                                            </td>
                                            <td className="px-8 py-5 text-right font-medium text-slate-500 text-sm">
                                                {new Date(sub.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
