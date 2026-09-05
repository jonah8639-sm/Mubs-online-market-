import React, { useState } from 'react';
import { Download, Share2, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If running in standalone native mode, hide
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {isInstallable && (
        <button
          id="pwa-install-btn"
          onClick={install}
          className={`flex items-center gap-1.5 font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 active:scale-95 transition rounded-full ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
          }`}
          title="Install MUBS Market app on your phone or desktop"
        >
          <Download className="w-3.5 h-3.5 text-emerald-700" />
          <span>Install App</span>
        </button>
      )}

      {isIOS && !isInstallable && (
        <button
          id="pwa-ios-guide-btn"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition rounded-full ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
          }`}
          title="Install on iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
          <span>Install on iOS</span>
        </button>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-emerald-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                  M
                </div>
                <h3 className="font-bold text-gray-900">Install MUBS Market</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <p>
                  In Safari, tap the <span className="font-semibold text-gray-900 inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5 inline text-blue-600" /> Share</span> button at the bottom of your screen.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <p>
                  Scroll down the share sheet and tap <span className="font-semibold text-gray-900">Add to Home Screen</span>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </div>
                <p>
                  Tap <span className="font-semibold text-emerald-700">Add</span> in the top right. Launch MUBS Market anytime directly like a native iOS app!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
