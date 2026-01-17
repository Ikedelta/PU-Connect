
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/feature/Navbar';

type Application = {
  id: string;
  user_id: string;
  business_name: string;
  business_category: string;
  business_description: string;
  contact_phone: string;
  contact_email: string;
  business_logo?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string;
    student_id: string;
  };
};

interface SellerApplicationsProps {
  isEmbedded?: boolean;
}

export default function SellerApplications({ isEmbedded = false }: SellerApplicationsProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      navigate('/');
      return;
    }
    fetchApplications();

    // Real-time subscription
    const channel = supabase
      .channel('seller_applications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seller_applications',
        },
        () => {
          fetchApplications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, navigate]);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_applications')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            student_id
          )
        `)
        .order('updated_at', { ascending: false });

      console.log('Admin Dashboard: Current User:', profile?.role, profile?.id); // DEBUG
      console.log('Admin Dashboard: Fetched Applications:', data);
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (application: Application) => {
    if (!confirm(`Approve ${application.business_name}?`)) return;

    setProcessing(true);
    try {
      // Check if admin ID is a valid UUID (system admin has text ID)
      // If we are the system admin (or any non-UUID), we pass null to reviewed_by
      // because the column is UUID type.
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile?.id || '');
      // Ensure we don't pass the dummy UUID which might not exist in profiles table
      const isDummy = profile?.id === '00000000-0000-0000-0000-000000000000';
      const reviewedBy = (isValidUUID && !isDummy) ? profile?.id : null;

      // 1. Update user role to seller FIRST
      const secret = localStorage.getItem('sys_admin_secret') || 'your_secret_admin_key_here';
      const { error: profileError } = await supabase.rpc('admin_update_user_role', {
        target_user_id: application.user_id,
        new_role: 'seller',
        secret_key: secret
      });

      if (profileError) {
        console.warn('RPC role update failed, falling back to direct update:', profileError);
        const { error: directError } = await supabase
          .from('profiles')
          .update({ role: 'seller' })
          .eq('id', application.user_id);
        if (directError) throw directError;
      }

      // 2. Create/Update seller profile
      const { error: sellerError } = await supabase
        .from('seller_profiles')
        .upsert({
          user_id: application.user_id,
          business_name: application.business_name,
          business_category: application.business_category,
          business_description: application.business_description,
          contact_phone: application.contact_phone,
          contact_email: application.contact_email,
          business_logo: application.business_logo,
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (sellerError) throw sellerError;

      // 3. Update application status LAST
      // This triggers the real-time redirect on the status page
      const { error: appError } = await supabase
        .from('seller_applications')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id);

      if (appError) throw appError;

      // Send SMS Notification
      if (application.contact_phone) {
        try {
          const { sendSMS } = await import('../../lib/arkesel');
          const firstName = application.profiles?.full_name.split(' ')[0] || 'User';

          await sendSMS(
            [application.contact_phone],
            `Hi ${firstName}, congratulations! Your seller application for "${application.business_name}" on PU Connect has been APPROVED. You can now log in and start listing your products. Happy selling!`
          );
        } catch (smsErr) {
          console.error('Failed to send approval SMS:', smsErr);
          // Don't block the approval if SMS fails, just log it
        }
      }

      setNotification({ type: 'success', message: 'Application approved successfully!' });
      // The real-time subscription will also catch this, but we fetch to be safe
      fetchApplications();
    } catch (error: any) {
      console.error('Error approving application:', error);
      setNotification({ type: 'error', message: 'Failed to approve: ' + error.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (application: Application) => {
    setSelectedApp(application);
    setRejectionReason('');
    setShowModal(true);
  };

  const handleReset = async (app: Application) => {
    if (!confirm(`Reset application for ${app.business_name} to Pending?`)) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('seller_applications')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', app.id);

      if (error) throw error;

      // If resetting from Approved, we should also revert role
      if (app.status === 'approved') {
        // Use RPC to bypass RLS and guarantee update
        const secret = localStorage.getItem('sys_admin_secret') || 'your_secret_admin_key_here';
        const { error: rpcError } = await supabase.rpc('admin_update_user_role', {
          target_user_id: app.user_id,
          new_role: 'buyer',
          secret_key: secret
        });

        if (rpcError) {
          console.error('Failed to revert role via RPC:', rpcError);
          alert('Warning: Application reset but failed to revert user role.');
        } else {
          // Also deactivate seller profile if exists (using direct update, usually fine if policy set, or could add RPC)
          await supabase.from('seller_profiles').update({ is_active: false }).eq('user_id', app.user_id);
        }
      }

      setNotification({ type: 'success', message: 'Application reset to Pending' });
      fetchApplications();
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Error resetting: ' + err.message });
    } finally {
      setProcessing(false);
    }
  };

  const submitRejection = async () => {
    if (!selectedApp || !rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    setProcessing(true);
    try {
      // Check if we are revoking a dummy system admin (bypass mode)
      // This is less likely for rejection but good to keep safe
      const isDummy = selectedApp.user_id === '00000000-0000-0000-0000-000000000000';
      if (isDummy) {
        // Dummy user doesn't have profile, so we skip role updates
      }

      const { error } = await supabase
        .from('seller_applications')
        .update({
          status: 'rejected',
          admin_notes: rejectionReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedApp.id);

      if (error) throw error;

      // If Revoking an approved app, cleanup
      if (selectedApp.status === 'approved' && !isDummy) {
        const secret = localStorage.getItem('sys_admin_secret') || 'your_secret_admin_key_here';
        await supabase.rpc('admin_update_user_role', {
          target_user_id: selectedApp.user_id,
          new_role: 'buyer',
          secret_key: secret
        });
        await supabase.from('seller_profiles').update({ is_active: false }).eq('user_id', selectedApp.user_id);
      }

      setNotification({ type: 'success', message: 'Application rejected successfully' });
      setShowModal(false);
      setSelectedApp(null);
      fetchApplications();
    } catch (error: any) {
      console.error('Error rejecting application:', error);
      setNotification({ type: 'error', message: 'Failed to reject: ' + error.message });
    } finally {
      setProcessing(false);
    }
  };

  const filteredApplications = applications.filter(app =>
    filter === 'all' ? true : app.status === filter
  );

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    cancelled: applications.filter(a => a.status === 'cancelled').length,
  };

  if (loading) {
    return (
      <div className={isEmbedded ? "py-20" : "min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-300"}>
        {!isEmbedded && <Navbar />}
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading applications...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "animate-in fade-in duration-500" : "min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-300"}>
      {!isEmbedded && <Navbar />}

      <div className={isEmbedded ? "w-full" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12"}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">

            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <i className="ri-file-list-3-line text-2xl text-white"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Seller Applications</h1>
              <p className="text-gray-600 dark:text-gray-400">Review and manage seller applications</p>
            </div>
          </div>
          <button
            onClick={() => fetchApplications()}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold text-xs uppercase tracking-widest rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <i className={`ri-refresh-line ${loading ? 'animate-spin' : ''}`}></i>
            Sync Data
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className={`fixed top-24 right-4 md:right-8 z-50 animate-in fade-in slide-in-from-right-8 duration-300 px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400/50 text-white' :
            notification.type === 'error' ? 'bg-rose-500/90 border-rose-400/50 text-white' :
              'bg-blue-500/90 border-blue-400/50 text-white'
            }`}>
            <i className={`${notification.type === 'success' ? 'ri-checkbox-circle-fill' : notification.type === 'error' ? 'ri-error-warning-fill' : 'ri-notification-3-fill'} text-xl`}></i>
            <span className="font-bold text-sm tracking-wide">{notification.message}</span>
          </div>
        )}

        {/* Stats Cards */}
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Applications</p>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">{stats.total}</h3>
              </div>
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500">
                <i className="ri-file-list-3-fill text-xl"></i>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Pending Review</p>
                <h3 className="text-2xl font-black text-amber-500">{stats.pending}</h3>
              </div>
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500">
                <i className="ri-time-fill text-xl"></i>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Approved</p>
                <h3 className="text-2xl font-black text-emerald-500">{stats.approved}</h3>
              </div>
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-500">
                <i className="ri-checkbox-circle-fill text-xl"></i>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Rejected</p>
                <h3 className="text-2xl font-black text-red-500">{stats.rejected}</h3>
              </div>
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center text-red-500">
                <i className="ri-close-circle-fill text-xl"></i>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cancelled</p>
                <h3 className="text-2xl font-black text-slate-500">{stats.cancelled}</h3>
              </div>
              <div className="w-10 h-10 bg-slate-500/10 rounded-lg flex items-center justify-center text-slate-500">
                <i className="ri-prohibited-line text-xl"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-2 mb-6 border border-gray-100 dark:border-gray-800 shadow-sm inline-flex gap-2 w-full sm:w-auto overflow-x-auto transition-colors">
          {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${filter === status
                ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${filter === status ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                  {stats[status]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Applications List */}
        <div className="space-y-4">
          {filteredApplications.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-800 transition-colors">
              <i className="ri-inbox-line text-6xl text-gray-300 dark:text-gray-700 mb-4"></i>
              <p className="text-gray-500 dark:text-gray-400">No applications found</p>
            </div>
          ) : (
            filteredApplications.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
                        {app.business_logo ? (
                          <img src={`${app.business_logo}?t=${new Date(app.updated_at).getTime()}`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <i className="ri-store-3-line text-2xl text-white"></i>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{app.business_name}</h3>
                          {app.business_name.startsWith('[Mock]') && (
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase rounded">System Test</span>
                          )}
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${app.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            app.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                            }`}>
                            {app.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <i className="ri-user-line mr-1"></i>
                          {app.profiles?.full_name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <i className="ri-price-tag-3-line mr-1"></i>
                          {app.business_category}
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 transition-colors">
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{app.business_description}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <i className="ri-phone-line text-teal-600 dark:text-teal-400"></i>
                        <span>{app.contact_phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <i className="ri-mail-line text-teal-600 dark:text-teal-400"></i>
                        <span>{app.contact_email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                      <span>
                        <i className="ri-calendar-line mr-1"></i>
                        Applied: {new Date(app.created_at).toLocaleDateString()}
                      </span>
                      {app.updated_at !== app.created_at && (
                        <span>
                          <i className="ri-refresh-line mr-1"></i>
                          Updated: {new Date(app.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {app.admin_notes && (
                      <div className="mt-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-4">
                        <p className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">Rejection Reason:</p>
                        <p className="text-sm text-red-800 dark:text-red-200/80">{app.admin_notes}</p>
                      </div>
                    )}
                  </div>



                  <div className="flex flex-col gap-3 lg:w-48">
                    {app.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(app)}
                          disabled={processing}
                          className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <i className="ri-checkbox-circle-line text-lg"></i>
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(app)}
                          disabled={processing}
                          className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <i className="ri-close-circle-line text-lg"></i>
                          Reject
                        </button>
                      </>
                    )}

                    {app.status === 'approved' && (
                      <>
                        <button
                          onClick={() => handleReject(app)}
                          disabled={processing}
                          className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <i className="ri-prohibited-line text-lg"></i>
                          Revoke
                        </button>
                        <button
                          onClick={() => handleReset(app)}
                          disabled={processing}
                          className="w-full px-6 py-3 bg-white border border-yellow-500 text-yellow-600 rounded-lg hover:bg-yellow-50 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <i className="ri-history-line text-lg"></i>
                          Re-evaluate
                        </button>
                      </>
                    )}

                    {app.status === 'rejected' && (
                      <>
                        <button
                          onClick={() => handleApprove(app)}
                          disabled={processing}
                          className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <i className="ri-checkbox-circle-line text-lg"></i>
                          Approve
                        </button>
                        <button
                          onClick={() => handleReset(app)}
                          disabled={processing}
                          className="w-full px-6 py-3 bg-white border border-yellow-500 text-yellow-600 rounded-lg hover:bg-yellow-50 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                          <i className="ri-history-line text-lg"></i>
                          Re-evaluate
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rejection Modal */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <i className="ri-close-circle-line text-2xl text-white"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reject Application</h3>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Please provide a reason for rejecting <strong>{selectedApp?.business_name}</strong>
              </p>

              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none mb-2 outline-none"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">{rejectionReason.length}/500 characters</p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedApp(null);
                  }}
                  disabled={processing}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRejection}
                  disabled={processing || !rejectionReason.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md"
                >
                  {processing ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
