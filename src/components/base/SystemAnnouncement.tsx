import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function SystemAnnouncement() {
    const { user } = useAuth();
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        async function fetchAnnouncement() {
            try {
                const { data, error } = await supabase
                    .from('website_settings')
                    .select('announcement_bar')
                    .single();

                if (data?.announcement_bar) {
                    setMessage(data.announcement_bar);
                }
            } catch (err) {
                // Silent fail
            }
        }

        fetchAnnouncement();
    }, [user]); // Re-check on user change just in case, though it's global

    if (!message || !message.trim()) return null;

    return (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-2 text-center relative z-[60] text-xs md:text-sm font-bold tracking-wide shadow-md animate-fade-in-down">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
                <i className="ri-megaphone-fill animate-pulse"></i>
                <span>{message}</span>
            </div>
        </div>
    );
}
