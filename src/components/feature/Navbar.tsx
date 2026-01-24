import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useTheme } from '../../contexts/ThemeContext';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Realtime Presence Tracking
  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel('online-presence', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      // Just syncing state, no local action needed in Navbar
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const presenceState = {
          id: user.id, // Explicitly add id for simpler checks
          user_id: user.id,
          full_name: profile.full_name,
          role: profile.role,
          online_at: new Date().toISOString(),
        };
        await channel.track(presenceState);
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [user, profile]);

  // Real-time News Notifications
  useEffect(() => {
    // Only subscribe to INSERT events that are published
    const channel = supabase
      .channel('public:campus_news')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'campus_news' },
        (payload: any) => {
          if (payload.new.is_published) {
            // Check if we have a simple toast system, if not, native alert or console for now, 
            // but effectively we want a visual indicator.
            // Since we don't have a global toast context readily shown in this file,
            // we will use a custom DOM toast or similar if we can, or just alert?
            // "put a notification or an alert".
            // Let's create a temporary overlay or just a browser notification?
            // Let's use a custom state for a "New News" banner/toast in the Navbar.
            setNewsNotification({
              title: payload.new.title,
              id: payload.new.id
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'campus_news' },
        (payload: any) => {
          // If it just got published (wasn't before)
          if (payload.new.is_published && !payload.old.is_published) {
            setNewsNotification({
              title: payload.new.title,
              id: payload.new.id
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [newsNotification, setNewsNotification] = useState<{ title: string, id: string } | null>(null);

  // Auto-hide notification
  useEffect(() => {
    if (newsNotification) {
      const timer = setTimeout(() => setNewsNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [newsNotification]);

  const handleSignOut = async () => {
    try {
      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret');
      const token = localStorage.getItem('sys_admin_session_token');

      if (isBypass && secret && token) {
        // Release the session so others can log in
        await supabase.rpc('sys_release_admin_session', {
          secret_key: secret,
          s_token: token
        });
      }

      await signOut();

      // Clear bypass keys
      localStorage.removeItem('sys_admin_bypass');
      localStorage.removeItem('sys_admin_secret');
      localStorage.removeItem('sys_admin_session_token');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      navigate('/login');
    }
  };

  // Fetch unread message count and application status
  useEffect(() => {
    if (!user) return;

    // Calculate effective user ID once, respecting localStorage bypass for testing
    const isBypass = user.id === 'sys_admin_001' || localStorage.getItem('sys_admin_bypass') === 'true';
    const effectiveUserId = isBypass ? '00000000-0000-0000-0000-000000000000' : user.id;

    const fetchData = async () => {
      try {
        // Fetch unread messages
        const { count, error: msgError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('is_read', false);

        if (!msgError && count !== null) {
          setUnreadCount(count);
        }

        // Check for seller application
        const { data: app, error: appError } = await supabase
          .from('seller_applications')
          .select('id, status')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        if (!appError) {
          setApplicationStatus(app?.status || null);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();

    // 1. Real-time subscription for messages (unread count)
    const msgChannel = supabase
      .channel(`navbar-messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          // Re-fetch unread count when messages change for this user
          fetchData();
        }
      )
      .subscribe();

    // 2. Real-time subscription for application changes
    const appChannel = supabase
      .channel(`seller-app-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seller_applications',
          filter: `user_id=eq.${effectiveUserId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setApplicationStatus(null);
          } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const app = payload.new as any;
            setApplicationStatus(app.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(appChannel);
    };
  }, [user, profile?.role]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const getDashboardItem = () => {
    const isSysAdminBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    if (profile?.role === 'super_admin' || profile?.role === 'admin' || isSysAdminBypass)
      return { label: 'Admin Dashboard', path: '/admin', icon: 'ri-dashboard-line' };

    if (profile?.role === 'news_publisher')
      return { label: 'Publisher Dashboard', path: '/publisher', icon: 'ri-article-line' };

    if (profile?.role === 'seller' || profile?.role === 'publisher_seller')
      return { label: 'Seller Dashboard', path: '/seller/dashboard', icon: 'ri-store-3-line' };

    // If they have an application that is NOT approved (pending/rejected), show status
    if (applicationStatus && applicationStatus !== 'approved' && applicationStatus !== 'cancelled') {
      return { label: 'View Application Status', path: '/seller/status', icon: 'ri-file-list-3-line' };
    }

    return null;
  };

  const dashboardItem = getDashboardItem();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      <div className={`absolute inset-0 transition-colors duration-500 ${showMobileMenu
        ? 'bg-transparent'
        : 'bg-white/95 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm'
        }`}></div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-[60]">
        <div className="flex justify-between items-center h-20">
          {/* Logo Section */}
          <Link to="/" className={`flex items-center gap-2 group relative z-10 transition-all duration-300 ${showMobileMenu ? 'opacity-0 invisible' : 'opacity-100 visible'}`} onClick={() => setShowMobileMenu(false)}>
            <div className="h-8 w-auto md:h-10 flex items-center justify-center">
              <img
                src="/Compus%20Konnect%20logo.png"
                alt="Campus Konnect"
                className={`w-full h-full object-contain transition-all duration-500 ${showMobileMenu ? 'brightness-0 invert' : ''}`}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('bg-blue-600', 'rounded-xl', 'text-white', 'p-2');
                  e.currentTarget.parentElement!.innerHTML = '<i class="ri-store-3-fill text-2xl"></i>';
                }}
              />
            </div>
          </Link>

          {/* Right Side Actions (Nav + Auth) */}
          <div className="flex items-center gap-3 md:gap-6">

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-6">
              <Link to="/" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors">Home</Link>
              <Link to="/marketplace" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors">Marketplace</Link>
              <Link to="/news" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors">News</Link>
              <Link to="/support" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors">Help Center</Link>
              <div className="w-px h-6 bg-gray-300 dark:bg-gray-800 mx-2"></div>

              {/* Primary Action Button (Desktop) */}
              {profile?.role === 'super_admin' || profile?.role === 'admin' ? (
                <Link to="/admin" className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 active:scale-95 transition-all flex items-center gap-2">
                  <i className="ri-dashboard-line text-lg"></i> Admin Dashboard
                </Link>
              ) : (applicationStatus && applicationStatus !== 'approved' && applicationStatus !== 'cancelled') ? (
                <Link to="/seller/status" className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-95 transition-all flex items-center gap-2">
                  <i className="ri-file-list-3-line text-lg"></i> View Application Status
                </Link>
              ) : (profile?.role === 'seller' || profile?.role === 'publisher_seller') ? (
                <Link to="/seller/dashboard" className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 active:scale-95 transition-all flex items-center gap-2">
                  <i className="ri-dashboard-line text-lg"></i> Seller Dashboard
                </Link>
              ) : (
                <Link to="/seller/apply" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-95 transition-all flex items-center gap-2">
                  <i className="ri-store-2-line text-lg"></i> Become a Seller
                </Link>
              )}
            </div>

            {/* Auth/User Section - Visible on Desktop, Simplified on Mobile */}
            <div className={`flex items-center gap-3 lg:gap-4 relative z-10 transition-all duration-300 ${showMobileMenu ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>

              {/* Dark Mode Toggle - Always Visible */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <i className="ri-sun-line text-xl"></i> : <i className="ri-moon-line text-xl"></i>}
              </button>

              {!user ? (
                /* Logged Out State - Mobile Optimized */
                <div className="flex items-center gap-2 sm:gap-4">
                  <Link to="/login" className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors">
                    Log In
                  </Link>
                  <Link to="/register" className="px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-lg shadow-lg transition-all shadow-blue-500/30">
                    Sign Up
                  </Link>
                </div>
              ) : (
                /* Logged In State */
                <div className="flex items-center gap-2 lg:gap-4 pl-0 lg:pl-6 lg:border-l border-gray-300 dark:border-gray-800">
                  <Link to="/messages" className="relative p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white transition-colors">
                    <i className="ri-chat-3-line text-xl"></i>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
                    )}
                  </Link>

                  {/* Desktop Profile Dropdown / Mobile Avatar Link */}
                  <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setShowDropdown(!showDropdown)} className="hidden lg:flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        {profile?.avatar_url ? (
                          <img src={getOptimizedImageUrl(profile.avatar_url, 80, 80)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold relative overflow-hidden">
                            <span className="relative z-10">{profile?.full_name?.charAt(0).toUpperCase() || 'U'}</span>
                          </div>
                        )}
                      </div>
                    </button>
                    {/* Mobile: Just show the avatar, handled by menu logic usually but we can show it here too if we want, or keep it simple */}
                  </div>

                  {/* Dropdown Menu (Desktop Only in this layout structure mainly) */}
                  <div className={`hidden lg:block absolute top-full right-0 mt-3 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-3 transition-all duration-200 origin-top-right z-[100] overflow-hidden ${showDropdown ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                    <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 mb-2 bg-gray-50/50 dark:bg-gray-800/30">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{profile?.full_name}</p>
                      <p className="text-xs text-gray-500 truncate font-medium">{profile?.email}</p>
                    </div>
                    <div className="px-2">
                      {[
                        { label: 'My Profile', path: '/profile', icon: 'ri-user-smile-line' },
                        ...(profile?.role === 'publisher_seller' ? [
                          { label: 'Seller Dashboard', path: '/seller/dashboard', icon: 'ri-store-3-line' },
                          { label: 'Publisher Dashboard', path: '/publisher', icon: 'ri-article-line' }
                        ] : dashboardItem ? [{ ...dashboardItem }] : []),
                        { label: 'Help Center', path: '/support', icon: 'ri-question-line' }
                      ].map((item) => (
                        <Link key={item.label} to={item.path} onClick={() => setShowDropdown(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            <i className={`${item.icon} text-lg`}></i>
                          </div>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-gray-50 dark:border-gray-800/50 mt-2 pt-2 px-2">
                      <button onClick={() => { setShowDropdown(false); handleSignOut(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left group">
                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 group-hover:text-red-600 transition-colors"><i className="ri-logout-box-line text-lg"></i></div> Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Toggle - Classic Card Style */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`lg:hidden w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl transition-all duration-300 relative z-[70] shadow-sm border ${showMobileMenu
                ? 'text-rose-500 bg-rose-50 border-rose-100'
                : 'text-gray-700 dark:text-white bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}
            >
              <i className={`ri-${showMobileMenu ? 'close' : 'menu-4'}-line text-xl sm:text-2xl font-bold`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay - Theme Responsive */}
      <div className={`fixed inset-0 z-40 transition-all duration-500 ${showMobileMenu ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}>
        <div className="absolute inset-0 bg-white/98 dark:bg-gray-950/98 backdrop-blur-xl" />

        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-200/20 dark:bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className={`relative h-full flex flex-col p-8 pt-12 overflow-y-auto transition-transform duration-500 ease-out ${showMobileMenu ? 'translate-y-0' : '-translate-y-12'
          }`}>
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between mb-10 pl-2">
            <div>
              <img src="/Compus%20Konnect%20logo.png" alt="Campus Konnect" className="h-10 w-auto object-contain" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] mb-4 pl-2">Quick Navigation</p>
            {[
              { label: 'Home', path: '/', icon: 'ri-home-5-line', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Marketplace', path: '/marketplace', icon: 'ri-shopping-bag-3-line', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20' },
              { label: 'Campus News', path: '/news', icon: 'ri-newspaper-line', color: 'text-purple-600 dark:text-indigo-400', bg: 'bg-purple-100 dark:bg-indigo-900/20' },
              { label: 'Help Center', path: '/support', icon: 'ri-customer-service-2-line', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/20' },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.path}
                onClick={() => setShowMobileMenu(false)}
                className="group flex items-center justify-between p-5 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/5 active:scale-[0.98] transition-all border border-transparent hover:border-gray-200 dark:hover:border-white/5"
              >
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.bg} ${item.color} shadow-sm`}>
                    <i className={`${item.icon} text-xl`}></i>
                  </div>
                  <span className={`text-lg font-bold tracking-tight text-gray-800 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors`}>{item.label}</span>
                </div>
                <i className="ri-arrow-right-line text-xl text-gray-300 dark:text-gray-700 group-hover:text-gray-600 dark:group-hover:text-white transition-colors"></i>
              </Link>
            ))}

            {/* Application or Seller Action */}
            {!['super_admin', 'admin'].includes(profile?.role || '') && (
              <>
                {dashboardItem && (
                  <Link
                    to={dashboardItem.path}
                    onClick={() => setShowMobileMenu(false)}
                    className="group flex items-center justify-between p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-blue-500/30 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ring-1 ring-white/10 ${dashboardItem.label === 'View Application Status'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                        }`}>
                        <i className={`${dashboardItem.icon} text-xl`}></i>
                      </div>
                      <div>
                        <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{dashboardItem.label}</span>
                        <p className={`text-[10px] font-bold uppercase tracking-wide mt-1 ${dashboardItem.label === 'View Application Status' ? 'text-blue-400' : 'text-emerald-400'
                          }`}>Live Access</p>
                      </div>
                    </div>
                    <i className="ri-arrow-right-line text-xl text-gray-500 group-hover:text-white transition-colors"></i>
                  </Link>
                )}

                {/* Show Become Seller if eligible */}
                {!['seller', 'publisher_seller', 'admin', 'super_admin'].includes(profile?.role || '') &&
                  (!applicationStatus || applicationStatus === 'cancelled' || applicationStatus === 'rejected') && (
                    <Link
                      to="/seller/apply"
                      onClick={() => setShowMobileMenu(false)}
                      className="group flex items-center justify-between p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40">
                          <i className="ri-store-2-line text-xl"></i>
                        </div>
                        <div>
                          <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tight">Become a Seller</span>
                          <p className="text-[10px] font-bold text-blue-500/60 uppercase tracking-wide mt-1">Start Trading</p>
                        </div>
                      </div>
                      <i className="ri-arrow-right-line text-xl text-blue-500/40 group-hover:text-blue-400 transition-colors"></i>
                    </Link>
                  )}
              </>
            )}



            {user && (profile?.role === 'admin' || profile?.role === 'super_admin') && dashboardItem && (
              <Link
                to={dashboardItem.path}
                onClick={() => setShowMobileMenu(false)}
                className="group flex items-center justify-between p-5 rounded-2xl hover:bg-white/5 active:scale-[0.98] transition-all border border-transparent hover:border-white/5"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gray-800 text-gray-300 shadow-lg ring-1 ring-white/5">
                    <i className={`${dashboardItem.icon} text-xl`}></i>
                  </div>
                  <div>
                    <span className="text-lg font-bold text-gray-200 tracking-tight group-hover:text-white transition-colors">{dashboardItem.label}</span>
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mt-1">Access Control</p>
                  </div>
                </div>
                <i className="ri-arrow-right-line text-xl text-gray-700 group-hover:text-white transition-colors"></i>
              </Link>
            )}
          </div>

          <div className="mt-auto pt-10 border-t border-gray-200 dark:border-white/5">
            {user ? (
              <div className="space-y-4">
                <Link
                  to="/profile"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-500/50 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <img
                        src={getOptimizedImageUrl(profile.avatar_url, 80, 80)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600 dark:bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold relative overflow-hidden">
                        <i className="ri-user-3-fill absolute text-2xl opacity-20 translate-y-1"></i>
                        <span className="relative z-10">{profile?.full_name?.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{profile?.full_name}</p>
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{profile?.role?.replace('_', ' ')}</p>
                  </div>
                </Link>

                <button
                  onClick={() => {
                    handleSignOut();
                    setShowMobileMenu(false);
                  }}
                  className="w-full py-5 bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold rounded-2xl uppercase tracking-wide text-xs flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-rose-500/20"
                >
                  <i className="ri-logout-box-line text-xl"></i>
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4 mt-4">
                <Link
                  to="/register"
                  onClick={() => setShowMobileMenu(false)}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
                >
                  Join Community
                </Link>
                <div className="text-center">
                  <span className="text-gray-400 text-xs font-medium">Already have an account?</span>
                  <Link
                    to="/login"
                    onClick={() => setShowMobileMenu(false)}
                    className="ml-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wide hover:underline"
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-8 text-center">
              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-700 uppercase tracking-widest">
                Campus Konnect
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* News Alert Toast */}
      {
        newsNotification && (
          <div className="fixed bottom-10 right-10 z-[100] animate-in slide-in-from-right-10 duration-500">
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-1 shadow-2xl shadow-blue-500/10 border border-gray-100 dark:border-gray-800 flex items-center gap-4 max-w-sm overflow-hidden group">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white flex-shrink-0 animate-pulse">
                <i className="ri-notification-3-line text-2xl"></i>
              </div>
              <div className="pr-12">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Breaking News Alert</p>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-2">
                  {newsNotification.title}
                </h4>
                <button
                  onClick={() => {
                    navigate(`/news/${newsNotification.id}`);
                    setNewsNotification(null);
                  }}
                  className="text-[10px] font-bold text-gray-400 hover:text-blue-600 uppercase tracking-wider flex items-center gap-1 transition-colors"
                >
                  Read Article <i className="ri-arrow-right-line"></i>
                </button>
              </div>
              <button
                onClick={() => setNewsNotification(null)}
                className="absolute top-4 right-4 text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
          </div>
        )
      }
    </nav >
  );
}
