import React, { createContext, useContext, useState, useCallback } from 'react';
import { router } from 'expo-router';
import Toast, { ToastType } from '@/components/shared/Toast';

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  onPress?: () => void;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  showMessageToast: (senderName: string, preview: string, matchId: string) => void;
  showLikeToast: (likerName: string, isPremium: boolean) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  showMessageToast: () => {},
  showLikeToast: () => {},
  hideToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [currentToast, setCurrentToast] = useState<ToastData | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Date.now().toString();
    setCurrentToast({ ...toast, id });
    setVisible(true);
  }, []);

  const showMessageToast = useCallback((senderName: string, preview: string, matchId: string) => {
    showToast({
      type: 'message',
      title: `New message from ${senderName}`,
      message: preview.length > 50 ? preview.substring(0, 50) + '...' : preview,
      onPress: () => {
        router.push(`/chat/${matchId}`);
      },
    });
  }, [showToast]);

  const showLikeToast = useCallback((likerName: string, isPremium: boolean) => {
    showToast({
      type: 'like',
      title: isPremium ? `${likerName} likes you!` : 'Someone likes you!',
      message: isPremium ? 'Tap to see their profile' : 'Upgrade to Premium to see who',
      onPress: () => {
        router.push('/(tabs)/likes');
      },
    });
  }, [showToast]);

  const hideToast = useCallback(() => {
    setVisible(false);
    // Clear toast data after animation
    setTimeout(() => setCurrentToast(null), 300);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showMessageToast, showLikeToast, hideToast }}>
      {children}
      {currentToast && (
        <Toast
          visible={visible}
          type={currentToast.type}
          title={currentToast.title}
          message={currentToast.message}
          onPress={currentToast.onPress}
          onDismiss={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
}
