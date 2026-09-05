import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Send, 
  Clock, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EscrowPendingPayout } from '../types';
import { ESCROW_MTN_NUMBER } from '../lib/momoAutoSplit';

interface PendingPayoutsViewProps {
  onOpenChat?: (chatId: string) => void;
}

export const PendingPayoutsView: React.FC<PendingPayoutsViewProps> = ({ onOpenChat }) => {
  const [payouts, setPayouts] = useState<EscrowPendingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    // Listen to escrow_wallet records
    const unsub = onSnapshot(collection(db, 'escrow_wallet'), (snapshot) => {
      const items: EscrowPendingPayout[] = [];
      snapshot.forEach((d) => {
        items.push({ ...d.data(), id: d.id } as EscrowPendingPayout);
      });
      items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setPayouts(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleRetryDisbursement = async (payout: EscrowPendingPayout) => {
    setActionLoading(payout.id);
    try {
      const res = await fetch('/api/momo/disburse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: payout.chatId,
          sellerPhone: payout.sellerPhone,
          sellerGets: payout.sellerGets,
          productTitle: payout.productTitle,
        }),
      });

      const data = await res.json();
      const refId = data.disbursementRef || `DISB_RETRY_${Date.now()}`;

      await updateDoc(doc(db, 'escrow_wallet', payout.id), {
        status: 'completed',
        disbursementRef: refId,
        completedAt: new Date().toISOString(),
      });

      alert(`✅ Auto-Disbursement Successful! Sent UGX ${payout.sellerGets.toLocaleString()} to ${payout.sellerPhone}. Ref: ${refId}`);
    } catch (err: any) {
      alert('Disbursement failed: ' + (err?.message || 'Check connection'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkManualComplete = async (payout: EscrowPendingPayout) => {
    if (!window.confirm(`Confirm that you manually sent UGX ${payout.sellerGets.toLocaleString()} from 0764117040 to ${payout.sellerPhone} (${payout.sellerName})?`)) {
      return;
    }

    setActionLoading(payout.id);
    try {
      await updateDoc(doc(db, 'escrow_wallet', payout.id), {
        status: 'manual_sent',
        completedAt: new Date().toISOString(),
        manualNote: 'Marked manually sent by Super Admin jonah8639@gmail.com',
      });
      alert(`Settlement marked complete for ${payout.sellerName}.`);
    } catch (err: any) {
      alert('Error updating payout: ' + (err?.message || ''));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-gray-900 font-sans">
              Pending Auto-Payouts (Escrow 0764117040)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
              Admin Auto-Disburse Queue
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            When buyers pay to 0764117040, the 5% platform cut is automatically kept, and 95% is auto-sent to the seller.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold bg-emerald-50 text-[#006400] px-3 py-2 rounded-2xl border border-emerald-200">
          <ShieldCheck className="w-4 h-4" />
          <span>Platform Cut: 5% of Original Price (Locked)</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-gray-500">Loading payout records...</div>
        ) : payouts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">No Pending Payouts</h3>
            <p className="text-xs text-gray-500">All escrow auto-disbursements are current and reconciled.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Seller Name & Email</th>
                  <th className="px-5 py-3">Seller Phone</th>
                  <th className="px-5 py-3">To Send (Seller 95%)</th>
                  <th className="px-5 py-3">Cut Kept (5%)</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((p) => {
                  const isDone = p.status === 'completed' || p.status === 'manual_sent';
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/80 transition">
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-500 text-[11px]">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        <div>{p.sellerName || 'Seller'}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-xs">{p.sellerEmail}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-800">
                        {p.sellerPhone}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-extrabold text-[#006400]">
                        UGX {p.sellerGets?.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-emerald-800 bg-emerald-50/50">
                        UGX {p.commission?.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        {p.status === 'completed' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006400]">
                            Auto-Sent
                          </span>
                        ) : p.status === 'manual_sent' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            Manual Sent
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Pending Auto
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
                        {onOpenChat && p.chatId && (
                          <button
                            onClick={() => onOpenChat(p.chatId)}
                            className="px-2.5 py-1 text-gray-600 hover:text-[#006400] font-bold rounded-lg border border-gray-200 text-[11px] cursor-pointer"
                          >
                            Chat
                          </button>
                        )}
                        {!isDone && (
                          <>
                            <button
                              onClick={() => handleRetryDisbursement(p)}
                              disabled={actionLoading === p.id}
                              className="px-2.5 py-1 bg-[#006400] text-white font-bold rounded-lg text-[11px] hover:bg-[#004d00] cursor-pointer shadow-2xs"
                            >
                              {actionLoading === p.id ? 'Sending...' : 'Retry Auto-Send'}
                            </button>
                            <button
                              onClick={() => handleMarkManualComplete(p)}
                              disabled={actionLoading === p.id}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              I Sent Manually
                            </button>
                          </>
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

    </div>
  );
};
