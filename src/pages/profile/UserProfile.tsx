import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';
import { useNavigate } from 'react-router-dom';
import ImageUploader from '../../components/base/ImageUploader';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';

export default function UserProfile() {
  // Destructure loading from useAuth
  const { profile, signOut, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    student_id: '',
    department: '',
    faculty: '',
    avatar_url: '',
    phone: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        student_id: profile.student_id || '',
        department: profile.department || '',
        faculty: profile.faculty || '',
        avatar_url: profile.avatar_url || '',
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  // Handle Loading & Auth Redirect
  useEffect(() => {
    if (!authLoading && !profile) {
      // If finished loading and no profile, redirect to login
      // navigate('/login'); // Optional: redirects automatically
    }
  }, [authLoading, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setLoading(true);
    setError(null);

    // Guard for mock user
    if (profile.id === 'sys_admin_001') {
      setTimeout(() => {
        setLoading(false);
        setEditing(false);
        const warnMsg = document.createElement('div');
        warnMsg.className = 'fixed top-6 right-6 bg-amber-500 text-white px-8 py-4 rounded-2xl shadow-2xl z-50 flex items-center font-bold animate-fade-in-up';
        warnMsg.innerHTML = '<i class="ri-alert-line mr-3 text-xl"></i>Bypass User: Changes not saved to DB';
        document.body.appendChild(warnMsg);
        setTimeout(() => warnMsg.remove(), 3000);
      }, 1000);
      return;
    }

    try {
      let finalAvatarUrl = formData.avatar_url;

      // 1. Upload file if a new one was selected
      if (selectedFile) {
        console.log('Uploading new avatar...');
        const { uploadImage, compressImage } = await import('../../lib/uploadImage');
        const compressed = await compressImage(selectedFile);
        const { url } = await uploadImage(compressed, 'profiles');
        finalAvatarUrl = url;
        console.log('Avatar uploaded successfully:', url);
      }

      // 2. Update profiles table
      console.log('Updating profile in database...', formData);
      const { data, error: updateError } = await supabase
        .from('profiles')
        .upsert({
          id: profile.id,
          email: profile.email, // Include email to satisfy not-null constraint on new rows
          full_name: formData.full_name,
          student_id: formData.student_id,
          department: formData.department,
          faculty: formData.faculty,
          avatar_url: finalAvatarUrl,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (updateError) throw updateError;
      if (!data) throw new Error('No data returned after update');

      console.log('Profile updated successfully:', data);

      setSelectedFile(null);
      await refreshProfile();

      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-6 right-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-2xl shadow-2xl z-50 flex items-center font-bold animate-fade-in-up border border-white/10 dark:border-slate-200';
      successMsg.innerHTML = `
        <div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center mr-3">
          <i class="ri-check-line text-white"></i>
        </div>
        Profile updated & saved!
      `;
      document.body.appendChild(successMsg);

      setTimeout(() => {
        successMsg.remove();
        setEditing(false);
      }, 2000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-bold">Loading User Profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-user-unfollow-line text-3xl text-gray-400"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-500 mb-8">We couldn't retrieve your profile information. Please try signing in again.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors uppercase tracking-wide text-xs"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      <Navbar />

      <div className="relative pt-32 pb-20 md:pt-40 md:pb-24 bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/20 z-0"></div>
        {/* Abstract Shapes */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <div className="flex flex-col md:flex-row items-end justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 backdrop-blur-md rounded-full mb-6 animate-fade-in-up">
                <i className="ri-shield-user-line text-blue-400"></i>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
                  ID: {profile.id.substring(0, 8).toUpperCase()}
                </span>
              </div>
              <h1 className="text-4xl md:text-7xl font-bold text-white tracking-tight leading-none mb-4 animate-fade-in-up delay-100">
                Student <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Profile.</span>
              </h1>
            </div>

            <button
              onClick={() => {
                if (editing) {
                  // Revert changes on cancel
                  setFormData({
                    full_name: profile.full_name || '',
                    student_id: profile.student_id || '',
                    department: profile.department || '',
                    faculty: profile.faculty || '',
                    avatar_url: profile.avatar_url || '',
                    phone: profile.phone || '',
                  });
                  setSelectedFile(null);
                }
                setEditing(!editing);
              }}
              className={`group px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl animate-fade-in-up delay-200 cursor-pointer ${editing
                ? 'bg-white text-gray-900 hover:bg-gray-100'
                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/20'}`}
            >
              <span>{editing ? 'Cancel Changes' : 'Edit Information'}</span>
              <i className={editing ? 'ri-close-line text-lg' : 'ri-edit-2-line text-lg'}></i>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 -mt-12 relative z-20 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
          {/* Identity Card */}
          <div className="lg:col-span-4 space-y-8 animate-fade-in-up delay-300">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/20 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-gray-50 to-transparent dark:from-gray-800/50"></div>

              <div className="relative z-10 text-center">
                <div className="w-48 h-48 mx-auto rounded-[2rem] overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-2xl mb-8 relative group/avatar ring-4 ring-white dark:ring-gray-900 flex items-center justify-center">
                  {(editing ? formData.avatar_url : profile.avatar_url) ? (
                    <img
                      src={getOptimizedImageUrl(editing ? formData.avatar_url : profile.avatar_url, 400, 85)}
                      alt={formData.full_name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white relative overflow-hidden">
                      <i className="ri-user-3-fill absolute text-[12rem] opacity-10 translate-y-8"></i>
                      <span className="relative z-10 text-6xl font-black">
                        {(editing ? formData.full_name : profile.full_name || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {editing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-100 transition-all duration-300 flex items-center justify-center cursor-pointer group/upload">
                      <ImageUploader
                        currentImage={formData.avatar_url}
                        onImageUploaded={() => { }} // Not used because autoUpload is false
                        onPreview={(url) => setFormData(prev => ({ ...prev, avatar_url: url }))}
                        onFileSelected={(file) => setSelectedFile(file)}
                        folder="profiles"
                        shape="square"
                        size="large"
                        noBorder={true}
                        hideInternalUI={true}
                        autoUpload={false}
                        className="w-full h-full"
                      />
                      <div className="absolute pointer-events-none text-white text-center group-hover/upload:scale-110 transition-transform duration-300">
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg">
                          <i className="ri-camera-lens-line text-2xl"></i>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] drop-shadow-md">Change Photo</p>
                      </div>
                    </div>
                  )}
                </div>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{editing ? formData.full_name : profile.full_name}</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">{profile.role?.replace('_', ' ')}</p>

                <div className="flex justify-center gap-3 mb-8">
                  {editing && formData.avatar_url !== profile.avatar_url && (
                    <span className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-amber-100 dark:border-amber-900/30 animate-pulse">
                      <i className="ri-eye-line mr-1"></i> Preview Mode
                    </span>
                  )}
                  <span className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-xl">
                    Verified Student
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-8">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Listings</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Orders</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Menu */}
            <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-800 shadow-lg shadow-gray-200/20 dark:shadow-none">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 pl-2">Account Control</p>
              <div className="space-y-2">
                <button onClick={() => navigate('/seller/dashboard')} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <i className="ri-store-2-line text-lg"></i>
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Seller Dashboard</span>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400 group-hover:translate-x-1 transition-transform"></i>
                </button>

                <button onClick={() => navigate('/support')} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <i className="ri-customer-service-2-line text-lg"></i>
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Help & Support</span>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400 group-hover:translate-x-1 transition-transform"></i>
                </button>

                <div className="h-px bg-gray-100 dark:bg-gray-800 my-2"></div>

                <button onClick={handleSignOut} className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <i className="ri-logout-box-line text-lg"></i>
                    </div>
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">Sign Out</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Details & Engagement */}
          <div className="lg:col-span-8 flex flex-col gap-8 animate-fade-in-up delay-400">
            {/* Main Form */}
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-gray-200/10 dark:shadow-none border border-gray-100 dark:border-gray-800 flex-1">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Academic Details</h3>
                {editing && <span className="text-[10px] font-bold text-white bg-blue-600 px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Editing Enabled</span>}
              </div>

              {error && (
                <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-bold">
                  <i className="ri-error-warning-fill text-lg"></i>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    { label: 'Full Name', key: 'full_name', value: formData.full_name, type: 'text', placeholder: 'Your Legal Name', icon: 'ri-user-line' },
                    { label: 'Email Address', key: 'email', value: profile.email, type: 'email', disabled: true, icon: 'ri-mail-line' },
                    { label: 'Phone Number', key: 'phone', value: formData.phone, type: 'tel', placeholder: 'Eg. 055 555 5555', icon: 'ri-phone-line' },
                    { label: 'Student ID', key: 'student_id', value: formData.student_id, type: 'text', placeholder: 'Your Index Number', icon: 'ri-id-card-line' },
                    { label: 'Faculty', key: 'faculty', value: formData.faculty, type: 'text', placeholder: 'Eg. Computing & Engineering', icon: 'ri-building-4-line' },
                    { label: 'Department', key: 'department', value: formData.department, type: 'text', placeholder: 'Eg. Computer Science', icon: 'ri-computer-line' }
                  ].map((field) => (
                    <div key={field.key} className="relative group">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 ml-1">{field.label}</label>
                      <div className={`relative flex items-center rounded-2xl border transition-all duration-300 ${field.disabled ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800' : 'bg-gray-50 dark:bg-gray-800 border-transparent focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-blue-500 focus-within:shadow-lg focus-within:shadow-blue-500/10'}`}>
                        <div className="pl-4 pr-3 text-gray-400">
                          <i className={`${field.icon} text-lg`}></i>
                        </div>
                        <input
                          type={field.type}
                          disabled={field.disabled || !editing}
                          value={field.value}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          className="w-full py-4 bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-900 dark:text-white placeholder-gray-400 disabled:text-gray-500"
                          placeholder={field.placeholder}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {editing && (
                  <div className="pt-8 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-10 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all uppercase tracking-widest text-xs flex items-center gap-3 hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <i className="ri-save-3-line text-lg"></i>}
                      Save Changes
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { label: 'Saved Items', value: 'Wishlist', icon: 'ri-heart-line', color: 'bg-rose-500', path: '/profile#favorites' },
                { label: 'Active Drafts', value: 'Work in Progress', icon: 'ri-draft-line', color: 'bg-amber-500', path: '#' },
                { label: 'Messages', value: 'Inbox', icon: 'ri-message-3-line', color: 'bg-emerald-500', path: '/messages' }
              ].map((stat, i) => (
                <div key={i} onClick={() => stat.path !== '#' && navigate(stat.path)} className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all cursor-pointer group hover:-translate-y-1">
                  <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    <i className={`${stat.icon} text-xl`}></i>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{stat.label}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 group-hover:text-blue-500 transition-colors">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
