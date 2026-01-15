import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  student_id?: string;
  department?: string;
  faculty?: string;
  phone?: string;
  avatar_url?: string;
  role: 'buyer' | 'seller' | 'admin' | 'super_admin' | 'news_publisher';
  is_active: boolean;
  last_seen?: string;
  is_online?: boolean;
  created_at: string;
  updated_at: string;
};

export type SellerApplication = {
  id: string;
  user_id: string;
  business_name: string;
  business_category: string;
  business_description: string;
  contact_phone: string;
  contact_email?: string;
  business_type?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  business_logo?: string;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  category: string;
  price?: number;
  price_type: 'fixed' | 'contact';
  images?: string[];
  whatsapp_number?: string;
  is_active: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
};

export type Advertisement = {
  id: string;
  title: string;
  image_url: string;
  destination_url?: string;
  placement_area: 'home_hero' | 'marketplace_sidebar' | 'news_feed' | 'global_popup';
  status: 'active' | 'paused' | 'expired';
  start_date: string;
  end_date?: string;
  impressions_count: number;
  clicks_count: number;
  created_by: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system' | 'message' | 'order';
  link_url?: string;
  is_read: boolean;
  created_at: string;
};
