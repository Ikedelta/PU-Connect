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
  const [hasApplication, setHasApplication] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Realtime Presence Tracking
  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase.channel('online-users', {
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

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      navigate('/login');
    }
  };

  // Fetch unread message count and application status
  useEffect(() => {
    if (!user) return;

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

        // Check for seller application if user is a buyer
        if (profile?.role === 'buyer') {
          const { data: app, error: appError } = await supabase
            .from('seller_applications')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(); // Use maybeSingle to avoid 406 error if not found

          if (!appError && app) {
            setHasApplication(true);
          } else {
            setHasApplication(false);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
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
    if (profile?.role === 'super_admin') return { label: 'Admin Dashboard', path: '/admin', icon: 'ri-dashboard-line' };
    if (profile?.role === 'admin') return { label: 'Admin Dashboard', path: '/admin', icon: 'ri-dashboard-line' };
    if (profile?.role === 'news_publisher') return { label: 'Publisher Dashboard', path: '/publisher', icon: 'ri-article-line' };
    if (profile?.role === 'seller') return { label: 'Seller Dashboard', path: '/seller/dashboard', icon: 'ri-store-3-line' };

    // If buyer has pending/rejected application
    if (hasApplication) return { label: 'Application Status', path: '/seller/status', icon: 'ri-file-list-3-line' };

    return null; // Don't show anything for regular buyers
  };

  const dashboardItem = getDashboardItem();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      <div className={`absolute inset-0 transition-colors duration-500 ${showMobileMenu
        ? 'bg-transparent'
        : 'bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 shadow-sm'
        }`}></div>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 relative z-[60]">
        <div className="flex justify-between items-center h-20">
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-2 group relative z-10" onClick={() => setShowMobileMenu(false)}>
            <div className="h-8 w-auto md:h-10 flex items-center justify-center">
              <img
                src="/PU%20Connect%20logo.png"
                alt="PU Connect"
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
          <div className="flex items-center gap-6">
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-6">
              <Link
                to="/"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors"
              >
                Home
              </Link>
              <Link
                to="/marketplace"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors"
              >
                Marketplace
              </Link>
              <Link
                to="/news"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors"
              >
                News
              </Link>
              <Link
                to="/support"
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors"
              >
                Help Center
              </Link>
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-2"></div>
              {profile?.role === 'seller' || profile?.role === 'admin' || profile?.role === 'super_admin' ? (
                <Link
                  to="/seller/dashboard"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 active:scale-95 transition-all flex items-center gap-2"
                >
                  <i className="ri-dashboard-line text-lg"></i>
                  Seller Dashboard
                </Link>
              ) : (
                <Link
                  to="/seller/apply"
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 active:scale-95 transition-all flex items-center gap-2"
                >
                  <i className="ri-store-2-line text-lg"></i>
                  Become a Seller
                </Link>
              )}
            </div>

            {/* Auth/User Section */}
            <div className={`flex items-center gap-4 relative z-10 transition-all duration-300 ${showMobileMenu
              ? 'opacity-0 pointer-events-none translate-x-4 invisible'
              : 'opacity-100 pl-6 border-l border-gray-200 dark:border-gray-800'
              }`}>
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="Toggle Theme"
              >
                {theme === 'dark' ? (
                  <i className="ri-sun-line text-xl"></i>
                ) : (
                  <i className="ri-moon-line text-xl"></i>
                )}
              </button>

              {user ? (
                <div className="flex items-center gap-4">
                  <Link to="/messages" className="relative p-2 text-gray-400 hover:text-blue-600 dark:hover:text-white transition-colors">
                    <i className="ri-chat-3-line text-xl"></i>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white dark:ring-gray-900"></span>
                    )}
                  </Link>

                  {/* Profile Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-2"
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        {profile?.avatar_url ? (
                          <img
                            src={getOptimizedImageUrl(profile.avatar_url, 80, 80)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold relative overflow-hidden">
                            <i className="ri-user-3-fill absolute text-3xl opacity-20 translate-y-1"></i>
                            <span className="relative z-10">{profile?.full_name?.charAt(0).toUpperCase() || 'U'}</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Dropdown Menu */}
                    <div className={`absolute top-full right-0 mt-3 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-gray-200/20 dark:shadow-black/40 border border-gray-100 dark:border-gray-800 py-3 transition-all duration-200 origin-top-right z-50 overflow-hidden ${showDropdown ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                      <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 mb-2 bg-gray-50/50 dark:bg-gray-800/30">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{profile?.full_name}</p>
                        <p className="text-xs text-gray-500 truncate font-medium">{profile?.email}</p>
                      </div>

                      <div className="px-2">
                        {[
                          { label: 'My Profile', path: '/profile', icon: 'ri-user-smile-line' },
                          ...(dashboardItem ? [{ ...dashboardItem }] : []),
                          { label: 'Help Center', path: '/support', icon: 'ri-question-line' }
                        ].map((item) => (
                          <Link
                            key={item.label}
                            to={item.path}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                            onClick={() => setShowDropdown(false)}
                          >
                            <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              <i className={`${item.icon} text-lg`}></i>
                            </div>
                            {item.label}
                          </Link>
                        ))}
                      </div>

                      <div className="border-t border-gray-50 dark:border-gray-800/50 mt-2 pt-2 px-2">
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            handleSignOut();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 group-hover:text-red-600 transition-colors">
                            <i className="ri-logout-box-line text-lg"></i>
                          </div>
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-white transition-colors"
                  >
                    Log In
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

            </div>

            {/* Mobile Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`lg:hidden p-3 rounded-xl transition-all duration-300 relative z-[70] ${showMobileMenu
                ? 'text-white bg-white/10 hover:bg-white/20 shadow-lg'
                : 'text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
            >
              <i className={`ri-${showMobileMenu ? 'close' : 'menu-4'}-line text-2xl`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay - Cinematic Dark Theme */}
      <div className={`fixed inset-0 z-40 transition-all duration-500 ${showMobileMenu ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}>
        <div className="absolute inset-0 bg-gray-950/98 backdrop-blur-xl" />

        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className={`relative h-full flex flex-col p-8 pt-12 overflow-y-auto transition-transform duration-500 ease-out ${showMobileMenu ? 'translate-y-0' : '-translate-y-12'
          }`}>
          {/* Mobile Menu Header with Brand and Manual Close */}
          <div className="flex items-center justify-between mb-10 pl-2">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                <img src="/PU%20Connect%20logo.png" alt="PU Connect" className="w-8 h-8 object-contain brightness-0 invert" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white tracking-tight">PU Connect</h3>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Student Portal</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-4 pl-2">Navigation Terminal</p>
            {[
              { label: 'Home Terminal', path: '/', icon: 'ri-home-5-line', color: 'text-blue-400', bg: 'bg-blue-900/20' },
              { label: 'Marketplace', path: '/marketplace', icon: 'ri-compass-3-line', color: 'text-emerald-400', bg: 'bg-emerald-900/20' },
              { label: 'Campus News', path: '/news', icon: 'ri-newspaper-line', color: 'text-indigo-400', bg: 'bg-indigo-900/20' },
              { label: 'Help Center', path: '/support', icon: 'ri-customer-service-2-line', color: 'text-pink-400', bg: 'bg-pink-900/20' },
              {
                label: 'Become a Seller',
                path: user ? '/seller/apply' : '/seller/become',
                icon: 'ri-store-2-line',
                color: 'text-white',
                // Special Orange-Red Gradient for Mobile Item
                bg: 'bg-gradient-to-r from-orange-500 to-red-600 shadow-orange-900/20'
              },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.path}
                onClick={() => setShowMobileMenu(false)}
                className="group flex items-center justify-between p-5 rounded-2xl hover:bg-white/5 active:scale-[0.98] transition-all border border-transparent hover:border-white/5"
              >
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.bg} ${item.color} shadow-lg ring-1 ring-white/5`}>
                    <i className={`${item.icon} text-xl`}></i>
                  </div>
                  <span className={`text-lg font-bold tracking-tight transition-colors ${item.label === 'Become a Seller' ? 'bg-gradient-to-r from-orange-500 to-red-600 text-transparent bg-clip-text' : 'text-gray-200 group-hover:text-white'}`}>{item.label}</span>
                </div>
                <i className="ri-arrow-right-line text-xl text-gray-700 group-hover:text-white transition-colors"></i>
              </Link>
            ))}



            {user && dashboardItem && (
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

          <div className="mt-auto pt-10 border-t border-white/5">
            {user ? (
              <div className="space-y-4">
                <Link
                  to="/profile"
                  onClick={() => setShowMobileMenu(false)}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-900 border border-white/5 hover:border-blue-500/50 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <img
                        src={getOptimizedImageUrl(profile.avatar_url, 80, 80)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold relative overflow-hidden">
                        <i className="ri-user-3-fill absolute text-2xl opacity-20 translate-y-1"></i>
                        <span className="relative z-10">{profile?.full_name?.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{profile?.full_name}</p>
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
              <div className="grid grid-cols-2 gap-4">
                <Link
                  to="/login"
                  onClick={() => setShowMobileMenu(false)}
                  className="py-5 bg-white/5 text-white border border-white/10 font-bold rounded-2xl uppercase tracking-wide text-xs flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setShowMobileMenu(false)}
                  className="py-5 bg-blue-600 text-white font-bold rounded-2xl uppercase tracking-wide text-xs flex items-center justify-center shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                >
                  Join Network
                </Link>
              </div>
            )}

            <div className="mt-8 text-center">
              <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest">
                Pentecost University • PU Connect
              </p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
