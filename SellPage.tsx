import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle2, 
  Upload, 
  ArrowLeft,
  X,
  ShieldAlert,
  Zap,
  PhoneCall,
  Clock
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { compressProductImage, uploadProductImageWithProgress } from '../lib/imageCompressor';
import { UserProfile, ProductCategory, ProductCondition, ProductLocation, Product } from '../types';
import { isOfficialMubsEmail } from '../lib/mubsValidation';
import { 
  COMMISSION_RATE, 
  calculateCommission, 
  formatUGX, 
  getDeviceFingerprint, 
  evaluatePenaltyStatus,
  MTN_MOMO_NUMBER, 
  AIRTEL_MONEY_NUMBER 
} from '../lib/commissionConstants';
import { PaymentBox } from './PaymentBox';

interface SellPageProps {
  currentUser: UserProfile | null;
  activeListingsCount: number;
  userProducts?: Product[];
  onSuccess: () => void;
  onCancel: () => void;
  onOpenAuth: () => void;
  onOpenUpgrade: () => void;
  onNavigateToPayments?: () => void;
}

const CATEGORIES: ProductCategory[] = [
  'Books',
  'Electronics',
  'Hostel Items',
  'Fashion',
  'Shoes',
  'Other'
];

const CONDITIONS: ProductCondition[] = [
  'New',
  'Like New',
  'Used'
];

const LOCATIONS: ProductLocation[] = [
  'MUBS Main Campus',
  'Nakawa',
  'Banda',
  'Kinawataka',
  'Hostel Area'
];

export const SellPage: React.FC<SellPageProps> = ({
  currentUser,
  activeListingsCount,
  userProducts = [],
  onSuccess,
  onCancel,
  onOpenAuth,
  onOpenUpgrade,
  onNavigateToPayments,
}) => {
  // Form fields
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Books');
  const [condition, setCondition] = useState<ProductCondition>('Like New');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<ProductLocation>('MUBS Main Campus');
  const [whatsapp, setWhatsapp] = useState('');

  // Photo state
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<{ origKb: number; compKb: number } | null>(null);

  // Upload & Progress states
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Input refs for programmatic clicks
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Check trial or free plan limits
  const isTrialActive = currentUser?.trialEndsAt ? new Date(currentUser.trialEndsAt) > new Date() : true;
  const isPremium = currentUser?.is_premium || currentUser?.plan === 'premium';
  const isExceededFreePlan = !isTrialActive && !isPremium && activeListingsCount >= 2;

  // Anti-defaulter check: Query products where commission is unpaid / pending
  const unpaidItems = userProducts.filter(
    (p) => (p.status === 'sold' && p.commission_status !== 'paid') ||
           p.commission_status === 'unpaid' ||
           p.commission_status === 'pending'
  );

  const isBanned = currentUser?.is_banned || unpaidItems.some(p => evaluatePenaltyStatus(p.sold_at || p.created_at, p.commission_status).isBanned7d);
  const isRestricted = currentUser?.is_restricted || unpaidItems.length > 0;

  // Handle instant photo selection & background compression
  const handleFileChosen = async (file: File) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    setRawFile(file);

    // 1. INSTANT PREVIEW: immediately show preview with URL.createObjectURL(file)
    const instantUrl = URL.createObjectURL(file);
    setPreviewUrl(instantUrl);

    // 2. SPEED FIX - COMPRESS IN BROWSER: browser-image-compression to under 300KB
    try {
      setUploadProgressText('Step 1: Compressing...');
      const origKb = Math.round(file.size / 1024);
      const compressed = await compressProductImage(file);
      const compKb = Math.round(compressed.size / 1024);
      setCompressedFile(compressed);
      setCompressionInfo({ origKb, compKb });
      setUploadProgressText(null);
    } catch (err: any) {
      console.warn('Compression error:', err);
      // Still keep the file so user is not blocked
      setCompressedFile(file);
      setUploadProgressText(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (isExceededFreePlan) {
      setError('Free plan limit reached (max 2 active listings). Upgrade to Premium or delete an older listing.');
      return;
    }

    if (!rawFile && !previewUrl) {
      setError('Please provide at least 1 photo of your item (Take Photo or Choose from Gallery).');
      return;
    }

    const cleanPrice = parseFloat(price.replace(/,/g, ''));
    if (isNaN(cleanPrice) || cleanPrice <= 0) {
      setError('Please enter a valid price in UGX.');
      return;
    }

    let cleanWhatsapp = whatsapp.trim().replace(/\D/g, '');
    if (cleanWhatsapp.startsWith('0')) {
      cleanWhatsapp = '256' + cleanWhatsapp.substring(1);
    } else if (!cleanWhatsapp.startsWith('256')) {
      cleanWhatsapp = '256' + cleanWhatsapp;
    }

    if (cleanWhatsapp.length < 12) {
      setError('Please enter a valid Ugandan WhatsApp number (e.g. 0764117040 or 256764117040).');
      return;
    }

    setIsProcessing(true);

    try {
      // LOOPHOLE 4: Cross-account WhatsApp check - block evasion by creating another account with same WhatsApp
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('whatsapp', '==', cleanWhatsapp)));
        const otherUserDoc = usersSnap.docs.find((d) => d.id !== currentUser.id);
        if (otherUserDoc) {
          const oData = otherUserDoc.data();
          if (oData.is_banned || oData.is_restricted) {
            setError('This WhatsApp number is linked to a restricted account. You cannot post items until all commissions are cleared.');
            setIsProcessing(false);
            return;
          }
        }

        // Check if any sold products associated with this WhatsApp number have unpaid commissions
        const prodSnap = await getDocs(query(
          collection(db, 'products'),
          where('whatsapp', '==', cleanWhatsapp),
          where('status', '==', 'sold')
        ));
        const hasUnpaid = prodSnap.docs.some((d) => d.data().commission_status !== 'paid');
        if (hasUnpaid) {
          setError('This WhatsApp number has sold items with unpaid 5% commissions. Settle all pending commissions to 0764117040 before posting new items.');
          setIsProcessing(false);
          return;
        }

        // Store WhatsApp on user record for identity enforcement
        await updateDoc(doc(db, 'users', currentUser.id), {
          whatsapp: cleanWhatsapp,
        });
      } catch (checkErr) {
        console.warn('WhatsApp uniqueness check notice:', checkErr);
      }

      // 1. Ensure file is compressed
      let fileToUpload = compressedFile;
      if (!fileToUpload && rawFile) {
        setUploadProgressText('Step 1: Compressing...');
        fileToUpload = await compressProductImage(rawFile);
      }

      // 2. Show progress: "Step 1: Compressing... Step 2: Uploading 0%... 100%"
      setUploadProgressText('Step 2: Uploading 0%...');

      let finalImageUrl = previewUrl || '';
      if (fileToUpload) {
        finalImageUrl = await uploadProductImageWithProgress(
          fileToUpload,
          currentUser.id,
          (percent) => {
            setUploadProgressText(`Step 2: Uploading ${percent}%...`);
          }
        );
      }

      setUploadProgressText('Step 2: Uploading 100%...');

      // 3. Save to Firestore collection "products"
      // Required schema: id, title, price, category, condition, description, location, whatsapp, imageUrl,
      // seller_id, seller_email, seller_name, is_boosted=false, is_premium=false, boost_expires_at=null, created_at, status=active
      const productDoc = {
        title: title.trim(),
        price: cleanPrice,
        original_price: cleanPrice, // Price lock: original_price saved at post, commission = original_price * 0.05 ALWAYS
        category,
        condition,
        description: description.trim(),
        location,
        whatsapp: cleanWhatsapp,
        imageUrl: finalImageUrl,
        seller_id: currentUser.id,
        seller_email: currentUser.email,
        seller_name: currentUser.displayName || 'MUBS Student',
        seller_phone: currentUser.phone || cleanWhatsapp,
        is_boosted: false,
        is_premium: isPremium,
        boost_expires_at: null,
        created_at: new Date().toISOString(),
        status: 'active',
        commission_rate: 0.05,
        commission_amount: Math.round(cleanPrice * 0.05),
      };

      await addDoc(collection(db, 'products'), productDoc);

      onSuccess();
    } catch (err: any) {
      console.error('Error posting listing:', err);
      setError(err?.message || 'Failed to post item. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
      setUploadProgressText(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-3xl border border-gray-200 shadow-sm text-center my-8">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
          <Upload className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to Sell on MUBS Market</h2>
        <p className="text-sm text-gray-600 mb-6">
          Only verified MUBS students & staff can post listings. Join with your student email in seconds.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-sm transition"
        >
          Sign In with MUBS Student Email
        </button>
      </div>
    );
  }

  // Banned Account Block (Fraud or Commission)
  if (currentUser?.is_banned || isBanned) {
    return (
      <div className="max-w-xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border-2 border-red-600 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-red-600 bg-red-100 px-3 py-1 rounded-full">
            Account Banned
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 mt-2">
            ACCOUNT BANNED - Fake MUBS Account
          </h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Your account has been banned due to unverified registration credentials or defaulting on marketplace obligations. Contact admin on WhatsApp to resolve.
          </p>
        </div>

        <PaymentBox
          title="Official Unban Payment Numbers"
          subtitle="Pay outstanding commission to MTN 0764117040 or Airtel 0700924322, then message admin on WhatsApp with transaction ID to appeal."
        />

        <div className="pt-2">
          <a
            href="https://wa.me/256764117040?text=Hello%20MUBS%20Market%20Admin%2C%20I%20am%20appealing%20my%20banned%20account%20http%3A%2F%2Fwa.me%2F256764117040"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-[#006400] hover:bg-[#004d00] text-white font-bold text-xs rounded-xl shadow-md transition"
          >
            Contact admin on WhatsApp (http://wa.me/256764117040)
          </a>
        </div>
      </div>
    );
  }

  // MUBS Verification Check: Only verified MUBS students can sell
  const isVerifiedMubs = 
    currentUser?.isMubsVerified || 
    currentUser?.verification_status === 'verified' || 
    isOfficialMubsEmail(currentUser?.email) ||
    currentUser?.email === 'jonah8639@gmail.com' ||
    currentUser?.email === 'gumikirizagilbert2002@mubs.ac.ug';

  if (!isVerifiedMubs) {
    return (
      <div className="max-w-xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border-2 border-amber-500 shadow-xl text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8" />
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
            MUBS Verification Required
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 mt-2">
            VERIFICATION REQUIRED TO POST
          </h2>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            Only verified MUBS students can sell to prevent fraud. Your account is currently pending verification. You can browse all items freely. To expedite verification, WhatsApp admin on 0764117040 with your MUBS student ID photo.
          </p>
        </div>

        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-left text-xs space-y-2 text-amber-900">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-600">Student Account:</span>
            <span className="font-mono font-bold">{currentUser?.email}</span>
          </div>
          {currentUser?.regNumber && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-600">Submitted Reg No:</span>
              <span className="font-mono font-bold">{currentUser.regNumber}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-600">Verification Status:</span>
            <span className="font-bold text-amber-700">Pending Admin Review</span>
          </div>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <a
            href="https://wa.me/256764117040?text=Hello%20MUBS%20Market%20Admin%2C%20here%20is%20my%20MUBS%20student%20ID%20photo%20for%20account%20verification"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-[#006400] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            Expedite via WhatsApp: 0764117040 (Send Student ID Photo)
          </a>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition cursor-pointer"
          >
            Browse Marketplace Items Instead
          </button>
        </div>
      </div>
    );
  }

  // LOOPHOLE 2: Unpaid Commission Block
  if (isRestricted && unpaidItems.length > 0) {
    const defaulterItem = unpaidItems[0];
    const totalDue = unpaidItems.reduce(
      (acc, it) => acc + (it.commission_amount || calculateCommission(it.sold_price || it.price)),
      0
    );
    const soldDate = new Date(defaulterItem.sold_at || defaulterItem.created_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <div className="max-w-xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border-2 border-red-500 shadow-xl space-y-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-red-600 bg-red-100 px-3 py-1 rounded-full">
            Account Restricted
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 mt-2">
            ACCOUNT RESTRICTED - UNPAID COMMISSION
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            You sold <strong>{defaulterItem.title}</strong> for <strong>{formatUGX(defaulterItem.sold_price || defaulterItem.price)}</strong> on {soldDate}.
          </p>
        </div>

        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-left space-y-1">
          <div className="flex justify-between items-center text-xs font-bold text-red-900">
            <span>Commission Due (5%):</span>
            <span className="text-base font-black text-red-700">{formatUGX(totalDue)}</span>
          </div>
          <p className="text-[11px] text-red-700">
            Your unpaid commission is {formatUGX(totalDue)}. You must clear payment to unblock your account and post new listings.
          </p>
        </div>

        <PaymentBox
          amount={totalDue}
          title="You must pay commission to:"
          subtitle="Send to either official MUBS Market number below to restore posting privileges:"
        />

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if (onNavigateToPayments) {
                onNavigateToPayments();
              } else {
                window.location.href = '/my-payments';
              }
            }}
            className="flex-1 py-3 bg-[#006400] hover:bg-[#004d00] text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            Go to Pay Button → /my-payments
          </button>
          <a
            href="https://wa.me/256764117040?text=Hello%20MUBS%20Market%20Admin%2C%20I%20want%20to%20clear%20my%20unpaid%20commission"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 bg-emerald-100 hover:bg-emerald-200 text-[#006400] font-extrabold text-xs rounded-xl transition text-center flex items-center justify-center gap-1.5"
          >
            Contact Admin on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-emerald-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Market
        </button>
        <h1 className="text-lg font-bold text-gray-900 font-sans">
          Post an Item for Sale
        </h1>
        <div className="w-16"></div>
      </div>

      {/* Plan limit warning banner */}
      {isExceededFreePlan && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-bold block">Active Listing Limit Reached (Free Plan)</span>
            <p className="mt-0.5">
              The free plan allows a maximum of 2 active listings. Upgrade to Premium Shop for unlimited listings.
            </p>
            <button
              type="button"
              onClick={onOpenUpgrade}
              className="mt-2 inline-flex items-center gap-1 font-bold text-amber-800 underline hover:text-amber-950"
            >
              <Zap className="w-3.5 h-3.5" /> Upgrade to Premium Shop (15,000 UGX / month)
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* PHOTO UPLOAD SECTION */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
              Product Photo <span className="text-red-500">*</span>
            </label>
            {compressionInfo && (
              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Compressed {compressionInfo.origKb}KB → {compressionInfo.compKb}KB (&lt;300KB)
              </span>
            )}
          </div>

          {/* Instant Photo Preview */}
          {previewUrl ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 aspect-16/10 max-h-64 bg-gray-100 flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Product preview"
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(null);
                  setRawFile(null);
                  setCompressedFile(null);
                  setCompressionInfo(null);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition shadow-md"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center bg-gray-50/50">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-xs text-gray-700 font-bold">
                Add at least 1 real photo of your item
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Instant preview with fast campus-optimized WebP compression.
              </p>
            </div>
          )}

          {/* 
            CRITICAL FIX REQUIRED BY PROMPT:
            1. Make 2 SEPARATE buttons:
               Button 1: "Take Photo" => <input type="file" accept="image/*" capture="environment" id="camera">
               Button 2: "Choose from Gallery" => <input type="file" accept="image/*,image/jpeg,image/png" id="gallery"> NO capture attribute
            2. DO NOT use display:none. Use style="position:absolute; opacity:0; width:100%; height:100%; top:0; left:0; cursor:pointer" over a styled div.
          */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Button 1: Take Photo */}
            <div 
              id="btn-take-photo-container"
              className="relative flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition shadow-xs cursor-pointer select-none"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="w-4 h-4 text-emerald-700 pointer-events-none" />
              <span className="pointer-events-none">Take Photo</span>
              <input
                ref={cameraInputRef}
                id="camera"
                type="file"
                accept="image/*"
                capture="environment"
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  top: 0,
                  left: 0,
                  cursor: 'pointer',
                }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChosen(f);
                }}
              />
            </div>

            {/* Button 2: Choose from Gallery */}
            <div 
              id="btn-choose-gallery-container"
              className="relative flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold transition shadow-xs cursor-pointer select-none"
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="w-4 h-4 text-gray-600 pointer-events-none" />
              <span className="pointer-events-none">Choose from Gallery</span>
              <input
                ref={galleryInputRef}
                id="gallery"
                type="file"
                accept="image/*,image/jpeg,image/png"
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  top: 0,
                  left: 0,
                  cursor: 'pointer',
                }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileChosen(f);
                }}
              />
            </div>
          </div>

          {/* Progress Banner */}
          {uploadProgressText && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-pulse">
              <div className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
              <span>{uploadProgressText}</span>
            </div>
          )}
        </div>

        {/* DETAILS FORM SECTION */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-4">
          
          {/* Title* */}
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
              Item Title <span className="text-red-500">*</span>
            </label>
            <input
              id="product-title"
              type="text"
              required
              maxLength={150}
              placeholder="e.g. BBA Financial Accounting Textbook (2nd Ed)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition"
            />
          </div>

          {/* Price UGX* & Category* */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                Price (UGX) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-400">
                  UGX
                </span>
                <input
                  id="product-price"
                  type="number"
                  min="500"
                  step="500"
                  required
                  placeholder="35000"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-14 pr-3.5 py-2.5 text-sm font-semibold border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id="product-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition bg-white font-medium"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Condition & Campus Location* */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                Condition
              </label>
              <select
                id="product-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ProductCondition)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition bg-white font-medium"
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>{cond}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                Location <span className="text-red-500">*</span>
              </label>
              <select
                id="product-location"
                value={location}
                onChange={(e) => setLocation(e.target.value as ProductLocation)}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition bg-white font-medium"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* WhatsApp Number* */}
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
              WhatsApp Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-emerald-700">
                +256
              </span>
              <input
                id="product-whatsapp"
                type="tel"
                required
                placeholder="764117040"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full pl-14 pr-3.5 py-2.5 text-sm font-semibold border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition"
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Interested MUBS students will click to chat directly with you on WhatsApp.
            </p>
          </div>

          {/* Description* */}
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="product-description"
              rows={4}
              required
              maxLength={1500}
              placeholder="State edition, course code, hostel name, or meetup details at campus..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition"
            />
          </div>

        </div>

        {/* Submit Button */}
        <button
          id="post-listing-submit-btn"
          type="submit"
          disabled={isProcessing || isExceededFreePlan}
          className="w-full py-4 px-6 rounded-2xl bg-[#006400] hover:bg-[#004d00] active:scale-[0.99] text-white font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>{uploadProgressText || 'Publishing listing...'}</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Post Listing to MUBS Market</span>
            </>
          )}
        </button>

      </form>
    </div>
  );
};
