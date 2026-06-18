import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { tOptions } from '@/lib/onboarding-labels';
import { GENDER_PREF_OPTIONS } from '@/lib/onboarding-config';
import ChipSelect from './ChipSelect';

// Step 7 (gender preference) — special case because of "Everyone"
// exclusivity: selecting Everyone clears specifics; selecting a specific
// while Everyone is on drops Everyone.
function GenderPrefFieldStep() {
  const { t } = useTranslation();
  const genderPreference = useOnboardingStore((s) => s.genderPreference);
  const setField = useOnboardingStore((s) => s.setField);

  const options = useMemo(() => tOptions(t, 'genderPrefs', GENDER_PREF_OPTIONS), [t]);

  const handleSelect = useCallback(
    (newSelection: string[]) => {
      const prev = useOnboardingStore.getState().genderPreference;
      const added = newSelection.filter((v) => !prev.includes(v));
      if (added.includes('Everyone')) {
        setField('genderPreference', ['Everyone']);
      } else if (added.length > 0 && prev.includes('Everyone')) {
        setField('genderPreference', added);
      } else {
        setField('genderPreference', newSelection);
      }
    },
    [setField]
  );

  return (
    <ChipSelect
      options={options}
      selected={genderPreference}
      onSelect={handleSelect}
    />
  );
}

export default memo(GenderPrefFieldStep);
