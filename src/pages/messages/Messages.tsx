import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useConversations, useMessages, type Conversation } from '../../hooks/useConversations';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/logger';

export default function Messages() {
  const { user } = useAuth();
  const { conversations, isLoading: loadingDocs, totalUnreadCount, refetch } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const { messages, isLoading: loadingMsgs, sendMessage: sendMsgMutation, markAsRead } = useMessages(selectedConversation?.id || null);

  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showConversationList, setShowConversationList] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime Online Status for User List
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel('online-users')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        for (const id in state) {
          state[id].forEach((presence: any) => {
            if (presence.user_id) onlineIds.add(presence.user_id);
          });
        }
        setOnlineUsers(onlineIds);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation && !showNewChatModal) {
      if (window.innerWidth >= 1024) {
        setSelectedConversation(conversations[0]);
      }
    }
  }, [conversations, selectedConversation]);

  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      const unreadMessageIds = messages
        .filter(m => !m.is_read && m.sender_id !== user?.id)
        .map(m => m.id);

      if (unreadMessageIds.length > 0) {
        markAsRead.mutate(unreadMessageIds);
      }
    }
  }, [selectedConversation, messages, user?.id, markAsRead]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowConversationList(false);
  };

  const handleBackToList = () => {
    setShowConversationList(true);
    setSelectedConversation(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('File size too large. Please select a file under 5MB.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !selectedConversation || !user) return;

    const receiverId = selectedConversation.buyer_id === user.id
      ? selectedConversation.seller_id
      : selectedConversation.buyer_id;

    sendMsgMutation.mutate({
      message: newMessage.trim(),
      receiverId,
      file: selectedFile || undefined
    }, {
      onSuccess: async () => {
        // Log Activity
        try {
          await logActivity(user.id, 'message_sent', {
            receiver_id: receiverId,
            content_snippet: newMessage.trim().slice(0, 100), // Store snippet
            has_attachment: !!selectedFile
          });
        } catch (err) {
          console.error('Failed to log message activity', err);
        }

        setNewMessage('');
        handleRemoveFile();
      }
    });
  };

  const getOnlineStatus = (userId: string, lastSeen?: string) => {
    if (onlineUsers.has(userId)) return { isOnline: true, text: 'Online' };
    if (!lastSeen) return { isOnline: false, text: 'Offline' };

    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / 60000);

    if (diffMinutes < 5) return { isOnline: false, text: 'Active recently' };
    if (diffMinutes < 60) return { isOnline: false, text: `Active ${diffMinutes}m ago` };
    if (diffMinutes < 1440) return { isOnline: false, text: `Active ${Math.floor(diffMinutes / 60)}h ago` };
    return { isOnline: false, text: `Active ${Math.floor(diffMinutes / 1440)}d ago` };
  };

  const searchUsers = async (term: string) => {
    setSearching(true);
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, last_seen')
        .neq('id', user?.id)
        .limit(20);

      if (term) {
        query = query.ilike('full_name', `%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error searching users", err);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (showNewChatModal) {
      searchUsers(searchTerm);
    }
  }, [showNewChatModal, searchTerm]);

  const startNewChat = async (otherUser: any) => {
    if (!user) return;

    const existing = conversations.find(c =>
      (c.buyer_id === user.id && c.seller_id === otherUser.id) ||
      (c.seller_id === user.id && c.buyer_id === otherUser.id)
    );

    if (existing) {
      handleConversationSelect(existing);
      setShowNewChatModal(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          buyer_id: user.id,
          seller_id: otherUser.id,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      await refetch();

      const newConv: Conversation = {
        id: data.id,
        product_id: null,
        buyer_id: user.id,
        seller_id: otherUser.id,
        created_at: data.created_at,
        updated_at: data.updated_at,
        product: undefined,
        other_user: otherUser,
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_count: 0
      };

      handleConversationSelect(newConv);
      setShowNewChatModal(false);

    } catch (err) {
      console.error("Failed to start chat", err);
      alert("Could not start chat. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 pb-20">
      <Navbar />

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 mt-16 pt-24">
        <div className="mb-4 sm:mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">Messages</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Connect with the campus community</p>
          </div>
          <div className="flex gap-2">
            {totalUnreadCount > 0 && (
              <span className="bg-blue-600 text-white px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center h-10">
                {totalUnreadCount} New
              </span>
            )}
            <button
              onClick={() => setShowNewChatModal(true)}
              className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-black dark:hover:bg-gray-200 transition-all flex items-center gap-2 h-10"
            >
              <i className="ri-edit-box-line text-lg"></i>
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-gray-200/40 dark:shadow-none overflow-hidden h-[calc(100dvh-11rem)] md:h-[calc(100dvh-13rem)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
            {/* Conversations List */}
            <div className={`${showConversationList ? 'block' : 'hidden'} lg:block lg:col-span-4 border-r border-gray-50 dark:border-slate-700 overflow-y-auto bg-gray-50/30 dark:bg-slate-900/30`}>
              {loadingDocs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-4 border-gray-100 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-6">
                    <i className="ri-message-3-line text-3xl text-gray-300 dark:text-gray-500"></i>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 tracking-tight">No conversations yet</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-4">Start chatting with students and sellers on the platform.</p>
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest hover:underline"
                  >
                    Start a New Chat
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-700">
                  {conversations.map((conversation) => {
                    const otherUser = conversation.other_user;
                    if (!otherUser) return null;
                    const status = getOnlineStatus(otherUser.id, otherUser.last_seen);
                    const hasUnread = (conversation.unread_count || 0) > 0;
                    return (
                      <div
                        key={conversation.id}
                        onClick={() => handleConversationSelect(conversation)}
                        className={`p-5 transition-all cursor-pointer relative ${selectedConversation?.id === conversation.id
                          ? 'bg-white dark:bg-slate-800 shadow-md border-r-4 border-r-blue-600 z-10 scale-[1.02]'
                          : 'hover:bg-white dark:hover:bg-slate-800'
                          } ${hasUnread ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}
                      >
                        <div className="flex items-start space-x-4">
                          <div className="relative flex-shrink-0">
                            {otherUser?.avatar_url ? (
                              <img
                                src={getOptimizedImageUrl(otherUser.avatar_url, 100, 80)}
                                alt={otherUser.full_name}
                                className="w-12 h-12 rounded-2xl object-cover border border-gray-100 dark:border-slate-600"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-900 dark:bg-slate-700 rounded-2xl flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                  {otherUser?.full_name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            {status.isOnline && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className={`text-sm truncate tracking-tight ${hasUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-900 dark:text-white'}`}>
                                {otherUser?.full_name}
                              </h3>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest whitespace-nowrap ml-2">
                                {new Date(conversation.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={`text-xs truncate flex-1 font-medium ${hasUnread ? 'text-gray-900 dark:text-gray-200 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                {conversation.last_message || 'Draft message...'}
                              </p>
                              {hasUnread && (
                                <span className="ml-2 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/10">
                                  {conversation.unread_count}
                                </span>
                              )}
                            </div>
                            {conversation.product && (
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest mt-2 truncate">
                                Re: {conversation.product.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Messages Area */}
            <div className={`${!showConversationList ? 'block' : 'hidden'} lg:block lg:col-span-8 flex flex-col bg-white dark:bg-slate-800`}>
              {selectedConversation ? (
                <>
                  <div className="p-4 sm:p-6 border-b border-gray-50 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleBackToList}
                        className="lg:hidden w-10 h-10 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
                      >
                        <i className="ri-arrow-left-line text-xl text-gray-700 dark:text-gray-300"></i>
                      </button>

                      <div className="relative">
                        {selectedConversation.other_user?.avatar_url ? (
                          <img
                            src={getOptimizedImageUrl(selectedConversation.other_user.avatar_url, 120, 80)}
                            alt={selectedConversation.other_user.full_name}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-cover border border-gray-100 dark:border-slate-600 shadow-sm"
                            loading="eager"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900 dark:bg-slate-700 rounded-2xl shadow-sm flex items-center justify-center">
                            <span className="text-white font-bold text-base">
                              {selectedConversation.other_user?.full_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {getOnlineStatus(selectedConversation.other_user?.id || '', selectedConversation.other_user?.last_seen).isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate tracking-tight">
                          {selectedConversation.other_user?.full_name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${getOnlineStatus(selectedConversation.other_user?.id || '', selectedConversation.other_user?.last_seen).isOnline ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-widest">
                            {getOnlineStatus(selectedConversation.other_user?.id || '', selectedConversation.other_user?.last_seen).text}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedConversation.product && (
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Inquiry Topic</p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate max-w-[150px]">{selectedConversation.product.name}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 bg-gray-50/50 dark:bg-slate-900/50">
                    {loadingMsgs ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-gray-100 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    ) : messages.map((message) => {
                      const isSender = message.sender_id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-md px-5 py-3 rounded-[1.5rem] shadow-sm ${isSender
                              ? 'bg-blue-600 text-white rounded-tr-none'
                              : 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-tl-none border border-gray-100 dark:border-slate-600'
                              }`}
                          >
                            {message.attachment_url && (
                              <div className="mb-3">
                                {message.attachment_type === 'image' ? (
                                  <a href={message.attachment_url} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={message.attachment_url}
                                      alt="Attachment"
                                      className="rounded-xl max-w-full max-h-[200px] object-cover border border-white/10"
                                      loading="lazy"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={message.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-3 p-3 rounded-xl ${isSender ? 'bg-white/10' : 'bg-gray-100 dark:bg-slate-600'}`}
                                  >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSender ? 'bg-white/20' : 'bg-white dark:bg-slate-500'}`}>
                                      <i className="ri-file-text-line text-xl"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold truncate">Attachment</p>
                                      <p className="text-[10px] opacity-70 uppercase">Click to view</p>
                                    </div>
                                    <i className="ri-external-link-line"></i>
                                  </a>
                                )}
                              </div>
                            )}
                            {message.message && <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>}
                            <div
                              className={`flex items-center justify-end mt-2 space-x-1 ${isSender ? 'text-blue-200' : 'text-gray-400'
                                }`}
                            >
                              <span className="text-[10px] font-bold uppercase tracking-widest">
                                {new Date(message.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {isSender && (
                                <i className={`ri-check-double-line ${message.is_read ? 'text-blue-200' : 'text-blue-300'}`}></i>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 sm:p-6 bg-white dark:bg-slate-800 border-t border-gray-50 dark:border-slate-700">
                    {selectedFile && (
                      <div className="mb-4 flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-2xl border border-gray-100 dark:border-slate-600 animate-fade-in-up">
                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-600 border border-gray-200 dark:border-slate-500 flex items-center justify-center overflow-hidden">
                          {selectedFile.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(selectedFile)}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <i className="ri-file-text-line text-2xl text-gray-400 dark:text-gray-300"></i>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{selectedFile.name}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          onClick={handleRemoveFile}
                          className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-600 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition-colors"
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleSendMessage} className="relative flex items-end gap-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-12 h-14 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-500 dark:text-gray-300 hover:text-blue-600 rounded-2xl flex items-center justify-center transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-500 flex-shrink-0"
                        title="Attach file"
                      >
                        <i className="ri-attachment-2 text-xl"></i>
                      </button>

                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Compose your message..."
                          className="w-full pl-6 pr-32 py-4 bg-gray-50 dark:bg-slate-700 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 dark:text-white text-sm font-medium transition-all"
                          disabled={sendMsgMutation.isPending}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                          <button
                            type="submit"
                            disabled={sendMsgMutation.isPending || (!newMessage.trim() && !selectedFile)}
                            className="px-6 py-2.5 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl hover:bg-black dark:hover:bg-gray-200 transition-all text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                          >
                            {sendMsgMutation.isPending ? (
                              <i className="ri-loader-4-line animate-spin"></i>
                            ) : (
                              <i className="ri-send-plane-fill"></i>
                            )}
                            <span>Send</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full p-8">
                  <div className="text-center max-w-sm">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-slate-700 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                      <i className="ri-chat-3-line text-4xl text-gray-200 dark:text-gray-500"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Communication Hub</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">Select a conversation from the sidebar or start a new chat to connect with others.</p>
                    <button
                      onClick={() => setShowNewChatModal(true)}
                      className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
                    >
                      Find People
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Message</h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                <i className="ri-close-line text-xl dark:text-white"></i>
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/50">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {searching ? (
                <div className="flex items-center justify-center py-10">
                  <i className="ri-loader-4-line text-2xl animate-spin text-blue-600"></i>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No users found.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {users.map(u => {
                    const status = getOnlineStatus(u.id, u.last_seen);
                    return (
                      <button
                        key={u.id}
                        onClick={() => startNewChat(u)}
                        className="w-full flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-left group"
                      >
                        <div className="relative">
                          <img
                            src={getOptimizedImageUrl(u.avatar_url, 80, 80)}
                            alt={u.full_name}
                            className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-slate-600"
                          />
                          {status.isOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{u.full_name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.role?.replace('_', ' ')}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${status.isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'
                          }`}>
                          {status.text}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
