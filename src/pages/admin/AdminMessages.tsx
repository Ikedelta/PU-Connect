import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import { useConversations, useMessages, type Conversation } from '../../hooks/useConversations';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';

export default function AdminMessages() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  // Real-time hooks
  const { conversations, isLoading: loadingDocs } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const { messages, isLoading: loadingMsgs, sendMessage: sendMsgMutation, markAsRead } = useMessages(selectedConversation?.id || null);

  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New Chat State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);

  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin' && profile?.role !== 'news_publisher') {
      // Allow access to all staff roles for now, or restrict as needed
      // navigate('/marketplace');
    }
  }, [profile, navigate]);

  // Fetch Potential Recipients for New Chat
  useEffect(() => {
    if (showNewChatModal) {
      const fetchRecipients = async () => {
        const { data } = await import('../../lib/supabase').then(({ supabase }) =>
          supabase.from('profiles')
            .select('id, full_name, role, avatar_url')
            .in('role', ['admin', 'super_admin', 'news_publisher'])
            .neq('id', user?.id)
        );
        if (data) setRecipients(data);
      };
      fetchRecipients();
    }
  }, [showNewChatModal, user?.id]);

  // Handle Mark as Read
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user) return;

    // Determine receiver (the other person in the conversation)
    const receiverId = selectedConversation.buyer_id === user.id
      ? selectedConversation.seller_id
      : selectedConversation.buyer_id;

    sendMsgMutation.mutate({
      message: newMessage.trim(),
      receiverId
    }, {
      onSuccess: () => {
        setNewMessage('');
      }
    });
  };

  const startNewChat = (recipient: any) => {
    // Check if conversation exists (client-side check for now)
    const existing = conversations.find(c =>
      c.buyer_id === recipient.id || c.seller_id === recipient.id
    );

    if (existing) {
      setSelectedConversation(existing);
    } else {
      // Create conversation immediately
      import('../../lib/supabase').then(async ({ supabase }) => {
        const { data, error } = await supabase.from('conversations').insert({
          buyer_id: user?.id,
          seller_id: recipient.id,
        }).select().single();

        if (data) {
          // @ts-ignore
          setSelectedConversation(data);
          // Force reload to refresh SWR or react-query cache if possible, or just let realtime handle it
          window.location.reload();
        } else if (error) {
          console.error(error);
        }
      });
    }
    setShowNewChatModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 transition-colors duration-300">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pt-28 pb-10 md:pt-32 md:pb-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gray-900 dark:bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wide rounded-full mb-6 shadow-lg shadow-gray-200/20 dark:shadow-blue-900/40">
              <i className="ri-team-line text-blue-400 dark:text-white"></i>
              Internal Comms
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              Team<br /><span className="text-blue-600 dark:text-blue-400">Chat.</span>
            </h1>
          </div>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
          >
            <i className="ri-add-line text-lg"></i>
            New Chat
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-200/40 dark:shadow-none overflow-hidden transition-colors duration-300" style={{ height: 'calc(100vh - 350px)' }}>
          <div className="grid grid-cols-12 h-full">
            {/* Conversations List */}
            <div className="col-span-12 md:col-span-4 border-r border-gray-50 dark:border-gray-800 overflow-y-auto">
              {loadingDocs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-10 h-10 border-4 border-gray-100 dark:border-gray-800 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                  <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-6">
                    <i className="ri-message-3-line text-3xl text-gray-400 dark:text-gray-500"></i>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight mb-2">No active chats</h3>
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide leading-relaxed">Start a conversation to see it here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {conversations.map((conversation) => {
                    const otherUser = conversation.other_user;
                    const hasUnread = (conversation.unread_count || 0) > 0;

                    return (
                      <div
                        key={conversation.id}
                        onClick={() => setSelectedConversation(conversation)}
                        className={`p-6 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 cursor-pointer transition-all relative ${selectedConversation?.id === conversation.id ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                          }`}
                      >
                        {selectedConversation?.id === conversation.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                        )}

                        <div className="flex items-center gap-3 mb-2">
                          <div className="relative flex-shrink-0">
                            {otherUser?.avatar_url ? (
                              <img
                                src={getOptimizedImageUrl(otherUser.avatar_url, 40, 40)}
                                alt={otherUser.full_name}
                                className="w-10 h-10 rounded-xl object-cover border border-gray-100 dark:border-gray-700"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-900 dark:bg-gray-700 rounded-xl flex items-center justify-center text-white font-bold text-xs">
                                {otherUser?.full_name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <h3 className={`text-[11px] uppercase tracking-wider truncate ${hasUnread ? 'font-black text-gray-900 dark:text-white' : 'font-bold text-gray-700 dark:text-gray-300'}`}>
                              {otherUser?.full_name}
                            </h3>
                            <p className={`text-xs truncate leading-relaxed ${hasUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-500 dark:text-gray-500'}`}>
                              {conversation.last_message || 'Attachment'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between ml-13 pl-1">
                          <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 tabular-nums uppercase tracking-wide">
                            {new Date(conversation.last_message_at).toLocaleDateString()}
                          </span>
                          {hasUnread && (
                            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-md shadow-sm">
                              {conversation.unread_count} new
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Messages Area */}
            <div className="col-span-12 md:col-span-8 flex flex-col bg-gray-50/20 dark:bg-black/20">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-6 border-b border-gray-50 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {selectedConversation.other_user?.avatar_url ? (
                          <img
                            src={getOptimizedImageUrl(selectedConversation.other_user.avatar_url, 50, 50)}
                            className="w-12 h-12 rounded-2xl object-cover shadow-sm dark:shadow-none border border-gray-100 dark:border-gray-800"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-900 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-white font-bold">
                            {selectedConversation.other_user?.full_name?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 leading-none">Chatting With</h3>
                          <p className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                            {selectedConversation.other_user?.full_name}
                          </p>
                        </div>
                      </div>
                      {selectedConversation.product && (
                        <div className="text-right hidden md:block">
                          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1 leading-none">Context</p>
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">{selectedConversation.product.name}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {loadingMsgs ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-800 border-t-blue-600 rounded-full animate-spin"></div>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wide">No messages yet. Say hello!</p>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isSender = message.sender_id === user?.id;
                        return (
                          <div key={message.id} className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
                            <div className={`flex items-end gap-2 max-w-[80%] ${isSender ? 'flex-row-reverse' : 'flex-row'}`}>
                              {!isSender && (
                                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-800 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                  {message.sender?.full_name?.[0]}
                                </div>
                              )}

                              <div className={`px-5 py-3 rounded-2xl shadow-sm border text-sm font-medium leading-relaxed ${isSender
                                ? 'bg-gray-900 dark:bg-blue-600 text-white border-transparent rounded-tr-none'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-100 dark:border-gray-700 rounded-tl-none conversation-bubble'
                                }`}>
                                {message.message}
                              </div>
                            </div>

                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wide mt-1 mx-9">
                              {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-50 dark:border-gray-800">
                    <form onSubmit={handleSendMessage} className="relative">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="w-full pl-6 pr-32 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-600/20 focus:bg-white dark:focus:bg-gray-800 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        disabled={sendMsgMutation.isPending}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <button
                          type="submit"
                          disabled={sendMsgMutation.isPending || !newMessage.trim()}
                          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none"
                        >
                          {sendMsgMutation.isPending ? (
                            <i className="ri-loader-4-line animate-spin"></i>
                          ) : (
                            <i className="ri-send-plane-fill"></i>
                          )}
                          <span>Send</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-[1.5rem] shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-center mx-auto mb-6">
                      <i className="ri-chat-smile-2-line text-3xl text-gray-300 dark:text-gray-600"></i>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight mb-2">Select a Conversation</h3>
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Choose a colleague from the list to start chatting</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white">New Message</h3>
              <button onClick={() => setShowNewChatModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
              {recipients.map(r => (
                <div key={r.id} onClick={() => startNewChat(r)} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer transition-colors">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center font-bold">
                    {r.full_name[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm dark:text-white">{r.full_name}</h4>
                    <p className="text-xs text-gray-500 uppercase">{r.role.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
              {recipients.length === 0 && <p className="text-center text-gray-500 py-4">No other admins found.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
