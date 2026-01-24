import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_EVENTS = [
    { id: 1, text: "🎓 Graduation Ceremony scheduled for March 15th", type: "academic" },
    { id: 2, text: "💻 50+ students currently online", type: "live" },
    { id: 3, text: "🔥 New trending item: Apple MacBook Air M1", type: "market" },
    { id: 4, text: "⚽ Inter-faculty football match tomorrow at 4 PM", type: "event" },
    { id: 5, text: "📚 Library extended hours for exam week", type: "academic" },
    { id: 6, text: "🚀 12 new internships added today", type: "career" }
];

export default function CampusPulse() {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % MOCK_EVENTS.length);
        }, 4000); // Change pulse every 4 seconds

        return () => clearInterval(timer);
    }, []);

    const getIcon = (type: string) => {
        switch (type) {
            case 'live': return 'ri-broadcast-fill text-red-500 animate-pulse';
            case 'market': return 'ri-fire-fill text-orange-500';
            case 'academic': return 'ri-book-open-fill text-blue-500';
            case 'event': return 'ri-calendar-event-fill text-purple-500';
            case 'career': return 'ri-briefcase-4-fill text-emerald-500';
            default: return 'ri-notification-3-fill text-gray-500';
        }
    };

    return (
        <div className="w-full bg-slate-900 border-b border-indigo-500/30 overflow-hidden relative h-10 flex items-center z-40">

            {/* Label Badge */}
            <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 md:px-8 flex items-center z-20 shadow-lg shadow-blue-900/50 skew-x-12 -ml-4">
                <div className="-skew-x-12 flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                    </span>
                    <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-widest hidden sm:block">Campus Pulse</span>
                </div>
            </div>

            {/* Scrolling/Fading Ticker */}
            <div className="flex-1 flex items-center justify-center md:justify-start pl-32 md:pl-48 pr-4 relative">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center gap-3 absolute w-full"
                    >
                        <i className={`${getIcon(MOCK_EVENTS[currentIndex].type)} text-lg`}></i>
                        <span className="text-xs md:text-sm font-bold text-slate-200 truncate">
                            {MOCK_EVENTS[currentIndex].text}
                        </span>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Decorative Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-900 to-transparent pointer-events-none z-10"></div>
        </div>
    );
}
