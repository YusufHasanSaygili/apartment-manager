// Ortak buton component'i: uygulamadaki tüm butonlar aynı görünüm ve davranışta olsun diye.
// İki türü var: 'birincil' (dolu, ana işlem) ve 'ikincil' (çerçeveli, diğer seçenekler).
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { renkler } from '../tema';

// baslik: buton yazısı, altYazi: (isteğe bağlı) başlığın altındaki küçük açıklama,
// onPress: basınca çalışacak fonksiyon,
// yukleniyor: true ise yazı yerine dönen simge çıkar ve buton tekrar basılamaz
// (aynı formun iki kez gönderilmesini önler).
export default function Buton({ baslik, altYazi, onPress, tur = 'birincil', yukleniyor = false }) {
  const birincil = tur === 'birincil';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.buton,
        birincil ? styles.birincil : styles.ikincil,
        (pressed || yukleniyor) && styles.basili,
      ]}
      onPress={onPress}
      disabled={yukleniyor}
      // Ekran okuyucu için: bunun bir buton olduğunu ve meşgulken beklemesi gerektiğini bildirir.
      accessibilityRole="button"
      accessibilityState={{ busy: yukleniyor }}
    >
      {yukleniyor ? (
        <ActivityIndicator color={birincil ? renkler.birincilUzeri : renkler.birincil} />
      ) : (
        <>
          <Text style={[styles.yazi, birincil ? styles.birincilYazi : styles.ikincilYazi]}>{baslik}</Text>
          {/* altYazi verilmişse başlığın altında küçük puntoyla gösterilir */}
          {altYazi && (
            <Text style={[styles.altYazi, birincil ? styles.birincilYazi : styles.ikincilYazi]}>{altYazi}</Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // minHeight 52: parmakla rahat basılabilecek boyut (en az 44 önerilir).
  buton: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birincil: {
    backgroundColor: renkler.birincil,
  },
  ikincil: {
    backgroundColor: renkler.kart,
    borderWidth: 1.5,
    borderColor: renkler.birincil,
  },
  basili: {
    opacity: 0.75,
  },
  yazi: {
    fontSize: 16,
    fontWeight: '600',
  },
  altYazi: {
    marginTop: 2,
    fontSize: 13,
    opacity: 0.85,
  },
  birincilYazi: {
    color: renkler.birincilUzeri,
  },
  ikincilYazi: {
    color: renkler.birincil,
  },
});
