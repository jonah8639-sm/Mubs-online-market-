import React, { useState, useEffect } from 'react';
import { 
  Key, 
  ShieldCheck, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Lock, 
  Server,
  Radio
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MoMoConfig, UserProfile } from '../types';
import { ESCROW_MTN_NUMBER, ESCROW_AIRTEL_NUMBER } from '../lib/momoAutoSplit';

const SUPER_ADMIN = 'jonah8639@gmail.com';

interface MoMoSettingsViewProps {
  currentUser: UserProfile | null;
}

export const MoMoSettingsView: React.FC<MoMoSettingsViewProps> = ({ currentUser }) => {
  const [config, setConfig] = useState<MoMoConfig>({
    environment: 'sandbox',
    escrowMtnNumber: ESCROW_MTN_NUMBER,
    escrowAirtelNumber: ESCROW_AIRTEL_NUMBER,
    collectionSubscriptionKey: '',
    collectionApiUser: '',
    collectionApiKey: '',
    disbursementSubscriptionKey: '',
    disbursementApiUser: '',
    disbursementApiKey: '',
    targetEnvironment: 'sandbox',
    autoDisburseEnabled: true,
    updatedAt: '',
    updatedBy: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db, 'config', 'momo'));
        if (snap.exists()) {
          setConfig((prev) => ({ ...prev, ...(snap.data() as MoMoConfig) }));
        }
      } catch (err) {
        console.error('Error loading MoMo config:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser?.email !== SUPER_ADMIN) {
      alert('Access Denied: Only Super Admin jonah8639@gmail.com can edit MoMo API credentials.');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updatedConfig: MoMoConfig = {
        ...config,
        updatedAt: now,
        updatedBy: currentUser.email,
      };

      await setDoc(doc(db, 'config', 'momo'), updatedConfig, { merge: true });
      setConfig(updatedConfig);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert('Failed to save MoMo configuration: ' + (err?.message || 'Error'));
    } finally {
      setSaving(false);
    }
  };

  if (currentUser?.email !== SUPER_ADMIN) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-center text-red-800 space-y-2">
        <Lock className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="text-base font-black">Restricted Access</h3>
        <p className="text-xs">Only Super Admin jonah8639@gmail.com can manage MoMo API keys and Escrow configuration.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 font-sans flex items-center gap-2">
            <Key className="w-5 h-5 text-[#006400]" />
            MTN MoMo API & Auto-Split Escrow Config
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configures Collection & Disbursement endpoints. Secured exclusively to {SUPER_ADMIN}.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-[#006400] hover:bg-[#004d00] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>MoMo API configuration saved successfully to Firestore (config/momo).</span>
        </div>
      )}

      {/* Escrow Account Rules Card */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>LOCKED ESCROW NUMBERS & COMMISSION RATE</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-white p-3 rounded-2xl border border-amber-200">
            <span className="text-[10px] text-gray-500 block font-semibold">MTN Escrow Primary:</span>
            <span className="text-sm font-mono font-black text-gray-900">0764117040</span>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-amber-200">
            <span className="text-[10px] text-gray-500 block font-semibold">Airtel Money Escrow:</span>
            <span className="text-sm font-mono font-black text-gray-900">0700924322</span>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-amber-200">
            <span className="text-[10px] text-gray-500 block font-semibold">Platform Commission:</span>
            <span className="text-sm font-mono font-black text-[#006400]">5% of Original Price</span>
          </div>
        </div>
      </div>

      {/* Target Environment */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
        <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
          <Server className="w-4 h-4 text-[#006400]" />
          Target Environment
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
              config.environment === 'sandbox'
                ? 'border-[#006400] bg-emerald-50/50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="environment"
              value="sandbox"
              checked={config.environment === 'sandbox'}
              onChange={(e) => setConfig({ ...config, environment: 'sandbox', targetEnvironment: 'sandbox' })}
              className="text-[#006400] focus:ring-[#006400]"
            />
            <div>
              <span className="block text-xs font-bold text-gray-900">MTN MoMo Sandbox</span>
              <span className="text-[11px] text-gray-500">Test simulations and trial transactions</span>
            </div>
          </label>

          <label
            className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
              config.environment === 'live'
                ? 'border-[#006400] bg-emerald-50/50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name="environment"
              value="live"
              checked={config.environment === 'live'}
              onChange={(e) => setConfig({ ...config, environment: 'live', targetEnvironment: 'mtnuganda' })}
              className="text-[#006400] focus:ring-[#006400]"
            />
            <div>
              <span className="block text-xs font-bold text-gray-900">Live Production (MTN Uganda)</span>
              <span className="text-[11px] text-gray-500">Real mobile money payments & disbursements</span>
            </div>
          </label>
        </div>
      </div>

      {/* Collection API Credentials */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-extrabold text-gray-900">
            1. Collection API (Buyer Payments into 0764117040)
          </h3>
          <span className="text-[11px] text-gray-500">MTN Open API</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Collection Primary Subscription Key (Ocp-Apim-Subscription-Key):
            </label>
            <input
              type="password"
              value={config.collectionSubscriptionKey}
              onChange={(e) => setConfig({ ...config, collectionSubscriptionKey: e.target.value })}
              placeholder="e.g. 84df201...99e4"
              className="w-full px-3.5 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#006400] focus:bg-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                API User (X-Reference-Id UUID):
              </label>
              <input
                type="text"
                value={config.collectionApiUser}
                onChange={(e) => setConfig({ ...config, collectionApiUser: e.target.value })}
                placeholder="UUIDv4 (e.g. c89456...)"
                className="w-full px-3.5 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#006400] focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                API Key (Secret):
              </label>
              <input
                type="password"
                value={config.collectionApiKey}
                onChange={(e) => setConfig({ ...config, collectionApiKey: e.target.value })}
                placeholder="Created via /apiuser/{id}/apikey"
                className="w-full px-3.5 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#006400] focus:bg-white outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Disbursement API Credentials */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-extrabold text-gray-900">
            2. Disbursement API (Auto-Payout to Seller Phone)
          </h3>
          <span className="text-[11px] text-gray-500">Auto-Disburse 95%</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Disbursement Primary Subscription Key:
            </label>
            <input
              type="password"
              value={config.disbursementSubscriptionKey}
              onChange={(e) => setConfig({ ...config, disbursementSubscriptionKey: e.target.value })}
              placeholder="e.g. 71ab324...88a1"
              className="w-full px-3.5 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#006400] focus:bg-white outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Disbursement API User:
              </label>
              <input
                type="text"
                value={config.disbursementApiUser}
                onChange={(e) => setConfig({ ...config, disbursementApiUser: e.target.value })}
                placeholder="UUIDv4"
                className="w-full px-3.5 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#006400] focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Disbursement API Key:
              </label>
              <input
                type="password"
                value={config.disbursementApiKey}
                onChange={(e) => setConfig({ ...config, disbursementApiKey: e.target.value })}
                placeholder="Disbursement Secret"
                className="w-full px-3.5 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#006400] focus:bg-white outline-none"
              />
            </div>
          </div>
        </div>
      </div>

    </form>
  );
};
