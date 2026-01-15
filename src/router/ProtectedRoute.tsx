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
        // Redirect to a specific dashboard or just the home page based on their actual role

        // DEBUG MODE: Show Forbidden instead of Redirect to catch errors
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 max-w-md bg-white rounded-2xl shadow-xl">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="ri-prohibited-line text-3xl"></i>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-500 mb-6">Your current role does not have permission to access this page.</p>

                    <div className="bg-gray-100 p-4 rounded-xl text-left mb-6 text-xs font-mono">
                        <p><span className="font-bold text-gray-700">Required:</span> {allowedRoles.join(', ')}</p>
                        <p><span className="font-bold text-gray-700">Your Role:</span> {profile.role}</p>
                        <p><span className="font-bold text-gray-700">Your ID:</span> {profile.id || 'N/A'}</p>
                    </div>

                    <div className="flex flex-col gap-3 justify-center">
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => window.location.href = '/marketplace'}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold text-sm"
                            >
                                Go to Marketplace
                            </button>
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold text-sm"
                            >
                                Back to Login
                            </button>
                        </div>
                        <button
                            onClick={() => {
                                localStorage.removeItem('pentvars_profile');
                                localStorage.removeItem('sys_admin_bypass');
                                localStorage.removeItem('sb-access-token'); // Clear supabase token if known key, or just general cleanup
                                window.location.href = '/login';
                            }}
                            className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-widest hover:underline"
                        >
                            Force Sign Out / Reset
                        </button>
                    </div>
                </div>
            </div>
        );

        /* Original Redirect Logic - Temporarily Disabled
        if (profile.role === 'admin') return <Navigate to="/admin" replace />;
        if (profile.role === 'seller') return <Navigate to="/seller/dashboard" replace />;
        if (profile.role === 'news_publisher') return <Navigate to="/publisher" replace />;
        return <Navigate to="/marketplace" replace />;
        */
    }

    return <>{children}</>;
}
