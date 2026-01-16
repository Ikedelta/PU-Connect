import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

interface WebsiteSettings {
  id?: string;
  site_name: string;
  site_tagline: string;
  announcement_bar?: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_text: string;
  about_title: string;
  about_description: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  footer_text: string;
  system_default_password?: string;
  enable_sms?: boolean;
  updated_at?: string;
}

export default function WebsiteSettings() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [settings, setSettings] = useState<WebsiteSettings>({
    site_name: 'Campus Marketplace',
    site_tagline: 'Buy, Sell & Connect on Campus',
    hero_title: 'Your Campus Marketplace',
    hero_subtitle: 'Connect with students, buy and sell products, discover campus news',
    hero_cta_text: 'Get Started',
    about_title: 'About Our Platform',
    about_description: 'We connect students on campus to buy, sell, and trade products and services.',
    contact_email: 'info@campusmarketplace.com',
    contact_phone: '+233 XX XXX XXXX',
    whatsapp_number: '+233 XX XXX XXXX',
    facebook_url: '',
    twitter_url: '',
    instagram_url: '',
    footer_text: '© 2024 Campus Marketplace. All rights reserved.',
    system_default_password: 'Password123!',
    enable_sms: true,
  });

  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      navigate('/');
      return;
    }
    loadSettings();
  }, [profile]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('website_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('website_settings')
        .select('id')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('website_settings')
          .update({
            ...settings,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('website_settings')
          .insert({
            ...settings,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      setNotification({ type: 'success', message: 'Settings saved successfully!' });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-slate-300 font-semibold text-lg">Loading Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Navbar />

      {/* Notifications */}
      {notification && (
        <div className="fixed top-24 right-6 z-50 animate-in slide-in-from-right fade-in duration-300">
          <div className={`px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-bold backdrop-blur-xl border ${notification.type === 'success' ? 'bg-emerald-600/90 border-emerald-500/50' : 'bg-rose-600/90 border-rose-500/50'
            }`}>
            <i className={`text-xl ${notification.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
            <span className="text-sm">{notification.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-32 pb-20">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-black text-white mb-3 tracking-tight">Website Settings</h1>
          <p className="text-slate-400 font-medium text-lg">Customize your platform without touching code</p>
        </div>

        <div className="space-y-8">

          {/* General Settings */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <i className="ri-settings-3-line text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black text-white">General Settings</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Site Name
                </label>
                <input
                  type="text"
                  name="site_name"
                  value={settings.site_name}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Site Tagline
                </label>
                <input
                  type="text"
                  name="site_tagline"
                  value={settings.site_tagline}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  System Announcement
                </label>
                <div className="relative">
                  <i className="ri-megaphone-line absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 text-xl"></i>
                  <input
                    type="text"
                    name="announcement_bar"
                    value={settings.announcement_bar || ''}
                    onChange={handleChange}
                    placeholder="e.g. Testing development..."
                    className="w-full pl-14 pr-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-white placeholder-slate-500 transition-all font-medium"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  Leave empty to hide. This message will be shown to ALL users at the top of the site.
                </p>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                <i className="ri-shield-keyhole-line text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black text-white">Security Settings</h2>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                Default System Password
              </label>
              <div className="relative">
                <i className="ri-lock-password-line absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 text-xl"></i>
                <input
                  type="text"
                  name="system_default_password"
                  value={settings.system_default_password || ''}
                  onChange={handleChange}
                  placeholder="Enter default system password"
                  className="w-full pl-14 pr-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">
                This password will be used for system-level operations or default user resets.
              </p>
            </div>
          </div>

          {/* Hero Section */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <i className="ri-home-heart-line text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black text-white">Homepage Hero Section</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Hero Title
                </label>
                <input
                  type="text"
                  name="hero_title"
                  value={settings.hero_title}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Hero Subtitle
                </label>
                <textarea
                  name="hero_subtitle"
                  value={settings.hero_subtitle}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-white placeholder-slate-500 transition-all font-medium resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Call-to-Action Button Text
                </label>
                <input
                  type="text"
                  name="hero_cta_text"
                  value={settings.hero_cta_text}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* About Section */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                <i className="ri-information-line text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black text-white">About Section</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  About Title
                </label>
                <input
                  type="text"
                  name="about_title"
                  value={settings.about_title}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  About Description
                </label>
                <textarea
                  name="about_description"
                  value={settings.about_description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 text-white placeholder-slate-500 transition-all font-medium resize-none"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <i className="ri-contacts-line text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black text-white">Contact Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Contact Email
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={settings.contact_email}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  name="contact_phone"
                  value={settings.contact_phone}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  name="whatsapp_number"
                  value={settings.whatsapp_number}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                <i className="ri-share-line text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black text-white">Social Media Links</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Facebook URL
                </label>
                <input
                  type="url"
                  name="facebook_url"
                  value={settings.facebook_url}
                  onChange={handleChange}
                  placeholder="https://facebook.com/yourpage"
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Twitter URL
                </label>
                <input
                  type="url"
                  name="twitter_url"
                  value={settings.twitter_url}
                  onChange={handleChange}
                  placeholder="https://twitter.com/yourhandle"
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                  Instagram URL
                </label>
                <input
                  type="url"
                  name="instagram_url"
                  value={settings.instagram_url}
                  onChange={handleChange}
                  placeholder="https://instagram.com/yourhandle"
                  className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 text-white placeholder-slate-500 transition-all font-medium"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-400">
                <i className="ri-layout-bottom-line text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black text-white">Footer</h2>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">
                Footer Text
              </label>
              <input
                type="text"
                name="footer_text"
                value={settings.footer_text}
                onChange={handleChange}
                className="w-full px-5 py-4 bg-slate-900/50 border border-slate-700 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 text-white placeholder-slate-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* System Preferences */}
          <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <i className="ri-settings-4-line text-2xl"></i>
              </div>
              <h2 className="text-2xl font-black text-white">System Preferences</h2>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-xl border border-slate-800">
              <div>
                <p className="text-white font-bold text-lg mb-1">Global SMS Notifications</p>
                <p className="text-slate-400 text-sm">
                  Enable or disable all automated SMS messages (OTP, Deal Alerts, Welcome messages).
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_sms !== false}
                  onChange={(e) => setSettings({ ...settings, enable_sms: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <i className="ri-save-line"></i>
                  Save Changes
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
