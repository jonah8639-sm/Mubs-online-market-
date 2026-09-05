import React from 'react';
import { MapPin, ShieldCheck, Sparkles, MessageCircle, Clock, X } from 'lucide-react';
import { Product, UserProfile } from '../types';
import { SUPER_ADMIN_EMAIL } from '../config/admin';
import { handleDeleteProductWithAntiDefaulter } from '../lib/deleteProductHelper';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  onChatClick?: (product: Product, e: React.MouseEvent) => void;
  currentUser?: UserProfile | null;
  onDeleteClick?: (product: Product, e: React.MouseEvent) => void;
  onSellerClick?: (sellerId: string, sellerName: string, e: React.MouseEvent) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onClick, 
  onChatClick,
  currentUser,
  onDeleteClick,
  onSellerClick
}) => {
  const isOwner = currentUser?.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();

  const formatUGX = (val: number) => {
    return `UGX ${val.toLocaleString('en-US')}`;
  };

  const handleChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChatClick) {
      onChatClick(product, e);
    } else {
      onClick();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteClick) {
      onDeleteClick(product, e);
    } else {
      handleDeleteProductWithAntiDefaulter(product.id, product, currentUser);
    }
  };

  return (
    <div
      id={`product-card-${product.id}`}
      onClick={onClick}
      className={`group relative bg-white rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col hover:shadow-lg active:scale-[0.99] ${
        product.is_boosted 
          ? 'border-amber-400/80 ring-2 ring-amber-400/20 shadow-xs' 
          : 'border-gray-200 hover:border-emerald-300'
      }`}
    >
      {/* Photo Container */}
      <div className="relative aspect-4/3 w-full bg-gray-100 overflow-hidden">
        {/* Owner Quick Delete Button (Top Right Red X) */}
        {isOwner && (
          <button
            type="button"
            onClick={handleDelete}
            title="Delete Product (Owner jonah8639@gmail.com)"
            className="absolute top-2 right-2 z-30 w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 active:scale-90 text-white flex items-center justify-center shadow-lg font-bold text-xs cursor-pointer border-2 border-white transition"
          >
            <X className="w-4 h-4 stroke-[3]" />
          </button>
        )}

        <img
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            // Fallback image if image fails
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';
          }}
        />

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
          {product.is_boosted ? (
            <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow-md tracking-wider uppercase">
              <Sparkles className="w-3 h-3 fill-white" />
              Featured
            </span>
          ) : (
            <span className="inline-flex items-center text-[11px] font-semibold bg-white/90 backdrop-blur-xs text-gray-700 px-2 py-0.5 rounded-md shadow-xs">
              {product.category}
            </span>
          )}

          <span className="inline-flex items-center gap-1 bg-[#006400]/90 backdrop-blur-xs text-emerald-100 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-xs">
            <ShieldCheck className="w-3 h-3 text-emerald-300" />
            Verified MUBS
          </span>
        </div>

        {/* Location pill & Condition bottom */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-md">
            <MapPin className="w-2.5 h-2.5 text-emerald-400" />
            {product.location}
          </span>
          {product.condition && (
            <span className="text-[10px] font-bold bg-white/90 text-gray-800 px-2 py-0.5 rounded-md shadow-xs">
              {product.condition}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <div>
          <div className="text-base font-extrabold text-[#006400] font-sans tracking-tight">
            {formatUGX(product.price)}
          </div>
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mt-0.5 leading-snug group-hover:text-emerald-700 transition-colors">
            {product.title}
          </h3>
        </div>

        {/* Seller Info & WhatsApp CTA */}
        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
          <div 
            className="min-w-0 flex-1 hover:text-[#006400] transition cursor-pointer"
            onClick={(e) => {
              if (onSellerClick && product.seller_id) {
                e.stopPropagation();
                onSellerClick(product.seller_id, product.seller_name || 'MUBS Student', e);
              }
            }}
          >
            <p className="text-[11px] font-medium text-gray-600 hover:text-[#006400] truncate flex items-center gap-1">
              <span className="truncate">{product.seller_name || 'MUBS Student'}</span>
            </p>
          </div>

          <button
            id={`product-chat-${product.id}`}
            onClick={handleChat}
            title="Chat & Negotiate In-App"
            className="shrink-0 flex items-center gap-1 bg-[#006400] hover:bg-[#004d00] active:scale-95 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5 fill-white/20" />
            <span>Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
