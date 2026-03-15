import { create } from 'zustand';

interface PreviewModeState {
  isPreviewMode: boolean;
  returnRoute: string | null;
  enterPreviewMode: (returnRoute: string) => void;
  exitPreviewMode: () => void;
}

export const usePreviewModeStore = create<PreviewModeState>((set) => ({
  isPreviewMode: false,
  returnRoute: null,
  enterPreviewMode: (returnRoute) => set({ isPreviewMode: true, returnRoute }),
  exitPreviewMode: () => set({ isPreviewMode: false, returnRoute: null }),
}));
