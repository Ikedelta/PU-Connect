
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function MobileBottomNav() {
    const location = useLocation();
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    // Fetch unread count for messages badge
    useEffect(() => {
        if (!user) return;

        const fetchUnread = async () => {
            const { count } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', user.id)
                .eq('is_read', false);

            setUnreadCount(count || 0);
        };

        fetchUnread();

        const channel = supabase.channel('mobile-nav-messages')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${user.id}`
            }, fetchUnread)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const navItems = [
        { label: 'Home', path: '/', icon: 'ri-home-5-line', activeIcon: 'ri-home-5-fill' },
        { label: 'Market', path: '/marketplace', icon: 'ri-store-2-line', activeIcon: 'ri-store-2-fill' },
        { label: 'Chat', path: '/messages', icon: 'ri-chat-3-line', activeIcon: 'ri-chat-3-fill', badge: unreadCount },
        { label: 'Profile', path: '/profile', icon: 'ri-user-3-line', activeIcon: 'ri-user-3-fill' }
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[100] lg:hidden">
            {/* Glassmorphism Background */}
            <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"></div>

            <div className="relative flex justify-around items-center h-16 px-2 safe-area-pb">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));

                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 relative group active:scale-95`}
                        >
                            <div className={`relative px-5 py-1 ${isActive ? 'translate-y-[-2px]' : ''} transition-transform`}>
                                <i className={`${isActive ? item.activeIcon : item.icon} text-2xl transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}></i>

                                {item.badge ? (
                                    <span className="absolute -top-1 right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 animate-bounce-short">
                                        {item.badge > 9 ? '9+' : item.badge}
                                    </span>
                                ) : null}

                                {/* Active Indicator Dot */}
                                {isActive && (
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                                )}
                            </div>
                            <span className={`text-[10px] font-medium tracking-wide transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* Floating Action Button for 'Sell' - Centered if we had 5 items, but here we can add a plus if needed, 
            or keep it simple. Let's make it simple for now as requested "nicer mobile UI". */}
            </div>
        </div>
    );
}
