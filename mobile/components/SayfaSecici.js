// Ay/yıl seçici: ortada başlık (örn. "Ekim 2026") ve küçük açıklama, iki yanda önceki/sonraki okları.
// Daire haritası ve aidat takviminde kullanılır.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { kose, renkler, yaziTipi } from '../tema';

// baslik: ortadaki yazı, alt: (isteğe bağlı) altındaki açıklama, onOnceki / onSonraki: oklara basınca çalışır.
// oncekiPasif / sonrakiPasif: true ise o ok soluk görünür ve basılamaz (örn. daha ileri ay yok).
export default function SayfaSecici({ baslik, alt, onOnceki, onSonraki, oncekiPasif = false, sonrakiPasif = false, oncekiAdi = 'Önceki', sonrakiAdi = 'Sonraki' }) {
  return (
    <View style={styles.kutu}>
      {/* Sol ok: basınca onOnceki çalışır (bir önceki ay/yıl) */}
      <Pressable style={({ pressed }) => [styles.ok, (pressed || oncekiPasif) && styles.basili]} onPress={onOnceki} disabled={oncekiPasif} hitSlop={6} accessibilityRole="button" accessibilityLabel={oncekiAdi}>
        <Feather name="chevron-left" size={20} color={renkler.yazi} />
      </Pressable>
      <View style={styles.orta}>
        <Text style={styles.baslik}>{baslik}</Text>
        {alt ? <Text style={styles.alt}>{alt}</Text> : null}
      </View>
      {/* Sağ ok: basınca onSonraki çalışır (bir sonraki ay/yıl) */}
      <Pressable style={({ pressed }) => [styles.ok, (pressed || sonrakiPasif) && styles.basili]} onPress={onSonraki} disabled={sonrakiPasif} hitSlop={6} accessibilityRole="button" accessibilityLabel={sonrakiAdi}>
        <Feather name="chevron-right" size={20} color={renkler.yazi} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 5,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  ok: {
    width: 42,
    height: 42,
    borderRadius: kose,
    backgroundColor: renkler.yuzey2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  basili: {
    opacity: 0.6,
  },
  orta: {
    alignItems: 'center',
  },
  baslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    fontWeight: '600',
    color: renkler.yazi,
  },
  alt: {
    fontFamily: yaziTipi.metin,
    fontSize: 12,
    color: renkler.soluk,
  },
});
