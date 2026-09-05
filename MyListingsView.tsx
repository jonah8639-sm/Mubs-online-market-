import React from 'react';
import { 
  PlusCircle, 
  Sparkles, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Calendar,
  AlertCircle,
  ShieldAlert,
  CreditCard
} from 'lucide-react';
import { Product, UserProfile } from '../types';
import { SUPER_ADMIN_EMAIL } from '../config/admin';
import { 
  COMMISSION_RATE, 
  calculateCommission, 
  formatUGX, 
  evaluatePenaltyStatus 
} from '../lib/commissionConstants';

interface MyListingsViewProps {
  currentUser: UserProfile | null;
  userProducts: Product[];
  onOpenSell: () => void;
  onOpenPricing: (product?: Product) => void;
  onSelectProduct: (product: Product) => void;
  onDeleteProduct: (productId: string, product?: Product) => void;
  onToggleSold: (product: Product) => void;
  onOpenAuth: () => void;
  onNavigateToPayments?: () => void;
}

export const MyListingsView: React.FC<MyListingsViewProps> = ({
  currentUser,
  userProducts,
  onOpenSell,
  onOpenPricing,
  onSelectProduct,
  onDeleteProduct,
  onToggleSold,
  onOpenAuth,
  onNavigateToPayments,
}) => {
  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-gray-200 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">View Your MUBS Listings</h2>
        <p className="text-xs text-gray-600 mb-6">
          Sign in with your MUBS student account to manage your listings and boost views.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition"
        >
          Sign In to Your Account
        </button>
      </div>
    );
  }

  const isOwner = currentUser?.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();

  // Calculate days remaining of trial
  const trialEnd = new Date(currentUser.trialEndsAt);
  const now = new Date();
  const diffTime = trialEnd.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const isTrial = currentUser.plan === 'trial' && daysLeft > 0;

  // Anti-defaulter stats & calculations
  const activeCount = userProducts.filter((p) => p.status === 'active').length;
  const soldProducts = userProducts.filter((p) => p.status === 'sold');
  const unpaidProducts = userProducts.filter(
    (p) => (p.status === 'sold' && p.commission_status !== 'paid') ||
           p.commission_status === 'unpaid' ||
           p.commission_status === 'pending'
  );
  const totalUnpaidCommission = unpaidProducts.reduce(
    (acc, it) => acc + (it.commission_amount || calculateCommission(it.sold_price || it.price)),
    0
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      
      {/* Profile Header & Subscription Status */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white font-bold text-xl flex items-center justify-center shadow-xs">
            {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'M'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 font-sans">
                {currentUser.displayName}
              </h1>
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Verified MUBS
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{currentUser.email}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Member since {new Date(currentUser.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
            currentUser.plan === 'premium'
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}>
            <Sparkles className="w-3 h-3 text-amber-500" />
            {currentUser.plan === 'premium' ? 'Premium Shop Member' : 'Student Free Plan'}
          </span>
          <button
            onClick={() => onOpenPricing()}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline"
          >
            Manage Plan / Upgrades
          </button>
        </div>
      </div>

      {/* Seller Performance & Defaulter Stats (Loophole 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-3.5 border border-gray-200 shadow-xs">
          <span className="text-[11px] font-semibold text-gray-500 block">Total Listed</span>
          <span className="text-lg font-black text-gray-900">{userProducts.length}</span>
        </div>
        <div className="bg-white rounded-2xl p-3.5 border border-gray-200 shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 block">Active Listings</span>
          <span className="text-lg font-black text-emerald-700">{activeCount}</span>
        </div>
        <div className="bg-white rounded-2xl p-3.5 border border-gray-200 shadow-xs">
          <span className="text-[11px] font-semibold text-gray-600 block">Items Sold</span>
          <span className="text-lg font-black text-gray-900">{soldProducts.length}</span>
        </div>
        <div className={`rounded-2xl p-3.5 border shadow-xs ${
          unpaidProducts.length > 0
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <span className="text-[11px] font-bold block">
            {unpaidProducts.length > 0 ? 'Unpaid Commission' : 'Commissions Clean'}
          </span>
          <span className="text-lg font-black">
            {unpaidProducts.length > 0 ? formatUGX(totalUnpaidCommission) : '0 UGX'}
          </span>
        </div>
      </div>

      {/* Unpaid Commission Warning Banner (Loophole 6 & 9) */}
      {unpaidProducts.length > 0 && (
        <div className="p-4 bg-red-50 border-2 border-red-500 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-extrabold text-sm block text-red-700">
                Action Required: Outstanding 5% Commission Due ({formatUGX(totalUnpaidCommission)})
              </span>
              <p className="mt-0.5 text-red-800">
                You have {unpaidProducts.length} sold item(s) pending commission. Pay to MTN 0764117040 or Airtel 0700924322 to prevent account restriction.
              </p>
            </div>
          </div>
          {onNavigateToPayments && (
            <button
              onClick={onNavigateToPayments}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer"
            >
              Pay Commission Now →
            </button>
          )}
        </div>
      )}

      {/* Free Trial Banner requirement */}
      {isTrial ? (
        <div className="p-4 bg-emerald-800 text-white rounded-2xl shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700/80 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <span className="font-bold text-sm block">
                {daysLeft} days left of free trial
              </span>
              <p className="text-xs text-emerald-100 mt-0.5">
                Enjoy unlimited active listings and instant WhatsApp buyer connections during your trial period.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenPricing()}
            className="hidden sm:inline-block px-3 py-1.5 bg-amber-400 text-emerald-950 text-xs font-bold rounded-xl hover:bg-amber-300 transition"
          >
            Extend with Premium
          </button>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Standard Free Plan:</span> Maximum 2 active listings allowed.
            </div>
          </div>
          <button
            onClick={() => onOpenPricing()}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shrink-0"
          >
            Get Unlimited
          </button>
        </div>
      )}

      {/* Listings Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Your Active Listings</h2>
            <p className="text-xs text-gray-500">
              {userProducts.length} item{userProducts.length === 1 ? '' : 's'} listed on MUBS Market
            </p>
          </div>
          <button
            onClick={onOpenSell}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post New Item</span>
          </button>
        </div>

        {userProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-gray-200 text-center space-y-3">
            <p className="text-xs text-gray-500">You have no active listings at the moment.</p>
            <button
              onClick={onOpenSell}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition"
            >
              <PlusCircle className="w-4 h-4" />
              List Your First Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="flex gap-3">
                  <img
                    src={p.imageUrl}
                    alt={p.title}
                    className="w-20 h-20 rounded-xl object-cover bg-gray-100 border border-gray-200 shrink-0 cursor-pointer"
                    onClick={() => onSelectProduct(p)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-semibold text-gray-500">{p.category}</span>
                      {p.is_boosted ? (
                        <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                          <Sparkles className="w-2.5 h-2.5" /> Boosted
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.status === 'sold' ? 'bg-gray-200 text-gray-800' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {p.status === 'sold' ? 'Sold' : 'Active'}
                        </span>
                      )}
                    </div>
                    <h3 
                      onClick={() => onSelectProduct(p)}
                      className="font-bold text-gray-900 text-sm line-clamp-1 mt-1 cursor-pointer hover:text-emerald-700"
                    >
                      {p.title}
                    </h3>
                    <p className="text-sm font-extrabold text-emerald-800 font-sans mt-0.5">
                      UGX {p.price.toLocaleString('en-US')}
                    </p>
                    {p.status === 'sold' && (
                      <div className="mt-1">
                        {p.commission_status === 'paid' ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            5% Commission Paid
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={onNavigateToPayments}
                            className="text-[10px] font-black text-red-700 bg-red-100 hover:bg-red-200 px-2 py-0.5 rounded-full border border-red-200 transition cursor-pointer"
                          >
                            Pay 5% Comm ({formatUGX(p.commission_amount || Math.round((p.sold_price || p.price) * 0.05))}) →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Listing Action Controls */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                  {p.status === 'sold' ? (
                    <span className="text-xs font-bold text-gray-500 py-1">
                      Sold (Cannot Undo)
                    </span>
                  ) : (
                    <button
                      onClick={() => onToggleSold(p)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-900 py-1 cursor-pointer"
                    >
                      Mark as Sold
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {p.status !== 'sold' && !p.is_boosted && (
                      <button
                        onClick={() => onOpenPricing(p)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" /> Boost (5k)
                      </button>
                    )}

                    {/* LOOPHOLE 1: Block delete if sold and commission unpaid, unless Owner */}
                    {p.status === 'sold' && p.commission_status !== 'paid' && !isOwner ? (
                      <button
                        type="button"
                        onClick={() => {
                          const comm = p.commission_amount || Math.round((p.sold_price || p.price) * 0.05);
                          alert(`You cannot delete sold product until you pay commission of ${formatUGX(comm)} to 0764117040. Go to /my-payments`);
                        }}
                        title="You cannot delete sold product until commission is paid"
                        className="p-1.5 text-gray-300 hover:text-red-600 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onDeleteProduct(p.id, p)}
                        title={isOwner ? "Delete listing (Owner jonah8639@gmail.com)" : "Delete listing"}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
