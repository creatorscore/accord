import React, { createContext, useContext, useState, useCallback } from 'react';
import { router } from 'expo-router';
import MatchModal from '@/components/matching/MatchModal';
import { maybeRequestReview } from '@/lib/store-review';

interface MatchedUser {
  id: string;
  displayName: string;
  photoUrl?: string;
  compatibilityScore?: number;
}

interface MatchContextType {
  showMatchCelebration: (matchedUser: MatchedUser, matchId: string, currentUserPhoto?: string) => void;
}

const MatchContext = createContext<MatchContextType>({
  showMatchCelebration: () => {},
});

export function useMatch() {
  return useContext(MatchContext);
}

export function MatchProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | undefined>();

  const showMatchCelebration = useCallback(
    (user: MatchedUser, id: string, userPhoto?: string) => {
      setMatchedUser(user);
      setMatchId(id);
      setCurrentUserPhoto(userPhoto);
      setVisible(true);
    },
    []
  );

  const handleSendMessage = useCallback(() => {
    setVisible(false);
    maybeRequestReview();
    if (matchId) {
      setTimeout(() => {
        router.push(`/chat/${matchId}`);
      }, 300);
    }
  }, [matchId]);

  const handleClose = useCallback(() => {
    setVisible(false);
    maybeRequestReview();
  }, []);

  return (
    <MatchContext.Provider value={{ showMatchCelebration }}>
      {children}
      {matchedUser && (
        <MatchModal
          visible={visible}
          onClose={handleClose}
          onSendMessage={handleSendMessage}
          matchedProfile={{
            display_name: matchedUser.displayName,
            photo_url: matchedUser.photoUrl,
            compatibility_score: matchedUser.compatibilityScore,
          }}
          currentUserPhoto={currentUserPhoto}
        />
      )}
    </MatchContext.Provider>
  );
}
