import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { tOptions } from '@/lib/onboarding-labels';
import { MUST_HAVE_OPTIONS } from '@/lib/onboarding-config';
import ChipSelect from './ChipSelect';

// Step 32 (must-haves) — optional multi-select, capped at 10.
// Writes to preferences.must_haves (TEXT[]). Mirrors FieldChipStep but
// enforces a selection cap: once 10 are chosen, additional taps are ignored
// (removals always allowed).
const MAX_MUST_HAVES = 10;

function MustHavesFieldStep() {
  const { t } = useTranslation();
  const value = useOnboardingStore((s) => s.mustHaves);
  const setField = useOnboardingStore((s) => s.setField);

  const options = useMemo(
    () => tOptions(t, 'mustHaves', MUST_HAVE_OPTIONS),
    [t]
  );

  const selected = Array.isArray(value) ? value : [];

  const handleSelect = useCallback(
    (v: string[]) => {
      if (v.length > MAX_MUST_HAVES) return;
      setField('mustHaves', v);
    },
    [setField]
  );

  return (
    <ChipSelect options={options} selected={selected} onSelect={handleSelect} multi />
  );
}

export default memo(MustHavesFieldStep);
