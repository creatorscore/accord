import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { tOptions } from '@/lib/onboarding-labels';
import { ORIENTATIONS, getAvailableOrientations } from '@/lib/onboarding-config';
import ChipSelect from './ChipSelect';

// Step 6 (sexual orientation) — special case because the available
// options depend on the user's gender answer from step 5.
function OrientationFieldStep() {
  const { t } = useTranslation();
  const sexualOrientation = useOnboardingStore((s) => s.sexualOrientation);
  const gender = useOnboardingStore((s) => s.gender);
  const setField = useOnboardingStore((s) => s.setField);

  const options = useMemo(
    () =>
      tOptions(
        t,
        'orientations',
        Array.isArray(gender) && gender.includes('Man') ? getAvailableOrientations('Man') : ORIENTATIONS
      ),
    [t, gender]
  );

  const handleSelect = useCallback(
    (v: string[]) => setField('sexualOrientation', v),
    [setField]
  );

  return (
    <ChipSelect
      options={options}
      selected={sexualOrientation}
      onSelect={handleSelect}
      multi={false}
    />
  );
}

export default memo(OrientationFieldStep);
