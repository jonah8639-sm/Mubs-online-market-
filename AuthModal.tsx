import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles,
  ArrowRight,
  LogIn,
  Phone,
  GraduationCap,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, isUserAdmin } from '../lib/firebase';
import { UserProfile } from '../types';
import { 
  isOfficialMubsEmail, 
  isValidMubsRegNumber, 
  isValidUgandaPhone, 
  cleanUgandaPhone, 
  MUBS_COURSES, 
  MUBS_YEARS, 
  MUBS_CAMPUSES 
} from '../lib/mubsValidation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: UserProfile) => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialMode = 'signin'
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // MUBS-specific signup fields
  const [emailType, setEmailType] = useState<'official' | 'gmail'>('official');
  const [regNumber, setRegNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState(MUBS_COURSES[0]);
  const [year, setYear] = useState(MUBS_YEARS[1]); // Year 2 default
  const [campus, setCampus] = useState(MUBS_CAMPUSES[0]);

  // Status & Feedback
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSyncUserProfile = async (firebaseUser: any, customFields?: Partial<UserProfile>) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const existingSnap = await getDoc(userRef);

    const now = new Date();
    const trialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days free trial

    let profile: UserProfile;

    if (existingSnap.exists()) {
      const data = existingSnap.data();

      // Enforce banned account check on login
      if (data.is_banned) {
        await auth.signOut();
        throw new Error(
          'Account banned for fake MUBS details or unpaid commission to 0764117040. Contact admin jonah8639@gmail.com'
        );
      }

      profile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: data.displayName || firebaseUser.displayName || customFields?.displayName || 'MUBS Student',
        fullName: data.fullName || data.displayName || customFields?.fullName,
        photoURL: firebaseUser.photoURL || undefined,
        phone: data.phone || customFields?.phone,
        whatsapp: data.whatsapp || data.phone || customFields?.phone,
        regNumber: data.regNumber || customFields?.regNumber,
        course: data.course || customFields?.course,
        year: data.year || customFields?.year,
        campus: data.campus || customFields?.campus,
        isMubsVerified: data.isMubsVerified ?? (isOfficialMubsEmail(firebaseUser.email) || isUserAdmin(firebaseUser.email)),
        verification_status: data.verification_status || (isOfficialMubsEmail(firebaseUser.email) ? 'verified' : 'pending'),
        created_at: data.created_at || data.createdAt || now.toISOString(),
        createdAt: data.createdAt || data.created_at || now.toISOString(),
        lastLoginAt: now.toISOString(),
        trialEndsAt: data.trialEndsAt || trialEnds.toISOString(),
        plan: data.plan || 'trial',
        is_premium: data.is_premium || false,
        isVerified: true,
        isAdmin: firebaseUser.email?.toLowerCase().trim() === 'jonah8639@gmail.com',
        isOwner: firebaseUser.email?.toLowerCase().trim() === 'jonah8639@gmail.com',
        boostsRemaining: data.boostsRemaining || 0,
      };

      // Update lastLoginAt
      try {
        await updateDoc(userRef, { 
          lastLoginAt: now.toISOString(),
          // Strip any accidental admin flag from non-super admins
          ...(firebaseUser.email?.toLowerCase().trim() !== 'jonah8639@gmail.com' ? { isAdmin: false, isOwner: false } : { isAdmin: true, isOwner: true })
        });
      } catch {
        // non-blocking
      }
    } else {
      const isAuto = isOfficialMubsEmail(firebaseUser.email) || isUserAdmin(firebaseUser.email);
      const isSuperAdminEmail = firebaseUser.email?.toLowerCase().trim() === 'jonah8639@gmail.com';
      profile = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: customFields?.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'MUBS Student',
        fullName: customFields?.fullName || customFields?.displayName || firebaseUser.displayName || 'MUBS Student',
        photoURL: firebaseUser.photoURL || undefined,
        phone: customFields?.phone || '',
        whatsapp: customFields?.phone || '',
        regNumber: customFields?.regNumber || '',
        course: customFields?.course || 'Undergraduate',
        year: customFields?.year || 'Year 2',
        campus: customFields?.campus || 'MUBS Main Campus - Nakawa',
        isMubsVerified: isAuto,
        verification_status: isAuto ? 'verified' : 'pending',
        isAdmin: isSuperAdminEmail,
        isOwner: isSuperAdminEmail,
        is_banned: false,
        created_at: now.toISOString(),
        createdAt: now.toISOString(),
        lastLoginAt: now.toISOString(),
        trialEndsAt: trialEnds.toISOString(),
        plan: 'trial',
        is_premium: false,
        isVerified: true,
        boostsRemaining: 0,
        seller_rating: 0,
        total_sales: 0,
        unpaid_commission: 0,
        total_products: 0,
      };

      try {
        await setDoc(userRef, profile);
      } catch (err) {
        console.warn('Could not save user profile to Firestore:', err);
      }
    }

    return profile;
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setPendingNotice(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      
      const userProfile = await handleSyncUserProfile(cred.user);

      if (onSuccess) {
        onSuccess(userProfile);
      }
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setError('Google sign-in was cancelled.');
      } else {
        console.warn('Google Sign In notice:', err?.message || err);
        setError(err?.message || 'Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPendingNotice(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        // 1. Validate Full Name (min 3 letters)
        const cleanName = displayName.trim();
        if (cleanName.length < 3) {
          throw new Error('Please enter your full official name (minimum 3 letters).');
        }

        // 2. Validate Email
        const cleanEmail = email.trim().toLowerCase();
        if (emailType === 'official') {
          if (!isOfficialMubsEmail(cleanEmail) && !isUserAdmin(cleanEmail)) {
            throw new Error('Please enter an official MUBS email ending with @mubs.ac.ug or @stud.mubs.ac.ug, or select "Using Gmail/Other" below.');
          }
        } else {
          if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            throw new Error('Please enter a valid email address.');
          }
        }

        // 3. Validate MUBS Registration Number (REQUIRED)
        const cleanReg = regNumber.trim().toUpperCase();
        if (!isValidMubsRegNumber(cleanReg)) {
          throw new Error('Enter valid MUBS Reg No: 22/U/12345/PS');
        }

        // 4. Validate Phone Number (REQUIRED - 10 digits starting with 07)
        const cleanPhone = cleanUgandaPhone(phone);
        if (!isValidUgandaPhone(cleanPhone)) {
          throw new Error('Enter a valid 10-digit Uganda phone starting with 07 (e.g. 0764117040)');
        }

        // 5. Validate Password
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }

        // 6. Check Phone Number Uniqueness in Firestore users collection
        try {
          const phoneQuery = query(collection(db, 'users'), where('phone', '==', cleanPhone));
          const phoneSnap = await getDocs(phoneQuery);
          if (!phoneSnap.empty) {
            throw new Error(`This phone number ${cleanPhone} is already registered. One account per student. If you forgot password, sign in or reset.`);
          }
        } catch (phoneErr: any) {
          if (phoneErr?.message?.includes('already registered')) throw phoneErr;
        }

        // 7. Check Reg Number Uniqueness in Firestore users collection
        try {
          const regQuery = query(collection(db, 'users'), where('regNumber', '==', cleanReg));
          const regSnap = await getDocs(regQuery);
          if (!regSnap.empty) {
            throw new Error(`This MUBS Registration Number ${cleanReg} is already registered. One account per student.`);
          }
        } catch (regErr: any) {
          if (regErr?.message?.includes('already registered')) throw regErr;
        }

        // Determine MUBS auto-verification
        const isAutoMubs = isOfficialMubsEmail(cleanEmail) || isUserAdmin(cleanEmail);

        // Create user in Firebase Auth
        let authedUser: any = null;
        try {
          const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          await updateProfile(cred.user, { displayName: cleanName });
          authedUser = cred.user;
        } catch (authErr: any) {
          if (authErr?.code === 'auth/operation-not-allowed') {
            // Graceful fallback for demo/mock environment without email/password enabled in cloud
            const studentId = 'mubs_user_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
            const studentProfile: UserProfile = {
              id: studentId,
              uid: studentId,
              email: cleanEmail,
              displayName: cleanName,
              fullName: cleanName,
              regNumber: cleanReg,
              phone: cleanPhone,
              whatsapp: cleanPhone,
              course,
              year,
              campus,
              isMubsVerified: isAutoMubs,
              verification_status: isAutoMubs ? 'verified' : 'pending',
              is_banned: false,
              created_at: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
              trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              plan: 'trial',
              seller_rating: 0,
              total_sales: 0,
              unpaid_commission: 0,
              total_products: 0,
            };

            await setDoc(doc(db, 'users', studentId), studentProfile, { merge: true });
            localStorage.setItem('mubs_demo_user', JSON.stringify(studentProfile));

            if (!isAutoMubs) {
              setPendingNotice(
                'Your account pending verification by Admin jonah8639@gmail.com - You can browse but cannot post until verified.'
              );
              setLoading(false);
              setTimeout(() => {
                if (onSuccess) onSuccess(studentProfile);
                onClose();
              }, 4000);
              return;
            }

            if (onSuccess) onSuccess(studentProfile);
            onClose();
            return;
          }
          throw authErr;
        }

        if (authedUser) {
          const profile = await handleSyncUserProfile(authedUser, {
            displayName: cleanName,
            fullName: cleanName,
            phone: cleanPhone,
            regNumber: cleanReg,
            course,
            year,
            campus,
          });

          if (!isAutoMubs) {
            setPendingNotice(
              'Your account pending verification by Admin jonah8639@gmail.com - You can browse but cannot post until verified.'
            );
            setLoading(false);
            setTimeout(() => {
              if (onSuccess) onSuccess(profile);
              onClose();
            }, 3500);
            return;
          }

          if (onSuccess) onSuccess(profile);
          onClose();
        }
      } else {
        // Sign In Flow
        const cleanEmail = email.trim().toLowerCase();
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        
        // Load user document and verify not banned
        const userProfile = await handleSyncUserProfile(cred.user);

        if (onSuccess) {
          onSuccess(userProfile);
        }
        onClose();
      }
    } catch (err: any) {
      console.warn('Auth notice:', err?.message || err);
      let msg = err?.message || 'Authentication failed.';
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password. Please verify your credentials or create a new student account.';
      } else if (err?.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please switch to Sign In.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts for instant testing
  const handleQuickDemoLogin = async (demoRole: 'student' | 'admin') => {
    setError(null);
    setLoading(true);
    try {
      const demoEmail = demoRole === 'admin' ? 'jonah8639@gmail.com' : 'j.mukasa@student.mubs.ac.ug';
      const demoPass = 'mubsPass123!';
      const demoName = demoRole === 'admin' ? 'Jonah Ssemanda (Admin & Owner)' : 'Joel Mukasa';
      const demoId = demoRole === 'admin' ? 'admin_jonah_mubs' : 'student_joel_mukasa';

      let authedUser: any = null;
      try {
        const cred = await signInWithEmailAndPassword(auth, demoEmail, demoPass);
        authedUser = cred.user;
      } catch (signInErr: any) {
        if (signInErr.code !== 'auth/operation-not-allowed') {
          try {
            const cred = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
            await updateProfile(cred.user, { displayName: demoName });
            authedUser = cred.user;
          } catch {
            // creation fallback handled below
          }
        }
      }

      if (authedUser) {
        const profile = await handleSyncUserProfile(authedUser, {
          displayName: demoName,
          fullName: demoName,
          phone: demoRole === 'admin' ? '0764117040' : '0701893452',
          regNumber: demoRole === 'admin' ? '21/U/10001/PS' : '22/U/14290/PS',
        });
        if (onSuccess) onSuccess(profile);
        onClose();
      } else {
        const now = new Date();
        const demoProfile: UserProfile = {
          id: demoId,
          uid: demoId,
          email: demoEmail,
          displayName: demoName,
          fullName: demoName,
          phone: demoRole === 'admin' ? '0764117040' : '0701893452',
          whatsapp: demoRole === 'admin' ? '0764117040' : '0701893452',
          regNumber: demoRole === 'admin' ? '21/U/10001/PS' : '22/U/14290/PS',
          course: demoRole === 'admin' ? 'BCOM - Bachelor of Commerce' : 'BBA - Bachelor of Business Administration',
          year: 'Year 2',
          campus: 'MUBS Main Campus - Nakawa',
          createdAt: now.toISOString(),
          trialEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          plan: demoRole === 'admin' ? 'premium' : 'trial',
          is_premium: demoRole === 'admin',
          isMubsVerified: true,
          verification_status: 'verified',
          is_banned: false,
          boostsRemaining: demoRole === 'admin' ? 5 : 0,
        };

        try {
          await setDoc(doc(db, 'users', demoId), demoProfile, { merge: true });
        } catch (dbErr) {
          console.warn('Demo profile Firestore sync fallback:', dbErr);
        }

        localStorage.setItem('mubs_demo_user', JSON.stringify(demoProfile));
        if (onSuccess) onSuccess(demoProfile);
        onClose();
      }
    } catch (err: any) {
      console.warn('Quick login error:', err);
      setError(err?.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full my-auto overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#006400] to-emerald-800 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 bg-emerald-800/80 text-emerald-200 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              MUBS Verified Community Only
            </span>
          </div>
          <h2 className="text-xl font-bold font-serif">
            {mode === 'signin' ? 'Sign In to MUBS Market' : 'Create Verified MUBS Account'}
          </h2>
          <p className="text-xs text-emerald-100 mt-0.5">
            {mode === 'signin'
              ? 'Enter your registered credentials to manage listings'
              : 'Strictly for MUBS students & staff. Fake accounts are blocked.'}
          </p>
        </div>

        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Pending Verification Notice */}
          {pendingNotice && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 text-xs animate-in fade-in">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block text-sm">Account Created - Pending Verification</span>
                <p className="mt-1 font-medium leading-relaxed">{pendingNotice}</p>
                <p className="text-[11px] text-amber-700 mt-2">
                  Admin will review your registration number format. You can start browsing immediately!
                </p>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span className="font-medium leading-snug">{error}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            id="google-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold shadow-xs transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-gray-200 w-full"></div>
            <span className="bg-white px-2 text-[11px] text-gray-400 font-medium uppercase tracking-wider">
              {mode === 'signup' ? 'Student Registration Form' : 'Or with Email'}
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === 'signup' && (
              <>
                {/* 1. Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span> (min 3 letters)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="auth-fullname"
                      type="text"
                      required
                      placeholder="e.g. Brenda Akello"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition"
                    />
                  </div>
                </div>

                {/* 2. MUBS Student Verification Type selector */}
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 space-y-2">
                  <label className="block text-xs font-bold text-[#006400]">
                    Are you a MUBS Student? <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEmailType('official')}
                      className={`p-2 rounded-lg border font-semibold text-left transition cursor-pointer flex flex-col ${
                        emailType === 'official'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1">
                        <span>Yes, MUBS Email</span>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[10px] opacity-85">@mubs.ac.ug (Auto-Verify)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEmailType('gmail')}
                      className={`p-2 rounded-lg border font-semibold text-left transition cursor-pointer flex flex-col ${
                        emailType === 'gmail'
                          ? 'bg-[#006400] text-white border-[#006400] shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1">
                        <span>Using Gmail/Other</span>
                        <Clock className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[10px] opacity-85">Reg No Review Required</span>
                    </button>
                  </div>
                </div>

                {/* 3. MUBS Registration Number */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    MUBS Registration Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="auth-regnumber"
                      type="text"
                      required
                      placeholder="e.g. 22/U/12345/PS"
                      value={regNumber}
                      onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition uppercase"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Format must match: 22/U/12345/PS or 21/U/5678/EVE
                  </p>
                </div>

                {/* 4. Phone Number (WhatsApp) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Phone Number (WhatsApp) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      id="auth-phone"
                      type="tel"
                      required
                      placeholder="0764117040"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    10 digits starting with 07. Strictly tracked to prevent defaulters.
                  </p>
                </div>

                {/* 5. Course & Academic Year */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Course</label>
                    <select
                      id="auth-course"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] outline-hidden bg-white"
                    >
                      {MUBS_COURSES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Year of Study</label>
                    <select
                      id="auth-year"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] outline-hidden bg-white"
                    >
                      {MUBS_YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 6. Campus */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Campus</label>
                  <select
                    id="auth-campus"
                    value={campus}
                    onChange={(e) => setCampus(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] outline-hidden bg-white"
                  >
                    {MUBS_CAMPUSES.map((camp) => (
                      <option key={camp} value={camp}>{camp}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {mode === 'signup' && emailType === 'official'
                  ? 'MUBS Student Email (@mubs.ac.ug or @stud.mubs.ac.ug)'
                  : 'Email Address'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder={
                    mode === 'signup' && emailType === 'official'
                      ? 's.mukasa@student.mubs.ac.ug'
                      : 'e.g. yourname@gmail.com'
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Password <span className="text-red-500">*</span> (min 6 chars)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#006400] focus:border-[#006400] outline-hidden transition"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-[#006400] to-emerald-700 hover:from-emerald-800 hover:to-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Account & Verify MUBS</span>
                </>
              )}
            </button>
          </form>

          {/* Switch Mode */}
          <div className="text-center text-xs text-gray-600 pt-1">
            {mode === 'signin' ? (
              <p>
                First time on MUBS Market?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setPendingNotice(null); }}
                  className="text-[#006400] font-bold hover:underline cursor-pointer"
                >
                  Create Verified Account
                </button>
              </p>
            ) : (
              <p>
                Already registered with MUBS?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); setPendingNotice(null); }}
                  className="text-[#006400] font-bold hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>

          {/* Quick Demo Test Logins */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 font-medium mb-2 text-center">
              Quick One-Click Test Accounts:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('student')}
                disabled={loading}
                className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium rounded-lg border border-emerald-200 transition text-center cursor-pointer"
              >
                🎓 Student Test Login
              </button>
              <button
                type="button"
                id="quick-login-super-owner-btn"
                onClick={() => handleQuickDemoLogin('admin')}
                disabled={loading}
                className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold rounded-lg border border-purple-300 transition text-center cursor-pointer"
              >
                👑 Owner (jonah8639)
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
