import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type Internship = {
    id: string;
    title: string;
    company: string;
    location: string;
    type: string;
    source: string;
    description: string;
    url: string;
    logo_url?: string;
    posted_at: string;
    created_at: string;
    is_active: boolean;
};

// Fallback Mock Data (matches the database schema)
const MOCK_DATA: Internship[] = [
    {
        id: '1',
        title: 'Software Engineering Intern',
        company: 'Tech Co Ghana',
        location: 'Accra, Ghana',
        type: 'Full-time',
        source: 'LinkedIn',
        description: 'Join our dynamic team to build the future of fintech in Africa.',
        posted_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        logo_url: 'https://ui-avatars.com/api/?name=Tech+Co&background=0D8ABC&color=fff',
        url: '#',
        created_at: new Date().toISOString(),
        is_active: true
    },
    {
        id: '2',
        title: 'Data Science Intern',
        company: 'Global Corp',
        location: 'Remote (USA)',
        type: 'Part-time',
        source: 'LinkedIn',
        description: 'Analyze large datasets and build predictive models.',
        posted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
        logo_url: 'https://ui-avatars.com/api/?name=Global+Corp&background=6366f1&color=fff',
        url: '#',
        created_at: new Date().toISOString(),
        is_active: true
    },
    {
        id: '3',
        title: 'Marketing Specialist Intern',
        company: 'Sowutoum Media',
        location: 'Sowutoum, Ghana',
        type: 'On-site',
        source: 'Direct',
        description: 'Assist in managing social media campaigns for local businesses.',
        posted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        logo_url: 'https://ui-avatars.com/api/?name=Sowutoum+Media&background=f43f5e&color=fff',
        url: '#',
        created_at: new Date().toISOString(),
        is_active: true
    },
    {
        id: '4',
        title: 'Graphic Design Intern',
        company: 'Creative Studio',
        location: 'London, UK (Remote)',
        type: 'Internship',
        source: 'Abroad',
        description: 'Create stunning visuals for international clients.',
        posted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        logo_url: 'https://ui-avatars.com/api/?name=Creative+Studio&background=10b981&color=fff',
        url: '#',
        created_at: new Date().toISOString(),
        is_active: true
    }
];

export function useInternships(filters?: { search?: string; type?: string }) {
    return useQuery({
        queryKey: ['internships', filters],
        queryFn: async () => {
            const results: Internship[] = [];

            // 1. Fetch from Supabase
            try {
                let dbQuery = supabase
                    .from('internships')
                    .select('*')
                    .eq('is_active', true);

                // Apply search filter if present
                if (filters?.search) {
                    const searchTerm = filters.search.trim();
                    // Using .or() to search across title and company
                    dbQuery = dbQuery.or(`title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
                }

                const { data, error } = await dbQuery.order('posted_at', { ascending: false });

                if (error) {
                    console.warn('Fetching Supabase internships failed:', error);
                } else if (data && data.length > 0) {
                    results.push(...data);
                }
            } catch (err) {
                console.error('Supabase error:', err);
            }

            // 2. Fetch from LinkedIn (Multi-Query Strategy to Maximize Results)
            const { fetchLinkedInJobs } = await import('../lib/linkedin-service');

            const baseSearch = filters?.search ? `${filters.search} Internship` : 'Internship';

            // We'll run multiple queries to get a diverse set of results
            const queries = [
                baseSearch,
                'Internship Ghana',
                'Remote Internship',
                'Software Engineering Internship',
                'Marketing Internship'
            ];

            // Remove duplicates if baseSearch overlaps
            const uniqueQueries = [...new Set(queries)];

            console.log('Fetching LinkedIn jobs for queries:', uniqueQueries);

            const linkedInPromises = uniqueQueries.map(q => fetchLinkedInJobs(q));
            const linkedInResults = await Promise.all(linkedInPromises);

            // Flatten results
            const allLinkedInJobs = linkedInResults.flat();

            const mappedLinkedInJobs: Internship[] = allLinkedInJobs.map(job => {
                const id = job.job_id || job.id || Math.random().toString();
                const title = job.job_title || job.title || 'Internship';
                const company = job.employer_name || job.organization || 'Unknown Company';

                let location = 'Remote';
                if (job.locations_derived && job.locations_derived.length > 0) {
                    location = job.locations_derived[0];
                } else if (job.job_city || job.job_country) {
                    location = `${job.job_city || ''}, ${job.job_country || ''}`.replace(/^, /, '').trim();
                }

                // Handle employment type (array or string)
                let type = 'Internship';
                if (Array.isArray(job.employment_type) && job.employment_type.length > 0) {
                    type = job.employment_type[0]; // e.g. "INTERN"
                } else if (job.job_employment_type) {
                    type = job.job_employment_type;
                }

                const url = job.job_apply_link || job.url || '#';
                const logo_url = job.employer_logo || job.organization_logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(company)}&background=0077b5&color=fff`;
                const posted_at = job.job_posted_at_datetime_utc || job.date_posted || new Date().toISOString();

                return {
                    id,
                    title,
                    company,
                    location,
                    type,
                    source: 'LinkedIn',
                    description: job.job_description || '',
                    url,
                    logo_url,
                    posted_at,
                    created_at: new Date().toISOString(),
                    is_active: true
                };
            });

            // Combine results
            // Deduplicate by ID just in case
            const allJobs = [...results, ...mappedLinkedInJobs];
            const uniqueJobs = Array.from(new Map(allJobs.map(item => [item.id, item])).values());

            // Sort by date (newest first)
            return uniqueJobs.sort((a, b) =>
                new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
            );
        },
        staleTime: 0, // Real-time: Always refetch on mount
    });
}
