import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const CONTENT_KEYS = {
    HOME_HERO_MAIN: 'home_hero_main',
    HOME_HERO_AERIAL: 'home_hero_aerial',
    MARKETPLACE_BANNER: 'marketplace_banner',
    NEWS_BANNER: 'news_banner',
};

const DEFAULTS: Record<string, string> = {
    [CONTENT_KEYS.HOME_HERO_MAIN]: '/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-2-1536x1152.jpeg',
    [CONTENT_KEYS.HOME_HERO_AERIAL]: '/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-11.jpeg',
    [CONTENT_KEYS.MARKETPLACE_BANNER]: '/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-11.jpeg',
    [CONTENT_KEYS.NEWS_BANNER]: '/Pentecost-University-Sowutoum-Ghana-SchoolFinder-TortoisePathcom-2-1536x1152.jpeg',
};

// Global shared promise to avoid concurrent downloads of the same config file
let configPromise: Promise<any> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

async function fetchConfig() {
    // Check if we have a fresh cached promise
    if (configPromise && (Date.now() - lastFetchTime < CACHE_DURATION)) {
        return configPromise;
    }

    configPromise = (async () => {
        try {
            const { data: blob, error } = await supabase.storage
                .from('uploads')
                .download('site_config.json');

            if (error || !blob) return null;

            const text = await blob.text();
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    })();

    lastFetchTime = Date.now();
    return configPromise;
}

export function useSiteContent(key: string) {
    const [url, setUrl] = useState<string>(DEFAULTS[key] || '');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function checkContent() {
            try {
                // 1. Sync check persistent cache first
                const cached = localStorage.getItem(`site_content_${key}`);
                if (cached && mounted) {
                    setUrl(cached);
                }

                // 2. Fetch shared config
                const config = await fetchConfig();

                if (config && config[key] && mounted) {
                    if (config[key] !== cached) {
                        setUrl(config[key]);
                        localStorage.setItem(`site_content_${key}`, config[key]);
                    }
                }
            } catch (err) {
                // Silent
            } finally {
                if (mounted) setLoading(false);
            }
        }

        checkContent();
        return () => { mounted = false; };
    }, [key]);

    return { url, loading };
}
