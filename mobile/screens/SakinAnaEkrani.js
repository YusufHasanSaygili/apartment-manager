// Sakin ana ekranı: davet koduyla katılan sakin giriş yapınca bu ekranı görür.
// Şimdilik site ve daire bilgisini gösterir; aidat bildirimi, duyurular ve mesajlar ilerleyen görevlerde eklenecek.
import { StyleSheet, Text, View } from 'react-native';
import { useOturum } from '../services/OturumContext';
import CikisButonu from '../components/CikisButonu';
import { renkler } from '../tema';

export default function SakinAnaEkrani() {
  // Oturumdaki kullanıcı, site ve daire bilgisi (giriş/katılma sırasında sunucudan geldi).
  // App.js bu ekranı sadece rolü 'sakin' olan oturumlarda gösterir.
  const { oturum } = useOturum();

  return (
    <View style={styles.kapsayici}>
      <Text style={styles.selam}>Hoş geldin, {oturum.kullanici.ad}</Text>
      <Text style={styles.site}>{oturum.site.ad}</Text>

      <View style={styles.kart}>
        <Text style={styles.kartEtiket}>Daireniz</Text>
        {/* daire null olabilir (örn. sakin daireden çıkarıldıysa); o durumda çizgi gösterilir */}
        <Text style={styles.daire}>{oturum.daire?.ad ?? '—'}</Text>
      </View>

      {/* Çıkış butonu ekranın en altında; basınca onay sorulur */}
      <View style={styles.alt}>
        <CikisButonu />
      </View>
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
  kart: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: renkler.kart,
  },
  kartEtiket: {
    fontSize: 15,
    color: renkler.soluk,
  },
  daire: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: '700',
    color: renkler.birincil,
  },
  // marginTop: 'auto' → buton ekranın en altına itilir.
  alt: {
    marginTop: 'auto',
  },
});
