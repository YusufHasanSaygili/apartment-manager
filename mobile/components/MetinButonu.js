// Ortak metin butonu: çerçevesi ve arka planı olmayan, sadece renkli yazıdan oluşan küçük buton
// ("Şifremi unuttum", "Kodu tekrar gönder", "Hesabımı sil", "Sil" gibi ikincil işlemler için).
// Tek component olduğu için görünümü (renk, boyut, boşluk) buradan değişince bütün uygulamada değişir.
import { Pressable, StyleSheet, Text } from 'react-native';
import { renkler, yaziTipi } from '../tema';

// baslik: buton yazısı, onPress: basınca çalışacak fonksiyon, disabled: true ise basılamaz.
// tehlike: true ise yazı kırmızı olur (geri alınamaz işlemler: silme gibi).
// ortada: true (varsayılan) ise satırın ortasında, üstünde boşlukla durur; false ise bulunduğu yere (örn. kart
// başlığının sağına) boşluksuz yerleşir.
export default function MetinButonu({ baslik, onPress, disabled = false, tehlike = false, ortada = true }) {
  return (
    // hitSlop: dokunma alanını yazının dışına 8 piksel genişletir; küçük yazıya parmakla basmak kolaylaşır.
    <Pressable
      style={({ pressed }) => [ortada && styles.ortada, (pressed || disabled) && styles.basili]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.yazi, tehlike && styles.tehlike]}>{baslik}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ortada: {
    alignSelf: 'center',
    marginTop: 16,
  },
  basili: {
    opacity: 0.6,
  },
  yazi: {
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
    color: renkler.birincil,
  },
  tehlike: {
    color: renkler.hata,
  },
});
