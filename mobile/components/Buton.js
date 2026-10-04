// Ortak buton component'i: uygulamadaki tüm butonlar aynı görünüm ve davranışta olsun diye.
// Dört türü var: 'birincil' (altın, ana işlem), 'ikincil' (koyu dolgu, diğer seçenekler),
// 'tehlike' (kırmızı dolgu, geri alınamaz işlem) ve 'tehlikeCerceve' (koyu kırmızı zemin, daha hafif uyarı).
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { kose, renkler, yaziTipi } from '../tema';
import Ikon from './Ikon';

// Her türün zemin rengi, yazı rengi ve (varsa) çerçeve rengi. Tek tabloda durduğu için yeni tür eklemek kolay.
const TURLER = {
  birincil: { zemin: renkler.birincil, yazi: renkler.birincilUzeri },
  ikincil: { zemin: renkler.yuzey2, yazi: renkler.yazi },
  tehlike: { zemin: renkler.hataDolgu, yazi: '#FFFFFF' }, // ikonla aynı kırmızı ailesi, beyaz yazı okunaklı
  tehlikeCerceve: { zemin: renkler.hataZemin, yazi: renkler.hata, cerceve: renkler.hataCizgi },
};

// baslik: buton yazısı, altYazi: (isteğe bağlı) başlığın altındaki küçük açıklama,
// ikon: (isteğe bağlı) yazının solundaki ikonun adı (components/Ikon.js), onPress: basınca çalışacak fonksiyon,
// yukleniyor: true ise yazı yerine dönen simge çıkar ve buton tekrar basılamaz
// (aynı formun iki kez gönderilmesini önler).
export default function Buton({ baslik, altYazi, ikon, onPress, tur = 'birincil', yukleniyor = false }) {
  // Seçilen türün renklerini tablodan alır; aşağıda zemin, yazı ve ikon bu renklerle boyanır.
  const renk = TURLER[tur];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.buton,
        { backgroundColor: renk.zemin },
        renk.cerceve && { borderWidth: 1, borderColor: renk.cerceve },
        (pressed || yukleniyor) && styles.basili,
      ]}
      // Basınca ekranın gönderdiği onPress fonksiyonu çalışır (örn. giriş yap, aidat bildir).
      // Yükleniyorken disabled olduğu için ikinci basış hiçbir şey yapmaz.
      onPress={onPress}
      disabled={yukleniyor}
      // Ekran okuyucu için: bunun bir buton olduğunu ve meşgulken beklemesi gerektiğini bildirir.
      accessibilityRole="button"
      accessibilityState={{ busy: yukleniyor }}
    >
      {yukleniyor ? (
        <ActivityIndicator color={renk.yazi} />
      ) : (
        <View style={styles.satir}>
          {/* İkon verilmişse yazının solunda, yazıyla aynı renkte çizilir */}
          {ikon ? <Ikon ad={ikon} boyut={20} renk={renk.yazi} arka={renk.zemin} /> : null}
          <View style={styles.yazilar}>
            <Text style={[styles.yazi, { color: renk.yazi }]}>{baslik}</Text>
            {/* altYazi verilmişse başlığın altında küçük puntoyla gösterilir.
                "altYazi && ..." yerine üçlü (? :) kullanılır: altYazi boş metin ("") olursa && onu ekrana yazmaya
                çalışır ve React Native, Text dışındaki metin yüzünden çöker. ? : ise boşta null döner. */}
            {altYazi ? <Text style={[styles.altYazi, { color: renk.yazi }]}>{altYazi}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // minHeight 54: parmakla rahat basılabilecek boyut (en az 44 önerilir).
  buton: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: kose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yazilar: {
    alignItems: 'center',
  },
  basili: {
    opacity: 0.75,
  },
  yazi: {
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    fontWeight: '600',
  },
  altYazi: {
    marginTop: 2,
    fontFamily: yaziTipi.metin,
    fontSize: 12,
    opacity: 0.75,
  },
});
