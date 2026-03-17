import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WishlistStore = {
  productIds: string[];
  add: (productId: string) => void;
  remove: (productId: string) => void;
  toggle: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  clear: () => void;
};

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      productIds: [],

      add: (productId) => {
        set((state) => ({
          productIds: state.productIds.includes(productId)
            ? state.productIds
            : [...state.productIds, productId],
        }));
      },

      remove: (productId) => {
        set((state) => ({
          productIds: state.productIds.filter((id) => id !== productId),
        }));
      },

      toggle: (productId) => {
        const { productIds } = get();
        if (productIds.includes(productId)) {
          get().remove(productId);
        } else {
          get().add(productId);
        }
      },

      isInWishlist: (productId) => get().productIds.includes(productId),

      clear: () => set({ productIds: [] }),
    }),
    {
      name: 'divinittys-wishlist',
    }
  )
);
