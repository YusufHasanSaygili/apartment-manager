// Ortak kod alanı: 6 haneli kodu (davet kodu, şifre sıfırlama kodu) her hane ayrı kutuda gösterir.
// Kutuların üstünde tek bir görünmez TextInput vardır; kullanıcı kutulara dokununca aslında ona dokunur, klavye açılır, yazdığı rakamlar
// sırayla kutulara dağıtılır. Böylece kopyala-yapıştır ve SMS/e-posta kodu otomatik doldurma da çalışır.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { kose, renkler, yaziTipi } from '../tema';

const HANE = 6; // kodun hane sayısı; kutu sayısı ve en fazla girilebilecek rakam buradan gelir

// etiket: alanın adı, value: şu anki kod (en fazla 6 rakam), onChangeText: kod değişince çalışan fonksiyon.
// Geri kalan özellikler (autoComplete gibi) gizli TextInput'a aktarılır.
export default function KodAlani({ etiket, value, onChangeText, ...digerleri }) {
  // useState: klavye açık mı. Açıkken sıradaki boş kutu altın çerçeveyle "buraya yazılacak" diye gösterilir.
  const [odakta, setOdakta] = useState(false);

  return (
    <View style={styles.kapsayici}>
      <Text style={styles.etiket}>{etiket.toLocaleUpperCase('tr-TR')}</Text>
      {/* 6 kutu sadece gösterim içindir; dokunuşu üstlerindeki şeffaf TextInput alır ve klavye açılır.
          Her kutu kodun i. rakamını gösterir (yoksa boş). Vurgulanan kutu = yazılan rakam sayısı;
          Math.min sayesinde 6 rakam dolunca vurgu son kutuda kalır, kutuların dışına taşmaz. */}
      <View style={styles.kutular}>
        {Array.from({ length: HANE }, (_, i) => (
          <View key={i} style={[styles.kutu, odakta && i === Math.min(value.length, HANE - 1) && styles.siradaki]}>
            <Text style={styles.rakam}>{value[i] ?? ''}</Text>
          </View>
        ))}
      </View>
      {/* Gizli TextInput: asıl yazma burada olur. Rakam olmayanlar silinir, en fazla 6 hane alınır.
          Kutuların üstüne şeffaf olarak yerleşir; ekran okuyucu için etiketi taşır.
          caretHidden: yanıp sönen imleç gizlenir (zaten görünmez alan). onFocus/onBlur: odakta state'ini günceller.
          {...digerleri} en sonda: ekranın verdiği ek özellikler (örn. autoComplete="one-time-code") buraya eklenir. */}
      <TextInput
        style={styles.gizli}
        value={value}
        onChangeText={(metin) => onChangeText(metin.replace(/\D/g, '').slice(0, HANE))}
        keyboardType="number-pad"
        caretHidden
        accessibilityLabel={etiket}
        onFocus={() => setOdakta(true)}
        onBlur={() => setOdakta(false)}
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
    marginBottom: 7,
    fontFamily: yaziTipi.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    color: renkler.soluk,
  },
  kutular: {
    flexDirection: 'row',
    gap: 8,
  },
  // flex: 1 → 6 kutu satırı eşit paylaşır, her telefonda hizalı durur.
  kutu: {
    flex: 1,
    height: 58,
    borderRadius: kose,
    borderWidth: 1,
    borderColor: renkler.kenarlik,
    backgroundColor: renkler.kart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  siradaki: {
    borderColor: renkler.birincil,
    borderWidth: 1.5,
  },
  rakam: {
    fontFamily: yaziTipi.mono,
    fontSize: 22,
    fontWeight: '600',
    color: renkler.yazi,
  },
  // Gizli girdi kutuların tam üstünde, şeffaf: dokunuşları da yakalayabilir.
  gizli: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 58,
    opacity: 0,
  },
});
