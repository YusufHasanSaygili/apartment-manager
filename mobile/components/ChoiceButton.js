// Ortak seçim düğmesi: seçilebilen küçük kutu (devirde daire seçimi, tekrarlayan duyuruda gün seçimi gibi).
// Seçiliyse koyu altın zemin + altın çerçeve, değilse koyu kutu + ince çerçeve görünür. Tek component olduğu için görünümü buradan değişince
// bütün seçim düğmeleri birlikte değişir.
import { Pressable, StyleSheet, Text } from 'react-native';
import { radius, colors, fonts } from '../theme';

// text: düğmedeki metin, isSelected: seçili mi, onPress: basınca çalışacak fonksiyon.
// multiple: true ise birden fazla seçilebilen listede kullanılır (ekran okuyucuya "onay kutusu" olarak bildirilir);
// false ise listeden yalnız biri seçilir ("seçenek düğmesi" olarak bildirilir).
// style: (isteğe bağlı) ek stil; örn. eşit sütunlu ızgarada flex: 1 verilerek bütün düğmeler aynı genişlikte olur.
export default function ChoiceButton({ text, isSelected, onPress, multiple = false, style }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.button, isSelected && styles.selected, pressed && styles.pressed, style]}
      onPress={onPress}
      // accessibilityRole/State: ekran okuyucu düğmenin türünü ve seçili olup olmadığını söyler.
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: isSelected } : { selected: isSelected }}
    >
      <Text style={[styles.text, isSelected && styles.selectedText]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 48,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBackground,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontFamily: fonts.text,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  selectedText: {
    color: colors.primary,
  },
});
