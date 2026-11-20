import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuItem, CartItem } from '../types';

const DRAFT_CART_STORAGE_KEY = '@koji_draft_cart';

interface CartContextType {
  cart: { [id: string]: CartItem };
  cartItemsList: CartItem[];
  totalQuantity: number;
  totalAmount: number;
  handleIncrement: (item: MenuItem) => void;
  handleDecrement: (item: MenuItem) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<{ [id: string]: CartItem }>({});
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  // Load persisted draft cart on startup
  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(DRAFT_CART_STORAGE_KEY)
      .then((saved) => {
        if (isMounted && saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
              setCart(parsed);
            }
          } catch {
            // Ignore parse error
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) {
          setIsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Save draft cart on change after initial load
  useEffect(() => {
    if (!isLoaded) return;
    if (Object.keys(cart).length === 0) {
      AsyncStorage.removeItem(DRAFT_CART_STORAGE_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(DRAFT_CART_STORAGE_KEY, JSON.stringify(cart)).catch(() => {});
    }
  }, [cart, isLoaded]);

  const handleIncrement = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const current = prev[item.id];
      const newQty = (current?.quantity || 0) + 1;
      return {
        ...prev,
        [item.id]: {
          ...item,
          quantity: newQty,
          status: 'pending',
        },
      };
    });
  }, []);

  const handleDecrement = useCallback((item: MenuItem) => {
    setCart((prev) => {
      const current = prev[item.id];
      if (!current) return prev;
      const newQty = current.quantity - 1;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return {
        ...prev,
        [item.id]: {
          ...current,
          quantity: newQty,
        },
      };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({});
    AsyncStorage.removeItem(DRAFT_CART_STORAGE_KEY).catch(() => {});
  }, []);

  const cartItemsList = useMemo(() => {
    return Object.values(cart).filter((item) => item.quantity > 0);
  }, [cart]);

  const totalQuantity = useMemo(() => {
    return cartItemsList.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItemsList]);

  const totalAmount = useMemo(() => {
    return cartItemsList.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }, [cartItemsList]);

  const value = useMemo(
    () => ({
      cart,
      cartItemsList,
      totalQuantity,
      totalAmount,
      handleIncrement,
      handleDecrement,
      clearCart,
    }),
    [
      cart,
      cartItemsList,
      totalQuantity,
      totalAmount,
      handleIncrement,
      handleDecrement,
      clearCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

