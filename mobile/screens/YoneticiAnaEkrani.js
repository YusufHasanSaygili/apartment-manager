// Yönetici ana ekranı: yönetici giriş yapınca açılan ekran.
// Şimdilik sadece karşılama ve site adı var; daire, aidat ve duyuru bölümleri ilerleyen görevlerde eklenecek.
import { StyleSheet, Text, View } from 'react-native';
import { useOturum } from '../services/OturumContext';
import { renkler } from '../tema';

export default function YoneticiAnaEkrani() {
  // Oturumdaki kullanıcı ve site bilgisi (site oluşturulurken sunucudan geldi).
  // oturum burada asla null değildir: App.js bu ekranı sadece oturum açıkken gösterir.
  const { oturum } = useOturum();

  return (
    <View style={styles.kapsayici}>
      <Text style={styles.selam}>Hoş geldin, {oturum.kullanici.ad}</Text>
      <Text style={styles.site}>{oturum.site.ad}</Text>
      <Text style={styles.bilgi}>Site yöneticisi olarak giriş yaptın.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kapsayici: {
    flex: 1,
    padding: 24,
    backgroundColor: renkler.arkaPlan,
  },
  selam: {
    fontSize: 16,
    color: renkler.soluk,
  },
  site: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '700',
    color: renkler.yazi,
  },
  bilgi: {
    marginTop: 16,
    fontSize: 15,
    color: renkler.soluk,
  },
});
