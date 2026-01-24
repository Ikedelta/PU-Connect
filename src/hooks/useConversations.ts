import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'file';
  is_read: boolean;
  created_at: string;
};

export type Conversation = {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string | null;
  last_message: string;
  last_message_at: string;
  created_at: string;
  updated_at?: string;
  other_user?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    is_online?: boolean;
    last_seen?: string;
  };
  product?: {
    id: string;
    name: string;
  };
  unread_count?: number;
};

export function useConversations() {
  const { user } = useAuth();

  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          buyer:profiles!buyer_id(id, full_name, email, avatar_url, is_online, last_seen),
          seller:profiles!seller_id(id, full_name, email, avatar_url, is_online, last_seen),
          product:products(id, name)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get unread counts for all conversations in one query
      const conversationIds = data?.map(c => c.id) || [];
      const { data: unreadData } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      const unreadCounts = unreadData?.reduce((acc, msg) => {
        acc[msg.conversation_id] = (acc[msg.conversation_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return data?.map((conv: any) => ({
        ...conv,
        other_user: conv.buyer_id === user.id ? conv.seller : conv.buyer,
        unread_count: unreadCounts[conv.id] || 0,
      })) || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Realtime subscription for conversations
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `buyer_id=eq.${user.id}`
      }, () => refetch())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `seller_id=eq.${user.id}`
      }, () => refetch())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  const { data: totalUnreadCount = 0 } = useQuery({
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { data: convData } = await supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (!convData || convData.length === 0) return 0;

      const conversationIds = convData.map(c => c.id);

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id)
        .eq('is_read', false);

      return count || 0;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 60000, // Refetch every 60 seconds
  });

  return {
    conversations,
    isLoading,
    totalUnreadCount,
    refetch,
  };
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!conversationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, () => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, () => refetch())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, refetch, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({ message, receiverId, file }: { message: string, receiverId: string, file?: File }) => {
      if (!conversationId || !user) throw new Error('Missing required data');

      let attachmentUrl = null;
      let attachmentType = null;

      if (file) {
        // Upload file to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${conversationId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(fileName);

        attachmentUrl = publicUrlData.publicUrl;

        // Determine attachment type
        if (file.type.startsWith('image/')) attachmentType = 'image';
        else if (file.type.startsWith('video/')) attachmentType = 'video';
        else attachmentType = 'file';
      }

      const messageData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        receiver_id: receiverId,
        message,
        is_read: false,
      };

      if (attachmentUrl) {
        messageData.attachment_url = attachmentUrl;
        messageData.attachment_type = attachmentType;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      // Update conversation's last message with preview text
      const lastMessageText = file ? (message ? `📷 ${message}` : 'Sent an attachment') : message;

      await supabase
        .from('conversations')
        .update({
          last_message: lastMessageText,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (messageIds: string[]) => {
      if (!user || messageIds.length === 0) return;

      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .in('id', messageIds)
        .neq('sender_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  return {
    messages,
    isLoading,
    sendMessage,
    markAsRead,
  };
}

export function useCreateConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ otherUserId, productId }: { otherUserId: string, productId?: string }) => {
      if (!user) throw new Error('Not authenticated');

      try {
        // 1. Try RPC first (Primary, Atomic)
        const { data, error } = await supabase.rpc('get_or_create_conversation', {
          current_user_id: user.id,
          target_user_id: otherUserId
        });

        if (!error && data) {
          const conversationId = data.id;
          if (productId && conversationId) {
            await supabase
              .from('conversations')
              .update({ product_id: productId })
              .eq('id', conversationId);
          }
          return conversationId;
        }

        // If error is not "function not found" or similar, rethrow
        if (error && error.code !== '42883') { // 42883 is undefined_function
          console.warn("RPC failed, falling back to client-side creation", error);
        }

        throw error; // If RPC fails for any reason, trigger catch block (actually we should just catch specifically)
      } catch (err: any) {
        // Fallback: Client-side check (Legacy method)
        console.warn("Using fallback conversation creation logic");

        // 1. Check existing
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(buyer_id.eq.${user.id},seller_id.eq.${otherUserId}),and(buyer_id.eq.${otherUserId},seller_id.eq.${user.id})`)
          .maybeSingle();

        if (existing) {
          if (productId) {
            await supabase.from('conversations').update({ product_id: productId }).eq('id', existing.id);
          }
          return existing.id;
        }

        // 2. Create new
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            buyer_id: user.id,
            seller_id: otherUserId,
            product_id: productId,
            last_message_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;
        return newConv.id;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

