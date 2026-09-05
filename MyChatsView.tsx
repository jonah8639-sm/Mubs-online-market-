import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  Clock, 
  CheckCircle2, 
  ShoppingBag, 
  Store, 
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Chat, UserProfile } from '../types';

interface MyChatsViewProps {
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onSelectChat: (chatId: string) => void;
}

export const MyChatsView: React.FC<MyChatsViewProps> = ({
  currentUser,
  onOpenAuth,
  onSelectChat,
}) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'buying' | 'selling' | 'paid' | 'completed' | 'disputes'>('buying');
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Subscribe to chats involving the user
    // Querying by buyerId or sellerId
    const chatsRef = collection(db, 'chats');
    const unsubBuyer = onSnapshot(
      query(chatsRef, where('buyerId', '==', currentUser.id)),
      (snap1) => {
        const buyerChats: Chat[] = [];
        snap1.forEach((d) => buyerChats.push({ ...d.data(), id: d.id } as Chat));

        // Also get seller chats
        const unsubSeller = onSnapshot(
          query(chatsRef, where('sellerId', '==', currentUser.id)),
          (snap2) => {
            const sellerChats: Chat[] = [];
            snap2.forEach((d) => sellerChats.push({ ...d.data(), id: d.id } as Chat));

            // Merge & deduplicate
            const map = new Map<string, Chat>();
            buyerChats.forEach((c) => map.set(c.id, c));
            sellerChats.forEach((c) => map.set(c.id, c));

            const allChats = Array.from(map.values()).sort((a, b) => {
              const tA = a.updatedAt || a.createdAt || '';
              const tB = b.updatedAt || b.createdAt || '';
              return tB.localeCompare(tA);
            });

            setChats(allChats);
            setLoading(false);
          }
        );

        return () => unsubSeller();
      }
    );

    return () => unsubBuyer();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-gray-200 text-center space-y-4 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#006400] flex items-center justify-center mx-auto">
          <MessageSquare className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Sign in to Access In-App Chats</h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          Negotiate prices safely, accept offers, and pay through MUBS Escrow auto-split.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-3 bg-[#006400] hover:bg-[#004d00] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
        >
          Sign In with MUBS Email
        </button>
      </div>
    );
  }

  // Filter chats by tab
  const filteredChats = chats.filter((c) => {
    // Search match
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      const matchTitle = c.productTitle.toLowerCase().includes(q);
      const matchSeller = c.sellerName.toLowerCase().includes(q);
      const matchBuyer = c.buyerName.toLowerCase().includes(q);
      if (!matchTitle && !matchSeller && !matchBuyer) return false;
    }

    if (activeTab === 'buying') {
      return c.buyerId === currentUser.id;
    }
    if (activeTab === 'selling') {
      return c.sellerId === currentUser.id;
    }
    if (activeTab === 'paid') {
      return c.escrowPaid === true || c.status === 'completed_auto_paid';
    }
    if (activeTab === 'completed') {
      return c.status === 'completed_auto_paid';
    }
    if (activeTab === 'disputes') {
      return c.status === 'disputed';
    }
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-sans flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-[#006400]" />
            In-App Negotiation & Escrow Chats
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Safe peer-to-peer campus trades. 5% platform cut automatically kept in Escrow 0764117040.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search chats or items..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#006400] outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-gray-200 pb-2 overflow-x-auto scrollbar-none text-xs font-bold">
        <button
          onClick={() => setActiveTab('buying')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'buying'
              ? 'bg-[#006400] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Buying ({chats.filter((c) => c.buyerId === currentUser.id).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('selling')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'selling'
              ? 'bg-[#006400] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Selling ({chats.filter((c) => c.sellerId === currentUser.id).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('paid')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'paid'
              ? 'bg-[#006400] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Paid via Escrow ({chats.filter((c) => c.escrowPaid).length})</span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'completed'
              ? 'bg-[#006400] text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completed ({chats.filter((c) => c.status === 'completed_auto_paid').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('disputes')}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            activeTab === 'disputes'
              ? 'bg-red-700 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Disputes ({chats.filter((c) => c.status === 'disputed').length})</span>
        </button>
      </div>

      {/* Chat List */}
      {loading ? (
        <div className="py-12 text-center space-y-2">
          <div className="w-8 h-8 border-3 border-[#006400] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-500">Loading chats...</p>
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-gray-900">No chats found in this tab</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Browse marketplace items and tap "Chat & Negotiate Inside App" to start an offer.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredChats.map((c) => {
            const isBuyer = c.buyerId === currentUser.id;
            const otherName = isBuyer ? c.sellerName : c.buyerName;
            const originalPrice = c.originalPrice || c.productPrice;
            const agreedPrice = c.agreedPrice || c.productPrice;

            return (
              <div
                key={c.id}
                onClick={() => onSelectChat(c.id)}
                className="bg-white hover:bg-emerald-50/40 border border-gray-200 hover:border-emerald-300 rounded-2xl p-4 transition cursor-pointer flex items-center justify-between gap-4 shadow-2xs group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {c.productImage ? (
                    <img
                      src={c.productImage}
                      alt={c.productTitle}
                      className="w-14 h-14 rounded-xl object-cover border border-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-6 h-6 text-gray-400" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-gray-900 truncate group-hover:text-[#006400] transition">
                        {otherName}
                      </h4>
                      <span className="text-[10px] text-gray-400">•</span>
                      <span className="text-[11px] font-bold text-gray-600 truncate">
                        {c.productTitle}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {c.lastMessage || 'Offer negotiation started'}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                      <span className="font-extrabold text-[#006400]">
                        UGX {agreedPrice.toLocaleString()}
                      </span>
                      {c.agreedPrice && c.agreedPrice !== originalPrice && (
                        <span className="text-gray-400 line-through text-[10px]">
                          UGX {originalPrice.toLocaleString()}
                        </span>
                      )}
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500 text-[10px]">
                        {c.updatedAt
                          ? new Date(c.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
                          : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {c.status === 'completed_auto_paid' ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-[#006400] border border-emerald-300">
                      Paid & Auto-Split
                    </span>
                  ) : c.status === 'offer_accepted' ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      Offer Accepted
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                      Negotiating
                    </span>
                  )}

                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#006400] transition group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
