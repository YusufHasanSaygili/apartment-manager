// Ortak hata mesajı component'i: bir işlem başarısız olunca kullanıcıya hatayı ve
// (istenirse) "Tekrar dene" butonunu gösterir. Tüm ekranlar aynı görünümü kullansın
// diye tek bir yerde tanımlandı.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, colors, fonts } from '../theme';
import Icon from './Icon';

// mesaj: gösterilecek hata metni.
// onRetry: verilirse "Tekrar dene" butonu çıkar ve basınca bu fonksiyon çalışır.
export default function ErrorMessage({ mesaj: message, onRetry }) {
  return (
    // accessibilityRole="alert": ekran okuyucu bu kutuyu uyarı olarak okur.
    <View style={styles.box} accessibilityRole="alert">
      {/* Uyarı üçgeni + mesaj aynı satırda; mesaj uzunsa alt satıra kayar */}
      <View style={styles.row}>
        <Icon ad="warning" size={20} color={colors.error} background={colors.errorBackground} />
        <Text style={styles.mesaj}>{message}</Text>
      </View>

      {/* "Tekrar dene" butonu: basınca ekranın gönderdiği onRetry fonksiyonu çalışır */}
      {onRetry && (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Tekrar dene</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: radius,
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mesaj: {
    flex: 1,
    fontFamily: fonts.metin,
    fontSize: 15,
    color: colors.error,
  },
  button: {
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: radius,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.errorFill,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: fonts.metin,
    fontSize: 15,
    fontWeight: '600',
  },
});
