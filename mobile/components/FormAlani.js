// Ortak form alanı: üstte görünür bir etiket + altında yazı kutusu (TextInput).
// Etiket kutunun dışında durduğu için kullanıcı yazmaya başlayınca alanın ne olduğu kaybolmaz.
// Şifre alanıysa (secureTextEntry) kutunun en sağında göz ikonu çıkar; basınca şifre görünür/gizlenir.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// Ionicons: Expo'nun hazır ikon setinden biri (@expo/vector-icons); ikon adıyla çizilir, resim dosyası gerekmez.
import { Ionicons } from '@expo/vector-icons';
import { kose, renkler, yaziTipi } from '../tema';

// etiket: alanın adı. Geri kalan tüm özellikler (value, onChangeText, keyboardType...)
// olduğu gibi TextInput'a aktarılır (...digerleri).
// style: (isteğe bağlı) kutuya ek stil, örn. uzun metin için daha yüksek kutu; varsayılan stilin üstüne eklenir.
// secureTextEntry: verilirse alan şifre alanıdır; yazılanlar gizlenir ve sağda göz ikonu eklenir.
// onFocus / onBlur: ekran kendi işini yapmak isterse yine çalışır; component sadece çerçeve rengini değiştirir.
// sayac: (isteğe bağlı) etiketin sağında gösterilen sayaç metni, örn. "12 / 80" (yazılan / en fazla karakter).
export default function FormAlani({ etiket, sayac, style, secureTextEntry, onFocus, onBlur, ...digerleri }) {
  // useState: şifre şu an görünüyor mu. Göz ikonuna basınca değişir; false iken karakterler nokta olarak görünür.
  const [sifreGorunur, setSifreGorunur] = useState(false);
  // useState: kutu şu an seçili mi (klavye bu kutuya mı yazıyor). Seçiliyken çerçeve altın olur,
  // kullanıcı hangi alana yazdığını kolayca görür.
  const [odakta, setOdakta] = useState(false);

  return (
    <View style={styles.kapsayici}>
      {/* Etiket büyük harfle yazılır. textTransform yerine toLocaleUpperCase('tr-TR') kullanılır;
          yoksa Türkçe 'i' harfi 'I' olur ('isteğe' → 'ISTEĞE', doğrusu 'İSTEĞE'). */}
      <View style={styles.etiketSatir}>
        <Text style={styles.etiket}>{etiket.toLocaleUpperCase('tr-TR')}</Text>
        {sayac ? <Text style={[styles.etiket, styles.sayac]}>{sayac}</Text> : null}
      </View>
      {/* Kutu ve (şifre alanıysa) göz ikonu aynı satırda: ikon kutunun içinde, en sağda durur (position absolute). */}
      <View>
        {/* style dizisi: sonra gelen (dışarıdan verilen style) varsayılanla çakışan değerleri ezer.
            Şifre alanında sağdan ek boşluk bırakılır ki yazı ikonun altına girmesin.
            secureTextEntry: alan şifre alanıysa VE göz açık değilse yazılanlar gizlenir.
            onFocus/onBlur: kutuya dokununca odakta true, klavye kapanınca/başka alana geçince false olur;
            ardından ekranın kendi onFocus/onBlur'u varsa o da çağrılır (?. = fonksiyon verilmemişse atla). */}
        <TextInput
          style={[styles.girdi, odakta && styles.odakli, secureTextEntry && styles.sifreGirdi, style]}
          placeholderTextColor={renkler.sonuk}
          selectionColor={renkler.birincil}
          accessibilityLabel={etiket}
          secureTextEntry={secureTextEntry && !sifreGorunur}
          onFocus={(e) => {
            setOdakta(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setOdakta(false);
            onBlur?.(e);
          }}
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
  // Etiket: küçük, büyük harf, harf aralıklı monospace (tasarımın imzası)
  etiketSatir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  sayac: {
    color: renkler.sonuk,
  },
  etiket: {
    fontFamily: yaziTipi.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    color: renkler.soluk,
  },
  // fontSize 16: Android/iOS'ta rahat okunan, yazarken ekranın yakınlaşmasını önleyen boyut.
  girdi: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
    fontFamily: yaziTipi.metin,
    fontSize: 16,
    color: renkler.yazi,
  },
  // Seçili kutunun altın çerçevesi (odakta true iken eklenir)
  odakli: {
    borderColor: renkler.birincil,
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
