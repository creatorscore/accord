import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { tOptions } from '@/lib/onboarding-labels';
import { COMMON_LANGUAGES } from '@/lib/onboarding-config';
import ChipSelect from './ChipSelect';

// Step 31 (languages spoken) — optional multi-select, capped at 5.
// Writes to profiles.languages_spoken (TEXT[]). Mirrors FieldChipStep but
// enforces a selection cap: once 5 are chosen, additional taps are ignored
// (removals always allowed). Silent cap matches settings/edit-profile.
const MAX_LANGUAGES = 5;

function LanguagesFieldStep() {
  const { t } = useTranslation();
  const value = useOnboardingStore((s) => s.languagesSpoken);
  const setField = useOnboardingStore((s) => s.setField);

  const options = useMemo(
    () => tOptions(t, 'languages', COMMON_LANGUAGES),
    [t]
  );

  const selected = Array.isArray(value) ? value : [];

  const handleSelect = useCallback(
    (v: string[]) => {
      // Reject additions that would exceed the cap; always allow removals.
      if (v.length > MAX_LANGUAGES) return;
      setField('languagesSpoken', v);
    },
    [setField]
  );

  return (
    <ChipSelect options={options} selected={selected} onSelect={handleSelect} multi />
  );
}

export default memo(LanguagesFieldStep);
