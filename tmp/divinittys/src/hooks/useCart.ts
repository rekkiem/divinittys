import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image?: string;
  slug: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
};

type CartStore = {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string, variantId?: string) => void;
  updateQuantity: (id: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  total: () => number;
  get subtotal(): number;
  get count(): number;
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        set((state) => {
          const key = item.variantId || item.id;
          const existing = state.items.find(
            (i) => (i.variantId || i.id) === key
          );

          if (existing) {
            return {
              items: state.items.map((i) =>
                (i.variantId || i.id) === key
                  ? { ...i, quantity: i.quantity + (item.quantity || 1) }
                  : i
              ),
            };
          }

          return {
            items: [...state.items, { ...item, quantity: item.quantity || 1 }],
          };
        });
      },

      removeItem: (id, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.id === id && i.variantId === variantId)
          ),
        }));
      },

      updateQuantity: (id, quantity, variantId) => {
        if (quantity < 1) {
          get().removeItem(id, variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id && i.variantId === variantId ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      get subtotal() {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },

      get count() {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'divinittys-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);
