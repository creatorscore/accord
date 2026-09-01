import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getSuperLikeCreditCount, getPriceString } from '@/lib/revenue-cat';

// Bottom-sheet picker for Lavender consumable packs. Presentational only:
// the caller owns package loading and the purchase flow (see
// lib/super-like.ts purchaseSuperLikeCredits). Mirrors the inline picker in
// discover.tsx — keep the two visually in sync.

interface LavenderPacksModalProps {
  visible: boolean;
  onClose: () => void;
  packages: any[];
  onBuy: (pkg: any) => void;
  cardColor: string;
  textColor: string;
}

export default function LavenderPacksModal({
  visible,
  onClose,
  packages,
  onBuy,
  cardColor,
  textColor,
}: LavenderPacksModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={{ backgroundColor: cardColor, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}
        >
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <MaterialCommunityIcons name="flower" size={40} color="#8B6FA8" />
            <Text style={{ fontSize: 20, fontWeight: '700', color: textColor, marginTop: 8 }}>
              {t('discover.superlike.packsTitle', { defaultValue: 'Get Lavenders' })}
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
              {t('discover.superlike.packsSubtitle', { defaultValue: 'Stand out to the people who matter.' })}
            </Text>
          </View>
          {packages.map((pkg: any, i: number) => {
            const count = getSuperLikeCreditCount(pkg);
            const best = packages.length > 1 && i === packages.length - 1;
            return (
              <TouchableOpacity
                key={pkg.product.identifier}
                onPress={() => { onClose(); onBuy(pkg); }}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  borderWidth: 2, borderColor: best ? '#8B6FA8' : '#E5E7EB', borderRadius: 16,
                  paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
                  backgroundColor: best ? 'rgba(139, 111, 168, 0.08)' : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: best ? '#6D28D9' : textColor }}>
                    {count === 1
                      ? t('discover.superlike.packOptionOne', { defaultValue: '1 Lavender' })
                      : t('discover.superlike.packOption', { count, defaultValue: '{{count}} Lavenders' })}
                  </Text>
                  {best && (
                    <View style={{ backgroundColor: '#8B6FA8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
                        {t('discover.superlike.bestValue', { defaultValue: 'Best value' })}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: textColor }}>{getPriceString(pkg)}</Text>
              </TouchableOpacity>
            );
          })}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
