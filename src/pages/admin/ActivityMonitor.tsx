import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/feature/Navbar';

interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  action_details: any;
  created_at: string;
  user?: {
    full_name: string;
    email: string;
  };
}

export default function ActivityMonitor() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState(searchParams.get('filter') || 'all');

  useEffect(() => {
    if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
      navigate('/marketplace');
      return;
    }
    fetchActivities();

    // Realtime subscription
    const channel = supabase
      .channel('public:activity_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_logs' },
        (payload) => {
          console.log('New activity:', payload);
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Update filter if URL changes
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter) setFilterType(filter);
  }, [searchParams]);

  const fetchActivities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        user:profiles!user_id(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setActivities(data as any);
    }
    setLoading(false);
  };

  const filteredActivities = filterType === 'all'
    ? activities
    : activities.filter(a => a.action_type === filterType);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'login': return 'ri-login-box-line';
      case 'logout': return 'ri-logout-box-line';
      case 'product_created': return 'ri-add-box-line';
      case 'product_updated': return 'ri-edit-box-line';
      case 'product_deleted': return 'ri-delete-bin-line';
      case 'message_sent': return 'ri-message-line';
      case 'sms_sent': return 'ri-message-2-line';
      case 'application_submitted': return 'ri-file-list-line';
      default: return 'ri-information-line';
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'login': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'logout': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
      case 'product_created': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'product_updated': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'product_deleted': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
      case 'message_sent': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'sms_sent': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 pb-20 font-sans">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 box-border">
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-widest border border-amber-200 dark:border-amber-800">
                Security & Logs
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Audit Trails</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Real-time monitoring of platform events and security actions.</p>
          </div>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wide shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <i className="ri-arrow-left-line text-lg"></i> Dashboard
          </button>
        </div>

        {/* Filter */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-2 mb-8 shadow-sm overflow-x-auto">
          <div className="flex items-center space-x-2">
            {[
              { id: 'all', label: 'All Events' },
              { id: 'login', label: 'Logins' },
              { id: 'product_created', label: 'Products' },
              { id: 'sms_sent', label: 'SMS' },
              { id: 'message_sent', label: 'Messages' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => {
                  setFilterType(filter.id);
                  navigate(`?filter=${filter.id}`, { replace: true });
                }}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-xl transition-all whitespace-nowrap cursor-pointer ${filterType === filter.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm p-6 md:p-8">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">Loading logs...</p>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <i className="ri-history-line text-4xl text-slate-300 dark:text-slate-500"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No activities found</h3>
              <p className="text-slate-500 max-w-sm mx-auto">Activities will appear here as users interact with the platform.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 group"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${getActionColor(activity.action_type)} group-hover:scale-110 transition-transform`}>
                    <i className={`${getActionIcon(activity.action_type)} text-xl`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {activity.user?.full_name || 'System / Unknown'}
                      </h3>
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                        {new Date(activity.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getActionColor(activity.action_type)} bg-opacity-20`}>
                        {activity.action_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {activity.action_details && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl mt-2 overflow-x-auto border border-slate-100 dark:border-slate-800">
                        {typeof activity.action_details === 'string' ? activity.action_details : JSON.stringify(activity.action_details, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
