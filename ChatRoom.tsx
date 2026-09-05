import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Send, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  CreditCard, 
  Download, 
  Clock, 
  Sparkles,
  Phone,
  AlertTriangle,
  X,
  FileText
} from 'lucide-react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Chat, ChatMessage, UserProfile } from '../types';
import { 
  ESCROW_MTN_NUMBER, 
  ESCROW_AIRTEL_NUMBER, 
  COMMISSION_RATE, 
  calculateAutoSplit, 
  containsPhoneNumber, 
  maskPhoneNumbers, 
  executeAutoSplitFlow 
} from '../lib/momoAutoSplit';

interface ChatRoomProps {
  chatId: string;
  currentUser: UserProfile;
  onBack: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  chatId,
  currentUser,
  onBack,
}) => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerInput, setOfferInput] = useState('');
  const [phoneWarning, setPhoneWarning] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [buyerPaymentPhone, setBuyerPaymentPhone] = useState(currentUser.phone || '');
  const [paymentStep, setPaymentStep] = useState<'prompt' | 'processing' | 'success'>('prompt');
  const [autoSplitResult, setAutoSplitResult] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to Chat document
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'chats', chatId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Chat;
        setChat({ ...data, id: docSnap.id });
      }
    });
    return () => unsub();
  }, [chatId]);

  // Subscribe to Messages subcollection
  useEffect(() => {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ ...d.data(), id: d.id } as ChatMessage);
      });
      setMessages(msgs);
    });
    return () => unsub();
  }, [chatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!chat) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 space-y-4">
        <div className="w-10 h-10 border-4 border-[#006400] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-600">Loading negotiation chat...</p>
      </div>
    );
  }

  const isBuyer = currentUser.id === chat.buyerId;
  const isSeller = currentUser.id === chat.sellerId;
  const otherPartyName = isBuyer ? chat.sellerName : chat.buyerName;
  const originalPrice = chat.originalPrice || chat.productPrice;
  const agreedPrice = chat.agreedPrice || chat.productPrice;
  const { commission, sellerGets } = calculateAutoSplit(agreedPrice, originalPrice);

  // Send standard text message with phone number blocking
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    // Check for phone number leak before payment
    if (!chat.escrowPaid && containsPhoneNumber(trimmed)) {
      setPhoneWarning(
        '⚠️ Phone numbers are hidden until payment is secured in Escrow (0764117040) to protect MUBS students from scams and enforce safety.'
      );

      // Log contact request attempt
      try {
        await addDoc(collection(db, 'contact_requests'), {
          chatId: chat.id,
          productId: chat.productId,
          userId: currentUser.id,
          userName: currentUser.displayName,
          attemptedText: trimmed,
          createdAt: new Date().toISOString(),
          status: 'blocked_off_platform_attempt',
        });
      } catch (err) {
        // Continue
      }

      // Mask phone
      const masked = maskPhoneNumbers(trimmed);
      await sendMessageToSubcollection(masked, 'text');
      setInputText('');
      return;
    }

    setPhoneWarning(null);
    await sendMessageToSubcollection(trimmed, 'text');
    setInputText('');
  };

  const sendMessageToSubcollection = async (text: string, type: ChatMessage['type'], offerAmount?: number) => {
    const now = new Date().toISOString();
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      chatId,
      senderId: currentUser.id,
      senderName: currentUser.displayName || (isBuyer ? 'Buyer' : 'Seller'),
      senderEmail: currentUser.email,
      text,
      type,
      offerAmount: offerAmount || null,
      createdAt: now,
    });

    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      lastMessageAt: now,
      updatedAt: now,
    });
  };

  // Submit Offer
  const handleMakeOffer = async () => {
    const amount = parseInt(offerInput.replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) {
      alert('Please enter a valid offer amount in UGX');
      return;
    }

    const now = new Date().toISOString();
    const offeredBy = isBuyer ? 'buyer' : 'seller';

    await updateDoc(doc(db, 'chats', chatId), {
      status: 'negotiating',
      currentOffer: {
        amount,
        offeredBy,
        status: 'pending',
        timestamp: now,
      },
      updatedAt: now,
    });

    await sendMessageToSubcollection(
      `Offered UGX ${amount.toLocaleString()} for ${chat.productTitle}`,
      'offer',
      amount
    );

    setShowOfferModal(false);
    setOfferInput('');
  };

  // Accept Offer
  const handleAcceptOffer = async () => {
    if (!chat.currentOffer) return;
    const acceptedAmount = chat.currentOffer.amount;
    const now = new Date().toISOString();

    const { commission: comm, sellerGets: sellerNet } = calculateAutoSplit(acceptedAmount, originalPrice);

    await updateDoc(doc(db, 'chats', chatId), {
      status: 'offer_accepted',
      agreedPrice: acceptedAmount,
      commissionKept: comm,
      sellerPaid: sellerNet,
      currentOffer: {
        ...chat.currentOffer,
        status: 'accepted',
      },
      updatedAt: now,
    });

    await sendMessageToSubcollection(
      `🤝 Offer of UGX ${acceptedAmount.toLocaleString()} ACCEPTED! Escrow auto-split prepared: 5% platform cut (UGX ${comm.toLocaleString()} to 0764117040), Seller gets UGX ${sellerNet.toLocaleString()}.`,
      'offer_accepted',
      acceptedAmount
    );
  };

  // Reject Offer
  const handleRejectOffer = async () => {
    if (!chat.currentOffer) return;
    const now = new Date().toISOString();

    await updateDoc(doc(db, 'chats', chatId), {
      currentOffer: {
        ...chat.currentOffer,
        status: 'rejected',
      },
      updatedAt: now,
    });

    await sendMessageToSubcollection(
      `❌ Declined the offer of UGX ${chat.currentOffer.amount.toLocaleString()}`,
      'offer_rejected'
    );
  };

  // Pay via Escrow with Auto-Split
  const handleStartPayment = () => {
    setShowPaymentDrawer(true);
    setPaymentStep('prompt');
  };

  const handleConfirmEscrowPayment = async () => {
    if (!buyerPaymentPhone || buyerPaymentPhone.length < 9) {
      alert('Please enter your valid MoMo phone number');
      return;
    }

    setIsPaying(true);
    setPaymentStep('processing');

    try {
      const collectionRef = `MOMO_COL_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Execute auto-cut & auto-split logic
      const result = await executeAutoSplitFlow({
        chat: {
          ...chat,
          agreedPrice,
          originalPrice,
        },
        collectionRef,
      });

      setAutoSplitResult({
        agreedPrice,
        originalPrice,
        commission: result.commission,
        sellerGets: result.sellerGets,
        collectionRef,
        disbursementRef: result.disbursementRef,
        sellerPhone: chat.sellerPhone,
      });

      setPaymentStep('success');
    } catch (err: any) {
      alert('Payment processing error: ' + (err?.message || 'Please try again'));
      setPaymentStep('prompt');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[90vh] flex flex-col bg-gray-50 border border-gray-200 rounded-3xl overflow-hidden shadow-xl">
      
      {/* 1. CHAT TOP BAR */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-gray-600 hover:text-[#006400] hover:bg-gray-100 rounded-full transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {chat.productImage && (
            <img
              src={chat.productImage}
              alt={chat.productTitle}
              className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0"
            />
          )}

          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-gray-900 truncate">
              {otherPartyName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
              <span className="truncate">{chat.productTitle}</span>
              <span>•</span>
              <span className="font-bold text-[#006400]">
                List: UGX {originalPrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="shrink-0">
          {chat.status === 'completed_auto_paid' ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-[#006400] border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Paid & Auto-Split
            </span>
          ) : chat.status === 'offer_accepted' ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Offer Accepted
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              Negotiating
            </span>
          )}
        </div>
      </div>

      {/* 2. PRODUCT & ESCROW NOTICE CARD */}
      <div className="bg-emerald-50/70 border-b border-emerald-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-2 text-emerald-950 font-medium">
          <ShieldCheck className="w-4 h-4 text-[#006400] shrink-0" />
          <span>
            MUBS Escrow Protected (MTN <strong>0764117040</strong>). 5% original price locked platform cut.
          </span>
        </div>

        {/* Action Button: Make Offer / Counter */}
        {chat.status !== 'completed_auto_paid' && (
          <button
            onClick={() => setShowOfferModal(true)}
            className="flex items-center gap-1 px-3 py-1 bg-[#006400] hover:bg-[#004d00] text-white font-bold rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Tag className="w-3 h-3" />
            <span>Make Offer</span>
          </button>
        )}
      </div>

      {/* 3. AGREED PRICE / ACTIVE OFFER BANNER */}
      {chat.currentOffer && chat.currentOffer.status === 'pending' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 text-amber-900 font-semibold">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>
              Pending Offer: <strong>UGX {chat.currentOffer.amount.toLocaleString()}</strong>
              {chat.currentOffer.offeredBy === (isBuyer ? 'buyer' : 'seller') ? ' (Your offer)' : ' (Incoming)'}
            </span>
          </div>

          {chat.currentOffer.offeredBy !== (isBuyer ? 'buyer' : 'seller') && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAcceptOffer}
                className="px-3 py-1 bg-[#006400] text-white font-bold rounded-lg hover:bg-[#004d00] cursor-pointer"
              >
                Accept Offer
              </button>
              <button
                onClick={() => setShowOfferModal(true)}
                className="px-2.5 py-1 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                Counter
              </button>
              <button
                onClick={handleRejectOffer}
                className="px-2.5 py-1 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 cursor-pointer"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. AGREED PRICE SUMMARY & PAY NOW BUTTON */}
      {chat.status === 'offer_accepted' && !chat.escrowPaid && (
        <div className="bg-emerald-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-inner">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-black text-sm text-emerald-300">
              <span>Agreed: UGX {agreedPrice.toLocaleString()}</span>
              <span className="text-emerald-400 font-normal text-xs">(List: UGX {originalPrice.toLocaleString()})</span>
            </div>
            <div className="text-emerald-200 text-[11px]">
              ✂️ 5% Cut: UGX {commission.toLocaleString()} (0764117040) • 📤 Seller: UGX {sellerGets.toLocaleString()}
            </div>
          </div>

          {isBuyer ? (
            <button
              onClick={handleStartPayment}
              className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-gray-900 font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Pay Now via MoMo Escrow</span>
            </button>
          ) : (
            <span className="px-3 py-1 rounded-lg bg-emerald-800 text-emerald-200 font-medium">
              Waiting for buyer payment into Escrow 0764117040
            </span>
          )}
        </div>
      )}

      {/* 5. MESSAGES SCROLL AREA (WhatsApp style) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#EFEAE2]">
        
        {/* Encrypted / Protected Notice */}
        <div className="flex justify-center">
          <div className="bg-amber-100/90 border border-amber-200 text-amber-900 text-[11px] px-3 py-1 rounded-xl max-w-sm text-center shadow-2xs font-medium">
            🔒 MUBS verified student chat. Phone numbers are protected until payment is confirmed in Escrow 0764117040.
          </div>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const isSys = msg.senderId === 'system' || msg.type === 'auto_split_receipt';

          // System / Auto-Split Receipt
          if (isSys || msg.type === 'auto_split_receipt') {
            const data = msg.autoSplitData;
            return (
              <div key={msg.id} className="max-w-md mx-auto my-3">
                <div className="bg-white border-2 border-emerald-600 rounded-2xl p-4 shadow-md space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm border-b border-emerald-100 pb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Payment & Auto-Split Successful</span>
                  </div>

                  {data && (
                    <div className="space-y-1.5 text-xs text-gray-700">
                      <div className="flex justify-between font-bold">
                        <span>💰 Paid to Escrow:</span>
                        <span className="text-gray-900 font-mono">UGX {data.agreedPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 bg-emerald-50 p-1.5 rounded-lg font-semibold">
                        <span>✂️ 5% Platform Cut (0764117040):</span>
                        <span className="font-mono">UGX {data.commission.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-blue-700 bg-blue-50 p-1.5 rounded-lg font-semibold">
                        <span>📤 Auto-Sent to Seller:</span>
                        <span className="font-mono">UGX {data.sellerGets.toLocaleString()}</span>
                      </div>
                      <div className="text-[10px] text-gray-500 pt-1 border-t border-gray-100">
                        Refs: {data.collectionRef} / {data.disbursementRef}
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] font-bold text-[#006400] text-center pt-1">
                    {isSeller 
                      ? `💵 Check MoMo ${chat.sellerPhone} - You received UGX ${sellerGets.toLocaleString()}`
                      : `🤝 Escrow secure - arrange pickup with ${chat.sellerName}!`}
                  </div>
                </div>
              </div>
            );
          }

          // Regular WhatsApp bubbles
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[78%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 text-sm shadow-xs ${
                  isMe
                    ? 'bg-[#DCF8C6] text-gray-900 rounded-tr-none'
                    : 'bg-white text-gray-900 rounded-tl-none border border-gray-200'
                }`}
              >
                {!isMe && (
                  <span className="block text-[10px] font-bold text-emerald-800 mb-0.5">
                    {msg.senderName}
                  </span>
                )}

                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-gray-500">
                  <span>
                    {msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                  {isMe && <span className="text-emerald-700 font-bold">✓✓</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Phone Block Warning Banner */}
      {phoneWarning && (
        <div className="bg-red-50 border-t border-red-200 px-4 py-2 flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{phoneWarning}</span>
          </div>
          <button
            onClick={() => setPhoneWarning(null)}
            className="p-1 hover:bg-red-100 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 6. INPUT BAR */}
      <form
        onSubmit={handleSendMessage}
        className="bg-white border-t border-gray-200 p-2.5 sm:p-3 flex items-center gap-2 shrink-0"
      >
        <button
          type="button"
          onClick={() => setShowOfferModal(true)}
          className="p-2 text-gray-600 hover:text-[#006400] hover:bg-gray-100 rounded-full transition cursor-pointer"
          title="Make or counter offer"
        >
          <Tag className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            chat.escrowPaid
              ? 'Type a message (contact numbers now unlocked)...'
              : 'Type a message... (Phone numbers protected by Escrow)'
          }
          className="flex-1 bg-gray-100 focus:bg-white border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006400]"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 bg-[#006400] hover:bg-[#004d00] disabled:opacity-40 text-white rounded-full shadow-xs transition cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* OFFER MODAL */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">
                <Tag className="w-5 h-5 text-[#006400]" />
                Make Price Offer
              </h3>
              <button
                onClick={() => setShowOfferModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl space-y-1">
              <div className="flex justify-between">
                <span>Original Listing Price:</span>
                <span className="font-bold text-gray-900">UGX {originalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-semibold">
                <span>5% Escrow Commission:</span>
                <span>UGX {Math.round(originalPrice * 0.05).toLocaleString()} (Locked)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Your Offer in UGX:
              </label>
              <input
                type="number"
                value={offerInput}
                onChange={(e) => setOfferInput(e.target.value)}
                placeholder="e.g. 280000"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-lg font-mono font-extrabold focus:ring-2 focus:ring-[#006400] focus:bg-white outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowOfferModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleMakeOffer}
                className="flex-1 py-2.5 bg-[#006400] hover:bg-[#004d00] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Send Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT DRAWER / MODAL */}
      {showPaymentDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-200 animate-in fade-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-[#006400] font-black text-base">
                <CreditCard className="w-5 h-5" />
                <span>MoMo Escrow Auto-Cut Payment</span>
              </div>
              <button
                onClick={() => setShowPaymentDrawer(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentStep === 'prompt' && (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex justify-between text-sm font-black text-gray-900">
                    <span>Agreed Product Price:</span>
                    <span className="font-mono">UGX {agreedPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-800 font-semibold">
                    <span>✂️ 5% Commission Cut (0764117040):</span>
                    <span className="font-mono">UGX {commission.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-blue-800 font-semibold">
                    <span>📤 Seller Auto-Payout:</span>
                    <span className="font-mono">UGX {sellerGets.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 pt-1 border-t border-emerald-100">
                    Your money stays safe in MUBS Escrow. The seller is only disbursed after you pay.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Your MTN MoMo Phone Number:
                  </label>
                  <input
                    type="tel"
                    value={buyerPaymentPhone}
                    onChange={(e) => setBuyerPaymentPhone(e.target.value)}
                    placeholder="077XXXXXXX or 076XXXXXXX"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-[#006400] focus:bg-white outline-none"
                  />
                </div>

                <button
                  onClick={handleConfirmEscrowPayment}
                  disabled={isPaying}
                  className="w-full py-3.5 bg-[#006400] hover:bg-[#004d00] text-white font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer"
                >
                  Pay UGX {agreedPrice.toLocaleString()} to 0764117040
                </button>
              </div>
            )}

            {paymentStep === 'processing' && (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-[#006400] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <h4 className="text-base font-extrabold text-gray-900">
                  Processing MoMo Auto-Cut...
                </h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  1. Receiving UGX {agreedPrice.toLocaleString()} into Escrow (0764117040)<br/>
                  2. Auto-cutting 5% platform commission<br/>
                  3. Auto-disbursing UGX {sellerGets.toLocaleString()} to seller...
                </p>
              </div>
            )}

            {paymentStep === 'success' && autoSplitResult && (
              <div className="space-y-4">
                <div className="bg-emerald-500 text-white rounded-2xl p-5 text-center space-y-3 shadow-lg">
                  <CheckCircle2 className="w-12 h-12 mx-auto fill-white text-emerald-600" />
                  <h4 className="text-lg font-black tracking-tight">
                    ✅ Payment Successful!
                  </h4>
                  <div className="text-left bg-emerald-700/60 rounded-xl p-3 text-xs space-y-1.5 font-medium">
                    <p>💰 <strong>Paid:</strong> {autoSplitResult.agreedPrice.toLocaleString()} UGX to 0764117040</p>
                    <p>✂️ <strong>Commission Auto-Cut:</strong> {autoSplitResult.commission.toLocaleString()} UGX (5% of {autoSplitResult.originalPrice.toLocaleString()}) → Stays in Admin 0764117040</p>
                    <p>📤 <strong>Auto-Deposit:</strong> {autoSplitResult.sellerGets.toLocaleString()} UGX → Sent instantly to Seller {autoSplitResult.sellerPhone}</p>
                    <p className="text-[10px] text-emerald-200 pt-1 border-t border-emerald-600">
                      MoMo Refs: {autoSplitResult.collectionRef} / {autoSplitResult.disbursementRef}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const receiptText = `MUBS MARKETPLACE ESCROW RECEIPT\nProduct: ${chat.productTitle}\nPaid: UGX ${autoSplitResult.agreedPrice}\nCommission Kept: UGX ${autoSplitResult.commission}\nSeller Payout: UGX ${autoSplitResult.sellerGets}\nRef: ${autoSplitResult.collectionRef}\nDate: ${new Date().toLocaleString()}`;
                      const blob = new Blob([receiptText], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `MUBS_Receipt_${autoSplitResult.collectionRef}.txt`;
                      a.click();
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download Receipt
                  </button>

                  <button
                    onClick={() => setShowPaymentDrawer(false)}
                    className="flex-1 py-2.5 bg-[#006400] text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Back to Chat
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
