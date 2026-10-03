// Yönetici ana ekranı: yönetici giriş yapınca açılan ekran.
// Site adını, bina/daire kurulumunun durumunu ve aylık aidat tutarını gösterir; kurulum
// yapılmadıysa kurulum ekranına yönlendirir. Onay bekleyen aidat bildirimlerinin sayısını gösterir ve
// bildirimler ekranına geçirir. Daire haritası, Duyurular ve Mesajlar ekranlarına da buradan geçilir.
// "Aidat hatırlatması gönder" butonuyla bu ayı ödemeyen sakinlere hemen hatırlatma bildirimi gönderilir.
// "Yöneticiliği devret" butonuyla yöneticilik bir sakine devredilir.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import HataMesaji from '../components/HataMesaji';
import CikisButonu from '../components/CikisButonu';
import { AY_ADLARI, paraBicimi } from '../bicim';
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

  // useState: hatırlatma isteği sürerken true; buton dönen simge gösterir ve tekrar basılamaz.
  const [hatirlatiliyor, setHatirlatiliyor] = useState(false);

  // API isteği: POST /api/yonetim/aidatlar/hatirlatma ile bu ayın aidatını ödemeyen sakinlere hatırlatma gönderir.
  // Sonuçta kaç daireye gönderildiği, bildirimi kapalı sakin varsa o da yöneticiye gösterilir.
  const hatirlatmaGonder = async () => {
    setHatirlatiliyor(true);
    try {
      const { data } = await api.post('/yonetim/aidatlar/hatirlatma');
      const kapali = data.odemeyen - data.bildirimGiden;
      Alert.alert(
        'Hatırlatma gönderildi',
        data.odemeyen === 0
          ? 'Bu ay ödemeyen daire yok, kimseye hatırlatma gönderilmedi.'
          : `${data.bildirimGiden} daireye hatırlatma gönderildi.` +
              (kapali > 0 ? ` ${kapali} sakinin bildirimleri kapalı olduğu için ulaşılamadı.` : '')
      );
    } catch (e) {
      Alert.alert('Hatırlatma gönderilemedi', e.message);
    } finally {
      setHatirlatiliyor(false);
    }
  };

  // Hatırlatma tüm ödemeyenlerin telefonuna gider; yanlışlıkla basılmasın diye önce onay sorulur.
  // AY_ADLARI 0'dan başlayan bir dizi (Ocak = 0), getMonth() de 0'dan başladığı için doğrudan bu ayın adını verir.
  // "Gönder" seçilirse hatirlatmaGonder çalışır; "Vazgeç" (cancel) pencereyi kapatır, istek atılmaz.
  const hatirlatmaOnayi = () =>
    Alert.alert(
      'Aidat hatırlatması',
      `${AY_ADLARI[new Date().getMonth()]} ayının aidatını ödemeyen tüm sakinlere hatırlatma bildirimi gönderilsin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Gönder', onPress: hatirlatmaGonder },
      ]
    );

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
          {/* "Duyurular" butonu: basınca Duyurular ekranı açılır (duyuru yazma ve silme oradan) */}
          <Buton baslik="Duyurular" tur="ikincil" onPress={() => navigation.navigate('Duyurular')} />
          {/* "Mesajlar" butonu: basınca Sohbetler ekranı açılır (sakinlerin listesi, son mesajlarla) */}
          <Buton baslik="Mesajlar" tur="ikincil" onPress={() => navigation.navigate('Sohbetler')} />
          {/* "Aidat hatırlatması gönder" butonu: basınca önce onay sorulur (hatirlatmaOnayi), "Gönder" denirse
              hatirlatmaGonder çalışır. Otomatik hatırlatma zaten her ayın 10'unda gider; bu buton beklemeden göndermek içindir. */}
          <Buton
            baslik="Aidat hatırlatması gönder"
            altYazi="Otomatik olarak her ayın 10'unda da gönderilir"
            tur="ikincil"
            yukleniyor={hatirlatiliyor}
            onPress={hatirlatmaOnayi}
          />
          {/* "Yöneticiliği devret" butonu: basınca Devir ekranı açılır; yönetici bir sakini yeni yönetici yapar */}
          <Buton baslik="Yöneticiliği devret" tur="ikincil" onPress={() => navigation.navigate('Devir')} />
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
        {/* "Hesabımı sil" bağlantısı: basınca HesapSil ekranı açılır (geri alınamaz işlem; orada şifre ve onay istenir).
            Kırmızı ve küçük yazı: ana işlem olmadığı, yanlışlıkla basılmaması için göze batmayan bir bağlantı. */}
        <Pressable style={styles.hesapSil} onPress={() => navigation.navigate('HesapSil')} hitSlop={8} accessibilityRole="button">
          <Text style={styles.hesapSilYazi}>Hesabımı sil</Text>
        </Pressable>
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
  // "Hesabımı sil" bağlantısı: çıkış butonunun altında, ortada; kırmızı yazı tehlikeli bir işlem olduğunu belli eder.
  hesapSil: {
    alignSelf: 'center',
    marginTop: 16,
  },
  hesapSilYazi: {
    fontSize: 14,
    fontWeight: '600',
    color: renkler.hata,
  },
});
