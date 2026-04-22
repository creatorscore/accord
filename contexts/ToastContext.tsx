import React, { createContext, useContext, useState, useCallback } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  showReactionToast: (reactorName: string, emoji: string, matchId: string) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  showMessageToast: () => {},
  showLikeToast: () => {},
  showReactionToast: () => {},
  hideToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
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
      title: t('toast.newMessageFrom', { name: senderName }),
      message: preview.length > 50 ? preview.substring(0, 50) + '...' : preview,
      onPress: () => {
        router.push(`/chat/${matchId}`);
      },
    });
  }, [showToast, t]);

  const showLikeToast = useCallback((likerName: string, isPremium: boolean) => {
    showToast({
      type: 'like',
      title: isPremium ? t('toast.userLikesYou', { name: likerName }) : t('toast.someoneLikesYou'),
      message: isPremium ? t('toast.tapToSeeProfile') : t('toast.upgradeToSeePremium'),
      onPress: () => {
        router.push('/(tabs)/likes');
      },
    });
  }, [showToast, t]);

  const showReactionToast = useCallback((reactorName: string, emoji: string, matchId: string) => {
    showToast({
      type: 'reaction',
      title: t('toast.reactedWith', { name: reactorName, emoji }),
      message: t('toast.tapToViewConversation'),
      onPress: () => {
        router.push(`/chat/${matchId}`);
      },
    });
  }, [showToast, t]);

  const hideToast = useCallback(() => {
    setVisible(false);
    // Clear toast data after animation
    setTimeout(() => setCurrentToast(null), 300);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showMessageToast, showLikeToast, showReactionToast, hideToast }}>
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
