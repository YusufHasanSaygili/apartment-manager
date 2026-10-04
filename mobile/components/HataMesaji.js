// Ortak hata mesajı component'i: bir işlem başarısız olunca kullanıcıya hatayı ve
// (istenirse) "Tekrar dene" butonunu gösterir. Tüm ekranlar aynı görünümü kullansın
// diye tek bir yerde tanımlandı.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { kose, renkler, yaziTipi } from '../tema';
import Ikon from './Ikon';

// mesaj: gösterilecek hata metni.
// tekrarDene: verilirse "Tekrar dene" butonu çıkar ve basınca bu fonksiyon çalışır.
export default function HataMesaji({ mesaj, tekrarDene }) {
  return (
    // accessibilityRole="alert": ekran okuyucu bu kutuyu uyarı olarak okur.
    <View style={styles.kutu} accessibilityRole="alert">
      {/* Uyarı üçgeni + mesaj aynı satırda; mesaj uzunsa alt satıra kayar */}
      <View style={styles.satir}>
        <Ikon ad="uyari" boyut={20} renk={renkler.hata} arka={renkler.hataZemin} />
        <Text style={styles.mesaj}>{mesaj}</Text>
      </View>

      {/* "Tekrar dene" butonu: basınca ekranın gönderdiği tekrarDene fonksiyonu çalışır */}
      {tekrarDene && (
        <Pressable
          style={({ pressed }) => [styles.buton, pressed && styles.butonBasili]}
          onPress={tekrarDene}
          accessibilityRole="button"
        >
          <Text style={styles.butonYazi}>Tekrar dene</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: {
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: kose,
    backgroundColor: renkler.hataZemin,
    borderWidth: 1,
    borderColor: renkler.hataCizgi,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mesaj: {
    flex: 1,
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    color: renkler.hata,
  },
  buton: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: kose,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: renkler.hataDolgu,
  },
  butonBasili: {
    opacity: 0.8,
  },
  butonYazi: {
    color: '#FFFFFF',
    fontFamily: yaziTipi.metin,
    fontSize: 15,
    fontWeight: '600',
  },
});
