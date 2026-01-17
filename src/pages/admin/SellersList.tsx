import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getOptimizedImageUrl } from '../../lib/imageOptimization';
import Navbar from '../../components/feature/Navbar';

interface SellerProfile {
    id: string;
    user_id: string;
    business_name: string;
    business_category: string;
    business_logo?: string;
    contact_phone?: string;
    contact_email?: string;
    is_active: boolean;
    created_at: string;
    user?: {
        full_name: string;
        email: string;
        phone: string;
    };
}

interface Product {
    id: string;
    name: string;
    price: number;
    price_type: string;
    images: string[];
    is_active: boolean;
    views_count: number;
    created_at: string;
}

export default function SellersList() {
    const navigate = useNavigate();
    const [sellers, setSellers] = useState<SellerProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
    const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSellers();
    }, []);

    const fetchSellers = async () => {
        try {
            setLoading(true);
            // Fetch seller profiles joined with user profiles
            const { data, error } = await supabase
                .from('seller_profiles')
                .select(`
          *,
          user:profiles!user_id (
            full_name,
            email,
            phone
          )
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSellers(data || []);
        } catch (error) {
            console.error('Error fetching sellers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSellerClick = async (seller: SellerProfile) => {
        setSelectedSeller(seller);
        setProductsLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('seller_id', seller.user_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSellerProducts(data || []);
        } catch (error) {
            console.error('Error fetching seller products:', error);
        } finally {
            setProductsLoading(false);
        }
    };

    const filteredSellers = sellers.filter(seller =>
        seller.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        seller.user?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <Navbar />

            <div className="max-w-[1600px] mx-auto px-6 lg:px-8 pt-32 pb-20">

                {/* Header Navigation */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => selectedSeller ? setSelectedSeller(null) : navigate('/admin/dashboard')}
                        className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
                    >
                        <i className="ri-arrow-left-line"></i>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            {selectedSeller ? selectedSeller.business_name : 'Registered Merchants'}
                        </h1>
                        <p className="text-slate-400 text-sm font-medium">
                            {selectedSeller ? 'Merchant Profile & Inventory' : 'Manage and monitor all active sellers'}
                        </p>
                    </div>
                </div>

                {!selectedSeller ? (
                    <>
                        {/* Search & Stats Bar */}
                        <div className="flex flex-col md:flex-row gap-4 mb-8">
                            <div className="relative flex-1">
                                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <input
                                    type="text"
                                    placeholder="Search by business name or owner..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none font-medium"
                                />
                            </div>
                            <div className="px-6 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                    <i className="ri-store-2-fill"></i>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Merchants</p>
                                    <p className="text-lg font-black text-white leading-none">{sellers.length}</p>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-40">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-slate-500 font-bold animate-pulse">Loading Merchants...</p>
                                </div>
                            </div>
                        ) : filteredSellers.length === 0 ? (
                            <div className="text-center py-40 bg-slate-800/30 rounded-[3rem] border border-slate-700/30 backdrop-blur-sm">
                                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <i className="ri-store-2-line text-5xl text-slate-600"></i>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No Merchants Found</h3>
                                <p className="text-slate-400">Try adjusting your search terms</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredSellers.map(seller => (
                                    <div
                                        key={seller.id}
                                        onClick={() => handleSellerClick(seller)}
                                        className="group relative bg-slate-800/50 border border-slate-700/50 rounded-[2rem] p-6 cursor-pointer hover:bg-slate-800 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1"
                                    >
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 overflow-hidden border border-slate-600/50 group-hover:border-blue-500/50 transition-colors shadow-lg">
                                                {seller.business_logo ? (
                                                    <img
                                                        src={getOptimizedImageUrl(seller.business_logo, 100, 100)}
                                                        alt={seller.business_name}
                                                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                        <i className="ri-store-3-line text-2xl"></i>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors truncate">{seller.business_name}</h3>
                                                <span className="inline-block px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                                                    {seller.business_category}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-slate-700/50">
                                            <div className="flex items-center gap-3 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                                                <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-blue-500/70">
                                                    <i className="ri-user-smile-line"></i>
                                                </div>
                                                <span className="truncate font-medium">{seller.user?.full_name || 'Unknown'}</span>
                                            </div>

                                            <div className="flex items-center gap-3 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                                                <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-blue-500/70">
                                                    <i className="ri-mail-line"></i>
                                                </div>
                                                <span className="truncate font-medium">{seller.contact_email || seller.user?.email}</span>
                                            </div>
                                        </div>

                                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 duration-300">
                                            <i className="ri-arrow-right-line text-slate-400"></i>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    /* Detailed View */
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in slide-in-from-right-8 duration-500">
                        {/* Left Col: Profile Card */}
                        <div className="xl:col-span-1 space-y-6">
                            <div className="bg-slate-800/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-slate-700 shadow-xl overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>

                                <div className="relative z-10 text-center">
                                    <div className="w-40 h-40 mx-auto rounded-[2rem] bg-slate-900 border-4 border-slate-700/50 overflow-hidden mb-6 shadow-2xl group">
                                        {selectedSeller.business_logo ? (
                                            <img
                                                src={getOptimizedImageUrl(selectedSeller.business_logo, 400, 400)}
                                                alt={selectedSeller.business_name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                <i className="ri-store-3-line text-5xl"></i>
                                            </div>
                                        )}
                                    </div>

                                    <h2 className="text-2xl font-black text-white mb-2">{selectedSeller.business_name}</h2>
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-black uppercase tracking-widest border border-blue-500/20 mb-8">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                                        {selectedSeller.business_category}
                                    </div>

                                    <div className="space-y-4 text-left">
                                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                                                <i className="ri-user-3-line"></i>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Merchant Name</label>
                                                <p className="text-white font-bold">{selectedSeller.user?.full_name}</p>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                                                <i className="ri-mail-send-line"></i>
                                            </div>
                                            <div className="overflow-hidden">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Email Address</label>
                                                <p className="text-white font-bold truncate">{selectedSeller.contact_email}</p>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50 flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                                                <i className="ri-phone-line"></i>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phone Number</label>
                                                <p className="text-white font-bold">{selectedSeller.contact_phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 pt-8 border-t border-slate-700/50">
                                        <div className="flex justify-between items-center text-xs font-medium text-slate-500">
                                            <span>Joined Platform</span>
                                            <span>{new Date(selectedSeller.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Col: Inventory */}
                        <div className="xl:col-span-2">
                            <div className="bg-slate-800/50 backdrop-blur-sm rounded-[2.5rem] p-8 border border-slate-700/50 min-h-[600px]">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                    <div>
                                        <h3 className="text-xl font-black text-white flex items-center gap-3">
                                            <i className="ri-layout-grid-line text-blue-500"></i>
                                            Merchant Inventory
                                        </h3>
                                        <p className="text-slate-400 text-sm mt-1">Analyzing all listed products and services</p>
                                    </div>
                                    <span className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold border border-slate-700 shadow-lg">
                                        {sellerProducts.length} Items Listed
                                    </span>
                                </div>

                                {productsLoading ? (
                                    <div className="flex flex-col items-center justify-center py-40">
                                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Fetching Inventory...</p>
                                    </div>
                                ) : sellerProducts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-40 text-slate-500 bg-slate-900/30 rounded-[2rem] border-2 border-dashed border-slate-800">
                                        <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                                            <i className="ri-shopping-basket-2-line text-3xl opacity-50"></i>
                                        </div>
                                        <p className="text-sm font-bold uppercase tracking-widest">No products in inventory</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                                        {sellerProducts.map(product => (
                                            <div key={product.id} className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-4 flex gap-5 group hover:border-blue-500/30 hover:bg-slate-900 transition-all duration-300">
                                                <div className="w-24 h-24 bg-slate-800 rounded-xl overflow-hidden flex-shrink-0 relative">
                                                    {product.images?.[0] ? (
                                                        <img src={getOptimizedImageUrl(product.images[0], 200, 200)} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                                            <i className="ri-image-line text-2xl"></i>
                                                        </div>
                                                    )}
                                                    <div className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${product.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                                </div>

                                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                    <h4 className="font-bold text-lg text-white truncate pr-2 group-hover:text-blue-400 transition-colors" title={product.name}>{product.name}</h4>
                                                    <p className="text-emerald-400 font-black text-lg">
                                                        {product.price_type === 'fixed' ? `GH₵${product.price}` : 'Negotiable'}
                                                    </p>

                                                    <div className="flex items-center gap-4 mt-3">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-800 px-2 py-1 rounded-lg">
                                                            <i className="ri-eye-fill text-blue-500"></i> {product.views_count}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-800 px-2 py-1 rounded-lg">
                                                            <i className="ri-time-line text-amber-500"></i> {new Date(product.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
