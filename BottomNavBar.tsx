import React from 'react';
import { Home, Store, PlusCircle, CreditCard, ShieldCheck, User } from 'lucide-react';

export type NavTab = 'home' | 'shop' | 'sell' | 'my-listings' | 'my-payments' | 'admin' | 'profile';

interface BottomNavBarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isAdmin: boolean;
  onOpenSell: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentTab,
  onSelectTab,
  isAdmin,
  onOpenSell,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-2 py-1.5 md:hidden safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        
        {/* Home */}
        <button
          id="nav-home-btn"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] py-1 transition cursor-pointer ${
            currentTab === 'home' ? 'text-[#006400] font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Home className={`w-5 h-5 ${currentTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] mt-0.5">Home</span>
        </button>

        {/* Shop */}
        <button
          id="nav-shop-btn"
          onClick={() => onSelectTab('shop')}
          className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] py-1 transition cursor-pointer ${
            currentTab === 'shop' ? 'text-[#006400] font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Store className={`w-5 h-5 ${currentTab === 'shop' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] mt-0.5">Shop</span>
        </button>

        {/* Center Sell Button */}
        <button
          id="nav-sell-btn"
          onClick={onOpenSell}
          className="flex flex-col items-center justify-center min-w-[50px] min-h-[44px] -mt-5 transition group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-[#006400] group-hover:bg-[#004d00] group-active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-800/30 border-4 border-white transition">
            <PlusCircle className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-[10px] font-bold text-[#006400] mt-0.5">Sell</span>
        </button>

        {/* My Payments */}
        <button
          id="nav-payments-btn"
          onClick={() => onSelectTab('my-payments')}
          className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] py-1 transition cursor-pointer ${
            currentTab === 'my-payments' ? 'text-[#006400] font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <CreditCard className={`w-5 h-5 ${currentTab === 'my-payments' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] mt-0.5">Payments</span>
        </button>

        {/* Admin or Account */}
        {isAdmin ? (
          <button
            id="nav-admin-btn"
            onClick={() => onSelectTab('admin')}
            className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] py-1 transition cursor-pointer ${
              currentTab === 'admin' ? 'text-[#006400] font-bold' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldCheck className={`w-5 h-5 ${currentTab === 'admin' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-0.5">Admin</span>
          </button>
        ) : (
          <button
            id="nav-profile-btn"
            onClick={() => onSelectTab('profile')}
            className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] py-1 transition cursor-pointer ${
              currentTab === 'profile' ? 'text-[#006400] font-bold' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <User className={`w-5 h-5 ${currentTab === 'profile' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[10px] mt-0.5">Account</span>
          </button>
        )}

      </div>
    </nav>
  );
};
