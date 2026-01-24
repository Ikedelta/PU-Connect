import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    const socialLinks = [
        { icon: 'linkedin', color: 'from-blue-600 to-blue-800', url: 'https://linkedin.com/company/campus-konnect' },
        { icon: 'instagram', color: 'from-pink-500 to-purple-500', url: 'https://instagram.com/campuskonnect' },
        { icon: 'tiktok', color: 'from-black to-gray-800', url: 'https://tiktok.com/@campuskonnect' },
        { icon: 'whatsapp', color: 'from-green-400 to-green-600', url: 'https://wa.me/233000000000' }
    ];

    const quickLinks = [
        { name: 'Browse Marketplace', path: '/marketplace' },
        { name: 'Campus News', path: '/news' },
        { name: 'Start Selling', path: '/seller/apply' },
        { name: 'My Profile', path: '/profile' }
    ];

    return (
        <footer className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white pt-16 pb-8 border-t border-gray-200 dark:border-gray-800 relative overflow-hidden font-sans">
            {/* Subtle decorative background */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-gray-900 dark:to-gray-900 rounded-full blur-3xl opacity-30"></div>

            <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
                    {/* Brand Column */}
                    <div className="md:col-span-6">
                        <div className="flex items-center gap-3 mb-5">
                            <Link to="/" className="h-10 w-auto flex items-center justify-center">
                                <img src="/Compus%20Konnect%20logo.png" alt="Campus Konnect" className="w-full h-full object-contain" />
                            </Link>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed max-w-md mb-8">
                            Your trusted campus marketplace. Connecting students, empowering commerce, building community—one deal at a time.
                        </p>
                        <div className="flex gap-3">
                            {socialLinks.map(social => (
                                <motion.a
                                    key={social.icon}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    whileHover={{ scale: 1.1, y: -2 }}
                                    whileTap={{ scale: 0.9 }}
                                    className={`w-11 h-11 bg-gradient-to-br ${social.color} rounded-xl flex items-center justify-center text-white shadow-md transition-shadow hover:shadow-lg`}
                                >
                                    <i className={`ri-${social.icon}-fill text-lg`}></i>
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* Links Column */}
                    <div className="md:col-span-3">
                        <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-6 border-b border-blue-100 dark:border-blue-900 pb-2 w-fit">Quick Links</h4>
                        <ul className="space-y-3">
                            {quickLinks.map(link => (
                                <li key={link.name}>
                                    <Link
                                        to={link.path}
                                        className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium text-sm flex items-center gap-2 group"
                                    >
                                        <i className="ri-arrow-right-s-line group-hover:translate-x-1 transition-transform"></i>
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Column */}
                    <div className="md:col-span-3">
                        <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-6 border-b border-blue-100 dark:border-blue-900 pb-2 w-fit">Get In Touch</h4>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-widest mb-2">Support Email</p>
                                <a
                                    href="mailto:campuskonnect11@gmail.com"
                                    className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold flex items-center gap-2 group"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <i className="ri-mail-fill"></i>
                                    </div>
                                    <span className="text-sm">campuskonnect11@gmail.com</span>
                                </a>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-500 dark:text-gray-500 uppercase tracking-widest mb-2">Location</p>
                                <div className="text-gray-900 dark:text-white font-bold flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                        <i className="ri-map-pin-2-fill"></i>
                                    </div>
                                    <span className="text-sm">Main Campus Hub</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-500 dark:text-gray-500 font-medium">
                        &copy; {currentYear} Campus Konnect. All rights reserved.
                    </p>
                    <div className="flex gap-6">
                        <Link to="/terms" className="text-[10px] font-bold text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Terms of Service</Link>
                        <Link to="/privacy" className="text-[10px] font-bold text-gray-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Privacy Policy</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
