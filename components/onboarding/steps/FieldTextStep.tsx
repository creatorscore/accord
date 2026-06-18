import { memo, useCallback } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import TextInputStep from './TextInputStep';

// Per-field text-input wrapper. Same rationale as FieldChipStep —
// keystrokes here previously re-rendered the entire onboarding tree.
interface Props {
  fieldKey: string;
  placeholder?: string;
  visibilityKey?: string;
}

function FieldTextStep({ fieldKey, placeholder, visibilityKey }: Props) {
  const value = useOnboardingStore((s) => ((s as any)[fieldKey] as string) || '');
  const setField = useOnboardingStore((s) => s.setField);
  const visible = useOnboardingStore((s) =>
    visibilityKey ? s.fieldVisibility[visibilityKey] !== false : true
  );
  const setVisibility = useOnboardingStore((s) => s.setVisibility);

  const handleChange = useCallback(
    (v: string) => setField(fieldKey as any, v as any),
    [fieldKey, setField]
  );

  const handleVisibilityChange = useCallback(
    (v: boolean) => {
      if (visibilityKey) setVisibility(visibilityKey, v);
    },
    [visibilityKey, setVisibility]
  );

  return (
    <TextInputStep
      value={value}
      onChangeText={handleChange}
      placeholder={placeholder ?? ''}
      showVisibility={!!visibilityKey}
      visible={visible}
      onVisibilityChange={handleVisibilityChange}
    />
  );
}

export default memo(FieldTextStep);
