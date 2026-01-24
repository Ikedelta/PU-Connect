import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Product } from '../lib/supabase';

export function useProducts(filters?: {
  category?: string;
  search?: string;
  sellerId?: string;
  limit?: number;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const isOwner = user?.id && filters?.sellerId === user.id;

      let query = supabase
        .from('products')
        .select(`
          *,
          seller:profiles!products_seller_id_fkey(id, full_name, email, avatar_url, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      if (!isOwner) {
        query = query.eq('is_active', true);
      }

      if (filters?.category && filters.category !== 'all') {
        query = query.ilike('category', filters.category);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters?.sellerId) {
        query = query.eq('seller_id', filters.sellerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data) return [];

      // 1. Manual Filter: Only show products from ACTIVE Seller Profiles
      // This avoids the 400 Bad Request from complex inner joins on RLS-protected tables
      const uniqueSellerIds = Array.from(new Set(data.map(p => p.seller_id)));

      let finalProducts = data;

      if (uniqueSellerIds.length > 0) {
        // Fetch active statuses
        const { data: activeSellers } = await supabase
          .from('seller_profiles')
          .select('user_id')
          .in('user_id', uniqueSellerIds)
          .eq('is_active', true);

        const activeSellerIds = new Set(activeSellers?.map(s => s.user_id));

        // Filter out products from inactive/rejected sellers if not owner
        if (!isOwner) {
          finalProducts = data.filter(p => activeSellerIds.has(p.seller_id));
        }

        // 2. Fetch business details for these valid products
        const validSellerIds = Array.from(new Set(finalProducts.map(p => p.seller_id)));

        if (validSellerIds.length > 0) {
          const { data: businessApps } = await supabase
            .from('seller_applications')
            .select('user_id, business_name, business_logo')
            .in('user_id', validSellerIds)
            .eq('status', 'approved');

          if (businessApps && businessApps.length > 0) {
            const businessMap = new Map(businessApps.map(app => [app.user_id, app]));

            finalProducts.forEach(product => {
              const business = businessMap.get(product.seller_id);
              if (business && product.seller) {
                (product.seller as any).business_name = business.business_name;
                (product.seller as any).business_logo = business.business_logo;
              }
            });
          }
        }
      }

      return finalProducts;
    },
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useProduct(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          seller:profiles!products_seller_id_fkey(id, full_name, email, avatar_url, student_id, department, phone)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Privacy check: If product is hidden, only the owner can see it
      if (!data.is_active && (!user || user.id !== data.seller_id)) {
        throw new Error('This product is currently private or hidden by the seller.');
      }

      // Fetch additional business details from seller_applications
      if (data?.seller) {
        const { data: businessData } = await supabase
          .from('seller_applications')
          .select('business_name, business_logo')
          .eq('user_id', data.seller.id)
          .eq('status', 'approved')
          .maybeSingle();

        if (businessData) {
          // Merge business details into seller object
          (data.seller as any).business_name = businessData.business_name;
          (data.seller as any).business_logo = businessData.business_logo;
        }
      }

      // Increment view count asynchronously without waiting
      Promise.resolve(supabase.rpc('increment_product_views', { product_id: id })).catch(console.error);

      return data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    retry: 3, // More retries for single product
  });
}

export function useCreateProduct() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'seller_id' | 'created_at' | 'updated_at' | 'views_count'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('products')
        .insert({
          ...product,
          seller_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Product> }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', data.id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useFavorites() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('favorites')
        .select(`
          *,
          product:products(
            *,
            seller:profiles!products_seller_id_fkey(id, full_name, email, avatar_url)
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      if (!data) return [];

      // Fetch business details for unique sellers of favorited products
      const sellerIds = Array.from(new Set(data.map(f => (f.product as any)?.seller_id).filter(Boolean)));

      if (sellerIds.length > 0) {
        const { data: businessApps } = await supabase
          .from('seller_applications')
          .select('user_id, business_name, business_logo')
          .in('user_id', sellerIds)
          .eq('status', 'approved');

        if (businessApps && businessApps.length > 0) {
          const businessMap = new Map(businessApps.map(app => [app.user_id, app]));

          data.forEach(fav => {
            const product = fav.product as any;
            if (product && product.seller) {
              const business = businessMap.get(product.seller_id);
              if (business) {
                product.seller.business_name = business.business_name;
                (product.seller as any).business_logo = business.business_logo;
              }
            }
          });
        }
      }

      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Check if already favorited
      const { data: existing } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .single();

      if (existing) {
        // Remove favorite
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        return { action: 'removed' };
      } else {
        // Add favorite
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            product_id: productId,
          });

        if (error) throw error;
        return { action: 'added' };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}
