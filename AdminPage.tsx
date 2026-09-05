import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Package, 
  Clock, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  AlertTriangle, 
  ArrowLeft,
  ShieldCheck,
  Search,
  ExternalLink,
  Sparkles,
  Phone,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  onSnapshot 
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, isUserAdmin } from '../lib/firebase';
import { SUPER_ADMIN_EMAIL } from '../config/admin';
import { Product, Transaction, UserProfile, CommissionRecord } from '../types';
import { AdminCommissionsView } from './AdminCommissionsView';
import { AdminUsersView } from './AdminUsersView';
import { INITIAL_MUBS_USERS } from '../lib/seedData';

const SUPER_ADMIN = "jonah8639@gmail.com";
const ADMIN_EMAILS = ["jonah8639@gmail.com"];

interface AdminPageProps {
  currentUser: UserProfile | null;
  isAdmin: boolean;
  onBackToMarket: () => void;
  onOpenAuth?: () => void;
  onViewSellerProfile?: (userId: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({
  currentUser,
  isAdmin,
  onBackToMarket,
  onOpenAuth,
  onViewSellerProfile,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersCount, setUsersCount] = useState<number>(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'commissions' | 'transactions' | 'products'>('users');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check admin authorization - STRICTLY jonah8639@gmail.com only
  const userEmail = currentUser?.email?.toLowerCase().trim() || '';
  const isAuthorizedAdmin = ADMIN_EMAILS.includes(userEmail);
  const isSuperOwner = userEmail === SUPER_ADMIN;
  const [isDeletingDemo, setIsDeletingDemo] = useState<boolean>(false);

  // 1. ADMIN AUTH GUARD - /admin PAGE SECURITY:
  useEffect(() => {
    if (!currentUser) {
      if (onOpenAuth) onOpenAuth();
      window.history.replaceState(null, '', '/');
      onBackToMarket();
      return;
    }
    if (!ADMIN_EMAILS.includes(userEmail)) {
      alert("Access Denied - Only Admin jonah8639@gmail.com can access. You are not admin.");
      window.history.replaceState(null, '', '/');
      onBackToMarket();
      return;
    }
  }, [currentUser, userEmail, onBackToMarket, onOpenAuth]);

  const handleDeleteDemoProducts = async () => {
    if (!window.confirm("Delete all demo/test products? (Searches for products with 'iPhone', 'Demo', 'Sample' in title, or with no seller_id)")) {
      return;
    }

    setIsDeletingDemo(true);
    try {
      const snap = await getDocs(collection(db, 'products'));
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        const title = (data.title || '').toLowerCase();
        const isDemo =
          title.includes('iphone') ||
          title.includes('demo') ||
          title.includes('sample') ||
          !data.seller_id;

        if (isDemo) {
          try {
            if (data.imageUrl && data.imageUrl.includes('firebasestorage')) {
              const imgRef = ref(storage, data.imageUrl);
              await deleteObject(imgRef);
            }
          } catch (e) {
            console.log('Image delete skip:', e);
          }
          await deleteDoc(doc(db, 'products', d.id));
          count++;
        }
      }
      alert(`Deleted ${count} demo/test products successfully.`);
    } catch (err: any) {
      console.error('Error deleting demo products:', err);
      alert('Failed to delete demo products: ' + err.message);
    } finally {
      setIsDeletingDemo(false);
    }
  };

  useEffect(() => {
    if (!isAuthorizedAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Real-time Users listener
    const unsubUsers = onSnapshot(collection(db, 'users'), async (snap) => {
      if (snap.empty) {
        // Initialize default seed accounts if collection is empty
        for (const u of INITIAL_MUBS_USERS) {
          try {
            await setDoc(doc(db, 'users', u.id), u, { merge: true });
          } catch {
            // ignore
          }
        }
      }
      const uList: UserProfile[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UserProfile, 'id'>),
      }));
      setUsers(uList);
      setUsersCount(uList.length);
    });

    // 2. Real-time Products listener
    const unsubProducts = onSnapshot(collection(db, 'products'), (snap) => {
      const prods: Product[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, 'id'>),
      }));
      setProducts(prods);
    });

    // 3. Real-time Transactions listener from "transactions" collection
    // Order by pending first, then by date descending
    const unsubTx = onSnapshot(collection(db, 'transactions'), (snap) => {
      const txList: Transaction[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Transaction, 'id'>),
      }));

      txList.sort((a, b) => {
        // Pending first
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setTransactions(txList);
      setLoading(false);
    });

    // 4. Real-time Commissions listener from "commissions" collection
    const unsubCommissions = onSnapshot(collection(db, 'commissions'), (snap) => {
      const commList: CommissionRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CommissionRecord, 'id'>),
      }));

      commList.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        if (a.status === 'unpaid' && b.status !== 'unpaid') return -1;
        if (a.status !== 'unpaid' && b.status === 'unpaid') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setCommissions(commList);
    });

    return () => {
      unsubUsers();
      unsubProducts();
      unsubTx();
      unsubCommissions();
    };
  }, [isAuthorizedAdmin]);

  if (!isAuthorizedAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-red-200 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Access Denied</h2>
        <p className="text-xs text-gray-600 mb-6">
          This portal is restricted to MUBS Market administrators. Current account: <strong>{currentUser?.email || 'Guest'}</strong>.
        </p>
        <div className="flex flex-col gap-2">
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="w-full py-2.5 bg-[#006400] hover:bg-[#004d00] text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Sign In with Admin Email
            </button>
          )}
          <button
            onClick={onBackToMarket}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  // 4 Stats Cards
  const totalUsers = Math.max(usersCount, 1);
  const totalProducts = products.length;
  const pendingPayments = transactions.filter((t) => t.status === 'pending').length;
  const totalRevenue = transactions
    .filter((t) => t.status === 'approved')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Approve Logic
  // transaction.status = "approved"
  // if type == "boost" => products/{product_id}.is_boosted = true, boost_expires_at = now + 7 days
  // if type == "premium" => users/{user_id}.is_premium = true, premium_expires_at = now + 30 days
  const handleApprove = async (tx: Transaction) => {
    setActionLoading(tx.id);
    try {
      // 1. Update transaction
      await updateDoc(doc(db, 'transactions', tx.id), {
        status: 'approved',
      });

      // 2. If boost, update product
      if (tx.type === 'boost' && tx.product_id) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        try {
          await updateDoc(doc(db, 'products', tx.product_id), {
            is_boosted: true,
            boost_expires_at: expiresAt,
          });
        } catch (prodErr) {
          console.warn('Product doc update notice:', prodErr);
        }
      }

      // 3. If premium, update user
      if (tx.type === 'premium' && tx.user_id) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        try {
          await updateDoc(doc(db, 'users', tx.user_id), {
            is_premium: true,
            plan: 'premium',
            premium_expires_at: expiresAt,
          });
        } catch (userErr) {
          console.warn('User doc update notice:', userErr);
        }
      }
    } catch (err: any) {
      console.error('Failed to approve transaction:', err);
      alert('Failed to approve transaction: ' + (err.message || 'Error occurred'));
    } finally {
      setActionLoading(null);
    }
  };

  // Reject Logic
  const handleReject = async (tx: Transaction) => {
    if (!window.confirm(`Are you sure you want to reject transaction ${tx.user_transaction_id}?`)) return;
    setActionLoading(tx.id);
    try {
      await updateDoc(doc(db, 'transactions', tx.id), {
        status: 'rejected',
      });
    } catch (err: any) {
      console.error('Failed to reject transaction:', err);
      alert('Failed to reject transaction: ' + (err.message || 'Error occurred'));
    } finally {
      setActionLoading(null);
    }
  };

  // LOOPHOLE 8: Approve Commission
  // commission_status = paid, lift restrictions from seller
  const handleApproveCommission = async (rec: CommissionRecord) => {
    try {
      const nowIso = new Date().toISOString();
      // 1. Update commission record
      await updateDoc(doc(db, 'commissions', rec.id), {
        status: 'paid',
        approved_at: nowIso,
      });

      // 2. Update product commission status
      try {
        await updateDoc(doc(db, 'products', rec.product_id), {
          commission_status: 'paid',
          commission_paid_at: nowIso,
          is_hidden: false,
        });
      } catch (prodErr) {
        console.warn('Product update notice:', prodErr);
      }

      // 3. Lift restrictions from seller
      try {
        await updateDoc(doc(db, 'users', rec.seller_id), {
          is_restricted: false,
          restricted_reason: null,
        });
      } catch (userErr) {
        console.warn('User update notice:', userErr);
      }

      alert(`Commission of UGX ${rec.commission_amount.toLocaleString()} approved! Restrictions lifted from seller ${rec.seller_name}.`);
    } catch (err: any) {
      console.error('Failed to approve commission:', err);
      alert('Failed to approve commission: ' + (err.message || 'Error occurred'));
    }
  };

  // LOOPHOLE 8: Reject Commission
  // commission_status = unpaid, block seller immediately
  const handleRejectCommission = async (rec: CommissionRecord) => {
    try {
      // 1. Update commission record
      await updateDoc(doc(db, 'commissions', rec.id), {
        status: 'rejected',
      });

      // 2. Mark product commission as unpaid
      try {
        await updateDoc(doc(db, 'products', rec.product_id), {
          commission_status: 'unpaid',
        });
      } catch (prodErr) {
        console.warn('Product update notice:', prodErr);
      }

      // 3. Block seller immediately
      try {
        await updateDoc(doc(db, 'users', rec.seller_id), {
          is_restricted: true,
          restricted_reason: 'Fraudulent transaction ID or non-payment of 5% commission',
        });
      } catch (userErr) {
        console.warn('User restriction update notice:', userErr);
      }

      alert(`Commission rejected as fraudulent. Seller ${rec.seller_name} has been restricted immediately.`);
    } catch (err: any) {
      console.error('Failed to reject commission:', err);
      alert('Failed to reject commission: ' + (err.message || 'Error occurred'));
    }
  };

  // LOOPHOLE 8: Ban Seller
  const handleBanSeller = async (sellerId: string, sellerName: string) => {
    if (!window.confirm(`Are you sure you want to BAN ${sellerName}? Their account and all listings will be blocked from MUBS Market.`)) {
      return;
    }

    try {
      // 1. Update user
      await updateDoc(doc(db, 'users', sellerId), {
        is_banned: true,
        is_restricted: true,
        banned_reason: '5% commission evasion / fraud',
      });

      // 2. Hide all seller's products
      const sellerProds = products.filter((p) => p.seller_id === sellerId);
      for (const prod of sellerProds) {
        try {
          await updateDoc(doc(db, 'products', prod.id), {
            is_hidden: true,
            status: 'banned',
          });
        } catch (pe) {
          console.warn('Error hiding seller product:', pe);
        }
      }

      alert(`Seller ${sellerName} has been banned and their listings hidden.`);
    } catch (err: any) {
      console.error('Failed to ban seller:', err);
      alert('Failed to ban seller: ' + (err.message || 'Error occurred'));
    }
  };

  // Delete product logic
  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this listing from the market?')) return;
    try {
      const prod = products.find((p) => p.id === productId);
      if (prod?.imageUrl && prod.imageUrl.includes('firebasestorage')) {
        try {
          const imgRef = ref(storage, prod.imageUrl);
          await deleteObject(imgRef);
        } catch (e) {
          console.log('Image delete skip:', e);
        }
      }
      await deleteDoc(doc(db, 'products', productId));
      alert('Listing deleted permanently.');
    } catch (err: any) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product: ' + (err.message || 'Error occurred'));
    }
  };

  // Filtered products
  const filteredProducts = products.filter((p) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      p.title.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      p.seller_name.toLowerCase().includes(term) ||
      p.seller_email.toLowerCase().includes(term)
    );
  });

  if (!currentUser || !isAuthorizedAdmin) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-red-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Access Denied</h2>
        <p className="text-xs text-gray-600">
          Only Admin <strong>{SUPER_ADMIN}</strong> can access this dashboard. You are not admin.
        </p>
        <button
          onClick={onBackToMarket}
          className="px-6 py-2.5 bg-[#006400] hover:bg-[#004d00] text-white font-bold text-xs rounded-xl shadow cursor-pointer transition"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToMarket}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#006400] transition mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Marketplace
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold text-gray-900 font-sans">
              MUBS Market Admin Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-[#006400] border border-emerald-300 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#006400] animate-pulse"></span>
              Logged in as Admin: {SUPER_ADMIN}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Verified Super Administrator Session
          </p>
        </div>

        {/* Super Owner Action: Delete All Demo/Test Products */}
        {isSuperOwner && (
          <div className="flex items-center gap-2">
            <button
              id="delete-all-demo-products-btn"
              onClick={handleDeleteDemoProducts}
              disabled={isDeletingDemo}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 border border-red-500"
              title="Deletes products matching iPhone, Demo, Sample, or missing seller_id"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isDeletingDemo ? 'Deleting Demo Items...' : 'Delete All Demo/Test Products'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 
        CRITICAL INSTRUCTION BANNER REQUIRED BY PROMPT:
        "CHECK YOUR PHONE MTN 0764117040 and Airtel 0700924322 MoMo balance to confirm money before clicking Approve"
      */}
      <div className="p-4 bg-emerald-50 border-2 border-[#006400] rounded-2xl flex items-start gap-3 text-emerald-950 shadow-xs">
        <div className="p-2 rounded-xl bg-[#006400] text-white shrink-0 mt-0.5">
          <Phone className="w-5 h-5" />
        </div>
        <div className="text-xs">
          <span className="font-extrabold text-sm text-[#006400] block uppercase tracking-wide">
            Payment Verification Protocol
          </span>
          <p className="font-bold text-sm text-gray-900 mt-0.5">
            CHECK YOUR PHONE MTN <span className="font-mono text-[#006400] bg-emerald-100 px-1.5 py-0.5 rounded">0764117040</span> and Airtel <span className="font-mono text-red-700 bg-red-100 px-1.5 py-0.5 rounded">0700924322</span> MoMo balance to confirm money before clicking Approve.
          </p>
          <p className="text-gray-600 mt-1">
            Compare the User's MoMo TX ID with the SMS received on your phone.
          </p>
        </div>
      </div>

      {/* Top 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Users */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Total Users
            </span>
            <span className="text-2xl font-extrabold text-gray-900 font-sans">
              {totalUsers}
            </span>
          </div>
        </div>

        {/* Card 2: Total Products */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#006400] flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Total Products
            </span>
            <span className="text-2xl font-extrabold text-gray-900 font-sans">
              {totalProducts}
            </span>
          </div>
        </div>

        {/* Card 3: Pending Payments */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Pending Payments
            </span>
            <span className="text-2xl font-extrabold text-amber-600 font-sans">
              {pendingPayments}
            </span>
          </div>
        </div>

        {/* Card 4: Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
              Total Revenue
            </span>
            <span className="text-xl font-extrabold text-gray-900 font-mono">
              UGX {totalRevenue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-[#006400] text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>All Users - MUBS Students</span>
          <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
            activeTab === 'users' ? 'bg-emerald-800 text-white' : 'bg-gray-200 text-gray-800'
          }`}>
            {users.length}
          </span>
          {users.filter(u => u.verification_status === 'pending' && !u.isMubsVerified).length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-amber-950">
              {users.filter(u => u.verification_status === 'pending' && !u.isMubsVerified).length} pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('commissions')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'commissions'
              ? 'bg-[#006400] text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Commissions Verification (5%)</span>
          {commissions.filter((c) => c.status === 'pending').length > 0 && (
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-amber-950">
              {commissions.filter((c) => c.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'bg-[#006400] text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Boost & Subscriptions</span>
          {pendingPayments > 0 && (
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-amber-950">
              {pendingPayments}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'products'
              ? 'bg-[#006400] text-white shadow-xs'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>All Market Listings</span>
          <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-gray-200 text-gray-800">
            {products.length}
          </span>
        </button>
      </div>

      {/* TAB: ALL USERS - MUBS STUDENTS */}
      {activeTab === 'users' && (
        <AdminUsersView
          users={users}
          products={products}
          onViewSellerProfile={onViewSellerProfile}
        />
      )}

      {/* TAB 1: COMMISSIONS VERIFICATION (Loophole 8) */}
      {activeTab === 'commissions' && (
        <AdminCommissionsView
          commissions={commissions}
          onApproveCommission={handleApproveCommission}
          onRejectCommission={handleRejectCommission}
          onBanSeller={handleBanSeller}
        />
      )}

      {/* TAB 2: BOOST & SUBSCRIPTION TRANSACTIONS */}
      {activeTab === 'transactions' && (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <span>Mobile Money Verification Requests</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {transactions.length} total
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Pending payments appear first. Click Approve after checking SMS on 0764117040 or 0700924322.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-gray-800 uppercase tracking-wider font-bold border-b border-gray-200 text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">User Email</th>
                <th className="py-3.5 px-4">Product / Plan</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Sent To My Number</th>
                <th className="py-3.5 px-4">User's MoMo TX ID</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isPending = tx.status === 'pending';
                  const isApproved = tx.status === 'approved';
                  const isRejected = tx.status === 'rejected';
                  const isBusy = actionLoading === tx.id;

                  return (
                    <tr 
                      key={tx.id} 
                      className={`transition ${isPending ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-gray-50'}`}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-gray-500 font-sans">
                        {new Date(tx.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* User Email */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-gray-900">
                        {tx.user_email}
                      </td>

                      {/* Product/Plan */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 max-w-[200px] truncate">
                          {tx.product_title || (tx.type === 'boost' ? 'Product Boost' : 'Premium Shop')}
                        </div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          {tx.type === 'boost' ? '7-Day Top Placement' : '30-Day Unlimited'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-bold text-gray-900 font-mono">
                        UGX {tx.amount?.toLocaleString() || '5,000'}
                      </td>

                      {/* Sent To My Number (0764117040 or 0700924322) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-xs bg-emerald-50 text-[#006400] border border-emerald-200 px-2 py-0.5 rounded-md">
                          <Phone className="w-3 h-3" />
                          {tx.sent_to_number || '0764117040'}
                        </span>
                      </td>

                      {/* User's MoMo TX ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md text-xs">
                          {tx.user_transaction_id}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-[#006400] border border-emerald-300">
                            <CheckCircle className="w-3 h-3" />
                            Approved
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions: [Approve] [Reject] */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={isBusy}
                              onClick={() => handleApprove(tx)}
                              className="px-3 py-1.5 bg-[#006400] hover:bg-[#004d00] text-white font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => handleReject(tx)}
                              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg border border-red-200 transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-medium">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* TAB 3: ALL PRODUCTS WITH DELETE PRIVILEGE FOR ADMIN (Loophole 1) */}
      {activeTab === 'products' && (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <span>All Campus Marketplace Products</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {filteredProducts.length} items
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Live listings active on the student marketplace. Admins can remove any listing.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {isSuperOwner && (
              <button
                type="button"
                onClick={handleDeleteDemoProducts}
                disabled={isDeletingDemo}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 border border-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingDemo ? 'Deleting...' : 'Delete Demo Products'}</span>
              </button>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search listings or sellers..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] outline-hidden"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-gray-800 uppercase tracking-wider font-bold border-b border-gray-200 text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Item</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">Seller</th>
                <th className="py-3.5 px-4">Featured</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No products found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    {/* Item */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="w-9 h-9 rounded-lg object-cover border border-gray-200 shrink-0"
                        />
                        <span className="font-bold text-gray-900 max-w-[200px] truncate block">
                          {p.title}
                        </span>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-bold text-gray-900 font-mono">
                      UGX {p.price.toLocaleString()}
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold text-[11px]">
                        {p.category}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-gray-600">
                      {p.location}
                    </td>

                    {/* Seller */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="text-gray-900 font-medium">{p.seller_name}</div>
                      <div className="text-[10px] text-gray-400">{p.seller_email}</div>
                    </td>

                    {/* Featured / Boosted */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {p.is_boosted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          Boosted
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">Standard</span>
                      )}
                    </td>

                    {/* Delete button */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Delete listing (Admin Only)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

    </div>
  );
};
