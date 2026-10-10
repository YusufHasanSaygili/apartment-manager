// Ay/yıl seçici: ortada başlık (örn. "Ekim 2026") ve küçük açıklama, iki yanda önceki/sonraki okları.
// Daire haritası ve aidat takviminde kullanılır.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { radius, colors, fonts } from '../theme';

// title: ortadaki yazı, subtitle: (isteğe bağlı) altındaki açıklama, onPrevious / onNext: oklara basınca çalışır.
// previousDisabled / nextDisabled: true ise o ok soluk görünür ve basılamaz (örn. daha ileri ay yok).
export default function Pager({ title, subtitle, onPrevious, onNext, previousDisabled = false, nextDisabled = false, previousLabel = 'Önceki', nextLabel = 'Sonraki' }) {
  return (
    <View style={styles.box}>
      {/* Sol ok: basınca onPrevious çalışır (bir önceki ay/yıl) */}
      <Pressable style={({ pressed }) => [styles.arrow, (pressed || previousDisabled) && styles.pressed]} onPress={onPrevious} disabled={previousDisabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={previousLabel}>
        <Feather name="chevron-left" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {/* Sağ ok: basınca onNext çalışır (bir sonraki ay/yıl) */}
      <Pressable style={({ pressed }) => [styles.arrow, (pressed || nextDisabled) && styles.pressed]} onPress={onNext} disabled={nextDisabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={nextLabel}>
        <Feather name="chevron-right" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 5,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  arrow: {
    width: 42,
    height: 42,
    borderRadius: radius,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  center: {
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.text,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.muted,
  },
});
