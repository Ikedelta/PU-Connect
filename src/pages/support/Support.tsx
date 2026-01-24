
import { useState } from 'react';
import Navbar from '../../components/feature/Navbar';
import Footer from '../../components/layout/Footer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function Support() {
    const { user } = useAuth();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            alert('Please login to submit a ticket');
            return;
        }

        if (!subject || !message) return;

        setLoading(true);
        try {
            const priority = 'medium'; // Default priority for user submissions

            // 2. Submit Ticket
            if (user.id === '00000000-0000-0000-0000-000000000000') {
                // System Admin Bypass Submission
                const secret = localStorage.getItem('sys_admin_secret') || 'pentvars-sys-admin-x892'; // fallback default
                const { error: rpcError } = await supabase.rpc('admin_create_ticket', {
                    subject,
                    message,
                    priority,
                    secret_key: secret
                });
                if (rpcError) throw rpcError;
            } else {
                // Standard User Submission
                const { error: submitError } = await supabase
                    .from('support_tickets')
                    .insert({
                        user_id: user.id,
                        subject,
                        message,
                        priority,
                        status: 'open'
                    });

                if (submitError) throw submitError;
            }

            setSuccess(true);
            setSubject('');
            setMessage('');
        } catch (error: any) {
            console.error('Error details:', error);
            alert(`Failed to send request: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
            <Navbar />

            {/* Header Section */}
            <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-white dark:bg-gray-900 overflow-hidden py-24 md:py-32">
                <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/40 to-white/60 dark:from-gray-950/90 dark:to-gray-950 z-0"></div>
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-200/30 dark:bg-blue-600/10 rounded-full blur-[100px] opacity-50 z-0"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-white dark:bg-gray-800 border border-blue-200 dark:border-gray-700 rounded-2xl mb-8 shadow-sm">
                        <i className="ri-customer-service-2-fill text-2xl text-blue-600 dark:text-blue-400"></i>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight">
                        How can we <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">help you?</span>
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                        Search our knowledge base, explore frequently asked questions, or contact our dedicated support team directly.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 -mt-20 relative z-20 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 animate-fade-in-up delay-300">
                    {[
                        { title: 'Student Accounts', icon: 'ri-account-circle-line', desc: 'Login, Profile, and Verification issues' },
                        { title: 'Marketplace', icon: 'ri-store-3-line', desc: 'Listing products and Vendor queries' }
                    ].map((item, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-[2rem] shadow-lg border border-gray-100 dark:border-gray-700 hover:-translate-y-2 transition-transform duration-300 group cursor-pointer">
                            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <i className={`${item.icon} text-3xl text-blue-600 dark:text-blue-400`}></i>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{item.desc}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Contact Form */}
                    <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 h-full">
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Send Message</h3>
                        <p className="text-gray-500 text-sm mb-10">Fill out the form below and we'll get back to you within 24 hours.</p>

                        {success ? (
                            <div className="text-center py-12 flex flex-col items-center justify-center h-[400px]">
                                <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-8 animate-bounce">
                                    <i className="ri-check-line text-4xl text-green-600 dark:text-green-400"></i>
                                </div>
                                <h4 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Request Received!</h4>
                                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs mx-auto">Our support team has been notified. Check your email for updates.</p>
                                <button
                                    onClick={() => setSuccess(false)}
                                    className="px-8 py-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    New Request
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 pl-2">Support Topic</label>
                                    <div className="relative group">
                                        <i className="ri-list-settings-line absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 z-10"></i>
                                        <select
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            required
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:bg-white dark:focus:bg-gray-900 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-semibold text-gray-900 dark:text-white cursor-pointer appearance-none text-sm"
                                        >
                                            <option value="">Select a related topic...</option>
                                            <option value="account">Account & Verification</option>
                                            <option value="seller">Seller Application Status</option>
                                            <option value="payment">Billing & Subscriptions</option>
                                            <option value="technical">Report a Bug / Issue</option>
                                            <option value="other">General Inquiry</option>
                                        </select>
                                        <i className="ri-arrow-down-s-line absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 pl-2">Detailed Description</label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        required
                                        placeholder="Please describe your issue clearly..."
                                        rows={6}
                                        className="w-full p-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:bg-white dark:focus:bg-gray-900 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium text-gray-900 dark:text-white resize-none text-sm"
                                    ></textarea>
                                </div>

                                <div className="pt-6">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <span>Submit Ticket</span>
                                                <i className="ri-send-plane-fill text-lg group-hover:translate-x-1 transition-transform"></i>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Contact Info & FAQ */}
                    <div className="space-y-8 flex flex-col">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                            <div className="relative z-10">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full mb-6 border border-white/20">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Live Support</span>
                                </div>
                                <h3 className="text-3xl font-bold mb-8">Direct Channels</h3>
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 md:gap-5 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors cursor-pointer group">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600 group-hover:scale-110 transition-transform">
                                            <i className="ri-mail-send-fill text-2xl"></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Official Email</p>
                                            <a href="mailto:campuskonnect11@gmail.com" className="text-base md:text-lg font-bold break-all">campuskonnect11@gmail.com</a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-5 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors cursor-pointer group">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0 text-blue-600 group-hover:scale-110 transition-transform">
                                            <i className="ri-customer-service-2-fill text-2xl"></i>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Helpline</p>
                                            <a href="tel:+233123456789" className="text-lg font-bold">+233 123 456 789</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-10 border border-gray-100 dark:border-gray-800 flex-1">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
                                <i className="ri-question-answer-line text-blue-500"></i>
                                Common Questions
                            </h3>
                            <div className="space-y-4">
                                {[
                                    { q: "How do I become a seller?", a: "Navigate to 'Become a Seller' in the menu, complete the application form, and wait for admin approval (approx. 24hrs)." },
                                    { q: "Is listing products free?", a: "Yes! Currently, all student listings are completely free of charge to support campus commerce." },
                                    { q: "Can I manage multiple shops?", a: "Currently, each student account is limited to one unified seller profile to ensure quality and trust." }
                                ].map((faq, i) => (
                                    <div key={i}>
                                        <details className="group">
                                            <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm py-2">
                                                <span>{faq.q}</span>
                                                <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-open:bg-blue-50 dark:group-open:bg-blue-900/30 transition-colors">
                                                    <i className="ri-add-line group-open:rotate-45 transition-transform duration-300"></i>
                                                </div>
                                            </summary>
                                            <div className="overflow-hidden h-0 group-open:h-auto transition-all duration-300">
                                                <p className="text-gray-500 dark:text-gray-400 py-3 text-sm leading-relaxed border-l-2 border-blue-500/20 pl-4 ml-1 mb-2">
                                                    {faq.a}
                                                </p>
                                            </div>
                                        </details>
                                        {i !== 2 && <div className="h-px bg-gray-100 dark:bg-gray-800 my-2"></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
