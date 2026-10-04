// Hesap kartı: ana ekranların en altında kişi bilgisi (baş harfler, ad, e-posta, rol) ve iki satır:
// "Çıkış yap" ve "Hesabımı sil". Ayar listesi gibi tek kartta durur; ikisi de yanlışlıkla basılmasın diye
// ana işlemlerden ayrı, en altta.
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useOturum } from '../services/OturumContext';
import { karistir, kose, renkler, yaziTipi } from '../tema';
import Ikon from './Ikon';

// navigation: "Hesabımı sil" satırıyla HesapSil ekranını açmak için. rol: kartta görünen rol etiketi.
export default function HesapKarti({ navigation, rol }) {
  // oturum: kullanıcının adı ve e-postası; cikisYap: token'ı silip açılış ekranına döner.
  const { oturum, cikisYap } = useOturum();
  const { ad, eposta } = oturum.kullanici;
  // Baş harfler: "Ayşe Yılmaz" → "AY"
  const basHarfler = ad.split(' ').filter(Boolean).map((k) => k[0]).join('').slice(0, 2).toLocaleUpperCase('tr-TR');

  // "Çıkış yap" satırı: önce onay sorulur; "Çıkış yap" seçilirse cikisYap çalışır.
  const cikisOnayi = () =>
    Alert.alert('Çıkış yap', 'Hesabınızdan çıkmak istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: cikisYap },
    ]);

  return (
    <View style={styles.kart}>
      <View style={styles.ust}>
        <View style={styles.avatar}>
          <Text style={styles.avatarYazi}>{basHarfler}</Text>
        </View>
        <View style={styles.kim}>
          <Text style={styles.ad} numberOfLines={1}>{ad}</Text>
          <Text style={styles.eposta} numberOfLines={1}>{eposta}</Text>
        </View>
        <View style={styles.rol}>
          <Text style={styles.rolYazi}>{rol.toLocaleUpperCase('tr-TR')}</Text>
        </View>
      </View>

      {/* "Çıkış yap" satırı: basınca cikisOnayi çalışır */}
      <Pressable style={({ pressed }) => [styles.satir, pressed && styles.basili]} onPress={cikisOnayi} accessibilityRole="button">
        <Ikon ad="cikis" boyut={20} renk={renkler.soluk} />
        <Text style={styles.satirYazi}>Çıkış yap</Text>
        <Feather name="chevron-right" size={18} color={renkler.sonuk} />
      </Pressable>

      {/* "Hesabımı sil" satırı: basınca HesapSil ekranı açılır (orada şifre ve onay istenir) */}
      <Pressable
        style={({ pressed }) => [styles.satir, pressed && styles.basili]}
        onPress={() => navigation.navigate('HesapSil')}
        accessibilityRole="button"
      >
        <Ikon ad="hesapSil" boyut={20} renk={renkler.hata} />
        <View style={styles.satirMetin}>
          <Text style={[styles.satirYazi, { color: renkler.hata }]}>Hesabımı sil</Text>
          <Text style={styles.satirAlt}>Kalıcıdır, geri alınamaz</Text>
        </View>
        <Feather name="chevron-right" size={18} color={renkler.sonuk} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
    overflow: 'hidden',
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: kose,
    backgroundColor: karistir(renkler.birincil, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarYazi: {
    fontFamily: yaziTipi.metin,
    fontWeight: '700',
    fontSize: 14,
    color: renkler.birincil,
  },
  kim: {
    flex: 1,
  },
  ad: {
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
    color: renkler.yazi,
  },
  eposta: {
    fontFamily: yaziTipi.mono,
    fontSize: 12,
    color: renkler.soluk,
  },
  rol: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: kose,
    backgroundColor: renkler.zumrutZemin,
  },
  rolYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: renkler.zumrut,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: renkler.kenarlik,
  },
  basili: {
    backgroundColor: renkler.yuzey2,
  },
  satirMetin: {
    flex: 1,
  },
  satirYazi: {
    flex: 1,
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
    color: renkler.yazi,
  },
  satirAlt: {
    fontFamily: yaziTipi.metin,
    fontSize: 12,
    color: renkler.soluk,
  },
});
