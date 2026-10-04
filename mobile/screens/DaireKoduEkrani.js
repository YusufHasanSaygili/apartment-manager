// Daire kodu ekranı: alttan açılan pencere (arkası %60 karartılmış daire listesi). Seçilen dairenin davet kodunu
// büyük puntoyla gösterir ve kodu WhatsApp, SMS vb. ile paylaşmayı sağlar.
// Dairede sakin varsa adı gösterilir ve yönetici "Sakini daireden çıkar" ile daireyi boşaltabilir
// (daire el değiştirdiğinde); o zaman daireye yeni davet kodu verilir ve burada hemen gösterilir.
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useOturum } from '../services/OturumContext';
import Buton from '../components/Buton';
import Ikon from '../components/Ikon';
import { kose, renkler, yaziTipi, yazilar } from '../tema';

// route.params: daire listesinden gönderilen daire kimliği, adı (örn. "A3"), davet kodu, dolu bilgisi ve sakinin adı.
export default function DaireKoduEkrani({ route, navigation }) {
  // yoneticiDairesi: dairede sitenin yöneticisi oturuyor (devirle yönetici olmuş); çıkarma butonu gösterilmez.
  const { daireId, daireAdi, sakinAdi, yoneticiDairesi } = route.params;
  // useState: davet kodu ve dolu bilgisi listeden gelen değerlerle başlar; sakin çıkarılınca yeni kod
  // gelir ve daire boş olur. State olduğu için ekran kendiliğinden yeni kodu gösterir.
  const [davetKodu, setDavetKodu] = useState(route.params.davetKodu);
  const [dolu, setDolu] = useState(route.params.dolu);
  // useState: çıkarma isteği sürerken true; buton dönen simge gösterir ve tekrar basılamaz.
  const [cikariliyor, setCikariliyor] = useState(false);
  // useOturum: giriş yapan kullanıcının oturum bilgisi; paylaşım mesajına site adını koymak için gerekir.
  const { oturum } = useOturum();
  // useSafeAreaInsets: alt gezinme çubuğunun yüksekliği; pencerenin butonları çubuğun arkasında kalmasın diye
  const { bottom: altBosluk } = useSafeAreaInsets();

  // Share: telefonun kendi paylaşım menüsünü açar (ek kütüphane gerekmez).
  // Sakine gidecek hazır mesajda site adı, daire ve kod bulunur.
  const paylas = async () => {
    try {
      await Share.share({
        message: `Apartmanım uygulamasında ${oturum.site.ad} sitesine katılmak için davet kodunuz: ${davetKodu} (Daire ${daireAdi})`,
      });
    } catch {
      Alert.alert('Paylaşılamadı', 'Paylaşım menüsü açılamadı. Lütfen tekrar deneyin.');
    }
  };

  // API isteği: POST /api/daireler/:id/sakini-cikar. Sakinin hesabı ve mesajları silinir
  // ve sunucu daireye yeni davet kodu verir; yeni kod ekranda gösterilir ve paylaşılabilir.
  const sakiniCikar = async () => {
    setCikariliyor(true);
    try {
      const { data } = await api.post(`/daireler/${daireId}/sakini-cikar`);
      setDavetKodu(data.davetKodu);
      setDolu(false);
    } catch (e) {
      Alert.alert('Sakin çıkarılamadı', e.message);
    } finally {
      setCikariliyor(false);
    }
  };

  // Çıkarma geri alınamaz; önce onay sorulur. "Çıkar" seçilirse sakiniCikar çalışır.
  // Metin, sakinin hesabının ve mesajlarının kalıcı silineceğini açıkça söyler; yönetici neyi onayladığını bilsin.
  const cikarOnayi = () =>
    Alert.alert(
      'Sakini daireden çıkar',
      `${sakinAdi ?? 'Sakin'} ${daireAdi} dairesinden çıkarılsın mı? Hesabı ve mesajları kalıcı olarak silinir, daireye yeni davet kodu verilir. Aidat geçmişi korunur.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Çıkar', style: 'destructive', onPress: sakiniCikar },
      ],
    );

  // Kodun altında görünen kısa durum: kullanıldıysa yeşil "Kullanıldı", değilse soluk "Henüz kullanılmadı"
  const kullanildi = dolu || yoneticiDairesi;

  return (
    <View style={styles.dis}>
      {/* Karartma: pencerenin arkasındaki listeyi karartır; boşluğa basınca pencere kapanır */}
      <Pressable
        style={[StyleSheet.absoluteFill, styles.karartma]}
        onPress={() => navigation.goBack()}
        // Ekran okuyucu bu alanı atlar: pencerede aynı işi yapan "Kapat" butonu zaten var
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <View style={[styles.kapsayici, { paddingBottom: 24 + altBosluk }]} accessibilityViewIsModal>
        {/* Tutamaç: alttan açılan pencere olduğunu gösteren küçük çizgi */}
        <View style={styles.tutamac} />
        {/* Üst: daire rozeti, daire adı ve dairede kimin oturduğu */}
        <View style={styles.ust}>
          <View style={styles.rozet}>
            <Text style={styles.rozetYazi}>{daireAdi}</Text>
          </View>
          <View>
            <Text style={styles.baslik}>Daire {daireAdi}</Text>
            <Text style={yazilar.aciklama}>
              {yoneticiDairesi
                ? 'Site yöneticisinin dairesi'
                : dolu
                  ? `Sakin: ${sakinAdi ?? 'kayıtlı bir sakin'}`
                  : 'Henüz sakin katılmadı'}
            </Text>
          </View>
        </View>

        {/* Kod kutusu: kesikli çerçeve içinde büyük, monospace kod. selectable: basılı tutarak kopyalanabilir. */}
        <View style={styles.kodKutu}>
          <Text style={yazilar.etiket}>DAVET KODU</Text>
          <Text style={styles.kod} selectable accessibilityLabel={`Davet kodu ${davetKodu.split('').join(' ')}`}>
            {davetKodu.slice(0, 3)} {davetKodu.slice(3)}
          </Text>
          <View style={styles.kodDurum}>
            <Ikon ad={kullanildi ? 'odedi' : 'once'} boyut={15} renk={kullanildi ? renkler.basarili : renkler.soluk} />
            <Text style={[styles.kodDurumYazi, kullanildi && { color: renkler.basarili }]}>
              {kullanildi ? 'Kullanıldı · tek kullanımlık' : 'Henüz kullanılmadı · tek kullanımlık'}
            </Text>
          </View>
        </View>

        {/* Üç durum: 1) dairede yönetici oturuyor → sadece bilgi (çıkarma butonu yok, backend de engeller);
          2) kod kullanılmış (dolu) → "Sakini daireden çıkar"; 3) boş → "Kodu paylaş".
          Kod tek kullanımlık: kullanıldıysa paylaşma butonu gösterilmez */}
        {yoneticiDairesi ? null : dolu ? (
          // "Sakini daireden çıkar" butonu: basınca cikarOnayi çalışır (önce onay sorulur), onaylanırsa
          // sakiniCikar ile sakin çıkarılır ve yeni davet kodu gösterilir
          <Buton
            baslik="Sakini daireden çıkar"
            ikon="sakinCikar"
            tur="tehlikeCerceve"
            yukleniyor={cikariliyor}
            onPress={cikarOnayi}
          />
        ) : (
          // "Kodu paylaş" butonu: basınca paylas çalışır ve telefonun paylaşım menüsü açılır
          <Buton baslik="Kodu paylaş" ikon="paylas" onPress={paylas} />
        )}
        {/* "Kapat" butonu: basınca pencere kapanır, daire listesine dönülür */}
        <Buton baslik="Kapat" tur="ikincil" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pencere ekranın altına yaslanır
  dis: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  karartma: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  kapsayici: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 12,
    backgroundColor: renkler.kart,
    borderTopWidth: 1,
    borderTopColor: renkler.kenarlikGuclu,
  },
  tutamac: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: renkler.kenarlikGuclu,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rozet: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: kose,
    backgroundColor: renkler.yuzey3,
  },
  rozetYazi: {
    fontFamily: yaziTipi.mono,
    fontSize: 18,
    fontWeight: '600',
    color: renkler.yazi,
  },
  baslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 20,
    fontWeight: '600',
    color: renkler.yazi,
  },
  kodKutu: {
    alignItems: 'center',
    gap: 4,
    padding: 14,
    borderRadius: kose,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: renkler.kenarlikGuclu,
    backgroundColor: renkler.arkaPlan,
  },
  kod: {
    fontFamily: yaziTipi.mono,
    fontSize: 38,
    fontWeight: '600',
    letterSpacing: 4,
    color: renkler.yazi,
  },
  kodDurum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kodDurumYazi: {
    fontFamily: yaziTipi.metin,
    fontSize: 12.5,
    color: renkler.soluk,
  },
});
