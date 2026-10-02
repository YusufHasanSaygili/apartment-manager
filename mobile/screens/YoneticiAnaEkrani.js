// Yönetici ana ekranı: yönetici giriş yapınca açılan ekran.
// Site adını ve bina/daire kurulumunun durumunu gösterir; kurulum yapılmadıysa kurulum ekranına yönlendirir.
// Aidat ve duyuru bölümleri ilerleyen görevlerde eklenecek.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import { renkler } from '../tema';

// navigation: kurulum ekranına geçmek için kullanılır.
export default function YoneticiAnaEkrani({ navigation }) {
  // Oturumdaki kullanıcı ve site bilgisi (giriş/kayıt sırasında sunucudan geldi).
  // oturum burada asla null değildir: App.js bu ekranı sadece oturum açıkken gösterir.
  const { oturum, cikisYap } = useOturum();

  // useState: sitenin bina ve daire sayısı ({ binaSayisi, daireSayisi }).
  // null → henüz yüklenmedi. binaSayisi 0 ise kurulum yapılmamış demektir.
  const [ozet, setOzet] = useState(null);

  // useState: özet yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // API isteği: GET /api/kurulum ile sitenin bina/daire sayısını çeker.
  const ozetiYukle = useCallback(async () => {
    setHata('');
    try {
      const { data } = await api.get('/kurulum');
      setOzet(data);
    } catch (e) {
      setHata(e.message);
    }
  }, []);

  // useFocusEffect: ekran her ÖNE GELDİĞİNDE çalışır (useEffect'ten farkı bu).
  // Kurulum ekranından geri dönülünce özet kendiliğinden güncellenir.
  useFocusEffect(
    useCallback(() => {
      ozetiYukle();
    }, [ozetiYukle])
  );

  // Yanlışlıkla basılmasın diye önce onay sorulur; "Çıkış yap" seçilirse cikisYap çalışır.
  const cikisOnayi = () =>
    Alert.alert('Çıkış yap', 'Hesabınızdan çıkmak istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: cikisYap },
    ]);

  return (
    <View style={styles.kapsayici}>
      <Text style={styles.selam}>Hoş geldin, {oturum.kullanici.ad}</Text>
      <Text style={styles.site}>{oturum.site.ad}</Text>

      <View style={styles.kart}>
        {/* Özet yüklenene kadar yükleniyor simgesi; hata olursa "Tekrar dene" ile ozetiYukle yeniden çalışır */}
        {hata !== '' ? (
          <HataMesaji mesaj={hata} tekrarDene={ozetiYukle} />
        ) : ozet === null ? (
          <ActivityIndicator color={renkler.birincil} />
        ) : ozet.binaSayisi === 0 ? (
          <>
            <Text style={styles.kartBaslik}>Kurulum yapılmadı</Text>
            <Text style={styles.kartYazi}>
              Sakinlerin katılabilmesi için önce binaları ve daireleri oluşturun.
            </Text>
            {/* "Bina ve daire kurulumu" butonu: basınca Kurulum ekranına geçilir */}
            <Buton baslik="Bina ve daire kurulumu" onPress={() => navigation.navigate('Kurulum')} />
          </>
        ) : (
          <>
            <Text style={styles.kartBaslik}>
              {ozet.binaSayisi} bina, {ozet.daireSayisi} daire
            </Text>
            <Text style={styles.kartYazi}>Kurulum tamamlandı.</Text>
          </>
        )}
      </View>

      {/* "Çıkış yap" butonu: basınca cikisOnayi çalışır, onaylanırsa açılış ekranına dönülür */}
      <View style={styles.alt}>
        <Buton baslik="Çıkış yap" tur="ikincil" onPress={cikisOnayi} />
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
    gap: 12,
    borderRadius: 16,
    backgroundColor: renkler.kart,
  },
  kartBaslik: {
    fontSize: 18,
    fontWeight: '700',
    color: renkler.yazi,
  },
  kartYazi: {
    fontSize: 15,
    lineHeight: 22,
    color: renkler.soluk,
  },
  // marginTop: 'auto' → buton ekranın en altına itilir.
  alt: {
    marginTop: 'auto',
  },
});
