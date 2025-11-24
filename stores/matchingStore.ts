import { create } from 'zustand';
import { Database } from '@/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface MatchingState {
  discoveryQueue: Profile[];
  currentIndex: number;
  loading: boolean;
  setDiscoveryQueue: (profiles: Profile[]) => void;
  nextProfile: () => void;
  reset: () => void;
}

export const useMatchingStore = create<MatchingState>((set) => ({
  discoveryQueue: [],
  currentIndex: 0,
  loading: false,
  setDiscoveryQueue: (profiles) =>
    set({ discoveryQueue: profiles, currentIndex: 0 }),
  nextProfile: () =>
    set((state) => ({ currentIndex: state.currentIndex + 1 })),
  reset: () => set({ discoveryQueue: [], currentIndex: 0 }),
}));
