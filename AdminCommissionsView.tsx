import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Phone, 
  Clock, 
  ShieldAlert, 
  Search, 
  Check, 
  Copy, 
  MessageCircle, 
  ExternalLink,
  DollarSign,
  AlertTriangle,
  X
} from 'lucide-react';
import { CommissionRecord } from '../types';
import { formatUGX, MTN_MOMO_NUMBER, AIRTEL_MONEY_NUMBER } from '../lib/commissionConstants';

interface AdminCommissionsViewProps {
  commissions: CommissionRecord[];
  onApproveCommission: (record: CommissionRecord) => Promise<void>;
  onRejectCommission: (record: CommissionRecord) => Promise<void>;
  onBanSeller: (sellerId: string, sellerName: string) => Promise<void>;
}

export const AdminCommissionsView: React.FC<AdminCommissionsViewProps> = ({
  commissions,
  onApproveCommission,
  onRejectCommission,
  onBanSeller,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'unpaid' | 'paid'>('pending');
  const [search, setSearch] = useState('');
  const [activeVerifyRecord, setActiveVerifyRecord] = useState<CommissionRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter and search
  const filteredRecords = commissions.filter((rec) => {
    if (filter === 'pending' && rec.status !== 'pending') return false;
    if (filter === 'unpaid' && rec.status !== 'unpaid') return false;
    if (filter === 'paid' && rec.status !== 'paid') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSeller = (rec.seller_name || '').toLowerCase().includes(q) || (rec.seller_email || '').toLowerCase().includes(q);
      const matchProd = (rec.product_title || '').toLowerCase().includes(q);
      const matchTx = (rec.user_transaction_id || '').toLowerCase().includes(q);
      const matchPhone = (rec.seller_phone || '').includes(q) || (rec.buyer_whatsapp || '').includes(q);
      if (!matchSeller && !matchProd && !matchTx && !matchPhone) return false;
    }
    return true;
  });

  const totalCollected = commissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  const totalPending = commissions
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  const totalUnpaid = commissions
    .filter((c) => c.status === 'unpaid')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0);

  return (
    <div className="space-y-5">
      {/* Commission Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006400] flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Commissions Paid
            </span>
            <span className="text-xl font-black text-emerald-800 font-mono">
              {formatUGX(totalCollected)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Pending MoMo Proof
            </span>
            <span className="text-xl font-black text-amber-600 font-mono">
              {formatUGX(totalPending)}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Overdue Unpaid
            </span>
            <span className="text-xl font-black text-red-600 font-mono">
              {formatUGX(totalUnpaid)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <span>Anti-Defaulter 5% Commission Verification</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#006400]">
                {filteredRecords.length} records
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Verify claims against SMS received on MTN 0764117040 or Airtel 0700924322 before approving.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Buttons */}
            <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filter === 'pending'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pending ({commissions.filter((c) => c.status === 'pending').length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filter === 'unpaid'
                    ? 'bg-white text-red-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Unpaid ({commissions.filter((c) => c.status === 'unpaid').length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('paid')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filter === 'paid'
                    ? 'bg-white text-[#006400] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Paid ({commissions.filter((c) => c.status === 'paid').length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  filter === 'all'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({commissions.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search seller, tx ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-gray-800 uppercase tracking-wider font-bold border-b border-gray-200 text-[11px]">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Seller</th>
                <th className="py-3 px-3">Product</th>
                <th className="py-3 px-3">Sold Price</th>
                <th className="py-3 px-3">Commission (5%)</th>
                <th className="py-3 px-3">Buyer WhatsApp</th>
                <th className="py-3 px-3">Seller Claim</th>
                <th className="py-3 px-3">User TX ID</th>
                <th className="py-3 px-3">Seller Phone</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400">
                    No commission records found in this view.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isPending = rec.status === 'pending';
                  const isPaid = rec.status === 'paid';
                  const isRejected = rec.status === 'rejected';
                  const isUnpaid = rec.status === 'unpaid';

                  return (
                    <tr
                      key={rec.id}
                      className={`transition ${
                        isPending ? 'bg-amber-50/50 hover:bg-amber-50/80' : isUnpaid ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-gray-500 font-sans">
                        {new Date(rec.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </td>

                      {/* Seller */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{rec.seller_name}</div>
                        <div className="text-[10px] text-gray-400">{rec.seller_email}</div>
                      </td>

                      {/* Product */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-gray-900 line-clamp-1 max-w-[140px]" title={rec.product_title}>
                          {rec.product_title}
                        </span>
                      </td>

                      {/* Sold Price */}
                      <td className="py-3 px-3 whitespace-nowrap font-bold text-gray-900 font-mono">
                        {formatUGX(rec.sold_price)}
                      </td>

                      {/* Commission (5%) */}
                      <td className="py-3 px-3 whitespace-nowrap font-black text-emerald-800 font-mono text-sm">
                        {formatUGX(rec.commission_amount)}
                      </td>

                      {/* Buyer WhatsApp */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <a
                          href={`https://wa.me/${rec.buyer_whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md hover:bg-emerald-100"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-600" />
                          {rec.buyer_whatsapp}
                        </a>
                      </td>

                      {/* Seller Claim */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#006400] border border-emerald-200">
                          <Phone className="w-2.5 h-2.5" />
                          {rec.sent_to_number || MTN_MOMO_NUMBER}
                        </span>
                      </td>

                      {/* User TX ID */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {rec.user_transaction_id ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(rec.user_transaction_id!, rec.id)}
                            className="inline-flex items-center gap-1 font-mono font-bold text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded-md text-xs cursor-pointer"
                            title="Click to copy Transaction ID"
                          >
                            <span>{rec.user_transaction_id}</span>
                            {copiedId === rec.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-400" />
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Unsubmitted</span>
                        )}
                      </td>

                      {/* Seller Phone */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-gray-700">
                        {rec.seller_phone || rec.seller_whatsapp || '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 whitespace-nowrap text-right space-x-1.5">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006400]">
                            <CheckCircle className="w-3 h-3" />
                            Paid
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActiveVerifyRecord(rec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#006400] hover:bg-[#004d00] text-white shadow-xs transition cursor-pointer"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Check MoMo {rec.sent_to_number || MTN_MOMO_NUMBER} Balance</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onBanSeller(rec.seller_id, rec.seller_name)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-100 hover:bg-red-200 text-red-800 transition cursor-pointer"
                          title="Ban seller for commission evasion"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          <span>Ban Seller</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VERIFY MOMO BALANCE MODAL (Mandated by Loophole 8) */}
      {activeVerifyRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-[#006400]">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    Verify Mobile Money Receipt
                  </h3>
                  <span className="text-xs text-gray-500">
                    Mandatory balance check before approval
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveVerifyRecord(null)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Exact Prompt Required Instruction */}
            <div className="p-4 bg-emerald-50 border-2 border-[#006400] rounded-2xl text-emerald-950 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#006400] block">
                Verification Question
              </span>
              <p className="text-sm font-bold text-gray-900 leading-relaxed">
                Please check your MTN MoMo SMS on <span className="font-mono text-[#006400] bg-white px-1.5 py-0.5 rounded border border-emerald-300">{activeVerifyRecord.sent_to_number || MTN_MOMO_NUMBER}</span> or dial *165# to confirm you received <span className="font-mono text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-emerald-300">{formatUGX(activeVerifyRecord.commission_amount)}</span> from <span className="font-mono text-gray-900 bg-white px-1.5 py-0.5 rounded border border-gray-300">{activeVerifyRecord.seller_phone || activeVerifyRecord.seller_whatsapp || 'seller'}</span> with Transaction ID: <span className="font-mono font-black text-gray-900 bg-white px-1.5 py-0.5 rounded border border-gray-300">{activeVerifyRecord.user_transaction_id || 'N/A'}</span>.
              </p>
              <p className="text-xs font-semibold text-emerald-900 pt-1">
                Did you receive it?
              </p>
            </div>

            <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div className="flex justify-between">
                <span>Product Sold:</span>
                <strong className="text-gray-900">{activeVerifyRecord.product_title}</strong>
              </div>
              <div className="flex justify-between">
                <span>Sold Price:</span>
                <strong className="text-gray-900">{formatUGX(activeVerifyRecord.sold_price)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Commission Due (5%):</span>
                <strong className="text-emerald-800 text-sm font-mono">{formatUGX(activeVerifyRecord.commission_amount)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Buyer WhatsApp:</span>
                <strong className="font-mono text-gray-900">{activeVerifyRecord.buyer_whatsapp}</strong>
              </div>
            </div>

            {/* Approval and Rejection Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessing === activeVerifyRecord.id}
                onClick={async () => {
                  setIsProcessing(activeVerifyRecord.id);
                  try {
                    await onApproveCommission(activeVerifyRecord);
                    setActiveVerifyRecord(null);
                  } finally {
                    setIsProcessing(null);
                  }
                }}
                className="flex-1 py-3 px-4 bg-[#006400] hover:bg-[#004d00] text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Yes, I Received - Approve Commission</span>
              </button>

              <button
                type="button"
                disabled={isProcessing === activeVerifyRecord.id}
                onClick={async () => {
                  setIsProcessing(activeVerifyRecord.id);
                  try {
                    await onRejectCommission(activeVerifyRecord);
                    setActiveVerifyRecord(null);
                  } finally {
                    setIsProcessing(null);
                  }
                }}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>No, Fraudulent - Reject & Restrict Seller</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
