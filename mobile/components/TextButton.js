// Ortak metin butonu: çerçevesi ve arka planı olmayan, sadece renkli yazıdan oluşan küçük buton
// ("Şifremi unuttum", "Kodu tekrar gönder", "Hesabımı sil", "Sil" gibi ikincil işlemler için).
// Tek component olduğu için görünümü (renk, boyut, boşluk) buradan değişince bütün uygulamada değişir.
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

// baslik: buton yazısı, onPress: basınca çalışacak fonksiyon, disabled: true ise basılamaz.
// danger: true ise yazı kırmızı olur (geri alınamaz işlemler: silme gibi).
// centered: true (varsayılan) ise satırın ortasında, üstünde boşlukla durur; false ise bulunduğu yere (örn. kart
// başlığının sağına) boşluksuz yerleşir.
export default function TextButton({ baslik: title, onPress, disabled = false, danger = false, centered = true }) {
  return (
    // hitSlop: dokunma alanını yazının dışına 8 piksel genişletir; küçük yazıya parmakla basmak kolaylaşır.
    <Pressable
      style={({ pressed }) => [centered && styles.centered, (pressed || disabled) && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, danger && styles.danger]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignSelf: 'center',
    marginTop: 16,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    fontFamily: fonts.metin,
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  danger: {
    color: colors.error,
  },
});
