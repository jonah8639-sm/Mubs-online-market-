import React, { useState, useMemo } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Clock, 
  UserX, 
  Calendar, 
  Search, 
  CheckCircle2, 
  Ban, 
  Trash2, 
  Eye, 
  Sparkles, 
  Phone, 
  Mail, 
  GraduationCap, 
  AlertTriangle,
  Building2,
  ExternalLink,
  X
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Product } from '../types';
import { isOfficialMubsEmail, cleanUgandaPhone } from '../lib/mubsValidation';

const SUPER_ADMIN = 'jonah8639@gmail.com';

interface AdminUsersViewProps {
  users: UserProfile[];
  products: Product[];
  onUserUpdated?: () => void;
  onViewSellerProfile?: (userId: string) => void;
}

export const AdminUsersView: React.FC<AdminUsersViewProps> = ({
  users,
  products,
  onUserUpdated,
  onViewSellerProfile
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'banned'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoVerifySuccessMsg, setAutoVerifySuccessMsg] = useState<string | null>(null);

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Top Summary Cards metrics
  const totalUsers = users.length;
  const verifiedCount = users.filter((u) => u.isMubsVerified || u.verification_status === 'verified').length;
  const pendingCount = users.filter((u) => !u.is_banned && (!u.isMubsVerified || u.verification_status === 'pending')).length;
  const bannedCount = users.filter((u) => u.is_banned).length;
  const joinedTodayCount = users.filter((u) => {
    const d = u.created_at || u.createdAt;
    return d && d.startsWith(todayStr);
  }).length;

  // Requirement 3: Check if other users have admin flags
  const unauthorizedAdmins = useMemo(() => {
    return users.filter((u) => {
      const email = u.email?.toLowerCase().trim();
      return email !== SUPER_ADMIN && (u.isAdmin === true || (u as any).isOwner === true);
    });
  }, [users]);

  // Handler: Run cleanup to set all users isAdmin=false except jonah8639@gmail.com
  const handleCleanupAdminFlags = async () => {
    setActionLoading('cleanup-admins');
    try {
      let count = 0;
      const snap = await getDocs(collection(db, 'users'));
      for (const d of snap.docs) {
        const data = d.data();
        const email = data.email?.toLowerCase().trim();
        if (email === SUPER_ADMIN) {
          if (data.isAdmin !== true || data.isOwner !== true) {
            await updateDoc(doc(db, 'users', d.id), { isAdmin: true, isOwner: true });
          }
        } else {
          if (data.isAdmin === true || data.isOwner === true) {
            await updateDoc(doc(db, 'users', d.id), { isAdmin: false, isOwner: false });
            count++;
          }
        }
      }
      alert(`Cleanup Complete: Set isAdmin=false on ${count} unauthorized accounts. Only ${SUPER_ADMIN} is Admin.`);
      onUserUpdated?.();
    } catch (err: any) {
      console.error('Error in admin flag cleanup:', err);
      alert('Cleanup failed: ' + (err?.message || err));
    } finally {
      setActionLoading(null);
    }
  };

  // Search & Filter
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      // Status filter
      if (statusFilter === 'verified' && !(user.isMubsVerified || user.verification_status === 'verified')) return false;
      if (statusFilter === 'pending' && (user.is_banned || user.isMubsVerified || user.verification_status !== 'pending')) return false;
      if (statusFilter === 'banned' && !user.is_banned) return false;

      // Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      const emailMatch = user.email?.toLowerCase().includes(q);
      const nameMatch = (user.fullName || user.displayName || '').toLowerCase().includes(q);
      const regMatch = (user.regNumber || '').toLowerCase().includes(q);
      const phoneMatch = (user.phone || user.whatsapp || '').includes(q);
      const courseMatch = (user.course || '').toLowerCase().includes(q);

      return emailMatch || nameMatch || regMatch || phoneMatch || courseMatch;
    });
  }, [users, statusFilter, searchTerm]);

  // Handler: Manual Verify User
  const handleVerifyUser = async (user: UserProfile) => {
    setActionLoading(`verify-${user.id}`);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        isMubsVerified: true,
        verification_status: 'verified',
        is_banned: false,
      });
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, isMubsVerified: true, verification_status: 'verified', is_banned: false });
      }
      onUserUpdated?.();
    } catch (err) {
      console.error('Error verifying user:', err);
      alert('Could not update user verification status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Ban or Unban User
  const handleToggleBan = async (user: UserProfile) => {
    const isBanning = !user.is_banned;
    if (isBanning) {
      const confirmBan = window.confirm(
        `Are you sure you want to BAN ${user.fullName || user.displayName} (${user.email})?\nThey will not be able to log in or post items.`
      );
      if (!confirmBan) return;
    }

    setActionLoading(`ban-${user.id}`);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        is_banned: isBanning,
        banned_reason: isBanning ? 'Banned by Admin (fake registration details or unpaid commission)' : '',
        ...(isBanning ? { isMubsVerified: false, verification_status: 'rejected' } : {})
      });
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, is_banned: isBanning, isMubsVerified: !isBanning });
      }
      onUserUpdated?.();
    } catch (err) {
      console.error('Error toggling ban status:', err);
      alert('Failed to update ban status. Check connection.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Delete Account
  const handleDeleteUser = async (user: UserProfile) => {
    const confirmDelete = window.confirm(
      `⚠️ PERMANENT DELETE: Are you sure you want to completely delete ${user.fullName || user.displayName} (${user.email}) from Firestore?\nThis cannot be undone.`
    );
    if (!confirmDelete) return;

    setActionLoading(`delete-${user.id}`);
    try {
      await deleteDoc(doc(db, 'users', user.id));
      if (selectedUser?.id === user.id) {
        setSelectedUser(null);
      }
      onUserUpdated?.();
    } catch (err) {
      console.error('Error deleting user account:', err);
      alert('Failed to delete account document.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handler: Verify All MUBS Emails Automatically
  const handleVerifyAllMubsEmails = async () => {
    const mubsEligible = users.filter((u) => isOfficialMubsEmail(u.email) && !u.isMubsVerified);
    if (mubsEligible.length === 0) {
      alert('All accounts with official @mubs.ac.ug or @stud.mubs.ac.ug domains are already verified!');
      return;
    }

    setActionLoading('bulk-verify');
    let count = 0;
    try {
      for (const u of mubsEligible) {
        await updateDoc(doc(db, 'users', u.id), {
          isMubsVerified: true,
          verification_status: 'verified',
          is_banned: false,
        });
        count++;
      }
      setAutoVerifySuccessMsg(`Successfully verified ${count} MUBS student account(s) with official emails!`);
      setTimeout(() => setAutoVerifySuccessMsg(null), 5000);
      onUserUpdated?.();
    } catch (err) {
      console.error('Bulk verification error:', err);
      alert(`Verified ${count} accounts before an error occurred.`);
    } finally {
      setActionLoading(null);
    }
  };

  // Helper to compute user's products and unpaid commissions
  const getUserStats = (user: UserProfile) => {
    const userProds = products.filter(
      (p) => p.seller_id === user.id || (user.email && p.seller_email?.toLowerCase() === user.email.toLowerCase())
    );
    const unpaidProds = userProds.filter((p) => p.status === 'sold' && p.commission_status === 'unpaid');
    const unpaidAmount = unpaidProds.reduce((sum, p) => sum + (p.commission_amount || (p.sold_price ? p.sold_price * 0.05 : 0)), 0);

    return {
      productCount: userProds.length,
      unpaidCount: unpaidProds.length,
      unpaidAmount: user.unpaid_commission || unpaidAmount,
    };
  };

  return (
    <div className="space-y-6">
      {/* Auto-verify success notification */}
      {autoVerifySuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{autoVerifySuccessMsg}</span>
          </div>
          <button onClick={() => setAutoVerifySuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECURITY WARNING BANNER (Prompt requirement 3) */}
      {unauthorizedAdmins.length > 0 && (
        <div className="p-4 bg-red-50 border-2 border-red-500 text-red-900 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-600 text-white shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-sm uppercase tracking-wide text-red-900">
                SECURITY WARNING: {unauthorizedAdmins.length} user{unauthorizedAdmins.length > 1 ? 's have' : ' has'} admin flag - Remove them
              </h4>
              <p className="text-xs text-red-700 mt-0.5">
                Only <strong>{SUPER_ADMIN}</strong> is authorized as Admin. Unauthorized accounts: {unauthorizedAdmins.map(u => u.email).join(', ')}
              </p>
            </div>
          </div>
          <button
            id="cleanup-unauthorized-admins-btn"
            onClick={handleCleanupAdminFlags}
            disabled={actionLoading === 'cleanup-admins'}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer whitespace-nowrap disabled:opacity-50 border border-red-500"
          >
            {actionLoading === 'cleanup-admins' ? 'Cleaning Up...' : 'Run Cleanup: Set isAdmin=false'}
          </button>
        </div>
      )}

      {/* Top 5 Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Users */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Total Users
            </span>
            <span className="text-xl font-extrabold text-gray-900 font-sans">
              {totalUsers}
            </span>
          </div>
        </div>

        {/* Card 2: Verified MUBS Students */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Verified MUBS
            </span>
            <span className="text-xl font-extrabold text-emerald-600 font-sans">
              {verifiedCount}
            </span>
          </div>
        </div>

        {/* Card 3: Pending Verification */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Pending Review
            </span>
            <span className="text-xl font-extrabold text-amber-600 font-sans">
              {pendingCount}
            </span>
          </div>
        </div>

        {/* Card 4: Banned Fake Accounts */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Banned Accounts
            </span>
            <span className="text-xl font-extrabold text-red-600 font-sans">
              {bannedCount}
            </span>
          </div>
        </div>

        {/* Card 5: Joined Today */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
              Joined Today
            </span>
            <span className="text-xl font-extrabold text-purple-600 font-sans">
              {joinedTodayCount}
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar: Search, Filters & Bulk Verify Button */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            id="admin-search-users"
            type="text"
            placeholder="Search by Email, Reg No (22/U/...), Phone (07xx), Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({totalUsers})
          </button>
          <button
            onClick={() => setStatusFilter('verified')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'verified'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Verified ({verifiedCount})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('banned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              statusFilter === 'banned'
                ? 'bg-red-700 text-white'
                : 'bg-red-50 text-red-800 hover:bg-red-100'
            }`}
          >
            Banned ({bannedCount})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Reset Other Admins Cleanup Button */}
          <button
            id="admin-cleanup-flags-btn"
            onClick={handleCleanupAdminFlags}
            disabled={actionLoading === 'cleanup-admins'}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            title="Reset any other users who have admin flags"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{actionLoading === 'cleanup-admins' ? 'Cleaning...' : 'Reset Other Admins'}</span>
          </button>

          {/* Bulk Action: Verify All MUBS Emails Automatically */}
          <button
            id="admin-verify-all-mubs-btn"
            onClick={handleVerifyAllMubsEmails}
            disabled={actionLoading === 'bulk-verify'}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-[#006400] to-emerald-700 hover:from-emerald-800 hover:to-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Verify All MUBS Emails Automatically</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <span>Registered MUBS Accounts</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              Showing {filteredUsers.length} of {totalUsers}
            </span>
          </h3>
          <span className="text-[11px] text-gray-500">
            Real-time Firestore Users Collection
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Date Joined</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-center">Is Admin?</th>
                <th className="py-3 px-4">MUBS Reg Number</th>
                <th className="py-3 px-4">Phone WhatsApp</th>
                <th className="py-3 px-4">Campus & Course</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Listings</th>
                <th className="py-3 px-4 text-right">Unpaid Comm.</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-medium text-sm text-gray-600">No users found</p>
                    <p className="text-xs text-gray-400 mt-0.5">Try searching with a different term or clear filters.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const stats = getUserStats(user);
                  const isVerified = user.isMubsVerified || user.verification_status === 'verified';
                  const isBanned = user.is_banned;
                  const dateStr = user.created_at || user.createdAt;
                  const formattedDate = dateStr 
                    ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'N/A';

                  const cleanPhone = cleanUgandaPhone(user.phone || user.whatsapp || '');

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-gray-50/80 transition-colors ${
                        isBanned ? 'bg-red-50/40' : !isVerified ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      {/* Date Joined */}
                      <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                        {formattedDate}
                      </td>

                      {/* Full Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-[#006400] flex items-center justify-center font-bold text-xs shrink-0">
                            {(user.fullName || user.displayName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-1">
                              <span>{user.fullName || user.displayName || 'Student'}</span>
                              {isVerified && (
                                <CheckCircle2 className="w-3.5 h-3.5 fill-blue-500 text-white shrink-0" title="Verified MUBS Student" />
                              )}
                            </div>
                            {user.plan === 'premium' && (
                              <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1 py-0.2 rounded">
                                Premium
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-gray-700 text-[11px]">
                          {user.email}
                        </span>
                        {isOfficialMubsEmail(user.email) && (
                          <span className="block text-[9px] text-emerald-700 font-semibold">
                            Official Domain
                          </span>
                        )}
                      </td>

                      {/* Is Admin? Column (Prompt Requirement 3) */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {user.email?.toLowerCase().trim() === SUPER_ADMIN ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-[#006400] border border-emerald-300">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#006400]" />
                            YES
                          </span>
                        ) : (user.isAdmin || (user as any).isOwner) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-300 animate-pulse" title="Unauthorized admin flag!">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            FLAGGED (NO)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500">
                            NO
                          </span>
                        )}
                      </td>

                      {/* MUBS Reg Number */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {user.regNumber ? (
                          <span className="font-mono font-bold text-xs bg-gray-100 text-gray-900 px-2 py-0.5 rounded-md border border-gray-200">
                            {user.regNumber}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">Not provided</span>
                        )}
                      </td>

                      {/* Phone WhatsApp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {cleanPhone ? (
                          <a
                            href={`https://wa.me/256${cleanPhone.replace(/^0/, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 font-mono font-bold hover:underline"
                            title="Chat on WhatsApp"
                          >
                            <Phone className="w-3 h-3 text-emerald-600" />
                            <span>{cleanPhone}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Campus & Course */}
                      <td className="py-3 px-4">
                        <div className="text-gray-900 font-medium text-[11px] truncate max-w-[140px]" title={user.campus || 'MUBS Main'}>
                          {user.campus || 'MUBS Main Nakawa'}
                        </div>
                        <div className="text-gray-500 text-[10px] truncate max-w-[140px]" title={`${user.course || 'Undergraduate'} ${user.year ? `(${user.year})` : ''}`}>
                          {user.course || 'Undergraduate'} {user.year ? `• ${user.year}` : ''}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                            <UserX className="w-3 h-3" />
                            Banned
                          </span>
                        ) : isVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Total Products */}
                      <td className="py-3 px-4 text-center font-bold text-gray-800">
                        {stats.productCount}
                      </td>

                      {/* Unpaid Commission */}
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                        {stats.unpaidAmount > 0 ? (
                          <span className="text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">
                            UGX {stats.unpaidAmount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">UGX 0</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            title="View Account Details"
                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Verify button */}
                          {!isVerified && (
                            <button
                              type="button"
                              onClick={() => handleVerifyUser(user)}
                              disabled={actionLoading === `verify-${user.id}`}
                              title="Approve & Verify MUBS Student"
                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verify</span>
                            </button>
                          )}

                          {/* Ban / Unban */}
                          <button
                            type="button"
                            onClick={() => handleToggleBan(user)}
                            disabled={actionLoading === `ban-${user.id}`}
                            title={isBanned ? 'Unban Account' : 'Ban Fake Account'}
                            className={`px-2 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                              isBanned
                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                            }`}
                          >
                            <Ban className="w-3 h-3" />
                            <span>{isBanned ? 'Unban' : 'Ban'}</span>
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={actionLoading === `delete-${user.id}`}
                            title="Delete Account from Firestore"
                            className="p-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#006400] to-emerald-800 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-white font-black text-base">
                  {(selectedUser.fullName || selectedUser.displayName || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-1.5">
                    <span>{selectedUser.fullName || selectedUser.displayName || 'Student Details'}</span>
                    {selectedUser.isMubsVerified && (
                      <CheckCircle2 className="w-4 h-4 fill-blue-500 text-white" />
                    )}
                  </h3>
                  <p className="text-xs text-emerald-200 font-mono">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Status Alert if Banned */}
              {selectedUser.is_banned && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <span className="font-bold block">Account Currently Banned</span>
                    <span className="text-[11px]">{selectedUser.banned_reason || 'Banned for fake credentials or unpaid commission.'}</span>
                  </div>
                </div>
              )}

              {/* Student Details Grid */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">MUBS Reg Number</span>
                  <span className="font-mono font-bold text-sm text-gray-900 block mt-0.5">
                    {selectedUser.regNumber || 'Not provided'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Phone / WhatsApp</span>
                  <span className="font-mono font-bold text-sm text-[#006400] block mt-0.5">
                    {selectedUser.phone || selectedUser.whatsapp || 'Not provided'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Campus</span>
                  <span className="font-medium text-gray-800 block mt-0.5">
                    {selectedUser.campus || 'MUBS Main Campus (Nakawa)'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Course & Year</span>
                  <span className="font-medium text-gray-800 block mt-0.5">
                    {selectedUser.course || 'Undergraduate'} {selectedUser.year ? `(${selectedUser.year})` : ''}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Verification Status</span>
                  <span className="font-bold block mt-0.5">
                    {selectedUser.isMubsVerified ? (
                      <span className="text-emerald-700">Verified MUBS Student</span>
                    ) : selectedUser.verification_status === 'pending' ? (
                      <span className="text-amber-700">Pending Admin Review</span>
                    ) : (
                      <span className="text-gray-600">Unverified</span>
                    )}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Joined Date</span>
                  <span className="font-medium text-gray-800 block mt-0.5">
                    {selectedUser.created_at || selectedUser.createdAt
                      ? new Date(selectedUser.created_at || selectedUser.createdAt!).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>

                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Admin Privilege Status</span>
                  <div className="mt-1 flex items-center justify-between">
                    {selectedUser.email?.toLowerCase().trim() === SUPER_ADMIN ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-[#006400] border border-emerald-300">
                        <ShieldCheck className="w-4 h-4 text-[#006400]" />
                        YES (Sole Authorized Super Admin)
                      </span>
                    ) : (selectedUser.isAdmin || (selectedUser as any).isOwner) ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-300 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          FLAGGED (Unauthorized Admin Flag)
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await updateDoc(doc(db, 'users', selectedUser.id), { isAdmin: false, isOwner: false });
                              setSelectedUser({ ...selectedUser, isAdmin: false, isOwner: false });
                              onUserUpdated?.();
                            } catch (e: any) {
                              alert('Failed to revoke admin: ' + e.message);
                            }
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-lg cursor-pointer"
                        >
                          Revoke Admin Flag
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                        NO (Standard User Account)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  {!selectedUser.isMubsVerified ? (
                    <button
                      onClick={() => handleVerifyUser(selectedUser)}
                      className="py-2.5 px-3 bg-[#006400] hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify Student</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleBan(selectedUser)}
                      className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Mark as Unverified</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleToggleBan(selectedUser)}
                    className={`py-2.5 px-3 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedUser.is_banned
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    <Ban className="w-4 h-4" />
                    <span>{selectedUser.is_banned ? 'Unban Account' : 'Ban Fake Account'}</span>
                  </button>
                </div>

                {onViewSellerProfile && (
                  <button
                    onClick={() => {
                      const uid = selectedUser.id;
                      setSelectedUser(null);
                      onViewSellerProfile(uid);
                    }}
                    className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-200"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Public Seller Profile & Listings</span>
                  </button>
                )}

                <button
                  onClick={() => handleDeleteUser(selectedUser)}
                  className="w-full py-2 text-red-600 hover:text-red-700 font-semibold text-xs transition text-center cursor-pointer"
                >
                  Delete Account Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
