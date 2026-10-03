// Ortak form alanı: üstte görünür bir etiket + altında yazı kutusu (TextInput).
// Etiket kutunun dışında durduğu için kullanıcı yazmaya başlayınca alanın ne olduğu kaybolmaz.
// Şifre alanıysa (secureTextEntry) kutunun en sağında göz ikonu çıkar; basınca şifre görünür/gizlenir.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// Ionicons: Expo'nun hazır ikon setinden biri (@expo/vector-icons); ikon adıyla çizilir, resim dosyası gerekmez.
import { Ionicons } from '@expo/vector-icons';
import { renkler } from '../tema';

// etiket: alanın adı. Geri kalan tüm özellikler (value, onChangeText, keyboardType...)
// olduğu gibi TextInput'a aktarılır (...digerleri).
// style: (isteğe bağlı) kutuya ek stil, örn. uzun metin için daha yüksek kutu; varsayılan stilin üstüne eklenir.
// secureTextEntry: verilirse alan şifre alanıdır; yazılanlar gizlenir ve sağda göz ikonu eklenir.
export default function FormAlani({ etiket, style, secureTextEntry, ...digerleri }) {
  // useState: şifre şu an görünüyor mu. Göz ikonuna basınca değişir; false iken karakterler nokta olarak görünür.
  const [sifreGorunur, setSifreGorunur] = useState(false);

  return (
    <View style={styles.kapsayici}>
      <Text style={styles.etiket}>{etiket}</Text>
      {/* Kutu ve (şifre alanıysa) göz ikonu aynı satırda: ikon kutunun içinde, en sağda durur (position absolute). */}
      <View>
        {/* style dizisi: sonra gelen (dışarıdan verilen style) varsayılanla çakışan değerleri ezer.
            Şifre alanında sağdan ek boşluk bırakılır ki yazı ikonun altına girmesin.
            secureTextEntry: alan şifre alanıysa VE göz açık değilse yazılanlar gizlenir. */}
        <TextInput
          style={[styles.girdi, secureTextEntry && styles.sifreGirdi, style]}
          placeholderTextColor={renkler.soluk}
          accessibilityLabel={etiket}
          secureTextEntry={secureTextEntry && !sifreGorunur}
          {...digerleri}
        />
        {/* Göz ikonu: sadece şifre alanlarında görünür. Basınca sifreGorunur tersine döner ve şifre açık yazıya
            çevrilir veya tekrar gizlenir. İkon da duruma göre değişir: açık göz (göster) / üstü çizili göz (gizle). */}
        {secureTextEntry && (
          <Pressable
            style={styles.goz}
            onPress={() => setSifreGorunur((g) => !g)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={sifreGorunur ? 'Şifreyi gizle' : 'Şifreyi göster'}
          >
            <Ionicons name={sifreGorunur ? 'eye-off-outline' : 'eye-outline'} size={22} color={renkler.soluk} />
          </Pressable>
        )}
      </View>
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
  sifreGirdi: {
    paddingRight: 48, // göz ikonunun alanı
  },
  // Göz ikonu: kutunun sağ kenarına sabitlenir, dikey olarak ortalanır (top/bottom 0 + justifyContent).
  goz: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
