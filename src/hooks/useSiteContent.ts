import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const CONTENT_KEYS = {
    HOME_HERO_MAIN: 'home_hero_main',
    HOME_HERO_AERIAL: 'home_hero_aerial',
    MARKETPLACE_BANNER: 'marketplace_banner',
    NEWS_BANNER: 'news_banner',
};

const DEFAULTS = {
    [CONTENT_KEYS.HOME_HERO_MAIN]: '/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-2-1536x1152.jpeg',
    [CONTENT_KEYS.HOME_HERO_AERIAL]: '/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-11.jpeg',
    [CONTENT_KEYS.MARKETPLACE_BANNER]: '/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-11.jpeg',
    [CONTENT_KEYS.NEWS_BANNER]: '/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-2-1536x1152.jpeg',
};

export function useSiteContent(key: string) {
    const [url, setUrl] = useState<string>(DEFAULTS[key] || '');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function checkContent() {
            try {
                // 1. Check persistent cache
                const cached = localStorage.getItem(`site_content_${key}`);
                if (cached && mounted) {
                    setUrl(cached);
                }

                // 2. Silently check for config file existence to avoid noisy 400 errors
                const { data: files } = await supabase.storage
                    .from('uploads')
                    .list('', { limit: 1, search: 'site_config.json' });

                if (!files || files.length === 0) {
                    if (mounted) setLoading(false);
                    return;
                }

                // 3. Download and parse
                const { data: blob, error: downloadError } = await supabase.storage
                    .from('uploads')
                    .download('site_config.json');

                if (downloadError) throw downloadError;

                if (blob && mounted) {
                    const text = await blob.text();
                    const config = JSON.parse(text);
                    const remoteUrl = config[key];

                    if (remoteUrl && remoteUrl !== cached) {
                        setUrl(remoteUrl);
                        localStorage.setItem(`site_content_${key}`, remoteUrl);
                    }
                }
            } catch (err) {
                // Completely silent for site content - defaults are fine
            } finally {
                if (mounted) setLoading(false);
            }
        }

        checkContent();
        return () => { mounted = false; };
    }, [key]);

    return { url, loading };
}
