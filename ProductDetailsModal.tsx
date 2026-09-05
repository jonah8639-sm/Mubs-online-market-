import React from 'react';
import { 
  X, 
  MapPin, 
  ShieldCheck, 
  Sparkles, 
  MessageCircle, 
  Calendar, 
  AlertTriangle, 
  Trash2, 
  CheckCircle2, 
  Share2 
} from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { SUPER_ADMIN_EMAIL } from '../config/admin';
import { Product, UserProfile } from '../types';

interface ProductDetailsModalProps {
  product: Product | null;
  currentUser: UserProfile | null;
  isAdmin: boolean;
  onClose: () => void;
  onBoostClick?: (product: Product) => void;
  onDeleteClick?: (productId: string) => void;
  onStatusChange?: (product: Product, status: 'active' | 'sold') => void;
  onMarkSold?: (product: Product) => void;
  onViewSellerProfile?: (sellerId: string, sellerName: string) => void;
  onStartChat?: (product: Product) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  currentUser,
  isAdmin,
  onClose,
  onBoostClick,
  onDeleteClick,
  onStatusChange,
  onMarkSold,
  onViewSellerProfile,
  onStartChat,
}) => {
  if (!product) return null;

  const isOwner = currentUser?.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();

  const formatUGX = (val: number) => {
    return `UGX ${val.toLocaleString('en-US')}`;
  };

  const isSeller = Boolean(
    currentUser && (
      currentUser.id === product.seller_id ||
      (currentUser.email && product.seller_email && currentUser.email.toLowerCase().trim() === product.seller_email.toLowerCase().trim())
    )
  );

  const handleStartChat = () => {
    if (onStartChat) {
      onStartChat(product);
    }
  };
  const canManage = isSeller || isAdmin || isOwner;

  async function handleDelete(productId: string, prod: Product) {
    if (!window.confirm("Delete this product permanently?")) return;
    try {
      if (isOwner) {
        // OWNER BYPASS - DELETE ANYTHING
        await deleteDoc(doc(db, "products", productId));
        // Try delete image too
        try { 
          if (prod.imageUrl && prod.imageUrl.includes("firebasestorage")) {
            const imageRef = ref(storage, prod.imageUrl);
            await deleteObject(imageRef);
          }
        } catch(e){ console.log("Image delete skip:", e); }
        alert("Deleted successfully by Owner jonah8639@gmail.com");
        window.location.reload();
      } else {
        // Normal user - anti-defaulter check
        if (prod.status === "sold" && prod.commission_status !== "paid") {
          const comm = prod.commission_amount || Math.round((prod.sold_price || prod.price) * 0.05);
          alert(`Cannot delete - You have unpaid commission of ${comm} UGX to 0764117040`);
          return;
        }
        await deleteDoc(doc(db, "products", productId));
        alert("Deleted");
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Delete error:", error);
      alert("Delete failed: " + error.message + ". Check Firestore rules.");
    }
  }

  const handleWhatsApp = () => {
    let cleanNum = product.whatsapp.replace(/\D/g, '');
    if (cleanNum.startsWith('0')) {
      cleanNum = '256' + cleanNum.substring(1);
    } else if (!cleanNum.startsWith('256')) {
      cleanNum = '256' + cleanNum;
    }
    const text = encodeURIComponent(`Hi, I'm interested in ${product.title} on MUBS Market`);
    window.open(`https://wa.me/${cleanNum}?text=${text}`, '_blank');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: `Check out ${product.title} on MUBS Online Market for ${formatUGX(product.price)}`,
          url: window.location.href,
        });
      } catch (err) {
        // Ignored if cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Product link copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 md:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Modal Top Bar */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
              {product.category}
            </span>
            {product.is_boosted && (
              <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-xs">
                <Sparkles className="w-3 h-3 fill-white" />
                Featured
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              title="Share product"
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Close modal"
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 md:p-6 space-y-5">
          
          {/* Main Photo */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 aspect-16/10 max-h-80 w-full flex items-center justify-center">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-contain md:object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
              }}
            />
            {product.status === 'sold' && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                <span className="bg-red-600 text-white font-extrabold text-lg px-6 py-2 rounded-xl shadow-lg uppercase tracking-wider">
                  Item Sold Out
                </span>
              </div>
            )}
          </div>

          {/* Title & Price Header */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-2xl md:text-3xl font-extrabold text-emerald-800 tracking-tight">
                {formatUGX(product.price)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                {product.location}
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 leading-snug">
              {product.title}
            </h1>
          </div>

          {/* Description */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Product Description
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Seller Profile Card */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-emerald-700 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                {product.seller_name ? product.seller_name.charAt(0).toUpperCase() : 'M'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-gray-900 truncate">
                    {product.seller_name || 'MUBS Student'}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Verified MUBS
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {product.seller_email}
                </p>
              </div>
            </div>

            {onViewSellerProfile && product.seller_id && (
              <button
                type="button"
                onClick={() => onViewSellerProfile(product.seller_id, product.seller_name || 'MUBS Student')}
                className="shrink-0 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#006400] text-xs font-bold rounded-xl border border-emerald-200 transition cursor-pointer"
              >
                View Profile
              </button>
            )}
          </div>

          {/* Safety Banner requirement: "Confirm meetup location with seller - campus or hostel" */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-900">Safety First at MUBS:</span>
              <p className="mt-0.5 text-amber-800">
                Confirm meetup location with seller - campus or hostel. Always inspect the item in person in well-lit public university areas before payment.
              </p>
            </div>
          </div>

          {/* Management actions for owner or admin */}
          {canManage && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Listing Management
                </span>
                {isSeller && !product.is_boosted && onBoostClick && (
                  <button
                    onClick={() => onBoostClick(product)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Boost for 5,000 UGX
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {product.status === 'sold' ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-xl bg-gray-200 text-gray-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    Sold (Cannot Undo)
                  </span>
                ) : (
                  canManage && (onMarkSold || onStatusChange) && (
                    <button
                      onClick={() => {
                        if (onMarkSold) {
                          onMarkSold(product);
                        } else if (onStatusChange) {
                          onStatusChange(product, 'sold');
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Mark as Sold
                    </button>
                  )
                )}

                {/* LOOPHOLE 1: Block delete on sold product if commission unpaid, unless Admin or Owner */}
                {onDeleteClick && (
                  product.status === 'sold' && !isAdmin && !isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        const comm = product.commission_amount || Math.round((product.sold_price || product.price) * 0.05);
                        alert(`You cannot delete sold product until you pay commission of UGX ${comm.toLocaleString()} to 0764117040. Go to /my-payments`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600 transition ml-auto cursor-pointer"
                      title="You cannot delete sold product until commission is paid"
                    >
                      <Trash2 className="w-4 h-4" />
                      Locked (Pay Commission to Delete)
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(product.id, product)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition ml-auto cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                      {isOwner ? 'Owner Delete' : 'Delete Listing'}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

        </div>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-0 z-10 bg-white border-t border-gray-100 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <span className="text-xs text-gray-500 block">Price</span>
              <span className="text-lg font-extrabold text-emerald-800 font-sans">
                {formatUGX(product.price)}
              </span>
            </div>

            {isSeller ? (
              <div className="flex-1 py-3 px-4 rounded-2xl bg-gray-100 text-gray-600 font-bold text-center text-xs">
                This is your active listing
              </div>
            ) : (
              <button
                id="chat-negotiate-btn"
                onClick={handleStartChat}
                className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3.5 px-6 rounded-2xl bg-[#006400] hover:bg-[#004d00] active:scale-[0.98] text-white font-bold text-sm shadow-md transition shadow-[#006400]/20 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 fill-white/20" />
                  <span>Chat & Negotiate Inside App</span>
                </div>
                <span className="text-[10px] font-normal text-emerald-200 hidden sm:inline">
                  (Escrow 0764117040 Protected)
                </span>
              </button>
            )}
          </div>

          {/* Huge Red Button for Owner */}
          {isOwner && (
            <button
              type="button"
              id="owner-force-delete-btn"
              onClick={() => handleDelete(product.id, product)}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition cursor-pointer border border-red-500 uppercase tracking-wide"
            >
              <Trash2 className="w-5 h-5" />
              <span>OWNER FORCE DELETE (jonah8639@gmail.com)</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
