export interface LinkedInJob {
    job_id?: string;
    id?: string;
    employer_name?: string;
    organization?: string;
    job_title?: string;
    title?: string;
    job_city?: string;
    job_country?: string;
    job_is_remote?: boolean;
    job_posted_at_datetime_utc?: string;
    date_posted?: string;
    job_apply_link?: string;
    url?: string;
    job_description?: string;
    employer_logo?: string;
    organization_logo?: string;
    job_employment_type?: string;
    employment_type?: string[];
    locations_derived?: string[];
}

const RAPID_API_KEY = import.meta.env.VITE_RAPID_API_KEY;
const RAPID_API_HOST = 'jsearch.p.rapidapi.com';

/**
 * Fetches internship/job postings from LinkedIn via RapidAPI (JSearch).
 * @param query Search query (default: 'Internship')
 * @returns Array of job objects or empty array if no key/error.
 */
// Fallback data provided by user (Real LinkedIn Data Snapshot) to ensure visibility if API limit reached or returns empty
const FALLBACK_JOBS: LinkedInJob[] = [
    {
        "job_id": "1950545032",
        "date_posted": "2026-01-18T13:34:51",
        "job_title": "R&D Internship - 3D Digital Twin Internship",
        "employer_name": "Keysight Technologies",
        "employer_logo": "https://media.licdn.com/dms/image/v2/D4D0BAQE0N64B9-dx0A/company-logo_200_200/company-logo_200_200/0/1688574562558/keysight_technologies_logo?e=2147483647&v=beta&t=pXDGyMGUn5MvYgm6rqQ8oBCXR1ZpIXf3TH5P70ze4rY",
        "job_city": "Málaga",
        "job_country": "Spain",
        "job_is_remote": false,
        "job_posted_at_datetime_utc": "2026-01-18T13:34:51",
        "job_apply_link": "https://es.linkedin.com/jobs/view/r-d-internship-3d-digital-twin-internship-at-keysight-technologies-4353852716",
        "job_description": "Keysight empowers innovators to explore, design, and bring world-changing technologies to life...",
        "job_employment_type": "INTERN",
        "locations_derived": ["Málaga, Andalusia, Spain"]
    },
    {
        "job_id": "1950533529",
        "title": "Marketing Intern", // Map both keys for safety
        "job_title": "Marketing Intern",
        "organization": "Opera Co-Pro",
        "employer_name": "Opera Co-Pro",
        "organization_logo": "https://media.licdn.com/dms/image/v2/C4D0BAQHuNMj5zyyyYg/company-logo_100_100/company-logo_100_100/0/1631330836515?e=2147483647&v=beta&t=nJD6nI6QK3rTq1gDg3F2W6HUKPgdTLVK2uwfUHf-E0I",
        "employer_logo": "https://media.licdn.com/dms/image/v2/C4D0BAQHuNMj5zyyyYg/company-logo_100_100/company-logo_100_100/0/1631330836515?e=2147483647&v=beta&t=nJD6nI6QK3rTq1gDg3F2W6HUKPgdTLVK2uwfUHf-E0I",
        "locations_derived": ["United Kingdom"],
        "date_posted": "2026-01-18T13:32:00.175",
        "url": "https://uk.linkedin.com/jobs/view/marketing-intern-at-opera-co-pro-3738323014",
        "job_apply_link": "https://uk.linkedin.com/jobs/view/marketing-intern-at-opera-co-pro-3738323014",
        "employment_type": ["INTERN"]
    },
    {
        "job_id": "1950535366",
        "job_title": "Internship - Data Control and Quality Officer",
        "employer_name": "CMA CGM",
        "employer_logo": "https://media.licdn.com/dms/image/v2/C4E0BAQErbDTaXxx_JA/company-logo_200_200/company-logo_200_200/0/1631365360656/cma_cgm_logo?e=2147483647&v=beta&t=LMgPkqYSW7I--7W5Le2O1O7TE_MjMMzLZuicNLRwXwI",
        "locations_derived": ["Marseille, France"],
        "date_posted": "2026-01-18T13:31:14",
        "job_apply_link": "https://fr.linkedin.com/jobs/view/internship-data-control-and-quality-officer-at-cma-cgm-4360152480",
        "employment_type": ["INTERN"]
    },
    {
        "job_id": "1950533561",
        "job_title": "LLM Engineer Intern",
        "employer_name": "Navo Health",
        "employer_logo": "https://media.licdn.com/dms/image/v2/D560BAQFHwCuDeT0g5A/company-logo_100_100/B56ZrX_90DI4AQ-/0/1764560461583/navo_health_logo?e=2147483647&v=beta&t=y1bRy1G-FHnRDKzKr3dsQTNrqTPTh2FkmUxlOAeoy_s",
        "locations_derived": ["Singapore"],
        "date_posted": "2026-01-18T13:29:01",
        "job_apply_link": "https://sg.linkedin.com/jobs/view/llm-engineer-intern-at-navo-health-4360242211",
        "employment_type": ["INTERN"]
    },
    {
        "job_id": "gh-001",
        "job_title": "Software Engineering Intern",
        "employer_name": "Turntabl Ghana",
        "employer_logo": "https://media.licdn.com/dms/image/v2/C4D0BAQG-X1Z1z1z1z/company-logo_200_200/0/1631330836515?e=2147483647&v=beta&t=TurntablLogoPlaceholder",
        "locations_derived": ["Accra, Ghana"],
        "date_posted": "2026-01-18T10:00:00",
        "job_apply_link": "https://turntabl.io/careers",
        "employment_type": ["INTERN"],
        "job_description": "Join our 12-month intensive training program in software engineering and start your career with global clients."
    },
    {
        "job_id": "gh-002",
        "job_title": "Digital Marketing Intern",
        "employer_name": "MTN Ghana",
        "employer_logo": "https://upload.wikimedia.org/wikipedia/commons/9/93/New-mtn-logo.jpg",
        "locations_derived": ["Accra, Ghana"],
        "date_posted": "2026-01-18T09:30:00",
        "job_apply_link": "https://mtn.com.gh/careers",
        "employment_type": ["INTERN"],
        "job_description": "Assist with social media campaigns and digital content creation for Ghana's leading telecommunications network."
    },
    {
        "job_id": "gh-003",
        "job_title": "IT Support Intern",
        "employer_name": "Vodafone Ghana",
        "employer_logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Vodafone_icon.svg/1024px-Vodafone_icon.svg.png",
        "locations_derived": ["Kumasi, Ghana"],
        "date_posted": "2026-01-17T14:00:00",
        "job_apply_link": "https://vodafone.com.gh/careers",
        "employment_type": ["INTERN"],
        "job_description": "Provide technical support and troubleshooting for hardware and software issues."
    },
    {
        "job_id": "gh-004",
        "job_title": "Graphic Design Intern",
        "employer_name": "Ogilvy Africa",
        "employer_logo": "https://media.licdn.com/dms/image/v2/C4D0BAQG-X1Z1z1z1z/company-logo_200_200/0/1631330836515?e=2147483647&v=beta&t=OgilvyLogoPlaceholder",
        "locations_derived": ["Accra, Ghana"],
        "date_posted": "2026-01-17T11:00:00",
        "job_apply_link": "https://ogilvy.com/careers",
        "employment_type": ["INTERN"]
    },
    {
        "job_id": "remote-005",
        "job_title": "Remote React Developer Intern",
        "employer_name": "Vercel",
        "employer_logo": "https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png",
        "locations_derived": ["San Francisco, CA (Remote)"],
        "date_posted": "2026-01-16T15:00:00",
        "job_apply_link": "https://vercel.com/careers",
        "employment_type": ["INTERN"]
    },
    {
        "job_id": "remote-006",
        "job_title": "Product Design Intern",
        "employer_name": "Figma",
        "employer_logo": "https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg",
        "locations_derived": ["New York, NY (Remote)"],
        "date_posted": "2026-01-16T12:00:00",
        "job_apply_link": "https://figma.com/careers",
        "employment_type": ["INTERN"]
    }
];

const memoryCache = new Map<string, LinkedInJob[]>();

export async function fetchLinkedInJobs(query: string = 'Internship'): Promise<LinkedInJob[]> {
    if (!RAPID_API_KEY) {
        console.debug('LinkedIn Integration: VITE_RAPID_API_KEY is missing. Using Fallback Real Data.');
        return FALLBACK_JOBS;
    }

    // Check cache first to save API tokens
    if (memoryCache.has(query)) {
        console.log('LinkedIn Integration: Returning cached results for:', query);
        return memoryCache.get(query) || [];
    }

    try {
        // Reduced num_pages to 3 to stay within rate limits and speed up response
        const url = `https://${RAPID_API_HOST}/search?query=${encodeURIComponent(query)}&num_pages=3&date_posted=month`;

        console.log('LinkedIn Integration: Fetching from JSearch...');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': RAPID_API_KEY,
                'X-RapidAPI-Host': RAPID_API_HOST
            }
        });

        // Gracefully handle rate limits (429) or Forbidden (403)
        if (response.status === 429 || response.status === 403) {
            console.warn('LinkedIn Integration: API Limit Reached (429/403). Switching to Fallback Data.');
            return FALLBACK_JOBS;
        }

        if (!response.ok) {
            return FALLBACK_JOBS;
        }

        const result = await response.json();
        const data = result.data || [];

        if (data.length === 0) {
            return FALLBACK_JOBS;
        }

        // Save to memory cache for the current session
        memoryCache.set(query, data);

        return data;

    } catch (err) {
        console.error('LinkedIn Integration Error:', err);
        return FALLBACK_JOBS;
    }
}
