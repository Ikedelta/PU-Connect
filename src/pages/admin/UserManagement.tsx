import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

type User = {
  id: string;
  email: string;
  full_name: string;
  student_id: string | null;
  department: string | null;
  faculty: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default function UserManagement() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ role: '', department: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    if (!authLoading && profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      navigate('/marketplace');
    }
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      await fetchUsers();
      setOpenDropdown(null);
      alert(`User ${!currentStatus ? 'activated' : 'suspended'} successfully`);
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await fetchUsers();
      setOpenDropdown(null);
      alert('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    setEditData({
      role: user.role,
      department: user.department || '',
      phone: user.phone || ''
    });
    setShowEditModal(true);
    setOpenDropdown(null);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: editData.role,
          department: editData.department,
          phone: editData.phone
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      // Send SMS Notification if role changed
      if (selectedUser.role !== editData.role && editData.phone) {
        try {
          const { sendSMS } = await import('../../lib/arkesel');
          const firstName = selectedUser.full_name.split(' ')[0];
          const newRole = editData.role === 'news_publisher' ? 'News Publisher' :
            editData.role.charAt(0).toUpperCase() + editData.role.slice(1);

          await sendSMS(
            [editData.phone],
            `Hi ${firstName}, your account role on PU Connect has been updated to "${newRole}". You now have ${newRole} privileges. Login to access your dashboard.`
          );
        } catch (smsErr) {
          console.error('Failed to send role update SMS:', smsErr);
        }
      }

      await fetchUsers();
      setShowEditModal(false);
      setSelectedUser(null);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update user profile');
    } finally {
      setSaving(false);
    }
  };

  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportData = (category?: string) => {
    let usersToExport = users;

    if (category) {
      usersToExport = users.filter(u => u.role === category);
    }

    if (usersToExport.length === 0) {
      alert('No users found for this category');
      return;
    }

    const csvContent = [
      ['Email', 'Full Name', 'Department', 'Faculty', 'Role', 'Status', 'Created At'],
      ...usersToExport.map(user => [
        `"${user.email}"`,
        `"${user.full_name}"`,
        `"${user.department || ''}"`,
        `"${user.faculty || ''}"`,
        user.role,
        user.is_active ? 'Active' : 'Suspended',
        new Date(user.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pentvars-${category || 'all'}-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    setShowExportMenu(false);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.student_id && user.student_id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50/50 dark:bg-gray-950 transition-colors duration-300 pb-20 font-sans">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-widest border border-blue-200 dark:border-blue-800">
                System Admin
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase tracking-widest border border-purple-200 dark:border-purple-800">
                User Management
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
              Users
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Manage platform accounts, roles, and permissions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-5 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
            >
              <i className="ri-arrow-left-line mr-2"></i>
              Back to Dashboard
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 border border-transparent rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-black dark:hover:bg-gray-100 transition-colors shadow-lg shadow-gray-200/50 dark:shadow-none cursor-pointer flex items-center gap-2"
              >
                <i className="ri-download-line text-lg"></i>
                Export Data
                <i className={`ri-arrow-down-s-line transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
              </button>

              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 py-1 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => handleExportData()} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-blue-600 transition-colors flex items-center gap-2">
                      <i className="ri-database-2-line text-blue-500"></i> All Users
                    </button>
                    <button onClick={() => handleExportData('buyer')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-cyan-600 transition-colors flex items-center gap-2">
                      <i className="ri-shopping-bag-3-line text-cyan-500"></i> Buyers Only
                    </button>
                    <button onClick={() => handleExportData('seller')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-emerald-600 transition-colors flex items-center gap-2">
                      <i className="ri-store-2-line text-emerald-500"></i> Sellers Only
                    </button>
                    <button onClick={() => handleExportData('admin')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-amber-600 transition-colors flex items-center gap-2">
                      <i className="ri-shield-star-line text-amber-500"></i> Admins Only
                    </button>
                    <button onClick={() => handleExportData('news_publisher')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-purple-600 transition-colors flex items-center gap-2">
                      <i className="ri-newspaper-line text-purple-500"></i> Publishers Only
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 mb-8 border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                Search Users
              </label>
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, or ID..."
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 font-medium text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                Filter by Role
              </label>
              <div className="relative">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 font-medium text-sm text-gray-900 dark:text-white outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="all">All Roles</option>
                  <option value="buyer">Buyers</option>
                  <option value="seller">Sellers</option>
                  <option value="admin">Admins</option>
                  <option value="news_publisher">News Publishers</option>
                </select>
                <i className="ri-filter-3-line absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {[
            { label: 'Total Users', value: users.length, icon: 'ri-group-fill', color: 'bg-blue-500' },
            { label: 'Buyers', value: users.filter(u => u.role === 'buyer').length, icon: 'ri-shopping-bag-3-fill', color: 'bg-cyan-500' },
            { label: 'Sellers', value: users.filter(u => u.role === 'seller').length, icon: 'ri-store-3-fill', color: 'bg-emerald-500' },
            { label: 'Admins', value: users.filter(u => u.role === 'admin').length, icon: 'ri-shield-star-fill', color: 'bg-amber-500' },
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

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    User Profile
                  </th>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Academic Info
                  </th>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Role
                  </th>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Joined
                  </th>
                  <th className="px-8 py-5 text-right text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors group">
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-gray-900 dark:text-white">{user.full_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{user.department || '-'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{user.faculty}</div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-[10px] font-bold uppercase tracking-widest rounded-full border ${user.role === 'admin'
                        ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30'
                        : user.role === 'seller'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30'
                          : user.role === 'news_publisher'
                            ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30'
                            : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30'
                        }`}>
                        {user.role === 'news_publisher' ? 'News' : user.role}
                      </span>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${user.is_active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {user.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-xs font-medium text-gray-500 dark:text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-right text-sm font-medium relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <i className={`ri-more-2-fill text-xl ${openDropdown === user.id ? 'text-blue-600' : ''}`}></i>
                      </button>

                      {/* Dropdown Menu */}
                      {openDropdown === user.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10 cursor-default"
                            onClick={() => setOpenDropdown(null)}
                          ></div>
                          <div className="absolute right-8 top-12 mt-2 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 py-2 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                            <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-800 mb-1">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">User Actions</p>
                            </div>
                            <button
                              onClick={() => handleEditRole(user)}
                              className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 cursor-pointer transition-colors"
                            >
                              <i className="ri-shield-user-line text-lg text-blue-500"></i>
                              Edit Privileges
                            </button>
                            <button
                              onClick={() => handleToggleActive(user.id, user.is_active)}
                              className="w-full text-left px-4 py-3 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-3 cursor-pointer transition-colors"
                            >
                              <i className={`${user.is_active ? 'ri-prohibited-line text-amber-500' : 'ri-checkbox-circle-line text-emerald-500'} text-lg`}></i>
                              {user.is_active ? 'Suspend Account' : 'Activate Account'}
                            </button>
                            <div className="h-px bg-gray-50 dark:bg-gray-800 my-1"></div>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="w-full text-left px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-3 cursor-pointer transition-colors"
                            >
                              <i className="ri-delete-bin-line text-lg"></i>
                              Delete Permanently
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-24">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-user-search-line text-3xl text-gray-300 dark:text-gray-600"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No users found</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">Adjust filters to see results</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Role Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl max-w-md w-full p-8 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Access Control</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Update permissions</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center font-bold text-xl text-blue-600 shadow-sm">
                {selectedUser.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">{selectedUser.full_name}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{selectedUser.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 ml-1">
                  Department
                </label>
                <input
                  type="text"
                  value={editData.department}
                  onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 ml-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl text-gray-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  placeholder="e.g. 0540000000"
                />
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3 ml-1">
                Select System Role
              </label>
              <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto">
                {['buyer', 'seller', 'news_publisher', 'admin'].map((role) => (
                  <label key={role} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${editData.role === role
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                    }`}>
                    <input
                      type="radio"
                      name="role"
                      value={role}
                      checked={editData.role === role}
                      onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="block text-sm font-bold text-gray-900 dark:text-white capitalize">
                        {role.replace('_', ' ')}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-6 py-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="flex-1 px-6 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black dark:hover:bg-gray-100 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-lg"></i>
                    Saving...
                  </>
                ) : (
                  'Update Profile'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-24 right-4 md:right-8 z-50 animate-in fade-in slide-in-from-right-8 duration-300 px-6 py-4 rounded-2xl shadow-2xl border border-emerald-400/50 bg-emerald-500/90 text-white backdrop-blur-md flex items-center gap-3">
          <i className="ri-checkbox-circle-fill text-xl"></i>
          <div>
            <p className="font-bold text-sm tracking-wide">Success</p>
            <p className="text-xs opacity-90">User profile updated</p>
          </div>
        </div>
      )}
    </div>
  );
}