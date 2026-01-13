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
    if (profile?.role === 'super_admin') return { label: 'Admin Dashboard', path: '/admin/super-admins', icon: 'ri-dashboard-line' };
    if (profile?.role === 'admin') return { label: 'Admin Dashboard', path: '/admin', icon: 'ri-dashboard-line' };
    if (profile?.role === 'news_publisher') return { label: 'Publisher Dashboard', path: '/publisher', icon: 'ri-article-line' };
    if (profile?.role === 'seller') return { label: 'Seller Dashboard', path: '/seller/dashboard', icon: 'ri-store-3-line' };

    // If buyer has pending/rejected application
    if (hasApplication) return { label: 'Application Status', path: '/seller/status', icon: 'ri-file-list-3-line' };

    return null; // Don't show anything for regular buyers
  };

  const dashboardItem = getDashboardItem();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-500">
      <div className="absolute inset-0 bg-white/80 dark:bg-gray-950/80 backdrop-blur-2xl border-b border-gray-100/50 dark:border-gray-800/50"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 relative">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-3 group relative z-10 transition-transform active:scale-95">
            {/* Logo Image - Enhanced Size */}
            <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
              <img
                src="/PU%20Connect%20logo.png"
                alt="PU Connect"
                className="w-full h-full object-contain drop-shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('bg-blue-600', 'rounded-xl', 'text-white');
                  e.currentTarget.parentElement!.innerHTML = '<i class="ri-store-3-fill text-2xl"></i>';
                }}
              />
            </div>
          </Link>

          {/* Right Side Actions (Nav + Auth) */}
          <div className="flex items-center gap-8 md:gap-12">
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              <Link
                to="/marketplace"
                className="group flex items-center gap-2 text-[12px] font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all tracking-wide uppercase relative py-1"
              >
                <i className="ri-compass-3-line text-lg group-hover:text-blue-600 transition-colors"></i>
                Marketplace
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link
                to="/news"
                className="group flex items-center gap-2 text-[12px] font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all tracking-wide uppercase relative py-1"
              >
                <i className="ri-newspaper-line text-lg group-hover:text-blue-600 transition-colors"></i>
                Campus News
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link
                to="/support"
                className="group flex items-center gap-2 text-[12px] font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all tracking-wide uppercase relative py-1"
              >
                <i className="ri-customer-service-2-line text-lg group-hover:text-blue-600 transition-colors"></i>
                Help Center
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link
                to="/seller/apply"
                className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 active:scale-95 transition-all"
              >
                <i className="ri-store-2-line text-lg"></i>
                Become a Seller
              </Link>
            </div>

            {/* Auth/User Section */}
            <div className="flex items-center gap-4 md:gap-6 relative z-10">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Toggle Theme"
              >
                {theme === 'dark' ? (
                  <i className="ri-sun-line text-xl text-yellow-400"></i>
                ) : (
                  <i className="ri-moon-line text-xl text-gray-600 dark:text-gray-400"></i>
                )}
              </button>

              {user && (
                <div className="hidden lg:flex" />
              )}

              {user ? (
                <div className="flex items-center gap-4 md:gap-6">
                  {/* ... user controls ... */}
                  <Link to="/messages" className="hidden lg:flex relative group p-3 bg-gray-50 dark:bg-white/5 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                    <i className="ri-chat-3-line text-xl md:text-2xl text-gray-900 dark:text-white group-hover:text-blue-600"></i>
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full ring-4 ring-white dark:ring-gray-900"></span>
                    )}
                  </Link>

                  {/* RESTORED: Admin Setup Link */}
                  {(!profile?.role || ['admin', 'super_admin'].includes(profile.role)) && (
                    <Link to="/admin/setup" className="hidden lg:flex relative group p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all" title="Grant Admin Access">
                      <i className="ri-shield-keyhole-line text-xl md:text-2xl text-purple-900 dark:text-purple-300"></i>
                    </Link>
                  )}

                  {/* Profile Dropdown - Hidden on Mobile to fix responsiveness */}
                  <div className="relative hidden lg:block" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-3 p-1.5 pr-4 bg-gray-50 dark:bg-white/5 rounded-full hover:bg-white dark:hover:bg-gray-800 hover:shadow-xl transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-700 cursor-pointer"
                    >
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-lg">
                        <img
                          src={getOptimizedImageUrl(profile?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200", 80, 80)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <i className={`ri-arrow-down-s-line text-lg text-gray-400 transition-transform duration-300 ${showDropdown ? 'rotate-180' : ''}`}></i>
                    </button>

                    <div className={`absolute top-full right-0 mt-4 w-60 md:w-72 max-w-[90vw] bg-white dark:bg-gray-900 rounded-[1.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-800 p-3 transition-all duration-300 origin-top-right z-50 ${showDropdown ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-4 invisible'
                      }`}>
                      <div className="p-4 mb-2 border-b border-gray-50 dark:border-gray-800">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">User Account</p>
                        <p className="text-base font-bold text-gray-900 dark:text-white truncate tracking-tight">{profile?.full_name}</p>
                      </div>

                      <div className="space-y-1">
                        {[
                          { label: 'My Settings', path: '/profile', icon: 'ri-user-settings-line' },
                          // Only spread dashboardItem if it exists
                          ...(dashboardItem ? [dashboardItem] : []),
                          { label: 'Help Center', path: '/support', icon: 'ri-customer-service-2-line' },
                          { label: 'Saved Products', path: '/profile#favorites', icon: 'ri-heart-line' }
                        ].map((item) => (
                          <Link
                            key={item.label}
                            to={item.path}
                            className="flex items-center gap-4 p-4 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-all tracking-tight"
                            onClick={() => setShowDropdown(false)}
                          >
                            <i className={`${item.icon} text-xl`}></i>
                            {item.label}
                          </Link>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            handleSignOut();
                          }}
                          className="w-full flex items-center gap-4 p-4 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all mt-2 cursor-pointer uppercase tracking-wide"
                        >
                          <i className="ri-logout-circle-line text-xl"></i>
                          Secure Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hidden lg:flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-6 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-all uppercase tracking-wide"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[10px] font-bold rounded-lg hover:bg-blue-600 dark:hover:bg-gray-200 shadow-lg shadow-gray-200 dark:shadow-none transition-all active:scale-95 uppercase tracking-wide"
                  >
                    Register
                  </Link>
                </div>
              )}

              {/* Mobile Toggle */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-900 dark:text-white hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
              >
                <i className={`ri-${showMobileMenu ? 'close' : 'menu-4'}-line text-2xl`}></i>
              </button>
            </div>
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

        <div className={`relative h-full flex flex-col p-8 pt-32 overflow-y-auto transition-transform duration-500 ease-out ${showMobileMenu ? 'translate-y-0' : '-translate-y-12'
          }`}>
          <div className="space-y-2">
            {/* Mobile Menu Logo */}
            <div className="flex items-center gap-4 mb-10 pl-2">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                <img src="/PU%20Connect%20logo.png" alt="PU Connect" className="w-12 h-12 object-contain brightness-0 invert" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white tracking-tight">PU Connect</h3>
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Student Portal</p>
              </div>
            </div>

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

            {/* RESTORED: Mobile Admin Setup Link */}
            {user && (!profile?.role || ['admin', 'super_admin'].includes(profile.role)) && (
              <Link
                to="/admin/setup"
                onClick={() => setShowMobileMenu(false)}
                className="group flex items-center justify-between p-5 rounded-2xl hover:bg-white/5 active:scale-[0.98] transition-all border border-transparent hover:border-white/5"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-purple-900/20 text-purple-400 shadow-lg ring-1 ring-white/5">
                    <i className="ri-shield-keyhole-line text-xl"></i>
                  </div>
                  <span className="text-lg font-bold text-gray-200 tracking-tight group-hover:text-white transition-colors">Admin Access</span>
                </div>
                <i className="ri-arrow-right-line text-xl text-gray-700 group-hover:text-white transition-colors"></i>
              </Link>
            )}

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
                  <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden">
                    <img
                      src={getOptimizedImageUrl(profile?.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200", 80, 80)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
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
