import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { tOptions } from '@/lib/onboarding-labels';
import ChipSelect from './ChipSelect';

// Per-field chip wrapper. Subscribes only to the single store field it
// renders so a chip tap on step N never re-renders steps 0..N-1 or the
// parent onboarding container. Real-device iPad walkthrough 2026-05-29
// confirmed the parent's bare `useOnboardingStore()` subscription was
// freezing the JS thread by step 12 — every tap re-rendered the entire
// 900-line onboarding tree + restarted the OnboardingLayout fade.
interface Props {
  fieldKey: string;
  optionsKey: string;
  optionsList: readonly (string | { value: string; label: string })[];
  multi?: boolean;
  /** true if the store field is string[] (e.g. ethnicity); false if string (e.g. wantsChildren). */
  isArrayField?: boolean;
  /** Field-visibility key (e.g. 'pets'). Omit to hide the visibility toggle entirely. */
  visibilityKey?: string;
}

function FieldChipStep({
  fieldKey,
  optionsKey,
  optionsList,
  multi = false,
  isArrayField = false,
  visibilityKey,
}: Props) {
  const { t } = useTranslation();
  const value = useOnboardingStore((s) => (s as any)[fieldKey]);
  const setField = useOnboardingStore((s) => s.setField);
  const visible = useOnboardingStore((s) =>
    visibilityKey ? s.fieldVisibility[visibilityKey] !== false : true
  );
  const setVisibility = useOnboardingStore((s) => s.setVisibility);

  const options = useMemo(
    () => tOptions(t, optionsKey, optionsList),
    [t, optionsKey, optionsList]
  );

  const selected: string[] = isArrayField
    ? Array.isArray(value) ? (value as string[]) : []
    : value ? [value as string] : [];

  const handleSelect = useCallback(
    (v: string[]) => {
      if (isArrayField) {
        setField(fieldKey as any, v as any);
      } else {
        setField(fieldKey as any, (v[0] || '') as any);
      }
    },
    [fieldKey, isArrayField, setField]
  );

  const handleVisibilityChange = useCallback(
    (v: boolean) => {
      if (visibilityKey) setVisibility(visibilityKey, v);
    },
    [visibilityKey, setVisibility]
  );

  return (
    <ChipSelect
      options={options}
      selected={selected}
      onSelect={handleSelect}
      multi={multi}
      showVisibility={!!visibilityKey}
      visible={visible}
      onVisibilityChange={handleVisibilityChange}
    />
  );
}

export default memo(FieldChipStep);
