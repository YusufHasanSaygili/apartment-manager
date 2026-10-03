// Ortak seçim düğmesi: seçilebilen küçük kutu (devirde daire seçimi, tekrarlayan duyuruda gün seçimi gibi).
// Seçiliyse dolu renkli, değilse çerçeveli görünür. Tek component olduğu için görünümü buradan değişince
// bütün seçim düğmeleri birlikte değişir.
import { Pressable, StyleSheet, Text } from 'react-native';
import { renkler } from '../tema';

// yazi: düğmedeki metin, secili: seçili mi, onPress: basınca çalışacak fonksiyon.
// coklu: true ise birden fazla seçilebilen listede kullanılır (ekran okuyucuya "onay kutusu" olarak bildirilir);
// false ise listeden yalnız biri seçilir ("seçenek düğmesi" olarak bildirilir).
export default function SecimDugmesi({ yazi, secili, onPress, coklu = false }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.dugme, secili && styles.secili, pressed && styles.basili]}
      onPress={onPress}
      // accessibilityRole/State: ekran okuyucu düğmenin türünü ve seçili olup olmadığını söyler.
      accessibilityRole={coklu ? 'checkbox' : 'radio'}
      accessibilityState={coklu ? { checked: secili } : { selected: secili }}
    >
      <Text style={[styles.yazi, secili && styles.seciliYazi]}>{yazi}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dugme: {
    minWidth: 48,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    alignItems: 'center',
    backgroundColor: renkler.kart,
  },
  secili: {
    borderColor: renkler.birincil,
    backgroundColor: renkler.birincil,
  },
  basili: {
    opacity: 0.7,
  },
  yazi: {
    fontSize: 15,
    fontWeight: '600',
    color: renkler.yazi,
  },
  seciliYazi: {
    color: renkler.birincilUzeri,
  },
});
