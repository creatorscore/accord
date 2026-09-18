import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { tOptions } from '@/lib/onboarding-labels';
import { DEALBREAKER_OPTIONS } from '@/lib/onboarding-config';
import ChipSelect from './ChipSelect';

// Step 33 (dealbreakers) — optional multi-select, capped at 10. Final step.
// Writes to preferences.dealbreakers (TEXT[]). Mirrors FieldChipStep but
// enforces a selection cap: once 10 are chosen, additional taps are ignored
// (removals always allowed).
const MAX_DEALBREAKERS = 10;

function DealbreakersFieldStep() {
  const { t } = useTranslation();
  const value = useOnboardingStore((s) => s.dealbreakers);
  const setField = useOnboardingStore((s) => s.setField);

  const options = useMemo(
    () => tOptions(t, 'dealbreakers', DEALBREAKER_OPTIONS),
    [t]
  );

  const selected = Array.isArray(value) ? value : [];

  const handleSelect = useCallback(
    (v: string[]) => {
      if (v.length > MAX_DEALBREAKERS) return;
      setField('dealbreakers', v);
    },
    [setField]
  );

  return (
    <ChipSelect options={options} selected={selected} onSelect={handleSelect} multi />
  );
}

export default memo(DealbreakersFieldStep);
