// Ortak form alanı: üstte görünür bir etiket + altında yazı kutusu (TextInput).
// Etiket kutunun dışında durduğu için kullanıcı yazmaya başlayınca alanın ne olduğu kaybolmaz.
// Şifre alanıysa (secureTextEntry) altında "Şifreyi göster" kutucuğu çıkar.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { renkler } from '../tema';

// etiket: alanın adı. Geri kalan tüm özellikler (value, onChangeText, keyboardType...)
// olduğu gibi TextInput'a aktarılır (...digerleri).
// style: (isteğe bağlı) kutuya ek stil, örn. uzun metin için daha yüksek kutu; varsayılan stilin üstüne eklenir.
// secureTextEntry: verilirse alan şifre alanıdır; yazılanlar gizlenir ve "Şifreyi göster" kutucuğu eklenir.
export default function FormAlani({ etiket, style, secureTextEntry, ...digerleri }) {
  // useState: şifre şu an görünüyor mu. Kutucuğa basınca değişir; false iken karakterler nokta olarak görünür.
  const [sifreGorunur, setSifreGorunur] = useState(false);

  return (
    <View style={styles.kapsayici}>
      <Text style={styles.etiket}>{etiket}</Text>
      {/* style dizisi: sonra gelen (dışarıdan verilen style) varsayılanla çakışan değerleri ezer.
          secureTextEntry: alan şifre alanıysa VE "Şifreyi göster" işaretli değilse yazılanlar gizlenir. */}
      <TextInput
        style={[styles.girdi, style]}
        placeholderTextColor={renkler.soluk}
        accessibilityLabel={etiket}
        secureTextEntry={secureTextEntry && !sifreGorunur}
        {...digerleri}
      />
      {/* "Şifreyi göster" kutucuğu: sadece şifre alanlarında görünür. Basınca sifreGorunur tersine döner,
          şifre açık yazıya çevrilir veya tekrar gizlenir. accessibilityRole checkbox: ekran okuyucu işaretli mi söyler. */}
      {secureTextEntry && (
        <Pressable
          style={styles.goster}
          onPress={() => setSifreGorunur((g) => !g)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: sifreGorunur }}
        >
          <View style={[styles.kutu, sifreGorunur && styles.kutuIsaretli]}>
            {sifreGorunur && <Text style={styles.tik}>✓</Text>}
          </View>
          <Text style={styles.gosterYazi}>Şifreyi göster</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  goster: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 10,
  },
  kutu: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: renkler.kenarlik,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: renkler.kart,
  },
  kutuIsaretli: {
    borderColor: renkler.birincil,
    backgroundColor: renkler.birincil,
  },
  tik: {
    fontSize: 14,
    fontWeight: '700',
    color: renkler.birincilUzeri,
  },
  gosterYazi: {
    fontSize: 14,
    color: renkler.yazi,
  },
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
