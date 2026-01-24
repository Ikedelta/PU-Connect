import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Profile } from '../../lib/supabase';
import { useCreateConversation } from '../../hooks/useConversations';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';

import Navbar from '../../components/feature/Navbar';

type User = Profile;

export default function UserManagement() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();

  useEffect(() => {
    console.log('🛡️ UserManagement Component Mounted');
    console.log('👤 Current Profile:', profile);

    // Strict Access Control: Only Admins
    if (!authLoading && profile && profile.role !== 'admin' && profile.role !== 'super_admin') {
      console.warn('⛔ Access Denied: User is not an admin. Role:', profile.role);
      navigate('/dashboard'); // or /admin/dashboard, depending on their allowed area
      return;
    }
  }, [profile, authLoading, navigate]);

  const { mutate: createConversation } = useCreateConversation();

  const handleMessageUser = (userId: string) => {
    createConversation(
      { otherUserId: userId },
      {
        onSuccess: (conversationId) => {
          navigate(`/messages?conversationId=${conversationId}`);
        },
        onError: () => {
          alert('Failed to start conversation');
        }
      }
    );
  };

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const USERS_PER_PAGE = 20;

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Add User State
  const [newData, setNewData] = useState({
    email: '',
    password: '',
    fullName: '',
    department: '',
    faculty: '',
    phone: '',
    role: 'buyer'
  });

  // Expanded Edit Data State
  const [editData, setEditData] = useState({
    full_name: '',
    role: '',
    department: '',
    faculty: '',
    student_id: '',
    phone: '',
    email: '',
    created_at: '',
    last_sign_in_at: ''
  });

  const [saving, setSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Role check handled by ProtectedRoute

  // Debounced search/filter
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(0, true);
      fetchTotalCount();
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm, roleFilter]);

  useEffect(() => {
    // Profiles change subscription
    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          // Instead of fetching all, we might want to just refresh the current view
          // but for simplicity, we'll reload the first page if many changes happen
          // or just refresh the count.
          fetchTotalCount();
        }
      )
      .subscribe();

    // Presence subscription
    const presenceChannel = supabase.channel('online-presence');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = new Set<string>();
        Object.values(state).flat().forEach((p: any) => {
          if (p.id) onlineIds.add(p.id);
        });
        setOnlineUsers(onlineIds);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  const fetchTotalCount = async () => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');

    try {
      if (isBypass && secret) {
        const { data, error } = await supabase.rpc('admin_get_profiles_count', {
          secret_key: secret,
          p_search: searchTerm,
          p_role: roleFilter
        });
        if (!error && data !== null) setTotalCount(data);
      } else {
        let query = supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (roleFilter !== 'all') query = query.eq('role', roleFilter);
        if (searchTerm) query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);

        const { count, error } = await query;
        if (!error && count !== null) setTotalCount(count);
      }
    } catch (err) {
      console.error('Error fetching count:', err);
    }
  };

  const adminHideAllProducts = async (targetUserId: string) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');
    if (isBypass && secret) {
      const { error } = await supabase.rpc('admin_hide_all_products', { target_user_id: targetUserId, secret_key: secret });
      return { error };
    }
    return await supabase.from('products').update({ is_active: false }).eq('seller_id', targetUserId);
  };

  const fetchUsers = async (pageToFetch = 0, isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret');

      let query;

      if (isBypass && secret) {
        console.log('Using System Admin RPC for fetching users');
        query = supabase.rpc('admin_get_profiles', {
          secret_key: secret,
          p_limit: USERS_PER_PAGE,
          p_offset: pageToFetch * USERS_PER_PAGE,
          p_search: searchTerm,
          p_role: roleFilter
        });
      } else {
        let baseQuery = supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (roleFilter !== 'all') baseQuery = baseQuery.eq('role', roleFilter);
        if (searchTerm) {
          baseQuery = baseQuery.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`);
        }

        query = baseQuery.range(pageToFetch * USERS_PER_PAGE, (pageToFetch + 1) * USERS_PER_PAGE - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (isInitial) {
        setUsers(data || []);
      } else {
        setUsers(prev => [...prev, ...(data || [])]);
      }

      setHasMore((data || []).length === USERS_PER_PAGE);
      setPage(pageToFetch);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to load users. Please check your permissions.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchUsers(page + 1);
    }
  };

  // Helper for System Admin Bypass vs Standard Update
  const adminUpdateProfile = async (targetId: string, updates: any) => {
    const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
    const secret = localStorage.getItem('sys_admin_secret');

    if (isBypass && secret) {
      console.log('Using System Admin RPC for update');
      const { data, error } = await supabase.rpc('admin_update_profile', {
        target_id: targetId,
        new_data: updates,
        secret_key: secret
      });
      return { error };
    } else {
      return await supabase.from('profiles').update(updates).eq('id', targetId);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    // Optimistic Update
    setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
    if (selectedUser?.id === userId) {
      setSelectedUser(prev => prev ? { ...prev, is_active: !currentStatus } : null);
    }

    try {
      const { error } = await adminUpdateProfile(userId, { is_active: !currentStatus });

      if (error) {
        // Revert on error
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: currentStatus } : u));
        throw error;
      }

      await fetchUsers();
      setOpenDropdown(null);
      alert(`User ${!currentStatus ? 'activated' : 'suspended'} successfully`);
    } catch (error: any) {
      console.error('Error updating user status:', error);
      alert(`Failed to update user status: ${error.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === profile?.id) {
      alert("You cannot delete your own account.");
      return;
    }

    if (!confirm('Are you sure you want to PERMANENTLY delete this user? This will remove their profile AND their authentication account, allowing them to sign up again if needed. This action cannot be undone.')) {
      return;
    }

    const previousUsers = [...users];
    setUsers(users.filter(u => u.id !== userId));

    try {
      // Use RPC for reliable deletion
      const isBypass = localStorage.getItem('sys_admin_bypass') === 'true';
      const secret = localStorage.getItem('sys_admin_secret');

      const { data, error } = await supabase.rpc('admin_delete_user', {
        target_user_id: userId,
        secret_key: isBypass ? secret : null
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Failed to delete user');

      setOpenDropdown(null);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      setTotalCount(prev => prev - 1);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      setUsers(previousUsers); // Revert
      alert(`Failed to delete user: ${error.message || 'System error.'}`);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Create Account via Edge Function (Auto-confirms email)
      const { data: result, error: functionError } = await supabase.functions.invoke('register-user', {
        body: newData
      });

      if (functionError || !result?.success) {
        throw new Error(functionError?.message || result?.error || 'Failed to create account');
      }

      // If specialty role was selected, update it (register-user defaults to buyer)
      if (newData.role !== 'buyer') {
        const { error: roleError } = await adminUpdateProfile(result.userId, { role: newData.role }); // Use Helper Check
        if (roleError) console.error('Failed to update role:', roleError);
      }

      // Send welcome SMS
      if (newData.phone) {
        const { sendSMS } = await import('../../lib/arkesel');
        sendSMS([newData.phone], `Welcome to Campus Konnect, ${newData.fullName}! Your account has been successfully created. Browse the marketplace and connect with fellow students.`, 'welcome');
      }

      setShowAddModal(false);
      setNewData({
        email: '',
        password: '',
        fullName: '',
        department: '',
        faculty: '',
        phone: '',
        role: 'buyer'
      });
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      fetchUsers(0, true);
      fetchTotalCount();
    } catch (err: any) {
      console.error('Add User error:', err);
      alert(err.message || 'Failed to create user. Check if Edge Functions are enabled.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditRole = (user: User) => {
    setSelectedUser(user);
    setEditData({
      full_name: user.full_name,
      role: user.role,
      department: user.department || '',
      faculty: user.faculty || '',
      student_id: user.student_id || '',
      phone: user.phone || '',
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: (user as any).last_sign_in_at || ''
    });
    setShowEditModal(true);
    setOpenDropdown(null);
  };

  const handleHideAllProducts = async (userId: string) => {
    if (!window.confirm('This will deactivate all products listed by this user. Continue?')) return;
    setSaving(true);
    try {
      const { error } = await adminHideAllProducts(userId);
      if (error) throw error;
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
      alert('All products for this user have been hidden');
    } catch (err: any) {
      alert('Failed to hide products: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      // Optimistic Update
      setUsers(users.map(u => u.id === selectedUser.id ? {
        ...u,
        full_name: editData.full_name,
        role: editData.role as any,
        department: editData.department,
        faculty: editData.faculty,
        student_id: editData.student_id,
        phone: editData.phone
      } : u));

      const { error } = await adminUpdateProfile(selectedUser.id, {
        full_name: editData.full_name,
        role: editData.role,
        department: editData.department,
        faculty: editData.faculty,
        student_id: editData.student_id,
        phone: editData.phone
      });

      if (error) throw error;

      // Send SMS Notification
      if (selectedUser.role !== editData.role && editData.phone) {
        try {
          const { sendSMS } = await import('../../lib/arkesel');
          const firstName = (selectedUser.full_name || 'User').split(' ')[0];
          const smsMessage = `Hi ${firstName}, your role on Campus Connect has been updated to "${editData.role.replace('_', ' ')}".`;

          await sendSMS([editData.phone], smsMessage, 'role_update', { name: firstName, role: editData.role.replace('_', ' ') });
          setShowSuccessToast(true);
        } catch (smsErr: any) {
          console.error('Failed to send role update SMS:', smsErr);
          alert(`Role updated, but SMS failed: ${smsErr.message || 'Check Arkesel settings'}`);
        }
      }

      fetchUsers(0, true);
      setShowEditModal(false);
      setSelectedUser(null);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(`Failed to update user profile: ${error.message || 'Permission denied'}`);
    } finally {
      setSaving(false);
    }
  };

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    format: 'csv' as 'csv' | 'pdf',
    columns: {
      email: true,
      full_name: true,
      department: true,
      faculty: true,
      role: true,
      status: true,
      joined: true,
      phone: false
    }
  });

  const handleExport = async () => {
    let usersToExport = users;
    // Apply current filters if needed, or export all? usually export matches view
    if (roleFilter !== 'all') {
      usersToExport = users.filter(u => u.role === roleFilter);
    }

    // Filter by search
    if (searchTerm) {
      usersToExport = usersToExport.filter(u =>
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (usersToExport.length === 0) {
      alert('No data to export based on current filters.');
      return;
    }

    const headers: string[] = [];
    const keys: string[] = [];

    if (exportConfig.columns.full_name) { headers.push('Full Name'); keys.push('full_name'); }
    if (exportConfig.columns.email) { headers.push('Email'); keys.push('email'); }
    if (exportConfig.columns.phone) { headers.push('Phone'); keys.push('phone'); }
    if (exportConfig.columns.role) { headers.push('Role'); keys.push('role'); }
    if (exportConfig.columns.department) { headers.push('Department'); keys.push('department'); }
    if (exportConfig.columns.faculty) { headers.push('Faculty'); keys.push('faculty'); }
    if (exportConfig.columns.status) { headers.push('Status'); keys.push('is_active'); }
    if (exportConfig.columns.joined) { headers.push('Joined Date'); keys.push('created_at'); }

    if (exportConfig.format === 'csv') {
      const csvContent = [
        headers.join(','),
        ...usersToExport.map(user => keys.map(key => {
          let val = (user as any)[key];
          if (key === 'created_at') val = new Date(val).toLocaleDateString();
          if (key === 'is_active') val = val ? 'Active' : 'Suspended';
          if (val === null || val === undefined) val = '';
          return `"${val}"`;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } else {
      // PDF Export - Temporarily Disabled due to build issues
      /*
      try {
        const jsPDF = (await import('jspdf')).default;
        const autoTable = (await import('jspdf-autotable')).default;

        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('User Report', 14, 22);
        doc.setFontSize(11);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

        const tableData = usersToExport.map(user => keys.map(key => {
          let val = (user as any)[key];
          if (key === 'created_at') val = new Date(val).toLocaleDateString();
          if (key === 'is_active') val = val ? 'Active' : 'Suspended';
          if (val === null || val === undefined) val = '';
          return val;
        }));

        autoTable(doc, {
          head: [headers],
          body: tableData,
          startY: 40,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [37, 99, 235] } // Blue 600
        });

        doc.save(`users_export_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (err) {
        console.error('PDF Generation failed:', err);
        alert('Failed to generate PDF. Please ensure libraries are loaded.');
      }
      */
      alert('PDF Export is temporarily unavailable. Please use CSV export.');
    }
    setShowExportModal(false);
  };

  const filteredUsers = users;

  const isUserOnline = (user: User) => {
    if (!user || !user.id) return false;
    return onlineUsers.has(user.id);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 bg-african-pattern transition-colors duration-300 pb-20 font-sans relative overflow-hidden">
      <Navbar />

      <div className="pt-28 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-widest border border-blue-200 dark:border-blue-800">
                System Admin
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Users
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Manage platform accounts, permissions, and view user details ({totalCount} total)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
            >
              <i className="ri-arrow-left-line mr-2"></i>
              Dashboard
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wide hover:shadow-xl transition-all cursor-pointer flex items-center gap-2"
            >
              <i className="ri-user-add-line text-lg"></i>
              Add User
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportModal(true)}
                className="px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
              >
                <i className="ri-download-line text-lg"></i>
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl p-8 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">Export Data</h3>
                  <p className="text-sm text-slate-500 font-medium">Select columns and format</p>
                </div>
                <button onClick={() => setShowExportModal(false)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 block">Columns to Include</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(exportConfig.columns).map(([key, checked]) => (
                      <label key={key} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer select-none">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                          {checked && <i className="ri-check-line"></i>}
                        </div>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={checked}
                          onChange={() => setExportConfig(prev => ({
                            ...prev,
                            columns: { ...prev.columns, [key]: !checked }
                          }))}
                        />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 capitalize">{key.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 block">Export Format</label>
                  <div className="flex gap-4">
                    {['csv', 'pdf'].map(format => (
                      <button
                        key={format}
                        onClick={() => setExportConfig(prev => ({ ...prev, format: format as 'csv' | 'pdf' }))}
                        className={`flex-1 p-4 rounded-xl border-2 font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${exportConfig.format === format
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                          : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-300'
                          }`}
                      >
                        <i className={format === 'csv' ? 'ri-file-excel-2-line text-lg' : 'ri-file-pdf-line text-lg'}></i>
                        {format}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleExport}
                    className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                  >
                    Download Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mb-8 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users by name, email, or ID..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 font-medium text-sm text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500/20 font-medium text-sm text-slate-900 dark:text-white outline-none appearance-none cursor-pointer"
              >
                <option value="all">All Roles</option>
                <option value="buyer">Buyers</option>
                <option value="seller">Sellers</option>
                <option value="publisher_seller">Publisher & Seller</option>
                <option value="admin">Admins</option>
              </select>
              <i className="ri-filter-3-line absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">User Profile</th>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Status</th>
                  <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Role</th>
                  <th className="px-8 py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredUsers.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-slate-500 font-medium">
                      No users found matching your filters.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <i className="ri-loader-4-line text-4xl text-blue-500 animate-spin"></i>
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Hydrating User Data...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredUsers.map((user) => {
                      if (!user || !user.id) return null;
                      const online = isUserOnline(user);
                      const safeName = user.full_name || 'Unnamed User';
                      const safeEmail = user.email || 'No email';

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => handleEditRole(user)}>
                              <div className="relative">
                                {user.avatar_url ? (
                                  <img
                                    src={user.avatar_url}
                                    alt=""
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-slate-700"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 relative overflow-hidden">
                                    <i className="ri-user-3-fill absolute text-3xl opacity-10 translate-y-1"></i>
                                    <span className="relative z-10">{safeName.charAt(0).toUpperCase()}</span>
                                  </div>
                                )}
                                {online && (
                                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-slate-900 dark:text-white">{safeName}</div>
                                <div className="text-xs text-slate-500">{safeEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide w-fit ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                {user.is_active ? 'Active' : 'Suspended'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {online ? 'Online Now' : 'Offline'}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-4">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-600">
                              {user.role}
                            </span>
                          </td>
                          <td className="px-8 py-4 text-right">
                            <button
                              onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                              <i className="ri-more-2-fill text-xl"></i>
                            </button>
                            {/* Dropdown */}
                            {openDropdown === user.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)}></div>
                                <div className="absolute right-8 mt-2 w-48 bg-white dark:bg-slate-800 shadow-xl rounded-xl z-20 border border-slate-100 dark:border-slate-700 py-1 text-left">
                                  <button onClick={() => handleMessageUser(user.id)} className="block w-full text-left px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">Message User</button>
                                  <button onClick={() => handleEditRole(user)} className="block w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700">View Details / Edit</button>
                                  <button onClick={() => handleDeleteUser(user.id)} className="block w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">Delete User</button>
                                </div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {hasMore && searchTerm === '' && roleFilter === 'all' && (
                      <tr>
                        <td colSpan={4} className="px-8 py-8 text-center">
                          <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            className="px-6 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                          >
                            {loadingMore ? (
                              <span className="flex items-center gap-2">
                                <i className="ri-loader-4-line animate-spin"></i>
                                Loading...
                              </span>
                            ) : 'Load More Users'}
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View/Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto outline-none border border-slate-100 dark:border-slate-800 flex flex-col">

            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">User Details</h3>
                <p className="text-sm text-slate-500 font-medium">View and manage user profile information</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-8">

              {/* Read-Only Info Card */}
              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-3xl font-bold text-slate-300 uppercase shrink-0 relative overflow-hidden">
                  {selectedUser.avatar_url ? (
                    <img
                      src={getOptimizedImageUrl(selectedUser.avatar_url, 160, 160)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <i className="ri-user-3-fill absolute text-[8rem] opacity-5 translate-y-4"></i>
                      <span className="relative z-10 text-slate-400">{(editData.full_name || 'U').charAt(0)}</span>
                    </>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left space-y-2 w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">User ID</p>
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate w-full" title={selectedUser.id}>{selectedUser.id}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Email Address</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{editData.email}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Joined On</p>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{new Date(editData.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${selectedUser.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {selectedUser.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-6">
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Profile Information</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Full Name</label>
                    <input
                      type="text"
                      value={editData.full_name}
                      onChange={e => setEditData({ ...editData, full_name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Phone Number</label>
                    <input
                      type="tel"
                      value={editData.phone}
                      onChange={e => setEditData({ ...editData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Student ID</label>
                    <input
                      type="text"
                      value={editData.student_id}
                      onChange={e => setEditData({ ...editData, student_id: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Department</label>
                    <input
                      type="text"
                      value={editData.department}
                      onChange={e => setEditData({ ...editData, department: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2 mb-4">Role Assignment</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['buyer', 'seller', 'news_publisher', 'publisher_seller', 'admin'].map(role => (
                    <div
                      key={role}
                      onClick={() => setEditData({ ...editData, role: role as any })} // Explicitly cast role
                      className={`cursor-pointer px-4 py-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center ${editData.role === role
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'
                        }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${editData.role === role ? 'border-blue-500' : 'border-slate-300'
                        }`}>
                        {editData.role === role && <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>}
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{role.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Account Management Actions */}
              <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                  <i className="ri-shield-flash-line text-rose-500"></i>
                  Account Management
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleMessageUser(selectedUser.id)}
                    className="flex items-center justify-center gap-3 p-5 rounded-2xl border-2 border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/10 dark:border-blue-900/20 transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
                  >
                    <i className="ri-chat-3-line text-lg"></i>
                    Send Message
                  </button>

                  <button
                    onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active)}
                    className={`flex items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all font-bold text-xs uppercase tracking-widest active:scale-95 ${selectedUser.is_active
                      ? 'border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/10 dark:border-amber-900/20'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/20'
                      }`}
                  >
                    <i className={selectedUser.is_active ? 'ri-user-forbid-line text-lg' : 'ri-user-follow-line text-lg'}></i>
                    {selectedUser.is_active ? 'Suspend Account' : 'Activate Account'}
                  </button>

                  <button
                    onClick={() => handleHideAllProducts(selectedUser.id)}
                    className="flex items-center justify-center gap-3 p-5 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
                  >
                    <i className="ri-eye-off-line text-lg"></i>
                    Hide products
                  </button>

                  <button
                    onClick={async () => {
                      await handleDeleteUser(selectedUser.id);
                      setShowEditModal(false);
                    }}
                    className="flex items-center justify-center gap-3 p-5 rounded-2xl border-2 border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20 transition-all font-bold text-xs uppercase tracking-widest active:scale-95"
                  >
                    <i className="ri-delete-bin-line text-lg"></i>
                    Delete Profile
                  </button>
                </div>

                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed px-1">
                  <i className="ri-information-line mr-1 text-blue-500"></i>
                  Suspending blocks access while keeping data. Deleting permanently removes the profile.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-4 sticky bottom-0 bg-white dark:bg-slate-900 z-10">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="flex-[2] py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
              >
                {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto outline-none border border-slate-100 dark:border-slate-800 flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Create User</h3>
                <p className="text-sm text-slate-500 font-medium">Add a new user to the platform (Auto-confirm email)</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Full Name</label>
                  <input
                    required
                    type="text"
                    value={newData.fullName}
                    onChange={e => setNewData({ ...newData, fullName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Email Address</label>
                  <input
                    required
                    type="email"
                    value={newData.email}
                    onChange={e => setNewData({ ...newData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Password</label>
                  <input
                    required
                    type="password"
                    value={newData.password}
                    onChange={e => setNewData({ ...newData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Phone Number</label>
                  <input
                    required
                    type="tel"
                    value={newData.phone}
                    onChange={e => setNewData({ ...newData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    placeholder="024XXXXXXX"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Faculty</label>
                  <select
                    required
                    value={newData.faculty}
                    onChange={e => setNewData({ ...newData, faculty: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                  >
                    <option value="">Select Faculty</option>
                    <option value="Faculty of Business">Faculty of Business</option>
                    <option value="Faculty of Science & Computing">Faculty of Science & Computing</option>
                    <option value="Faculty of Nursing & Midwifery">Faculty of Nursing & Midwifery</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">Department</label>
                  <input
                    type="text"
                    value={newData.department}
                    onChange={e => setNewData({ ...newData, department: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500/50 outline-none font-medium"
                    placeholder="e.g. IT"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-4 block">Initial Role</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['buyer', 'seller', 'admin', 'news_publisher'].map(role => (
                    <div
                      key={role}
                      onClick={() => setNewData({ ...newData, role })}
                      className={`cursor-pointer px-4 py-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center ${newData.role === role ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800'}`}
                    >
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 capitalize">{role.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {saving ? <i className="ri-loader-4-line animate-spin text-lg"></i> : <i className="ri-user-add-line text-lg"></i>}
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed top-24 right-4 z-50 animate-bounce px-6 py-4 rounded-2xl bg-emerald-500 text-white shadow-xl flex items-center gap-3">
          <i className="ri-checkbox-circle-fill text-xl"></i>
          <span className="font-bold">Profile Updated!</span>
        </div>
      )}
    </div>
  );
}