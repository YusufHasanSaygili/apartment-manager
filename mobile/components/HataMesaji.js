// Ortak hata mesajı component'i: bir işlem başarısız olunca kullanıcıya hatayı ve
// (istenirse) "Tekrar dene" butonunu gösterir. Tüm ekranlar aynı görünümü kullansın
// diye tek bir yerde tanımlandı.
import { Pressable, StyleSheet, Text, View } from 'react-native';

// mesaj: gösterilecek hata metni.
// tekrarDene: verilirse "Tekrar dene" butonu çıkar ve basınca bu fonksiyon çalışır.
export default function HataMesaji({ mesaj, tekrarDene }) {
  return (
    // accessibilityRole="alert": ekran okuyucu bu kutuyu uyarı olarak okur.
    <View style={styles.kutu} accessibilityRole="alert">
      <Text style={styles.mesaj}>{mesaj}</Text>

      {/* "Tekrar dene" butonu: basınca ekranın gönderdiği tekrarDene fonksiyonu çalışır */}
      {tekrarDene && (
        <Pressable
          style={({ pressed }) => [styles.buton, pressed && styles.butonBasili]}
          onPress={tekrarDene}
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
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  mesaj: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
  },
  buton: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
  },
  butonBasili: {
    opacity: 0.8,
  },
  butonYazi: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
