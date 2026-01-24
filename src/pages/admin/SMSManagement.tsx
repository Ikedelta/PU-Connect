import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

type User = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  faculty?: string; // Added faculty
};

type ScheduledSMS = {
  id: string;
  recipients: string[];
  message: string;
  scheduled_at: string;
  status: string;
  created_at: string;
};

type SMSHistoryItem = {
  id: string;
  created_at: string;
  action_details: {
    message: string;
    recipient_count: number;
    sent_at: string;
  };
  user?: {
    full_name: string;
  };
};

const SMS_TEMPLATES = [
  { title: 'Meeting Reminder', text: 'Reminder: All staff meeting tomorrow at 10 AM at the main hall.' },
  { title: 'Maintenance Alert', text: 'System Alert: Campus Konnect will undergoing scheduled maintenance tonight from 11 PM to 4 AM.' },
  { title: 'Welcome Message', text: 'Welcome to Campus Konnect! We are glad to have you on board.' },
  { title: 'Application Update', text: 'Update: Your seller application status has changed. Please check your dashboard.' },
];

export default function SMSManagement() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Filters
  const [filterRole, setFilterRole] = useState<'all' | 'buyer' | 'seller'>('all'); // Renamed for clarity vs DB values
  const [filterFaculty, setFilterFaculty] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [activeTab, setActiveTab] = useState<'compose' | 'scheduled' | 'history' | 'topups'>('compose');
  const [scheduledSMS, setScheduledSMS] = useState<ScheduledSMS[]>([]);
  const [smsHistory, setSmsHistory] = useState<SMSHistoryItem[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');

  const [smsBalance, setSmsBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buyingUnits, setBuyingUnits] = useState(false);
  const [topupHistory, setTopupHistory] = useState<any[]>([]);

  const SMS_PACKAGES = [
    { units: 500, price: 15, label: 'Sprint', icon: 'ri-flashlight-line', type: 'no-expiry' },
    { units: 1500, price: 40, label: 'Velocity', icon: 'ri-rocket-line', type: 'no-expiry' },
    { units: 3500, price: 90, label: 'Altitude', icon: 'ri-medal-line', type: 'no-expiry' },
    { units: 10000, price: 250, label: 'Orbital', icon: 'ri-crown-line', type: 'no-expiry' },
    { units: 20000, price: 450, label: 'Galactic', icon: 'ri-rocket-2-fill', type: 'monthly' }
  ];

  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      navigate('/marketplace');
      return;
    }
    fetchUsers();
    fetchScheduledSMS();
    fetchHistory();
    fetchBalance();
    fetchTopupHistory();
  }, [profile, navigate]);

  const fetchBalance = async () => {
    setIsLoadingBalance(true);
    try {
      // Import once at the top to make it faster
      const { getSMSBalance } = await import('../../lib/arkesel');
      // Parallelize nothing, just fetch. Arkesel is fast, the import/init is the slow part.
      const balance = await getSMSBalance();
      setSmsBalance(balance);
    } catch (err) {
      console.error('Failed to fetch SMS balance', err);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, phone, faculty')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchScheduledSMS = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_sms')
        .select('*')
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setScheduledSMS(data || []);
    } catch (error) {
      console.error('Error fetching scheduled SMS:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          id,
          created_at,
          action_details,
          user:user_id ( full_name )
        `)
        .eq('action_type', 'sms_sent') // Corrected to action_type
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSmsHistory(data as any || []);
    } catch (error) {
      console.error('Error fetching SMS history:', error);
    }
  };

  const fetchTopupHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_topups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTopupHistory(data || []);
    } catch (error) {
      console.error('Error fetching topup history:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id));
    }
  };

  const handleSelectUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleSendSMS = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    setSending(true);

    try {
      const uniqueRecipients = new Set(
        users
          .filter(u => selectedUsers.includes(u.id) && (u as any).phone)
          .map(u => (u as any).phone)
      );
      const recipients = Array.from(uniqueRecipients);

      if (recipients.length === 0) {
        throw new Error('Selected users do not have valid phone numbers');
      }

      if (scheduledAt) {
        // Schedule Request
        const { error } = await supabase.from('scheduled_sms').insert({
          recipients: recipients,
          message: message,
          scheduled_at: new Date(scheduledAt).toISOString(),
          status: 'pending',
          created_by: profile?.id
        });

        if (error) throw error;

        alert(`Message scheduled for ${new Date(scheduledAt).toLocaleString()}!`);
        setScheduledAt('');
        fetchScheduledSMS();
      } else {
        // Instant Send
        await import('../../lib/arkesel').then(({ sendSMS }) => {
          return sendSMS(recipients, message);
        });

        // Correct log entry
        await supabase.from('activity_logs').insert({
          user_id: profile?.id, // Admin sent it
          action_type: 'sms_sent',
          action_details: {
            message: message,
            recipient_count: recipients.length,
            sent_at: new Date().toISOString(),
          },
        });

        // Update balance
        fetchBalance();
        fetchHistory(); // Refresh history

        alert(`SMS sent successfully to ${recipients.length} user(s)!`);
      }

      // Reset Form part
      setMessage('');
      setSelectedUsers([]);

    } catch (error: any) {
      console.error('SMS Error:', error);
      alert(error.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteScheduled = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled message?')) return;

    try {
      const { error } = await supabase
        .from('scheduled_sms')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchScheduledSMS();
    } catch (error: any) {
      alert('Failed to delete: ' + error.message);
    }
  };

  const handlePurchaseSMS = async (pkg: typeof SMS_PACKAGES[0]) => {
    setBuyingUnits(true);
    try {
      const { data, error } = await supabase.functions.invoke('initialize-paystack-payment', {
        body: {
          email: profile?.email,
          amount: pkg.price,
          metadata: {
            type: 'sms_topup',
            units: pkg.units,
            admin_id: profile?.id
          }
        }
      });

      if (error) throw error;

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err: any) {
      console.error('Purchase initialization failed:', err);
      alert(err.message || 'Failed to initialize payment');
    } finally {
      setBuyingUnits(false);
    }
  };

  // Unique faculties for filter
  const faculties = Array.from(new Set(users.map(u => u.faculty).filter(Boolean)));

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole =
      filterRole === 'all' ||
      user.role === filterRole;

    const matchesFaculty =
      filterFaculty === 'all' ||
      user.faculty === filterFaculty;

    return matchesSearch && matchesRole && matchesFaculty;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 font-sans">
      <Navbar />

      <div className="pt-28 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">SMS Console</h1>
            <p className="text-slate-500 font-medium">Broadcast System & Engagement</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Improved Balance Card */}
            <div className="bg-white dark:bg-slate-800 px-6 py-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center text-xl">
                <i className="ri-coins-line"></i>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SMS Balance</div>
                {isLoadingBalance ? (
                  <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                ) : (
                  <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                    {smsBalance.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">UNITS</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowBuyModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-3xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/25 active:scale-95 flex items-center gap-3"
            >
              <i className="ri-add-circle-line text-lg"></i>
              Top Up Credits
            </button>

            <button
              onClick={() => navigate('/admin/dashboard')}
              className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center justify-center"
              title="Back to Dashboard"
            >
              <i className="ri-arrow-left-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-200/50 dark:bg-slate-800 p-1 rounded-xl w-fit mb-6 overflow-x-auto">
          {[
            { id: 'compose', label: 'Compose', icon: 'ri-edit-box-line' },
            { id: 'scheduled', label: `Scheduled (${scheduledSMS.length})`, icon: 'ri-calendar-event-line' },
            { id: 'history', label: 'Sent History', icon: 'ri-history-line' },
            { id: 'topups', label: 'Topup History', icon: 'ri-bank-card-line' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
            >
              <i className={tab.icon}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'compose' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Selection */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col h-[600px]">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Select Recipients</h2>

                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    <div className="relative">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search users..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm outline-none dark:text-white"
                      />
                    </div>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value as any)}
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer outline-none dark:text-white"
                    >
                      <option value="all">All Roles</option>
                      <option value="buyer">Buyers Only</option>
                      <option value="seller">Sellers Only</option>
                    </select>
                    <select
                      value={filterFaculty}
                      onChange={(e) => setFilterFaculty(e.target.value)}
                      className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer outline-none dark:text-white"
                    >
                      <option value="all">All Faculties</option>
                      {faculties.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  {/* Select All */}
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onChange={handleSelectAll}
                        className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        Select All ({filteredUsers.length})
                      </span>
                    </label>
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {selectedUsers.length} selected
                    </span>
                  </div>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                  {filteredUsers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <i className="ri-user-search-line text-5xl text-slate-300 mb-4"></i>
                      <p className="text-slate-500 font-medium">No users found matching your criteria</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredUsers.map((user) => (
                        <label
                          key={user.id}
                          className={`flex items-center space-x-4 p-3 rounded-xl cursor-pointer transition-all ${selectedUsers.includes(user.id)
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => handleSelectUser(user.id)}
                            className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {user.full_name}
                              </p>
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-md border ${user.role === 'seller' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                                }`}>
                                {user.role}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
                              <span>{user.email}</span>
                              {user.faculty && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                  <span className="text-slate-500">{user.faculty}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Message Composer */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sticky top-28 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Compose Message</h2>

                {/* Templates */}
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Quick Templates</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {SMS_TEMPLATES.map((tpl, i) => (
                      <button
                        key={i}
                        onClick={() => setMessage(tpl.text)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap transition-colors"
                      >
                        {tpl.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                    Message Content
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    maxLength={160}
                    placeholder="Type your broadcast message..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm font-medium dark:text-white"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">1 credit per SMS</p>
                    <p className={`text-xs font-bold ${message.length > 150 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {message.length}/160
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center justify-between">
                    <span>Schedule Delivery (Optional)</span>
                    {scheduledAt && (
                      <button onClick={() => setScheduledAt('')} className="text-[10px] text-rose-500 hover:underline uppercase">Clear</button>
                    )}
                  </label>
                  <div className="relative">
                    <i className="ri-calendar-event-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-medium outline-none ${scheduledAt ? 'text-blue-600' : 'text-slate-500'
                        }`}
                    />
                  </div>
                </div>

                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 font-bold uppercase">Recipients:</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{selectedUsers.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-bold uppercase">Est. Cost:</span>
                    <span className="text-sm font-black text-blue-600">
                      {selectedUsers.length} CREDITS
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSendSMS}
                  disabled={sending || selectedUsers.length === 0 || !message.trim()}
                  className={`w-full px-6 py-4 rounded-xl text-white font-bold text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1 ${scheduledAt ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-gradient-to-r from-blue-600 to-cyan-600'
                    }`}
                >
                  {sending ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className={`${scheduledAt ? 'ri-calendar-check-fill' : 'ri-send-plane-fill'} mr-2`}></i>
                      {scheduledAt ? 'Schedule Message' : 'Send Campaign'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'scheduled' ? (
          // SCHEDULED TAB
          <div className="space-y-6">
            {scheduledSMS.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-calendar-todo-line text-4xl text-slate-300 dark:text-slate-500"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Scheduled Messages</h3>
                <p className="text-slate-500 font-medium max-w-sm mx-auto">Messages scheduled for later delivery will appear here. You can cancel them any time before delivery.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scheduledSMS.map((item) => (
                  <div key={item.id} className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-all relative group overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full -mr-4 -mt-4"></div>

                    <div className="flex items-start justify-between mb-4 relative z-10">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md border ${item.status === 'pending' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                        item.status === 'sent' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                        }`}>
                        {item.status}
                      </span>
                      <button
                        onClick={() => handleDeleteScheduled(item.id)}
                        className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                        title="Cancel Schedule"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>

                    <div className="mb-4">
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Scheduled For</div>
                      <div className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                        {new Date(item.scheduled_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm font-medium text-purple-600">
                        {new Date(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl mb-4 text-sm text-slate-600 dark:text-slate-300 italic border-l-2 border-purple-400">
                      "{item.message}"
                    </div>

                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wide">
                      <span><i className="ri-group-fill mr-1 text-slate-300"></i> {item.recipients.length} Recipient(s)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'topups' ? (
          // TOPUP HISTORY TAB
          <div className="space-y-6">
            {topupHistory.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-bank-card-line text-4xl text-slate-300 dark:text-slate-500"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Purchase History</h3>
                <p className="text-slate-500 font-medium max-w-sm mx-auto">SMS credit purchases will be tracked here for your reference.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="p-6">Date</th>
                        <th className="p-6">Package</th>
                        <th className="p-6">Amount</th>
                        <th className="p-6">Reference</th>
                        <th className="p-6">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topupHistory.map((topup) => (
                        <tr key={topup.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="p-6 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {new Date(topup.created_at).toLocaleString()}
                          </td>
                          <td className="p-6 text-sm font-black text-slate-900 dark:text-white">
                            {topup.units.toLocaleString()} UNITS
                          </td>
                          <td className="p-6 text-sm font-bold text-emerald-600">
                            GH₵ {topup.amount.toFixed(2)}
                          </td>
                          <td className="p-6 text-xs font-mono text-slate-400">
                            {topup.payment_reference}
                          </td>
                          <td className="p-6">
                            <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md ${topup.status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              topup.status === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                              {topup.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          // HISTORY TAB
          <div className="space-y-6">
            {smsHistory.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="ri-history-line text-4xl text-slate-300 dark:text-slate-500"></i>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Sent History</h3>
                <p className="text-slate-500 font-medium max-w-sm mx-auto">Messages you send will appear here for audit purposes.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="p-6">Date Sent</th>
                        <th className="p-6">Message</th>
                        <th className="p-6">Recipients</th>
                        <th className="p-6">Sent By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {smsHistory.map((log) => (
                        <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="p-6 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="p-6">
                            <p className="text-sm text-slate-900 dark:text-white max-w-md">
                              {log.action_details.message}
                            </p>
                          </td>
                          <td className="p-6">
                            <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-bold">
                              <i className="ri-user-line mr-1"></i> {log.action_details.recipient_count}
                            </div>
                          </td>
                          <td className="p-6 text-sm text-slate-500">
                            {log.user?.full_name || 'System'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Purchase SMS Units</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Top up your broadcast balance</p>
              </div>
              <button
                onClick={() => setShowBuyModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-8">
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Rates synced with Arkesel Official
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {SMS_PACKAGES.map((pkg, i) => (
                  <button
                    key={i}
                    disabled={buyingUnits}
                    onClick={() => handlePurchaseSMS(pkg)}
                    className="group flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl border-2 border-slate-50 dark:border-slate-800 hover:border-indigo-500 hover:bg-indigo-50/10 transition-all text-center relative overflow-hidden active:scale-95 cursor-pointer shadow-sm hover:shadow-indigo-500/10"
                  >
                    <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-bl-full group-hover:scale-110 transition-transform"></div>

                    {/* Expiry Tag */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/5 dark:bg-white/5 rounded-md text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {pkg.type === 'no-expiry' ? 'No Expiry' : '30 Days'}
                    </div>

                    <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center mb-3 text-lg sm:text-xl ring-4 ring-indigo-50 dark:ring-indigo-900/20">
                      <i className={pkg.icon}></i>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">{pkg.units.toLocaleString()}</div>
                    <div className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">{pkg.label}</div>
                    <div className="w-full py-2 bg-indigo-600 text-white rounded-xl text-[10px] sm:text-sm font-black tracking-tight group-hover:scale-110 transition-transform shadow-lg shadow-indigo-600/20">
                      GH₵ {pkg.price}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                <i className="ri-information-line text-blue-600 text-lg"></i>
                <p className="text-xs text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
                  Payments are securely processed via <span className="font-black text-indigo-600 dark:text-indigo-400">Paystack</span>. Units will be added to your account record automatically upon successful verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
