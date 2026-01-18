import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type NewsArticle = {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  image_url?: string;
  author_id: string;
  is_published: boolean;
  published_at?: string;
  views_count: number;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
};

export function useNews(filters?: {
  category?: string;
  search?: string;
  isPublished?: boolean;
}) {
  const queryClient = useQueryClient();

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('news-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campus_news',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['news'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['news', filters],
    queryFn: async () => {
      try {
        let query = supabase
          .from('campus_news')
          .select(`
            *,
            author:profiles(id, full_name, email, avatar_url)
          `)
          .order('updated_at', { ascending: false });

        if (filters?.isPublished !== undefined) {
          query = query.eq('is_published', filters.isPublished);
        } else {
          query = query.eq('is_published', true);
        }

        if (filters?.category && filters.category !== 'all') {
          query = query.ilike('category', filters.category);
        }

        if (filters?.search) {
          query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Supabase query error (news):', error);
          throw error;
        }
        return data || [];
      } catch (err) {
        console.error('useNews error:', err);
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useFeaturedNews(limit: number = 5) {
  return useQuery({
    queryKey: ['news', 'featured', limit],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('campus_news')
          .select(`
            *,
            author:profiles(id, full_name, email, avatar_url)
          `)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('Featured news error:', error);
          throw error;
        }
        return data || [];
      } catch (err) {
        console.error('useFeaturedNews error:', err);
        throw err;
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0,
  });
}

export function useNewsArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['news', 'article', id],
    queryFn: async () => {
      if (!id) return null;

      try {
        const { data, error } = await supabase
          .from('campus_news')
          .select(`
            *,
            author:profiles(id, full_name, email, avatar_url)
          `)
          .eq('id', id)
          .single();

        if (error) {
          console.error('News article fetch error:', error);
          throw error;
        }

        // Increment view count - ignore if RPC fails
        try {
          await supabase.rpc('increment_news_views', { news_id: id });
        } catch (rpcErr) {
          console.warn('Failed to increment views:', rpcErr);
        }

        return data;
      } catch (err) {
        console.error('useNewsArticle error:', err);
        throw err;
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateNews() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (article: Omit<NewsArticle, 'id' | 'author_id' | 'created_at' | 'updated_at' | 'views_count' | 'author'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('campus_news')
        .insert({
          ...article,
          author_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
  });
}

export function useUpdateNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<NewsArticle> }) => {
      const { data, error } = await supabase
        .from('campus_news')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
      queryClient.invalidateQueries({ queryKey: ['news', data.id] });
    },
  });
}

export function useDeleteNews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campus_news')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
  });
}
