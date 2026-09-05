import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Check, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Smartphone,
  Send,
  ShieldAlert
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, UserProfile, PaymentNumber } from '../types';
import { 
  COMMISSION_RATE, 
  calculateCommission, 
  formatUGX, 
  MTN_MOMO_NUMBER, 
  AIRTEL_MONEY_NUMBER 
} from '../lib/commissionConstants';
import { PaymentBox } from './PaymentBox';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  targetProduct?: Product | null;
  allUserProducts?: Product[];
  initialTab?: 'boost' | 'premium';
  onSuccess?: () => void;
  onOpenAuth?: () => void;
  onNavigateToPayments?: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetProduct,
  allUserProducts = [],
  initialTab = 'boost',
  onSuccess,
  onOpenAuth,
  onNavigateToPayments,
}) => {
  const [activeTab, setActiveTab] = useState<'boost' | 'premium'>(
    targetProduct ? 'boost' : initialTab
  );

  // Form states
  const [sentToNumber, setSentToNumber] = useState<PaymentNumber>('0764117040');
  const [userTransactionId, setUserTransactionId] = useState('');
  const [amount, setAmount] = useState<string>(activeTab === 'boost' ? '5000' : '15000');
  const [selectedProductId, setSelectedProductId] = useState<string>(targetProduct?.id || '');
  
  // UI states
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Check for unpaid commissions (Loophole 7: Block boost/premium until commission is cleared)
  const unpaidProducts = allUserProducts.filter(
    (p) => (p.status === 'sold' && p.commission_status !== 'paid') ||
           p.commission_status === 'unpaid' ||
           p.commission_status === 'pending'
  );
  const totalUnpaidCommission = unpaidProducts.reduce(
    (sum, p) => sum + (p.commission_amount || calculateCommission(p.sold_price || p.price)),
    0
  );
  const hasUnpaidCommissions = unpaidProducts.length > 0;

  if (!isOpen) return null;

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2500);
  };

  const handleTabChange = (tab: 'boost' | 'premium') => {
    setActiveTab(tab);
    setAmount(tab === 'boost' ? '5000' : '15000');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    if (!userTransactionId.trim()) {
      setError('Please enter the MoMo Transaction ID from your SMS.');
      return;
    }

    const cleanAmount = Number(amount);
    if (!cleanAmount || cleanAmount <= 0) {
      setError('Please enter a valid amount sent in UGX.');
      return;
    }

    // Determine target product title
    let targetTitle = 'Premium Shop Subscription';
    let prodId: string | null = null;
    if (activeTab === 'boost') {
      const prod = allUserProducts.find((p) => p.id === selectedProductId) || targetProduct;
      prodId = prod?.id || selectedProductId || null;
      targetTitle = prod ? `Boost: ${prod.title}` : 'Product Boost (7 Days)';
    }

    setIsSubmitting(true);

    try {
      // Save to Firestore collection "transactions"
      // Required schema: id, user_email, user_id, product_id, product_title, amount, sent_to_number,
      // user_transaction_id, type ("boost" | "premium"), status="pending", created_at
      const newTxData = {
        user_email: currentUser.email,
        user_id: currentUser.id,
        product_id: prodId,
        product_title: targetTitle,
        amount: cleanAmount,
        sent_to_number: sentToNumber,
        user_transaction_id: userTransactionId.trim().toUpperCase(),
        type: activeTab,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      await addDoc(collection(db, 'transactions'), newTxData);

      // Also maintain backward-compatible record for legacy listeners if any
      if (activeTab === 'boost') {
        await addDoc(collection(db, 'boost_requests'), {
          product_id: prodId || 'general',
          product_title: targetTitle,
          seller: currentUser.email,
          seller_id: currentUser.id,
          amount: cleanAmount,
          momo_reference: userTransactionId.trim().toUpperCase(),
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'premium_requests'), {
          seller: currentUser.email,
          seller_id: currentUser.id,
          amount: cleanAmount,
          momo_reference: userTransactionId.trim().toUpperCase(),
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }

      setIsSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error submitting MoMo payment transaction:', err);
      setError(err?.message || 'Failed to submit payment verification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-auto animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#006400] text-white px-6 py-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full text-emerald-200 hover:text-white hover:bg-[#004d00] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-200">
              <Zap className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              MUBS Market Services
            </span>
          </div>
          <h3 className="text-xl font-extrabold tracking-tight">
            {activeTab === 'boost' ? 'Boost Your Listing' : 'Premium Shop Subscription'}
          </h3>
          <p className="text-xs text-emerald-100 mt-1">
            Official MTN MoMo & Airtel Money direct verification.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1.5 bg-gray-100 border-b border-gray-200">
          <button
            type="button"
            onClick={() => handleTabChange('boost')}
            className={`py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'boost'
                ? 'bg-white text-[#006400] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Boost Listing (5,000 UGX)</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('premium')}
            className={`py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'premium'
                ? 'bg-white text-[#006400] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Premium Shop (15,000 UGX)</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {hasUnpaidCommissions ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-black text-gray-900">
                  Unpaid Commission Detected
                </h4>
                <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto leading-relaxed">
                  Clear your commission of <strong className="text-red-700">{formatUGX(totalUnpaidCommission)}</strong> to <strong>0764117040</strong> before you can boost or upgrade your shop.
                </p>
              </div>
              <PaymentBox
                amount={totalUnpaidCommission}
                title="Pay Outstanding Commission"
                subtitle="Send 5% commission to either official number below, then submit proof in /my-payments:"
              />
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigateToPayments) {
                      onNavigateToPayments();
                    } else {
                      window.location.href = '/my-payments';
                    }
                  }}
                  className="w-full py-3 bg-[#006400] hover:bg-[#004d00] text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer"
                >
                  Go to /my-payments to Clear Commission
                </button>
              </div>
            </div>
          ) : isSubmitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#006400] flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-extrabold text-gray-900">
                Payment Verification Submitted!
              </h4>
              <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
                Thank you! Your transaction ID (<strong className="font-mono text-gray-900">{userTransactionId.toUpperCase()}</strong>) has been queued for verification. The admin will check MoMo balance on <strong className="text-[#006400]">{sentToNumber}</strong> and activate your {activeTab === 'boost' ? 'boost' : 'premium subscription'} shortly.
              </p>
              <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-800 font-medium">
                You can track this in real-time on your <strong>My Payments</strong> tab.
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 px-4 bg-[#006400] hover:bg-[#004d00] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* 
                EXACT GREEN BOX REQUIRED BY PROMPT:
                <div style="background:#e8f5e9; border:2px solid #006400; padding:16px">
                <h3>Send Payment To My Personal Numbers:</h3>
                <p>MTN MoMo: 0764117040 <button onclick="copy">Copy</button></p>
                <p>Airtel: 0700924322 <button onclick="copy">Copy</button></p>
                <p>Name: MUBS Market Admin</p>
                <p>Boost Listing: 5,000 UGX for 7 days top placement</p>
                <p>Premium Shop: 15,000 UGX for 30 days unlimited listings</p>
                </div>
              */}
              <div 
                style={{
                  background: '#e8f5e9',
                  border: '2px solid #006400',
                  padding: '16px',
                  borderRadius: '12px'
                }}
                className="space-y-2.5 text-gray-900 font-sans"
              >
                <h3 className="font-bold text-[#006400] text-base flex items-center justify-between">
                  <span>Send Payment To My Personal Numbers:</span>
                  <span className="text-[11px] bg-[#006400] text-white px-2 py-0.5 rounded-full font-semibold">
                    Real MoMo
                  </span>
                </h3>

                <div className="space-y-1.5 text-sm pt-1">
                  <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-emerald-300">
                    <p className="font-medium text-gray-800">
                      <strong>MTN MoMo:</strong> <span className="font-mono font-bold text-[#006400] text-base">0764117040</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopy('0764117040')}
                      className="px-2.5 py-1 bg-[#006400] hover:bg-[#004d00] text-white text-xs font-bold rounded-md flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedNumber === '0764117040' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-emerald-300">
                    <p className="font-medium text-gray-800">
                      <strong>Airtel:</strong> <span className="font-mono font-bold text-red-700 text-base">0700924322</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopy('0700924322')}
                      className="px-2.5 py-1 bg-[#006400] hover:bg-[#004d00] text-white text-xs font-bold rounded-md flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedNumber === '0700924322' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-gray-700 pt-1">
                    <strong>Name:</strong> MUBS Market Admin
                  </p>
                  <p className="text-xs text-[#006400] font-semibold">
                    <strong>Boost Listing:</strong> 5,000 UGX for 7 days top placement
                  </p>
                  <p className="text-xs text-[#006400] font-semibold">
                    <strong>Premium Shop:</strong> 15,000 UGX for 30 days unlimited listings
                  </p>
                </div>
              </div>

              {/* Exact steps text required by prompt */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-950">
                  <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                  Follow these steps:
                </p>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] font-medium pl-1">
                  <li>Send money via MoMo to <strong>0764117040</strong> or <strong>0700924322</strong></li>
                  <li>You will get SMS with Transaction ID</li>
                  <li>Copy Transaction ID from SMS</li>
                  <li>Paste below</li>
                </ol>
              </div>

              {/* Product selector if boosting */}
              {activeTab === 'boost' && allUserProducts.length > 0 && !targetProduct && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Select Product to Boost
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition bg-white"
                  >
                    <option value="">-- Choose one of your listings --</option>
                    {allUserProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (UGX {p.price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Verification Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Which number did you send money to? */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Which number did you send money to? <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="select-sent-to-number"
                    value={sentToNumber}
                    onChange={(e) => setSentToNumber(e.target.value as PaymentNumber)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition bg-white"
                  >
                    <option value="0764117040">MTN 0764117040 (MUBS Market Admin)</option>
                    <option value="0700924322">Airtel 0700924322 (MUBS Market Admin)</option>
                  </select>
                </div>

                {/* 2. MoMo Transaction ID from SMS */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    MoMo Transaction ID from SMS <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="momo-tx-id-input"
                    type="text"
                    required
                    placeholder="e.g. 2948190342 or CI240901.1234"
                    value={userTransactionId}
                    onChange={(e) => setUserTransactionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono uppercase tracking-wider border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition"
                  />
                </div>

                {/* 3. Amount sent */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Amount sent (UGX) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="amount-sent-input"
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    {activeTab === 'boost' ? '5,000 UGX for 7-day Boost' : '15,000 UGX for 30-day Premium Shop'}
                  </p>
                </div>

                {/* Submit button */}
                <button
                  id="btn-submit-verification"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 bg-[#006400] hover:bg-[#004d00] active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit for Verification</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
