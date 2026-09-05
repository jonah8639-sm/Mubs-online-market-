import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  Phone, 
  MessageCircle, 
  Calendar, 
  Star, 
  Package, 
  GraduationCap, 
  Building2,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Product } from '../types';
import { isOfficialMubsEmail, cleanUgandaPhone } from '../lib/mubsValidation';
import { ProductCard } from './ProductCard';

interface SellerProfileModalProps {
  sellerId: string;
  onClose: () => void;
  onSelectProduct?: (product: Product) => void;
  currentUser?: UserProfile | null;
}

export const SellerProfileModal: React.FC<SellerProfileModalProps> = ({
  sellerId,
  onClose,
  onSelectProduct,
  currentUser,
}) => {
  const [seller, setSeller] = useState<UserProfile | null>(null);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadSellerData() {
      setLoading(true);
      try {
        // Fetch seller profile doc
        const userRef = doc(db, 'users', sellerId);
        const userSnap = await getDoc(userRef);

        let sellerProfile: UserProfile | null = null;
        if (userSnap.exists()) {
          sellerProfile = {
            id: userSnap.id,
            ...(userSnap.data() as Omit<UserProfile, 'id'>),
          };
        }

        // Fetch seller products
        let prods: Product[] = [];
        try {
          const prodsQuery = query(
            collection(db, 'products'),
            where('seller_id', '==', sellerId)
          );
          const prodsSnap = await getDocs(prodsQuery);
          prods = prodsSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Product, 'id'>),
          }));
        } catch (prodErr) {
          console.warn('Products query fallback for seller:', prodErr);
        }

        // If no user doc found in Firestore, but products exist with seller info, synthesize
        if (!sellerProfile && prods.length > 0) {
          const firstProd = prods[0];
          sellerProfile = {
            id: sellerId,
            email: firstProd.seller_email || '',
            displayName: firstProd.seller_name || 'MUBS Student',
            fullName: firstProd.seller_name || 'MUBS Student',
            phone: firstProd.whatsapp,
            whatsapp: firstProd.whatsapp,
            isMubsVerified: isOfficialMubsEmail(firstProd.seller_email),
            verification_status: isOfficialMubsEmail(firstProd.seller_email) ? 'verified' : 'pending',
            created_at: firstProd.created_at,
          };
        }

        if (isMounted) {
          setSeller(sellerProfile);
          setSellerProducts(prods);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Could not load seller profile:', err);
        if (isMounted) setLoading(false);
      }
    }

    loadSellerData();
    return () => {
      isMounted = false;
    };
  }, [sellerId]);

  if (!sellerId) return null;

  const isVerified = seller?.isMubsVerified || seller?.verification_status === 'verified' || isOfficialMubsEmail(seller?.email || '');
  const isBanned = seller?.is_banned;
  const cleanPhone = cleanUgandaPhone(seller?.phone || seller?.whatsapp || '');
  const joinedDate = seller?.created_at || seller?.createdAt
    ? new Date(seller.created_at || seller.createdAt!).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'MUBS Student';

  const handleWhatsApp = () => {
    if (!cleanPhone) return;
    const text = encodeURIComponent(
      `Hello ${seller?.fullName || seller?.displayName || 'Seller'}, I saw your student profile on MUBS Market.`
    );
    window.open(`https://wa.me/256${cleanPhone.replace(/^0/, '')}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full my-auto overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#006400] to-emerald-800 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-2xl shadow-inner shrink-0">
              {(seller?.fullName || seller?.displayName || 'S').charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  {seller?.fullName || seller?.displayName || 'MUBS Seller'}
                </h2>
                {isVerified ? (
                  <span className="inline-flex items-center gap-1 bg-blue-500/90 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified MUBS Student
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-amber-500/90 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Unverified Seller - Chat carefully
                  </span>
                )}
              </div>

              <p className="text-xs text-emerald-100 font-mono mt-1">
                {seller?.email || 'Student Account'}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-3 text-xs text-emerald-100">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                  Joined {joinedDate}
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-emerald-300" />
                  {sellerProducts.length} Listed Items
                </span>
                {seller?.total_sales ? (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    {seller.total_sales} Sales Completed
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Warning Banner if Banned or Unverified */}
          {isBanned ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 flex items-start gap-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <span className="font-bold text-sm block">⚠️ ACCOUNT BANNED - Fake MUBS Account</span>
                <p className="mt-0.5">
                  This user has been suspended by Admin for fraudulent details or defaulting on commission payments. Do not transact with this account.
                </p>
              </div>
            </div>
          ) : !isVerified ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 flex items-start gap-3 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-sm block">Unverified Student Account</span>
                <p className="mt-0.5">
                  This seller's MUBS Registration Number has not yet been approved by Admin jonah8639@gmail.com. Always inspect items in person at public MUBS locations (e.g. Guild Canteen or Library) before paying.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 flex items-center gap-3 text-xs">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold block">MUBS Identity Confirmed</span>
                <span className="text-[11px] text-blue-700">Official student identity verified with valid MUBS Registration & WhatsApp number.</span>
              </div>
            </div>
          )}

          {/* Student Profile Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">MUBS Reg Number</span>
              <span className="font-mono font-bold text-xs text-gray-900 block mt-0.5">
                {seller?.regNumber ? seller.regNumber : 'Official MUBS Student'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Campus</span>
              <span className="font-medium text-gray-800 block mt-0.5 truncate" title={seller?.campus || 'MUBS Main Campus - Nakawa'}>
                {seller?.campus || 'MUBS Main Campus (Nakawa)'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Course & Year</span>
              <span className="font-medium text-gray-800 block mt-0.5 truncate" title={`${seller?.course || 'Undergraduate'} ${seller?.year ? `(${seller.year})` : ''}`}>
                {seller?.course || 'Undergraduate'} {seller?.year ? `(${seller.year})` : ''}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">WhatsApp Number</span>
              <span className="font-mono font-bold text-xs text-emerald-700 block mt-0.5">
                {cleanPhone || 'Contact via Product'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Student Trust Rating</span>
              <span className="font-bold text-xs text-amber-600 block mt-0.5">
                {seller?.seller_rating ? `${seller.seller_rating} / 5.0 ⭐` : 'Verified Student'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Completed Sales</span>
              <span className="font-bold text-xs text-gray-900 block mt-0.5">
                {seller?.total_sales || 0} Deals
              </span>
            </div>
          </div>

          {/* Direct WhatsApp Contact CTA */}
          {cleanPhone && !isBanned && (
            <button
              onClick={handleWhatsApp}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Chat with {seller?.fullName || seller?.displayName || 'Seller'} on WhatsApp ({cleanPhone})</span>
            </button>
          )}

          {/* Seller's Products on Marketplace */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                <span>Items Listed by this Student</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  {sellerProducts.length}
                </span>
              </h3>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                Loading student listings...
              </div>
            ) : sellerProducts.length === 0 ? (
              <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-gray-600">No active listings currently</p>
                <p className="text-[11px] text-gray-400 mt-0.5">This seller hasn't posted new items yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {sellerProducts.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    currentUser={currentUser}
                    onClick={() => {
                      onClose();
                      onSelectProduct?.(prod);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
