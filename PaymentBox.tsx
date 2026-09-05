import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, Phone } from 'lucide-react';
import { MTN_MOMO_NUMBER, AIRTEL_MONEY_NUMBER } from '../lib/commissionConstants';

interface PaymentBoxProps {
  amount?: number;
  title?: string;
  subtitle?: string;
  highlightAmount?: boolean;
}

export const PaymentBox: React.FC<PaymentBoxProps> = ({
  amount,
  title = 'Official MUBS Market Mobile Money Payment Numbers',
  subtitle = 'Send the exact amount to either number below, then copy your transaction ID for verification.',
  highlightAmount = true,
}) => {
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const handleCopy = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  return (
    <div className="bg-emerald-50 border-2 border-[#006400] rounded-2xl p-4 sm:p-5 text-emerald-950 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#006400] text-white flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-[#006400] uppercase tracking-wide">
              {title}
            </h4>
            <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
              {subtitle}
            </p>
          </div>
        </div>

        {amount !== undefined && highlightAmount && (
          <div className="text-right shrink-0 bg-white/80 border border-emerald-300 rounded-xl px-2.5 py-1">
            <span className="text-[10px] text-gray-500 font-semibold block uppercase">Amount Due</span>
            <span className="text-sm font-extrabold text-[#006400]">
              UGX {Math.round(amount).toLocaleString('en-US')}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* MTN MoMo */}
        <div className="bg-white rounded-xl p-3 border border-emerald-300 shadow-2xs flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              <span>MTN MoMo</span>
            </div>
            <div className="font-mono text-base font-black text-[#006400] tracking-wider mt-0.5">
              {MTN_MOMO_NUMBER}
            </div>
            <div className="text-[10px] text-gray-400">Dial *165# to send</div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(MTN_MOMO_NUMBER)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-[#006400] rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
          >
            {copiedNumber === MTN_MOMO_NUMBER ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Airtel Money */}
        <div className="bg-white rounded-xl p-3 border border-red-200 shadow-2xs flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
              <span>Airtel Money</span>
            </div>
            <div className="font-mono text-base font-black text-red-700 tracking-wider mt-0.5">
              {AIRTEL_MONEY_NUMBER}
            </div>
            <div className="text-[10px] text-gray-400">Dial *185# to send</div>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(AIRTEL_MONEY_NUMBER)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
          >
            {copiedNumber === AIRTEL_MONEY_NUMBER ? (
              <>
                <Check className="w-3.5 h-3.5 text-red-700" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 pt-0.5">
        <ShieldCheck className="w-3.5 h-3.5 text-[#006400] shrink-0" />
        <span>Official MUBS Online Market verified administration accounts. Confirm recipient before sending.</span>
      </div>
    </div>
  );
};
