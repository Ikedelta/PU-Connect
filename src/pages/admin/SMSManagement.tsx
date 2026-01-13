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
};

export default function SMSManagement() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'buyers' | 'sellers'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sentMessages, setSentMessages] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      navigate('/marketplace');
      return;
    }
    setMessage("We are testing development");
    fetchUsers();
  }, [profile, navigate]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, phone')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
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
      const recipients = users
        .filter(u => selectedUsers.includes(u.id) && (u as any).phone)
        .map(u => (u as any).phone);

      if (recipients.length === 0) {
        throw new Error('Selected users do not have valid phone numbers');
      }

      await import('../../lib/arkesel').then(({ sendSMS }) => {
        return sendSMS(recipients, message);
      });

      const recipientUsers = users.filter(u => selectedUsers.includes(u.id));

      for (const user of recipientUsers) {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'sms_sent',
          details: {
            message: message,
            sent_by: profile?.id,
            sent_at: new Date().toISOString(),
          },
        });
      }

      alert(`SMS sent successfully to ${recipients.length} user(s)!`);
      setMessage('We are testing development');
      setSelectedUsers([]);

      // Add to sent messages
      setSentMessages([
        {
          id: Date.now(),
          message,
          recipients: recipients.length,
          sent_at: new Date().toISOString(),
        },
        ...sentMessages,
      ]);
    } catch (error: any) {
      console.error('SMS Error:', error);
      alert(error.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filter === 'all' ||
      (filter === 'buyers' && user.role === 'buyer') ||
      (filter === 'sellers' && user.role === 'seller');

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SMS Management</h1>
          <p className="text-gray-600 mt-2">Send notifications to users via SMS</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Selection */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Select Recipients</h2>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <div className="relative">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search users..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    <option value="all">All Users</option>
                    <option value="buyers">Buyers Only</option>
                    <option value="sellers">Sellers Only</option>
                  </select>
                </div>

                {/* Select All */}
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                      onChange={handleSelectAll}
                      className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      Select All ({filteredUsers.length} users)
                    </span>
                  </label>
                  <span className="text-sm text-gray-600">
                    {selectedUsers.length} selected
                  </span>
                </div>
              </div>

              {/* User List */}
              <div className="max-h-96 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <div className="p-12 text-center">
                    <i className="ri-user-search-line text-5xl text-gray-300 mb-4"></i>
                    <p className="text-gray-600">No users found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center space-x-4 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                          className="w-5 h-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                        />
                        <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-amber-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-sm">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.full_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === 'seller'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-sky-100 text-sky-700'
                          }`}>
                          {user.role}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Message Composer */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Compose Message</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  maxLength={160}
                  placeholder="Type your message here... (max 160 characters)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none text-sm"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {message.length}/160 characters
                </p>
              </div>

              <div className="mb-6 p-4 bg-sky-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Recipients:</span>
                  <span className="text-sm font-bold text-gray-900">{selectedUsers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Estimated Cost:</span>
                  <span className="text-sm font-bold text-gray-900">
                    ${(selectedUsers.length * 0.05).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSendSMS}
                disabled={sending || selectedUsers.length === 0 || !message.trim()}
                className="w-full px-4 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {sending ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-fill mr-2"></i>
                    Send SMS
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 mt-4 text-center">
                <i className="ri-information-line mr-1"></i>
                SMS will be sent to selected users
              </p>
            </div>
          </div>
        </div>

        {/* Sent Messages History */}
        {sentMessages.length > 0 && (
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Messages</h2>
            <div className="space-y-4">
              {sentMessages.map((msg) => (
                <div key={msg.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm text-gray-900">{msg.message}</p>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {new Date(msg.sent_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    <i className="ri-user-line mr-1"></i>
                    Sent to {msg.recipients} user(s)
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
