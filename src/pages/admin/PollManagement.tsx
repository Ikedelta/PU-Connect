import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import { useNavigate } from 'react-router-dom';

type Poll = {
    id: string;
    question: string;
    is_active: boolean;
    created_at: string;
    expires_at: string | null;
    options: {
        id: string;
        option_text: string;
        votes_count: number;
    }[];
};

export default function PollManagement() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']); // Start with 2 empty options
    const [expiresAt, setExpiresAt] = useState('');

    useEffect(() => {
        if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
            navigate('/marketplace');
            return;
        }
        fetchPolls();
    }, []);

    const fetchPolls = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('polls')
                .select(`
            *,
            options:poll_options(*)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPolls(data as any || []);
        } catch (error) {
            console.error('Error fetching polls:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePoll = async (e: React.FormEvent) => {
        e.preventDefault();
        if (options.some(o => !o.trim())) {
            alert("Please fill in all options.");
            return;
        }
        setSaving(true);

        try {
            // 1. Create Poll
            const { data: poll, error: pollError } = await supabase
                .from('polls')
                .insert({
                    question,
                    created_by: profile?.id,
                    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
                    is_active: true
                })
                .select()
                .single();

            if (pollError) throw pollError;

            // 2. Create Options
            const optionsData = options.map(text => ({
                poll_id: poll.id,
                option_text: text
            }));

            const { error: optionsError } = await supabase
                .from('poll_options')
                .insert(optionsData);

            if (optionsError) throw optionsError;

            setShowModal(false);
            setQuestion('');
            setOptions(['', '']);
            setExpiresAt('');
            fetchPolls();

        } catch (err: any) {
            console.error("Error creating poll", err);
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const togglePollStatus = async (id: string, currentStatus: boolean) => {
        try {
            await supabase.from('polls').update({ is_active: !currentStatus }).eq('id', id);
            fetchPolls();
        } catch (err) { console.error(err); }
    }

    const deletePoll = async (id: string) => {
        if (!confirm("Delete this poll?")) return;
        try {
            await supabase.from('polls').delete().eq('id', id);
            fetchPolls();
        } catch (err) { console.error(err); }
    }


    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
            <Navbar />

            <div className="pt-32 md:pt-40 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold uppercase tracking-widest border border-cyan-200 dark:border-cyan-800">
                                Community Engagement
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                            Polls
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Gather feedback from the student body.</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/admin')}
                            className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer flex items-center gap-2"
                        >
                            <i className="ri-arrow-left-line text-lg"></i>
                            Dashboard
                        </button>
                        <button
                            onClick={() => setShowModal(true)}
                            className="px-6 py-3 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap cursor-pointer flex items-center gap-2 shadow-lg shadow-cyan-200 dark:shadow-none"
                        >
                            <i className="ri-bar-chart-2-line text-lg"></i>
                            Create Poll
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20">
                        <i className="ri-loader-4-line text-4xl animate-spin text-cyan-600"></i>
                    </div>
                ) : polls.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-[2rem]">
                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                            <i className="ri-question-answer-line text-4xl text-slate-300"></i>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No polls created</h3>
                        <p className="text-slate-500 text-sm">Create a poll to start gathering opinions.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {polls.map(poll => (
                            <div key={poll.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm relative group hover:shadow-lg transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${poll.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {poll.is_active ? 'Active' : 'Closed'}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => togglePollStatus(poll.id, poll.is_active)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
                                            <i className={`ri-${poll.is_active ? 'stop' : 'play'}-line`}></i>
                                        </button>
                                        <button onClick={() => deletePoll(poll.id)} className="w-8 h-8 rounded-full bg-rose-100 hover:bg-rose-200 flex items-center justify-center text-rose-600">
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 min-h-[3.5rem]">{poll.question}</h3>

                                <div className="space-y-3">
                                    {poll.options.map(opt => {
                                        const totalVotes = poll.options.reduce((acc, curr) => acc + (curr.votes_count || 0), 0);
                                        const percentage = totalVotes > 0 ? Math.round((opt.votes_count / totalVotes) * 100) : 0;
                                        return (
                                            <div key={opt.id} className="relative">
                                                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 z-10 relative">
                                                    <span>{opt.option_text}</span>
                                                    <span>{percentage}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-700 text-xs text-slate-400 font-bold uppercase tracking-wider text-right">
                                    {poll.options.reduce((acc, curr) => acc + (curr.votes_count || 0), 0)} Total Votes
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Poll Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-8 border border-slate-100 dark:border-slate-800">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Create New Poll</h3>
                        <form onSubmit={handleCreatePoll}>
                            <div className="mb-6">
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Question</label>
                                <input
                                    type="text"
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-cyan-500/50 outline-none font-bold text-slate-900 dark:text-white"
                                    placeholder="e.g. What framework should we learn next?"
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Options</label>
                                <div className="space-y-3">
                                    {options.map((opt, idx) => (
                                        <input
                                            key={idx}
                                            type="text"
                                            value={opt}
                                            onChange={e => {
                                                const newOpts = [...options];
                                                newOpts[idx] = e.target.value;
                                                setOptions(newOpts);
                                            }}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
                                            placeholder={`Option ${idx + 1}`}
                                        />
                                    ))}
                                </div>
                                <button type="button" onClick={() => setOptions([...options, ''])} className="mt-3 text-xs font-bold text-cyan-600 uppercase tracking-wide hover:underline">
                                    + Add Option
                                </button>
                            </div>

                            <div className="mb-8">
                                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Expires At (Optional)</label>
                                <input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={e => setExpiresAt(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none font-bold text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl uppercase tracking-widest text-xs hover:bg-slate-200">
                                    Cancel
                                </button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-cyan-600 text-white font-bold rounded-xl uppercase tracking-widest text-xs hover:bg-cyan-700 shadow-lg shadow-cyan-200 dark:shadow-none flex items-center justify-center gap-2">
                                    {saving && <i className="ri-loader-4-line animate-spin"></i>}
                                    Launch Poll
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
