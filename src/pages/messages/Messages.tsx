import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import { useConversations, useMessages, type Conversation } from '../../hooks/useConversations';

export default function Messages() {
  const { user } = useAuth();
  const { conversations, isLoading: loadingDocs, totalUnreadCount } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const { messages, isLoading: loadingMsgs, sendMessage: sendMsgMutation, markAsRead } = useMessages(selectedConversation?.id || null);

  const [newMessage, setNewMessage] = useState('');
  const [showConversationList, setShowConversationList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0]);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user) return;

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

  const getOnlineStatus = (user: any) => {
    if (!user) return { isOnline: false, text: 'Offline' };
    if (user.is_online) return { isOnline: true, text: 'Online' };

    const lastSeen = new Date(user.last_seen);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / 60000);

    if (diffMinutes < 5) return { isOnline: false, text: 'Active recently' };
    if (diffMinutes < 60) return { isOnline: false, text: `Active ${diffMinutes}m ago` };
    if (diffMinutes < 1440) return { isOnline: false, text: `Active ${Math.floor(diffMinutes / 60)}h ago` };
    return { isOnline: false, text: `Active ${Math.floor(diffMinutes / 1440)}d ago` };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8 mt-16">
        <div className="mb-4 sm:mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-1">Messages</h1>
            <p className="text-sm text-gray-500 font-medium">Manage your university marketplace communications</p>
          </div>
          {totalUnreadCount > 0 && (
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20">
              {totalUnreadCount} New Notifications
            </span>
          )}
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden h-[calc(100dvh-11rem)] md:h-[calc(100dvh-12rem)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
            {/* Conversations List */}
            <div className={`${showConversationList ? 'block' : 'hidden'} lg:block lg:col-span-4 border-r border-gray-50 overflow-y-auto bg-gray-50/30`}>
              {loadingDocs ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-8 h-8 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                    <i className="ri-message-3-line text-3xl text-gray-300"></i>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 tracking-tight">No active conversations</h3>
                  <p className="text-sm text-gray-500 font-medium">Start chatting with potential buyers or sellers to see messages here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {conversations.map((conversation) => {
                    const otherUser = conversation.other_user;
                    const status = getOnlineStatus(otherUser);
                    const hasUnread = (conversation.unread_count || 0) > 0;
                    return (
                      <div
                        key={conversation.id}
                        onClick={() => handleConversationSelect(conversation)}
                        className={`p-5 transition-all cursor-pointer relative ${selectedConversation?.id === conversation.id
                          ? 'bg-white shadow-md border-r-4 border-r-blue-600 z-10 scale-[1.02]'
                          : 'hover:bg-white'
                          } ${hasUnread ? 'bg-blue-50/20' : ''}`}
                      >
                        <div className="flex items-start space-x-4">
                          <div className="relative flex-shrink-0">
                            {otherUser?.avatar_url ? (
                              <img
                                src={getOptimizedImageUrl(otherUser.avatar_url, 100, 80)}
                                alt={otherUser.full_name}
                                className="w-12 h-12 rounded-2xl object-cover border border-gray-100"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center">
                                <span className="text-white font-bold text-sm">
                                  {otherUser?.full_name?.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            {status.isOnline && (
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className={`text-sm truncate tracking-tight ${hasUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>
                                {otherUser?.full_name}
                              </h3>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest whitespace-nowrap ml-2">
                                {new Date(conversation.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={`text-xs truncate flex-1 font-medium ${hasUnread ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                                {conversation.last_message || 'Draft message...'}
                              </p>
                              {hasUnread && (
                                <span className="ml-2 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/10">
                                  {conversation.unread_count}
                                </span>
                              )}
                            </div>
                            {conversation.product && (
                              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-2 truncate">
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
            <div className={`${!showConversationList ? 'block' : 'hidden'} lg:block lg:col-span-8 flex flex-col bg-white`}>
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 sm:p-6 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={handleBackToList}
                        className="lg:hidden w-10 h-10 flex items-center justify-center hover:bg-gray-50 rounded-xl transition-all cursor-pointer"
                      >
                        <i className="ri-arrow-left-line text-xl text-gray-700"></i>
                      </button>

                      <div className="relative">
                        {selectedConversation.other_user?.avatar_url ? (
                          <img
                            src={getOptimizedImageUrl(selectedConversation.other_user.avatar_url, 120, 80)}
                            alt={selectedConversation.other_user.full_name}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-cover border border-gray-100 shadow-sm"
                            loading="eager"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-900 rounded-2xl shadow-sm flex items-center justify-center">
                            <span className="text-white font-bold text-base">
                              {selectedConversation.other_user?.full_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {getOnlineStatus(selectedConversation.other_user).isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate tracking-tight">
                          {selectedConversation.other_user?.full_name}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${getOnlineStatus(selectedConversation.other_user).isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
                            {getOnlineStatus(selectedConversation.other_user).text}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedConversation.product && (
                      <div className="hidden sm:block text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Inquiry Topic</p>
                        <p className="text-sm font-bold text-blue-600 truncate max-w-[150px]">{selectedConversation.product.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Messages Content */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 bg-gray-50/50">
                    {loadingMsgs ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
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
                              : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                              }`}
                          >
                            <p className="text-sm leading-relaxed">{message.message}</p>
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

                  {/* Message Input Container */}
                  <div className="p-4 sm:p-6 bg-white border-t border-gray-50">
                    <form onSubmit={handleSendMessage} className="relative">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Compose your message..."
                        className="w-full pl-6 pr-32 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 text-sm font-medium transition-all"
                        disabled={sendMsgMutation.isPending}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                        <button
                          type="submit"
                          disabled={sendMsgMutation.isPending || !newMessage.trim()}
                          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all text-xs font-bold uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
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
                <div className="flex items-center justify-center h-full p-8">
                  <div className="text-center max-w-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                      <i className="ri-chat-3-line text-4xl text-gray-200"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Communication Portal</h3>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed">Select a conversation from the sidebar to view exchange history and respond to inquiries.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

