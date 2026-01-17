import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type ProtectedRouteProps = {
    children: React.ReactNode;
    allowedRoles?: string[];
};

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, profile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-bold uppercase tracking-widest text-xs">Authenticating...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If specific roles are required and the user doesn't have the permission
    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
        // SMART REDIRECT: If a buyer is trying to access a seller route, send them to status page
        if (profile.role === 'buyer' && location.pathname.startsWith('/seller')) {
            return <Navigate to="/seller/status" replace />;
        }

        // For other unauthorized access, show the Access Denied screen
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 transition-colors duration-500">
                <div className="text-center p-12 max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-slate-800 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full translate-x-8 -translate-y-8 animate-pulse"></div>

                    <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-rose-500/10 transition-transform group-hover:scale-110 duration-500">
                        <i className="ri-shield-keyhole-fill text-4xl"></i>
                    </div>

                    <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-4 tracking-tighter">Access Denied.</h2>
                    <p className="text-gray-500 dark:text-slate-400 font-bold mb-10 leading-relaxed uppercase tracking-widest text-[10px]">
                        Security clearance required for this terminal.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl text-left mb-10 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">{allowedRoles.join(' | ')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">User Identity</span>
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{profile.role}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={() => window.location.href = '/marketplace'}
                            className="h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-900/10"
                        >
                            Return to Marketplace
                        </button>
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="h-14 border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                            Back to Login
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem('pentvars_profile');
                                localStorage.removeItem('sys_admin_bypass');
                                window.location.href = '/login';
                            }}
                            className="mt-6 text-rose-500/60 hover:text-rose-500 text-[9px] font-black uppercase tracking-[0.3em] hover:underline"
                        >
                            Force System Reset
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
