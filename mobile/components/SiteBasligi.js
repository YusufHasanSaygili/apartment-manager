// Ana ekranların en üstündeki başlık: "Hoş geldin, Ad" ve büyük site adı; site adının bittiği yerde, sağında
// uygulamanın logosu. Yönetici ve sakin ana ekranı aynı başlığı kullanır.
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { kose, renkler, yaziTipi } from '../tema';

// selam: üstteki küçük yazı ("Hoş geldin, Zeynep Kaya"), ad: sitenin adı
export default function SiteBasligi({ selam, ad }) {
  return (
    <View style={styles.baslik}>
      <Text style={styles.selam}>{selam}</Text>
      {/* ImageBackground: içine başka bileşen konabilen resim. Image'dan farkı, yazının resimle aynı kutuda
          durabilmesidir. style: site adının kutusu; imageStyle: sadece resmin kendisi. Kutu, yazının genişliği kadar
          olur (alignSelf: 'flex-start'); resim imageStyle ile kutunun sağ ucuna küçük bir kare olarak yerleştirilir,
          yazı da paddingRight sayesinde resmin üstüne binmez. Böylece logo her zaman adın bittiği yerde görünür.
          accessible={false}: logo süs olduğu için ekran okuyucu onu atlar, sadece site adını okur. */}
      <ImageBackground
        source={require('../assets/logo.png')}
        style={styles.adKutusu}
        imageStyle={styles.logo}
        resizeMode="contain"
        accessible={false}
      >
        <Text style={styles.ad}>{ad}</Text>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  baslik: {
    gap: 2,
  },
  // Site adının kutusu: yazı kadar geniş, sağda logo için 50 birim boşluk
  adKutusu: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 40,
    paddingRight: 50,
  },
  // Logo: kutunun sağ ucunda, dikeyde ortalı 40x40 köşeli kare (koyu kart zemini, diğer kutularla aynı çerçeve).
  // left: undefined → ImageBackground'ın resme verdiği "soldan 0" konumu kaldırılır, resim sağa (right: 0) yaslanır.
  logo: {
    left: undefined,
    right: 0,
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
  },
  selam: {
    fontFamily: yaziTipi.metin,
    fontSize: 14,
    color: renkler.soluk,
  },
  ad: {
    fontFamily: yaziTipi.metin,
    fontSize: 31,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: renkler.yazi,
  },
});
