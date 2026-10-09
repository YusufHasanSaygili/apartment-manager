// Açılış ekranı: giriş yapmamış kullanıcının ilk gördüğü ekran.
// Üstte uygulamanın logosu ve adı, altta 3 seçenek: giriş yap, yeni site oluştur, davet koduyla katıl.
// (Yöneticilik, uygulama içinden bir sakine devredilir; devralan kişi kendi hesabıyla giriş yapar.)
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import { colors, fonts } from '../theme';

// navigation: React Navigation'ın her ekrana verdiği nesne; başka ekrana geçmek için kullanılır.
export default function WelcomeScreen({ navigation }) {
  return (
    // SafeAreaView: içeriğin telefonun çentiği ve alt çubuğu altında kalmasını önler.
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.header}>
        {/* Image: logo resmi (assets/logo.png). require ile verilen resim uygulamanın içine paketlenir,
            internet olmadan da görünür. Logo süs olduğu için ekran okuyucudan gizlenir; adı hemen altında yazıyor. */}
        <Image source={require('../assets/logo.png')} style={styles.logo} accessible={false} />
        <Text style={styles.baslik}>Apartmanım</Text>
        <Text style={styles.altBaslik}>Aidat, duyuru ve mesajlar tek yerde.</Text>
      </View>

      <View style={styles.buttons}>
        {/* "Giriş yap" butonu: hesabı olanlar için; basınca Login ekranına geçilir */}
        <Button baslik="Giriş yap" onPress={() => navigation.navigate('Login')} />

        {/* "Yeni site/apartman oluştur" butonu: basınca CreateSite ekranına geçilir */}
        <Button
          baslik="Yeni site/apartman oluştur"
          subtitle="(Yönetici hesabı ile başlar)"
          variant="secondary"
          onPress={() => navigation.navigate('CreateSite')}
        />

        {/* "Davet koduyla katıl" butonu: sakinler için; basınca JoinWithCode ekranına geçilir */}
        <Button baslik="Davet koduyla katıl" variant="secondary" onPress={() => navigation.navigate('JoinWithCode')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    backgroundColor: colors.background,
  },
  header: {
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
    fontFamily: fonts.metin,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1.2,
    color: colors.primary,
  },
  altBaslik: {
    marginTop: 6,
    fontFamily: fonts.metin,
    fontSize: 16,
    lineHeight: 23,
    color: colors.muted,
  },
  // gap: butonlar arasında eşit boşluk bırakır.
  buttons: {
    gap: 10,
    paddingBottom: 24,
  },
});
