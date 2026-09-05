import React from 'react';
import { 
  ShieldCheck, 
  PlusCircle, 
  LogIn, 
  LogOut, 
  Shield, 
  Sparkles,
  ShoppingBag,
  CreditCard,
  Search,
  Zap,
  Store
} from 'lucide-react';
import { UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentUser: UserProfile | null;
  isAdmin: boolean;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenSell: () => void;
  onOpenShop: () => void;
  onOpenMyPayments: () => void;
  onOpenAdmin: () => void;
  onOpenPricing: () => void;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  isAdmin,
  searchQuery,
  onSearchChange,
  onOpenAuth,
  onSignOut,
  onOpenSell,
  onOpenShop,
  onOpenMyPayments,
  onOpenAdmin,
  onOpenPricing,
  onLogoClick,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        
        {/* 1. Brand Logo & Title: "MUBS Online Market" */}
        <div 
          onClick={onLogoClick}
          className="flex items-center gap-2 cursor-pointer select-none group shrink-0"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#006400] text-white flex items-center justify-center font-black text-lg shadow-sm group-hover:bg-[#004d00] transition">
            <ShoppingBag className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-gray-900 text-base sm:text-lg tracking-tight font-sans group-hover:text-[#006400] transition">
                MUBS Online Market
              </span>
              <span className="hidden md:inline-flex items-center gap-0.5 bg-emerald-100 text-[#006400] text-[10px] font-bold px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Verified
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-medium -mt-0.5 hidden sm:block">
              Makerere University Business School Nakawa
            </p>
          </div>
        </div>

        {/* 2. Search Bar in Header */}
        <div className="hidden md:flex flex-1 max-w-md mx-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search books, electronics, hostel items..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-100 border border-transparent hover:border-gray-300 focus:border-[#006400] focus:bg-white rounded-xl outline-hidden transition"
            />
          </div>
        </div>

        {/* 3. Navigation Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* Shop button */}
          <button
            onClick={onOpenShop}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:text-[#006400] hover:bg-gray-100 rounded-xl transition cursor-pointer"
            title="Browse all products"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Shop</span>
          </button>

          {/* Sell Button - GREEN #006400 */}
          <button
            id="header-sell-btn"
            onClick={onOpenSell}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#006400] hover:bg-[#004d00] active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Sell</span>
          </button>

          {/* My Payments button */}
          <button
            id="header-my-payments-btn"
            onClick={onOpenMyPayments}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:text-[#006400] hover:bg-emerald-50 rounded-xl transition cursor-pointer"
            title="View my MoMo transactions"
          >
            <CreditCard className="w-3.5 h-3.5 text-[#006400]" />
            <span className="hidden sm:inline">My Payments</span>
          </button>

          {/* Premium Shop button */}
          <button
            onClick={onOpenPricing}
            className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition cursor-pointer"
            title="Boost or Premium Shop"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Boost / Premium</span>
          </button>

          {/* Admin link (Only jonah8639@gmail.com) */}
          {isAdmin && (
            <button
              id="header-admin-link"
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition cursor-pointer"
              title="Admin Dashboard"
            >
              <Shield className="w-3.5 h-3.5 text-red-700" />
              <span>Admin Dashboard</span>
            </button>
          )}

          {/* PWA Install */}
          <PWAInstallButton compact />

          {/* User Auth */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-1 border-l border-gray-200">
              <div 
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100 text-[#006400] font-bold text-xs flex items-center justify-center border border-emerald-300 select-none"
                title={`${currentUser.displayName} (${currentUser.email})`}
              >
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'M'}
              </div>
              <button
                id="header-logout-btn"
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="header-login-btn"
              onClick={onOpenAuth}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#006400] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

        </div>

      </div>

      {/* Mobile Search input below header bar */}
      <div className="md:hidden px-4 pb-2.5 pt-0.5">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search books, electronics, hostel items..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 border border-transparent focus:border-[#006400] focus:bg-white rounded-xl outline-hidden"
          />
        </div>
      </div>
    </header>
  );
};
