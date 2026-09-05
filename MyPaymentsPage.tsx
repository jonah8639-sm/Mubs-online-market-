import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  Plus, 
  Sparkles, 
  Zap,
  Phone,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, UserProfile } from '../types';

interface MyPaymentsPageProps {
  currentUser: UserProfile | null;
  onBackToMarket: () => void;
  onOpenPaymentModal: (tab: 'boost' | 'premium') => void;
  onOpenAuth: () => void;
}

export const MyPaymentsPage: React.FC<MyPaymentsPageProps> = ({
  currentUser,
  onBackToMarket,
  onOpenPaymentModal,
  onOpenAuth,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentUser) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Query transactions collection for this user's email or user_id
    const txRef = collection(db, 'transactions');
    const q = query(
      txRef,
      where('user_email', '==', currentUser.email)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txList: Transaction[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Transaction, 'id'>),
        }));

        // Sort descending by created_at
        txList.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setTransactions(txList);
        setLoading(false);
      },
      (err) => {
        console.warn('My payments listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Helper to calculate days remaining
  const calculateExpiryCountdown = (tx: Transaction) => {
    if (tx.status !== 'approved') return null;

    const durationDays = tx.type === 'boost' ? 7 : 30;
    const createdAt = new Date(tx.created_at).getTime();
    const expiryMs = createdAt + durationDays * 24 * 60 * 60 * 1000;
    const diffMs = expiryMs - Date.now();

    if (diffMs <= 0) {
      return 'Expired';
    }

    const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return `Expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-gray-200 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#006400] flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">My Payments & Receipts</h2>
        <p className="text-xs text-gray-600 mb-6">
          Sign in with your MUBS student email to view your mobile money payments, boost status, and premium subscription history.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-3 bg-[#006400] hover:bg-[#004d00] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          Sign In with MUBS Email
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBackToMarket}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#006400] transition mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </button>
          <h1 className="text-2xl font-extrabold text-gray-900 font-sans flex items-center gap-2">
            <span>My MoMo Payments & Receipts</span>
            <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-[#006400] rounded-full">
              Realtime
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Logged in as <strong>{currentUser.email}</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onOpenPaymentModal('boost')}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Boost a Listing</span>
          </button>
          <button
            onClick={() => onOpenPaymentModal('premium')}
            className="px-3.5 py-2 rounded-xl bg-[#006400] hover:bg-[#004d00] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Zap className="w-3.5 h-3.5 text-yellow-300" />
            <span>Upgrade to Premium</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="w-8 h-8 border-3 border-[#006400] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs font-semibold">Loading your payment records...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">No payment transactions yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-5">
              When you send MoMo to boost your products or activate Premium Shop, your receipt and verification status will appear here in real time.
            </p>
            <button
              onClick={() => onOpenPaymentModal('boost')}
              className="px-4 py-2.5 bg-[#006400] hover:bg-[#004d00] text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Boost a Product (5,000 UGX)
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-gray-800 uppercase tracking-wider font-bold border-b border-gray-200 text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Product / Plan</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Sent To</th>
                  <th className="py-3.5 px-4">Transaction ID</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {transactions.map((tx) => {
                  const countdown = calculateExpiryCountdown(tx);
                  const isPending = tx.status === 'pending';
                  const isApproved = tx.status === 'approved';
                  const isRejected = tx.status === 'rejected';

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/70 transition">
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-500 font-sans">
                        {new Date(tx.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Product / Plan */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 max-w-[200px] truncate">
                          {tx.product_title || (tx.type === 'boost' ? 'Product Boost' : 'Premium Shop')}
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          {tx.type === 'boost' ? '7-Day Boost' : '30-Day Premium'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-gray-900 font-mono">
                        UGX {tx.amount.toLocaleString()}
                      </td>

                      {/* Sent To */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                          <Phone className="w-3 h-3 text-[#006400]" />
                          {tx.sent_to_number || '0764117040'}
                        </span>
                      </td>

                      {/* Transaction ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                          {tx.user_transaction_id}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>Waiting for admin to check {tx.sent_to_number || '0764117040'}</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-[#006400] border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* Expiry countdown */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isApproved && countdown ? (
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {countdown}
                          </span>
                        ) : isPending ? (
                          <span className="text-[11px] text-gray-400">Awaiting approval</span>
                        ) : (
                          <span className="text-[11px] text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Support / Help footer */}
      <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="font-bold">Need help with your payment?</p>
          <p className="text-emerald-700 mt-0.5">
            Admin verifies MTN <strong>0764117040</strong> and Airtel <strong>0700924322</strong> within minutes.
          </p>
        </div>
        <a
          href="https://wa.me/256764117040?text=Hello%20MUBS%20Market%20Admin%2C%20I%20have%20sent%20a%20payment"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 bg-[#006400] hover:bg-[#004d00] text-white font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <span>Contact Admin on WhatsApp</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
