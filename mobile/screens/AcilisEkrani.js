// Açılış ekranı: giriş yapmamış kullanıcının ilk gördüğü ekran.
// Üstte uygulamanın logosu ve adı, altta 3 seçenek: giriş yap, yeni site oluştur, davet koduyla katıl.
// (Yöneticilik, uygulama içinden bir sakine devredilir; devralan kişi kendi hesabıyla giriş yapar.)
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Buton from '../components/Buton';
import { renkler, yaziTipi } from '../tema';

// navigation: React Navigation'ın her ekrana verdiği nesne; başka ekrana geçmek için kullanılır.
export default function AcilisEkrani({ navigation }) {
  return (
    // SafeAreaView: içeriğin telefonun çentiği ve alt çubuğu altında kalmasını önler.
    <SafeAreaView style={styles.kapsayici}>
      <View style={styles.ust}>
        {/* Image: logo resmi (assets/logo.png). require ile verilen resim uygulamanın içine paketlenir,
            internet olmadan da görünür. Logo süs olduğu için ekran okuyucudan gizlenir; adı hemen altında yazıyor. */}
        <Image source={require('../assets/logo.png')} style={styles.logo} accessible={false} />
        <Text style={styles.baslik}>Apartmanım</Text>
        <Text style={styles.altBaslik}>Aidat, duyuru ve mesajlar tek yerde.</Text>
      </View>

      <View style={styles.butonlar}>
        {/* "Giriş yap" butonu: hesabı olanlar için; basınca Giris ekranına geçilir */}
        <Buton baslik="Giriş yap" onPress={() => navigation.navigate('Giris')} />

        {/* "Yeni site/apartman oluştur" butonu: basınca SiteOlustur ekranına geçilir */}
        <Buton
          baslik="Yeni site/apartman oluştur"
          altYazi="(Yönetici hesabı ile başlar)"
          tur="ikincil"
          onPress={() => navigation.navigate('SiteOlustur')}
        />

        {/* "Davet koduyla katıl" butonu: sakinler için; basınca DavetKatil ekranına geçilir */}
        <Buton baslik="Davet koduyla katıl" tur="ikincil" onPress={() => navigation.navigate('DavetKatil')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  kapsayici: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    backgroundColor: renkler.arkaPlan,
  },
  ust: {
    flex: 1,
    justifyContent: 'center',
  },
  // Logo kare resim; genişlik ve yükseklik verilerek dosyanın kendi boyutu yerine ekranda 92x92 gösterilir.
  logo: {
    width: 92,
    height: 92,
    marginBottom: 14,
  },
  // Uygulama adı: büyük, kalın ve altın; harfler biraz sıkı (letterSpacing eksi).
  baslik: {
    fontFamily: yaziTipi.metin,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: renkler.birincil,
  },
  altBaslik: {
    marginTop: 6,
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    lineHeight: 23,
    color: renkler.soluk,
  },
  // gap: butonlar arasında eşit boşluk bırakır.
  butonlar: {
    gap: 10,
    paddingBottom: 24,
  },
});
