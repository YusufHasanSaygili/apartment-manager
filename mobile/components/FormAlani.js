// Ortak form alanı: üstte görünür bir etiket + altında yazı kutusu (TextInput).
// Etiket kutunun dışında durduğu için kullanıcı yazmaya başlayınca alanın ne olduğu kaybolmaz.
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { renkler } from '../tema';

// etiket: alanın adı. Geri kalan tüm özellikler (value, onChangeText, secureTextEntry,
// keyboardType...) olduğu gibi TextInput'a aktarılır (...digerleri).
export default function FormAlani({ etiket, ...digerleri }) {
  return (
    <View style={styles.kapsayici}>
      <Text style={styles.etiket}>{etiket}</Text>
      <TextInput
        style={styles.girdi}
        placeholderTextColor={renkler.soluk}
        accessibilityLabel={etiket}
        {...digerleri}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  kapsayici: {
    marginBottom: 16,
  },
  etiket: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: renkler.yazi,
  },
  // fontSize 16: Android/iOS'ta rahat okunan, yazarken ekranın yakınlaşmasını önleyen boyut.
  girdi: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
    fontSize: 16,
    color: renkler.yazi,
  },
});
