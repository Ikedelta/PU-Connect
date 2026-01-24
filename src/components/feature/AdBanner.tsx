import { useState, useEffect } from 'react';
import { supabase, Advertisement } from '../../lib/supabase';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';

interface AdBannerProps {
    placement: 'home_hero' | 'marketplace_sidebar' | 'news_feed';
    className?: string;
}

export default function AdBanner({ placement, className = '' }: AdBannerProps) {
    const [ad, setAd] = useState<Advertisement | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAd();
    }, [placement]);

    const fetchAd = async () => {
        try {
            const { data, error } = await supabase
                .from('advertisements')
                .select('*')
                .eq('placement_area', placement)
                .eq('status', 'active')
                .lte('start_date', new Date().toISOString())
                .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                setAd(data);
                // Track impression
                const { error: rpcError } = await supabase.rpc('increment_ad_impression', { ad_id: data.id });
                if (rpcError) {
                    console.warn('Failed to track impression:', rpcError);
                }
            }
        } catch (err) {
            console.error('Error fetching ad:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClick = async () => {
        if (!ad) return;

        try {
            // Track click
            const { error: rpcError } = await supabase.rpc('increment_ad_click', { ad_id: ad.id });
            if (rpcError) {
                console.warn('Failed to track click:', rpcError);
            }

            if (ad.destination_url) {
                window.open(ad.destination_url, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            console.error('Error handling ad click:', err);
        }
    };

    if (loading) {
        return (
            <div className={`animate-pulse ${className}`}>
                <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden">
                    {placement === 'marketplace_sidebar' ? (
                        <div className="h-[400px]" />
                    ) : placement === 'home_hero' ? (
                        <div className="h-[200px] md:h-[300px]" />
                    ) : (
                        <div className="h-[150px]" />
                    )}
                </div>
            </div>
        );
    }

    if (!ad || !ad.image_url) return null;

    return (
        <div className={`group ${className}`}>
            <div className="text-center mb-2">
                <span className="text-[9px] text-gray-400 dark:text-gray-600 uppercase tracking-widest font-bold">
                    Sponsored
                </span>
            </div>

            <div
                onClick={handleClick}
                className="relative overflow-hidden rounded-2xl cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800"
            >
                <img
                    src={getOptimizedImageUrl(ad.image_url, 800, 600)}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-6">
                    <div className="text-center">
                        <h3 className="text-white font-bold text-lg mb-2">{ad.title}</h3>
                        {ad.destination_url && (
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md text-white rounded-full text-sm font-bold hover:bg-white/30 transition-colors">
                                Learn More <i className="ri-arrow-right-line"></i>
                            </span>
                        )}
                    </div>
                </div>

                {/* Click indicator */}
                {ad.destination_url && (
                    <div className="absolute top-4 right-4 w-8 h-8 bg-white/90 dark:bg-gray-900/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <i className="ri-external-link-line text-gray-700 dark:text-gray-300"></i>
                    </div>
                )}
            </div>
        </div>
    );
}
