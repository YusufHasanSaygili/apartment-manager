// Ortak kod alanı: 6 haneli kodu (davet kodu, şifre sıfırlama kodu) her hane ayrı kutuda gösterir.
// Kutuların üstünde tek bir görünmez TextInput vardır; kullanıcı kutulara dokununca aslında ona dokunur, klavye açılır, yazdığı rakamlar
// sırayla kutulara dağıtılır. Böylece kopyala-yapıştır ve SMS/e-posta kodu otomatik doldurma da çalışır.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, colors, fonts } from '../theme';

const DIGITS = 6; // kodun hane sayısı; kutu sayısı ve en fazla girilebilecek rakam buradan gelir

// label: alanın adı, value: şu anki kod (en fazla 6 rakam), onChangeText: kod değişince çalışan fonksiyon.
// Geri kalan özellikler (autoComplete gibi) gizli TextInput'a aktarılır.
export default function CodeField({ label, value, onChangeText, ...rest }) {
  // useState: klavye açık mı. Açıkken sıradaki boş kutu altın çerçeveyle "buraya yazılacak" diye gösterilir.
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label.toLocaleUpperCase('tr-TR')}</Text>
      {/* 6 kutu sadece gösterim içindir; dokunuşu üstlerindeki şeffaf TextInput alır ve klavye açılır.
          Her kutu kodun i. rakamını gösterir (yoksa boş). Vurgulanan kutu = yazılan rakam sayısı;
          Math.min sayesinde 6 rakam dolunca vurgu son kutuda kalır, kutuların dışına taşmaz. */}
      <View style={styles.tiles}>
        {Array.from({ length: DIGITS }, (_, i) => (
          <View key={i} style={[styles.box, focused && i === Math.min(value.length, DIGITS - 1) && styles.next]}>
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      {/* Gizli TextInput: asıl yazma burada olur. Rakam olmayanlar silinir, en fazla 6 hane alınır.
          Kutuların üstüne şeffaf olarak yerleşir; ekran okuyucu için etiketi taşır.
          caretHidden: yanıp sönen imleç gizlenir (zaten görünmez alan). onFocus/onBlur: focused state'ini günceller.
          {...rest} en sonda: ekranın verdiği ek özellikler (örn. autoComplete="one-time-code") buraya eklenir. */}
      <TextInput
        style={styles.hidden}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, DIGITS))}
        keyboardType="number-pad"
        caretHidden
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 7,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    color: colors.muted,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
  },
  // flex: 1 → 6 kutu satırı eşit paylaşır, her telefonda hizalı durur.
  box: {
    flex: 1,
    height: 58,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  next: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  digit: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  // Gizli girdi kutuların tam üstünde, şeffaf: dokunuşları da yakalayabilir.
  hidden: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 58,
    opacity: 0,
  },
});
