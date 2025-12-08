import React, { createContext, useContext, useState, useCallback } from 'react';
import { router } from 'expo-router';
import MatchCelebrationModal from '@/components/matching/MatchCelebrationModal';

interface MatchedUser {
  id: string;
  displayName: string;
  photoUrl?: string;
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
    if (matchId) {
      setTimeout(() => {
        router.push(`/chat/${matchId}`);
      }, 300);
    }
  }, [matchId]);

  const handleKeepSwiping = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <MatchContext.Provider value={{ showMatchCelebration }}>
      {children}
      <MatchCelebrationModal
        visible={visible}
        matchedUser={matchedUser}
        currentUserPhoto={currentUserPhoto}
        onSendMessage={handleSendMessage}
        onKeepSwiping={handleKeepSwiping}
      />
    </MatchContext.Provider>
  );
}
