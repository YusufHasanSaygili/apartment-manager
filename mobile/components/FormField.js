// Ortak form alanı: üstte görünür bir etiket + altında yazı kutusu (TextInput).
// Etiket kutunun dışında durduğu için kullanıcı yazmaya başlayınca alanın ne olduğu kaybolmaz.
// Şifre alanıysa (secureTextEntry) kutunun en sağında göz ikonu çıkar; basınca şifre görünür/gizlenir.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
// Ionicons: Expo'nun hazır ikon setinden biri (@expo/vector-icons); ikon adıyla çizilir, resim dosyası gerekmez.
import { Ionicons } from '@expo/vector-icons';
import { radius, colors, fonts } from '../theme';

// label: alanın adı. Geri kalan tüm özellikler (value, onChangeText, keyboardType...)
// olduğu gibi TextInput'a aktarılır (...rest).
// style: (isteğe bağlı) kutuya ek stil, örn. uzun metin için daha yüksek kutu; varsayılan stilin üstüne eklenir.
// secureTextEntry: verilirse alan şifre alanıdır; yazılanlar gizlenir ve sağda göz ikonu eklenir.
// onFocus / onBlur: ekran kendi işini yapmak isterse yine çalışır; component sadece çerçeve rengini değiştirir.
// counter: (isteğe bağlı) etiketin sağında gösterilen sayaç metni, örn. "12 / 80" (yazılan / en fazla karakter).
export default function FormField({ label, counter, style, secureTextEntry, onFocus, onBlur, ...rest }) {
  // useState: şifre şu an görünüyor mu. Göz ikonuna basınca değişir; false iken karakterler nokta olarak görünür.
  const [passwordVisible, setPasswordVisible] = useState(false);
  // useState: kutu şu an seçili mi (klavye bu kutuya mı yazıyor). Seçiliyken çerçeve altın olur,
  // kullanıcı hangi alana yazdığını kolayca görür.
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {/* Etiket büyük harfle yazılır. textTransform yerine toLocaleUpperCase('tr-TR') kullanılır;
          yoksa Türkçe 'i' harfi 'I' olur ('isteğe' → 'ISTEĞE', doğrusu 'İSTEĞE'). */}
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label.toLocaleUpperCase('tr-TR')}</Text>
        {counter ? <Text style={[styles.label, styles.counter]}>{counter}</Text> : null}
      </View>
      {/* Kutu ve (şifre alanıysa) göz ikonu aynı satırda: ikon kutunun içinde, en sağda durur (position absolute). */}
      <View>
        {/* style dizisi: sonra gelen (dışarıdan verilen style) varsayılanla çakışan değerleri ezer.
            Şifre alanında sağdan ek boşluk bırakılır ki yazı ikonun altına girmesin.
            secureTextEntry: alan şifre alanıysa VE göz açık değilse yazılanlar gizlenir.
            onFocus/onBlur: kutuya dokununca focused true, klavye kapanınca/başka alana geçince false olur;
            ardından ekranın kendi onFocus/onBlur'u varsa o da çağrılır (?. = fonksiyon verilmemişse atla). */}
        <TextInput
          style={[styles.input, focused && styles.focused, secureTextEntry && styles.passwordInput, style]}
          placeholderTextColor={colors.faint}
          selectionColor={colors.primary}
          accessibilityLabel={label}
          secureTextEntry={secureTextEntry && !passwordVisible}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {/* Göz ikonu: sadece şifre alanlarında görünür. Basınca passwordVisible tersine döner ve şifre açık yazıya
            çevrilir veya tekrar gizlenir. İkon da duruma göre değişir: açık göz (göster) / üstü çizili göz (gizle). */}
        {secureTextEntry && (
          <Pressable
            style={styles.eye}
            onPress={() => setPasswordVisible((g) => !g)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Şifreyi gizle' : 'Şifreyi göster'}
          >
            <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  // Etiket: küçük, büyük harf, harf aralıklı monospace (tasarımın imzası)
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  counter: {
    color: colors.faint,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  // fontSize 16: Android/iOS'ta rahat okunan, yazarken ekranın yakınlaşmasını önleyen boyut.
  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    fontFamily: fonts.text,
    fontSize: 16,
    color: colors.text,
  },
  // Seçili kutunun altın çerçevesi (focused true iken eklenir)
  focused: {
    borderColor: colors.primary,
  },
  passwordInput: {
    paddingRight: 48, // göz ikonunun alanı
  },
  // Göz ikonu: kutunun sağ kenarına sabitlenir, dikey olarak ortalanır (top/bottom 0 + justifyContent).
  eye: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
