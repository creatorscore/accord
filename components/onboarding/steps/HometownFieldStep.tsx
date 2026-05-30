import { memo, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import CityAutocompleteStep from './CityAutocompleteStep';

interface Props {
  onSkip?: () => void;
}

function HometownFieldStep({ onSkip }: Props) {
  const hometown = useOnboardingStore((s) => s.hometown);
  const setField = useOnboardingStore((s) => s.setField);
  const visible = useOnboardingStore((s) => s.fieldVisibility.hometown !== false);
  const setVisibility = useOnboardingStore((s) => s.setVisibility);

  const handleSelect = useCallback((v: string) => setField('hometown', v), [setField]);
  const handleVisibilityChange = useCallback(
    (v: boolean) => setVisibility('hometown', v),
    [setVisibility]
  );

  return (
    <CityAutocompleteStep
      value={hometown}
      onSelect={handleSelect}
      placeholder="e.g. Los Angeles, CA"
      showVisibility
      visible={visible}
      onVisibilityChange={handleVisibilityChange}
      onSkip={onSkip}
    />
  );
}

export default memo(HometownFieldStep);
