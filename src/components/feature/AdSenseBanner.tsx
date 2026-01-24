import { useEffect } from 'react';

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

interface AdSenseBannerProps {
    slotId?: string;
    className?: string;
}

export default function AdSenseBanner({ slotId = "0000000000", className = "" }: AdSenseBannerProps) {
    useEffect(() => {
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
            console.error("AdSense load error:", e);
        }
    }, []);

    return (
        <div className={`w-full max-w-7xl mx-auto px-6 lg:px-12 my-8 ${className}`}>
            <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-medium opacity-50">Advertisement</span>
                <div className="w-full bg-gray-50 dark:bg-gray-900/50 rounded-2xl overflow-hidden flex items-center justify-center min-h-[100px] border border-gray-100 dark:border-gray-800 border-dashed">
                    <ins className="adsbygoogle"
                        style={{ display: 'block', width: '100%' }}
                        data-ad-client="ca-pub-3971214695695889"
                        data-ad-slot={slotId}
                        data-ad-format="auto"
                        data-full-width-responsive="true"></ins>
                </div>
            </div>
        </div>
    );
}
