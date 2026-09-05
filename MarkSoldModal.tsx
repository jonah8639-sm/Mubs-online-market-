import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  Lock, 
  ShieldAlert,
  Loader2,
  FileCheck
} from 'lucide-react';
import { doc, updateDoc, collection, addDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, UserProfile } from '../types';
import { 
  COMMISSION_RATE, 
  calculateCommission, 
  formatUGX 
} from '../lib/commissionConstants';
import { PaymentBox } from './PaymentBox';
import { compressProductImage } from '../lib/imageCompressor';

interface MarkSoldModalProps {
  product: Product | null;
  currentUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedProduct: Product) => void;
}

export const MarkSoldModal: React.FC<MarkSoldModalProps> = ({
  product,
  currentUser,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !product) return null;

  const [soldPrice, setSoldPrice] = useState<number>(product.price || 0);
  const [buyerWhatsapp, setBuyerWhatsapp] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [hasConfirmedAgreement, setHasConfirmedAgreement] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const commissionDue = calculateCommission(soldPrice);

  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a screenshot (JPG, PNG).');
      return;
    }
    try {
      const compressed = await compressProductImage(file);
      setProofFile(compressed);
      setProofPreview(URL.createObjectURL(compressed));
    } catch {
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage('You must be signed in to mark an item as sold.');
      return;
    }

    if (!soldPrice || soldPrice <= 0) {
      setErrorMessage('Please enter a valid final sale price.');
      return;
    }

    // Buyer WhatsApp validation
    const cleanPhone = buyerWhatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setErrorMessage('Please enter a valid Buyer WhatsApp phone number (e.g. 07XXXXXXXX or 2567XXXXXXXX).');
      return;
    }

    if (!hasConfirmedAgreement) {
      setErrorMessage('You must confirm that you sold this product and agree to pay 5% commission.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Prepare Base64 proof if provided
      let proofUrl = '';
      if (proofFile) {
        try {
          const reader = new FileReader();
          proofUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(proofFile);
          });
        } catch (fileErr) {
          console.warn('Proof conversion notice:', fileErr);
        }
      }

      const now = new Date().toISOString();

      // 2. Update Product Document in Firestore
      const updatedProductData: Partial<Product> = {
        status: 'sold',
        sold_price: soldPrice,
        sold_at: now,
        buyer_whatsapp: buyerWhatsapp.trim(),
        buyer_proof_url: proofUrl,
        commission_rate: COMMISSION_RATE,
        commission_amount: commissionDue,
        commission_status: 'unpaid',
      };

      await updateDoc(doc(db, 'products', product.id), updatedProductData);

      // 3. Create Record in 'commissions' collection
      await addDoc(collection(db, 'commissions'), {
        product_id: product.id,
        product_title: product.title,
        seller_id: currentUser.id,
        seller_email: currentUser.email,
        seller_name: currentUser.displayName || 'MUBS Student',
        seller_whatsapp: currentUser.whatsapp || product.whatsapp || '',
        seller_phone: product.whatsapp || '',
        sold_price: soldPrice,
        commission_amount: commissionDue,
        buyer_whatsapp: buyerWhatsapp.trim(),
        buyer_proof_url: proofUrl,
        status: 'unpaid',
        created_at: now,
      });

      // 4. Update User Profile Document to increment sold & unpaid counters
      try {
        await updateDoc(doc(db, 'users', currentUser.id), {
          sold_count: increment(1),
          unpaid_sold_count: increment(1),
        });
      } catch (uErr) {
        console.warn('User stats update notice:', uErr);
      }

      const completeUpdatedProduct: Product = {
        ...product,
        ...updatedProductData,
      } as Product;

      onSuccess(completeUpdatedProduct);
      onClose();
    } catch (err: any) {
      console.error('Failed to mark item sold:', err);
      setErrorMessage(err.message || 'Failed to mark item sold. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#006400] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900">Mark Listing as Sold</h3>
              <p className="text-[11px] text-gray-500">Record final sale & 5% commission obligation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Preview Snippet */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-14 h-14 rounded-xl object-cover bg-white border border-gray-200 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-gray-900 truncate">{product.title}</h4>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
              <span>Listed for: {formatUGX(product.price)}</span>
              <span>•</span>
              <span>{product.location}</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sold Price (Locked once submitted) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Final Sale Price (UGX) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1000"
                step="500"
                value={soldPrice || ''}
                onChange={(e) => setSoldPrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#006400] outline-hidden"
                placeholder="e.g. 50000"
                required
              />
              <div className="absolute right-3 top-2.5 text-xs text-gray-400 font-semibold">UGX</div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <Lock className="w-3 h-3 text-gray-400" />
              Sold price is locked forever upon confirmation to prevent evasion.
            </p>
          </div>

          {/* Commission Calculation Display */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-950 block">Market Commission (5%)</span>
              <span className="text-[11px] text-emerald-700">Official MUBS marketplace maintenance rate</span>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-[#006400] font-mono">
                {formatUGX(commissionDue)}
              </span>
              <span className="text-[10px] text-emerald-600 block">Due upon marking sold</span>
            </div>
          </div>

          {/* Required: Buyer WhatsApp Number */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Buyer's WhatsApp Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={buyerWhatsapp}
              onChange={(e) => setBuyerWhatsapp(e.target.value)}
              placeholder="e.g. 0701234567 or 256701234567"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#006400] outline-hidden"
              required
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Used by administration for student verification audits to prevent false sales.
            </p>
          </div>

          {/* Upload Proof (Optional but encouraged) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Upload Proof of Sale (MoMo SMS / WhatsApp Chat Screenshot)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 border-2 border-dashed border-gray-300 hover:border-[#006400] rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer bg-gray-50 hover:bg-emerald-50/50 transition">
                <Upload className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-600 font-semibold">
                  {proofFile ? proofFile.name : 'Choose Screenshot Image'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProofChange}
                  className="hidden"
                />
              </label>

              {proofPreview && (
                <img
                  src={proofPreview}
                  alt="Proof preview"
                  className="w-12 h-12 rounded-xl object-cover border border-emerald-300"
                />
              )}
            </div>
          </div>

          {/* Mandatory Checkbox Agreement */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasConfirmedAgreement}
                onChange={(e) => setHasConfirmedAgreement(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-[#006400] focus:ring-[#006400] border-gray-300 cursor-pointer"
              />
              <span className="text-xs text-amber-950 font-medium leading-snug">
                I confirm I sold this product and I agree to pay <strong>5% commission ({formatUGX(commissionDue)})</strong> to admin. If I lie or fail to pay, my account and listings will be permanently banned.
              </span>
            </label>
          </div>

          {/* Official Payment Box */}
          <PaymentBox
            amount={commissionDue}
            title="Pay Commission To Official Numbers"
            subtitle="Pay 5% commission via MTN or Airtel MoMo to avoid account restriction within 24h."
          />

          {/* Irreversible Warning */}
          <div className="flex items-start gap-2 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Once marked sold, this listing will display a public <strong>SOLD</strong> badge to all buyers and cannot be deleted until the 5% commission is verified.
            </span>
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasConfirmedAgreement}
              className="px-5 py-2.5 bg-[#006400] hover:bg-[#004d00] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Recording Sale...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>Confirm Sold & Agree to Commission</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
