import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface SubscriptionContextType {
  isPremium: boolean;
  isPlatinum: boolean;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPremium: false,
  isPlatinum: false,
  loading: true,
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isPlatinum, setIsPlatinum] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // TODO: Fetch subscription status from Supabase
      // For now, set to false
      setIsPremium(false);
      setIsPlatinum(false);
      setLoading(false);
    } else {
      setIsPremium(false);
      setIsPlatinum(false);
      setLoading(false);
    }
  }, [user]);

  return (
    <SubscriptionContext.Provider value={{ isPremium, isPlatinum, loading }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
