// Açılış ekranı: giriş yapmamış kullanıcının ilk gördüğü ekran.
// 3 seçenek sunar: giriş yap, yeni site oluştur, davet koduyla katıl.
// (Yöneticilik, uygulama içinden bir sakine devredilir; devralan kişi kendi hesabıyla giriş yapar.)
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Buton from '../components/Buton';
import { renkler } from '../tema';

// navigation: React Navigation'ın her ekrana verdiği nesne; başka ekrana geçmek için kullanılır.
export default function AcilisEkrani({ navigation }) {
  return (
    // SafeAreaView: içeriğin telefonun çentiği ve alt çubuğu altında kalmasını önler.
    <SafeAreaView style={styles.kapsayici}>
      <View style={styles.ust}>
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
  baslik: {
    fontSize: 34,
    fontWeight: '700',
    color: renkler.yazi,
  },
  altBaslik: {
    marginTop: 8,
    fontSize: 17,
    lineHeight: 24,
    color: renkler.soluk,
  },
  // gap: butonlar arasında eşit boşluk bırakır.
  butonlar: {
    gap: 12,
    paddingBottom: 24,
  },
});
