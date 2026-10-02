// Yönetici ana ekranı: yönetici giriş yapınca açılan ekran.
// Site adını, bina/daire kurulumunun durumunu ve aylık aidat tutarını gösterir; kurulum
// yapılmadıysa kurulum ekranına yönlendirir. Onay bekleyen aidat bildirimlerinin sayısını gösterir ve
// bildirimler ekranına geçirir. Duyurular ilerleyen görevlerde eklenecek.
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import CikisButonu from '../components/CikisButonu';
import { paraBicimi } from '../bicim';
import { renkler } from '../tema';

// navigation: kurulum, daire listesi, bekleyen bildirimler, daire haritası ve aidat tutarı ekranlarına geçmek için kullanılır.
export default function YoneticiAnaEkrani({ navigation }) {
  // Oturumdaki kullanıcı ve site bilgisi (giriş/kayıt sırasında sunucudan geldi).
  // oturum burada asla null değildir: App.js bu ekranı sadece oturum açıkken gösterir.
  const { oturum } = useOturum();

  // useState: site özeti ({ binaSayisi, daireSayisi, aidatTutari, bekleyenSayisi }).
  // null → henüz yüklenmedi. binaSayisi 0 ise kurulum yapılmamış demektir.
  const [ozet, setOzet] = useState(null);

  // useState: özet yüklenemezse gösterilecek hata mesajı.
  const [hata, setHata] = useState('');

  // API isteği: GET /api/kurulum ile bina/daire sayısını, aidat tutarını ve bekleyen bildirim sayısını çeker.
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
  // Kurulum, bildirimler veya aidat tutarı ekranından geri dönülünce özet kendiliğinden güncellenir.
  useFocusEffect(
    useCallback(() => {
      ozetiYukle();
    }, [ozetiYukle])
  );

  return (
    // ScrollView: kartlar küçük ekranlara sığmazsa sayfa kaydırılabilir.
    <ScrollView style={styles.dis} contentContainerStyle={styles.kapsayici}>
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
            {/* "Daireler ve davet kodları" butonu: basınca DaireListesi ekranına geçilir */}
            <Buton baslik="Daireler ve davet kodları" onPress={() => navigation.navigate('DaireListesi')} />
          </>
        )}
      </View>

      {/* "Bekleyen bildirimler" butonu: basınca BekleyenBildirimler ekranı açılır; parantezdeki sayı
          onay bekleyen bildirim adedidir (ekran her öne geldiğinde güncellenir) */}
      {ozet !== null && ozet.binaSayisi > 0 && (
        <View style={styles.bekleyen}>
          <Buton
            baslik={`Bekleyen bildirimler (${ozet.bekleyenSayisi})`}
            onPress={() => navigation.navigate('BekleyenBildirimler')}
          />
          {/* "Daire haritası" butonu: basınca DaireHaritasi ekranı açılır (aylık renkli aidat durumu) */}
          <Buton baslik="Daire haritası" tur="ikincil" onPress={() => navigation.navigate('DaireHaritasi')} />
        </View>
      )}

      {/* Aidat tutarı kartı: özet yüklendiyse gösterilir */}
      {ozet !== null && (
        <View style={styles.kart}>
          <Text style={styles.kartYazi}>Aylık aidat tutarı</Text>
          <Text style={styles.kartBaslik}>
            {ozet.aidatTutari == null ? 'Belirlenmedi' : paraBicimi(ozet.aidatTutari)}
          </Text>
          {/* "Aidat tutarını belirle/değiştir" butonu: basınca AidatTutari ekranı açılır, mevcut tutar da gönderilir */}
          <Buton
            baslik={ozet.aidatTutari == null ? 'Aidat tutarını belirle' : 'Aidat tutarını değiştir'}
            tur="ikincil"
            onPress={() => navigation.navigate('AidatTutari', { aidatTutari: ozet.aidatTutari })}
          />
        </View>
      )}

      {/* Çıkış butonu ekranın en altında; basınca onay sorulur (ortak CikisButonu component'i) */}
      <View style={styles.alt}>
        <CikisButonu />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dis: {
    flex: 1,
    backgroundColor: renkler.arkaPlan,
  },
  // flexGrow: 1 → içerik kısaysa da ekranı doldurur, çıkış butonu en alta itilebilir.
  kapsayici: {
    flexGrow: 1,
    padding: 24,
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
  bekleyen: {
    marginTop: 16,
    gap: 12,
  },
  // marginTop: 'auto' → buton ekranın en altına itilir.
  alt: {
    marginTop: 'auto',
    paddingTop: 24,
  },
});
