import { useState, useEffect } from 'react';
import { supabase, Advertisement } from '../../lib/supabase';
import { useLocation } from 'react-router-dom';

export default function GlobalAdPopup() {
    const [ad, setAd] = useState<Advertisement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const location = useLocation();

    useEffect(() => {
        // Don't show on login/register/admin pages
        if (['/login', '/register', '/admin'].some(path => location.pathname.startsWith(path))) {
            return;
        }

        const fetchPopupAd = async () => {
            // 1. Check if user dismissed it recently (e.g., in last hour)
            const lastDismissed = sessionStorage.getItem('popup_dismissed');
            if (lastDismissed) return;

            // 2. Fetch active popup ad
            const { data } = await supabase
                .from('advertisements')
                .select('*')
                .eq('placement_area', 'global_popup')
                .eq('status', 'active')
                .lte('start_date', new Date().toISOString())
                .limit(1)
                .maybeSingle();

            if (data && data.image_url) {
                setAd(data);
                // Delay slightly for effect
                setTimeout(() => setIsVisible(true), 2000);

                // Track Impression
                await supabase.rpc('increment_ad_impression', { ad_id: data.id });
            }
        };

        fetchPopupAd();
    }, [location.pathname]);

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('popup_dismissed', 'true');
    };

    const handleClick = async () => {
        if (!ad) return;
        // Track Click
        await supabase.rpc('increment_ad_click', { ad_id: ad.id });
        if (ad.destination_url) {
            window.open(ad.destination_url, '_blank');
        }
        handleDismiss();
    };

    if (!ad || !isVisible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <button
                    onClick={handleDismiss}
                    className="absolute top-4 right-4 w-8 h-8 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-colors z-10"
                >
                    <i className="ri-close-line text-xl"></i>
                </button>

                <div onClick={handleClick} className="cursor-pointer group relative">
                    <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="w-full h-auto max-h-[70vh] object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-12 flex flex-col items-center text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="px-4 py-2 bg-blue-600 text-white font-bold uppercase tracking-widest text-xs rounded-full hover:bg-blue-700 transition-colors">
                            {ad.destination_url ? 'Learn More' : 'View Offer'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
