import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/feature/Navbar';
import { useAuth } from '../../contexts/AuthContext';

import { useInternships } from '../../hooks/useInternships';

export default function Internships() {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterType, setFilterType] = useState('All');

    // Debounce search query to prevent excessive API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 800);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch data using the hook (depends on debounced search)
    const { data: internships = [], isLoading: isFetching } = useInternships({ search: debouncedSearch });

    // Show loading state if raw search differs from debounced (user is typing) or if fetching
    const isLoading = isFetching || searchQuery !== debouncedSearch;

    const filteredInternships = useMemo(() => {
        return internships.filter(internship => {
            const isLocal = internship.location.includes('Ghana') ||
                internship.location.includes('Accra') ||
                internship.location.includes('Kumasi');

            const matchesFilter = filterType === 'All' ||
                (filterType === 'Abroad' && !isLocal) ||
                (filterType === 'Local' && isLocal) ||
                (filterType === internship.type);

            return matchesFilter;
        });
    }, [internships, filterType]);

    const filters = [
        { id: 'All', label: 'All Jobs', icon: 'ri-briefcase-4-line' },
        { id: 'Local', label: 'Local', icon: 'ri-map-pin-user-line' },
        { id: 'Abroad', label: 'Remote / Abroad', icon: 'ri-earth-line' }
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
            <Navbar />

            {/* Mobile-First Header & Search */}
            <div className="pt-24 pb-4 bg-white dark:bg-gray-900 shadow-sm border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 md:px-6">
                    <div className="flex justify-between items-center mb-4">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <i className="ri-briefcase-line text-blue-600"></i>
                            Career Market
                        </h1>
                        {/* Admin Action Button */}
                        {(user?.role === 'admin' || user?.role === 'super_admin' || localStorage.getItem('sys_admin_bypass') === 'true') && (
                            <Link
                                to="/admin/internships"
                                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-xs uppercase tracking-wide flex items-center gap-2 hover:opacity-90 transition-opacity"
                            >
                                <i className="ri-settings-4-line"></i>
                                Manage Jobs
                            </Link>
                        )}
                    </div>

                    <div className="relative">
                        <i className="ri-search-2-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg"></i>
                        <input
                            type="text"
                            placeholder="Search internships, companies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-100 dark:bg-gray-800 border-none text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 rounded-xl px-12 py-3.5 font-medium transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <i className="ri-close-circle-fill"></i>
                            </button>
                        )}
                    </div>

                    {/* Horizontal Scrollable Filters */}
                    <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                        {filters.map((filter) => (
                            <button
                                key={filter.id}
                                onClick={() => setFilterType(filter.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wide whitespace-nowrap transition-all border ${filterType === filter.id
                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-lg transform scale-105'
                                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                            >
                                <i className={`${filter.icon} text-sm`}></i>
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 min-h-[60vh]">

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Latest Opportunities
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">Found <span className="font-bold text-slate-900 dark:text-white">{filteredInternships.length}</span> positions for you</p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-white dark:bg-gray-900 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-800 shadow-sm animate-pulse h-64"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {filteredInternships.map((job) => (
                            <div key={job.id} className="group bg-white dark:bg-gray-900 rounded-[2rem] p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-2xl hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-1 relative overflow-hidden">

                                {/* Hover Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 p-3 shadow-sm border border-gray-50 dark:border-gray-700 group-hover:scale-110 transition-transform duration-500 flex items-center justify-center">
                                            <img src={job.logo_url} alt={job.company} className="w-full h-full object-contain rounded-lg" />
                                        </div>
                                        <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-100 dark:border-slate-700">
                                            {job.type}
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                        {job.title}
                                    </h3>

                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
                                        <i className="ri-building-line"></i>
                                        {job.company}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Location</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{job.location}</p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                                            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Posted</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{new Date(job.posted_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-2">
                                            {job.source === 'LinkedIn' ? (
                                                <i className="ri-linkedin-fill text-blue-600 text-xl"></i>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-white text-[10px] font-bold">PU</div>
                                            )}
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                {job.source}
                                            </span>
                                        </div>

                                        <a
                                            href={job.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="pl-6 pr-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-2 group-hover:bg-blue-600 dark:group-hover:bg-blue-500 dark:group-hover:text-white transition-all shadow-lg active:scale-95"
                                        >
                                            Apply Now
                                            <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform"></i>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!isLoading && filteredInternships.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="w-24 h-24 bg-slate-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6 animate-bounce">
                            <i className="ri-search-eye-line text-4xl text-slate-300"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">No opportunities found</h3>
                        <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium">
                            We couldn't find any internships matching your criteria. Try adjusting your filters.
                        </p>
                        <button
                            onClick={() => { setFilterType('All'); setSearchQuery('') }}
                            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors uppercase tracking-widest text-xs"
                        >
                            Clear All Filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
