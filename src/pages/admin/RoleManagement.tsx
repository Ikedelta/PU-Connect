import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
};

export default function RoleManagement() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'publishers' | 'admins'>('publishers');
  const [showAddPublisherModal, setShowAddPublisherModal] = useState(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newPublisherEmail, setNewPublisherEmail] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (!authLoading && profile?.role !== 'admin') {
      navigate('/');
    }
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewsPublisher = async () => {
    if (!newPublisherEmail.trim()) {
      setNotification({ type: 'error', message: 'Please enter an email address' });
      return;
    }

    try {
      const { data: user, error: findError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', newPublisherEmail.trim())
        .single();

      if (findError || !user) {
        setNotification({ type: 'error', message: 'User not found with this email address' });
        return;
      }

      if (user.role === 'news_publisher') {
        setNotification({ type: 'error', message: 'This user is already a News Publisher' });
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'news_publisher' })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await fetchUsers();
      setShowAddPublisherModal(false);
      setNewPublisherEmail('');
      setNotification({ type: 'success', message: 'News Publisher role assigned successfully!' });
    } catch (error) {
      console.error('Error adding news publisher:', error);
      setNotification({ type: 'error', message: 'Failed to assign News Publisher role' });
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) {
      setNotification({ type: 'error', message: 'Please enter an email address' });
      return;
    }

    try {
      const { data: user, error: findError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', newAdminEmail.trim())
        .single();

      if (findError || !user) {
        setNotification({ type: 'error', message: 'User not found with this email address' });
        return;
      }

      if (user.role === 'admin') {
        setNotification({ type: 'error', message: 'This user is already an Administrator' });
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await fetchUsers();
      setShowAddAdminModal(false);
      setNewAdminEmail('');
      setNotification({ type: 'success', message: 'Administrator role assigned successfully!' });
    } catch (error) {
      console.error('Error adding admin:', error);
      setNotification({ type: 'error', message: 'Failed to assign Administrator role' });
    }
  };

  const handleRemoveRole = async (userId: string, userName: string, currentRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'buyer' })
        .eq('id', userId);

      if (error) throw error;

      await fetchUsers();
      setNotification({ type: 'success', message: 'Role removed successfully' });
    } catch (error) {
      console.error('Error removing role:', error);
      setNotification({ type: 'error', message: 'Failed to remove role' });
    }
  };

  const newsPublishers = users.filter(u => u.role === 'news_publisher');
  const admins = users.filter(u => u.role === 'admin');

  const filteredPublishers = newsPublishers.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAdmins = admins.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-amber-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Access Control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-gray-950 transition-colors duration-300 pb-20 font-sans">
      <Navbar />

      {/* Floating Notification */}
      {notification && (
        <div className={`fixed top-24 right-4 md:right-8 z-50 animate-in fade-in slide-in-from-right-8 duration-300 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white' : 'bg-rose-500/90 border-rose-400/50 text-white'}`}>
          <i className={`${notification.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-xl`}></i>
          <span className="font-bold text-sm tracking-wide">{notification.message}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-widest border border-amber-200 dark:border-amber-800">
                System Security
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-[10px] font-bold uppercase tracking-widest border border-cyan-200 dark:border-cyan-800">
                Permissions
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
              Roles & Access
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Manage administrators and special permissions assignments.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddPublisherModal(true)}
              className="px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
            >
              <i className="ri-newspaper-line mr-2"></i>
              Add Publisher
            </button>
            <button
              onClick={() => setShowAddAdminModal(true)}
              className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 border border-transparent rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-black dark:hover:bg-gray-100 transition-colors shadow-lg shadow-gray-200/50 dark:shadow-none cursor-pointer"
            >
              <i className="ri-shield-user-line mr-2"></i>
              Add Admin
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          {[
            { label: 'Administrators', value: admins.length, icon: 'ri-shield-star-fill', color: 'bg-amber-500' },
            { label: 'News Publishers', value: newsPublishers.length, icon: 'ri-newspaper-fill', color: 'bg-cyan-500' },
            { label: 'Total Users', value: users.length, icon: 'ri-group-fill', color: 'bg-emerald-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-24 h-24 ${stat.color} opacity-[0.03] rounded-bl-full group-hover:scale-110 transition-transform`}></div>
              <div className={`w-10 h-10 rounded-xl ${stat.color} bg-opacity-10 flex items-center justify-center mb-3 text-${stat.color.replace('bg-', '')} group-hover:scale-110 transition-transform`}>
                <i className={`${stat.icon} text-lg ${stat.color.replace('bg-', 'text-')}`}></i>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">{stat.value}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tab Navigation & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="bg-white dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800 inline-flex shadow-sm">
            <button
              onClick={() => setActiveTab('admins')}
              className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'admins'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
              Admins
            </button>
            <button
              onClick={() => setActiveTab('publishers')}
              className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'publishers'
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
              Publishers
            </button>
          </div>

          <div className="flex-1 max-w-md relative">
            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeTab === 'admins' ? 'administrators' : 'news publishers'}...`}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-amber-500/20 font-medium text-sm text-gray-900 dark:text-white placeholder-gray-400 transition-all outline-none shadow-sm"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    User Profile
                  </th>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Current Role
                  </th>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Assigned On
                  </th>
                  <th className="px-8 py-5 text-right text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(activeTab === 'admins' ? filteredAdmins : filteredPublishers).map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm transition-transform group-hover:scale-110 ${activeTab === 'admins' ? 'bg-amber-500' : 'bg-cyan-500'}`}>
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{user.full_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      {activeTab === 'admins' ? (
                        <span className="px-3 py-1 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-full bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30">
                          Administrator
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-900/30">
                          News Publisher
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-right">
                      {user.id !== profile?.id ? (
                        <button
                          onClick={() => handleRemoveRole(user.id, user.full_name, user.role)}
                          className="text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          title="Remove Role"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 dark:text-gray-600">Current User</span>
                      )}
                    </td>
                  </tr>
                ))}

                {(activeTab === 'admins' ? filteredAdmins : filteredPublishers).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-24 text-center">
                      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-gray-700">
                        <i className={`${activeTab === 'admins' ? 'ri-shield-user-line' : 'ri-newspaper-line'} text-3xl text-gray-300 dark:text-gray-600`}></i>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No users found</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                        {activeTab === 'admins' ? 'No administrators active' : 'No news publishers active'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add News Publisher Modal */}
      {showAddPublisherModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl max-w-md w-full p-8 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Add Publisher</h3>
              <button
                onClick={() => {
                  setShowAddPublisherModal(false);
                  setNewPublisherEmail('');
                }}
                className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="mb-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                Enter the email address of the user you want to assign permissions to publish campus news.
              </p>

              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">
                User Email
              </label>
              <input
                type="email"
                value={newPublisherEmail}
                onChange={(e) => setNewPublisherEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-cyan-500/20 font-medium text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowAddPublisherModal(false);
                  setNewPublisherEmail('');
                }}
                className="flex-1 px-6 py-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNewsPublisher}
                className="flex-1 px-6 py-4 bg-cyan-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-cyan-700 transition-colors whitespace-nowrap cursor-pointer shadow-lg shadow-cyan-200 dark:shadow-none"
              >
                Add Publisher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl max-w-md w-full p-8 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Add Administrator</h3>
              <button
                onClick={() => {
                  setShowAddAdminModal(false);
                  setNewAdminEmail('');
                }}
                className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="mb-8">
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <i className="ri-shield-alert-line text-amber-600 text-xl flex-shrink-0 mt-0.5"></i>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400 mb-1">High Privilege Role</p>
                    <p className="text-xs text-amber-700 dark:text-amber-500/80 leading-relaxed">
                      Administrators have full access to manage users, products, news, and system usage.
                    </p>
                  </div>
                </div>
              </div>

              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">
                User Email
              </label>
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-amber-500/20 font-medium text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowAddAdminModal(false);
                  setNewAdminEmail('');
                }}
                className="flex-1 px-6 py-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAdmin}
                className="flex-1 px-6 py-4 bg-amber-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-amber-600 transition-colors whitespace-nowrap cursor-pointer shadow-lg shadow-amber-200 dark:shadow-none"
              >
                Add Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
