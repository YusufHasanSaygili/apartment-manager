// Aidat bildirimi ekranı: sakin hangi ayın aidatını, ne kadar ve nasıl ödediğini yöneticiye bildirir.
// Yönetici onaylayınca o ay ödenmiş sayılır.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Button from '../components/Button';
import FormField from '../components/FormField';
import ErrorMessage from '../components/ErrorMessage';
import { MONTH_NAMES, amountText, parseAmount, cleanAmount } from '../format';
import { radius, colors, fonts, textStyles } from '../theme';

// Bu ay ve önceki 11 ay: [{ month, year }, ...] (en yeni başta). Backend de sadece bu aralığı kabul eder.
function last12Months() {
  const today = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return { month: date.getMonth() + 1, year: date.getFullYear() };
  });
}

// Seçenek kutusu: ay ve ödeme yöntemi seçimlerinde kullanılır. Satırdaki kutular eşit genişlikte (hizalı);
// seçiliyse koyu altın zemin + altın çerçeve. subtitle: (isteğe bağlı) altında küçük yazı (örn. yıl).
function Option({ text, subtitle, isSelected, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.option, isSelected && styles.isSelected, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={subtitle ? `${text} ${subtitle}` : text}
    >
      <Text style={[styles.optionText, isSelected && styles.selectedText]}>{text}</Text>
      {subtitle ? <Text style={[styles.optionSubtitle, isSelected && styles.selectedText]}>{subtitle}</Text> : null}
    </Pressable>
  );
}

// 12 ayı 3'lü satırlara böler (4 satır × 3 eşit kutu)
const chunk = (list) => Array.from({ length: Math.ceil(list.length / 3) }, (_, i) => list.slice(i * 3, i * 3 + 3));

// route.params.dueAmount: yöneticinin belirlediği aylık tutar (sakin ana ekranından gelir).
export default function ReportPaymentScreen({ route, navigation }) {
  // Ekrandaki ay düğmelerinin listesi (bu ay + önceki 11 ay).
  const months = last12Months();

  // useState: seçilen ay. Reddedilen bir bildirimden gelindiyse o ay (listede varsa), yoksa bu ay.
  // useState'e fonksiyon verilir: bu arama sadece ekran ilk açıldığında bir kez yapılır.
  const [selectedMonth, setSelectedMonth] = useState(
    () => months.find((a) => a.month === route.params?.month && a.year === route.params?.year) ?? months[0]
  );
  // useState: tutar kutusundaki metin. Yöneticinin tutarı hazır gelir, sakin değiştirebilir
  // (örn. 2 aylık ödediyse 1500 yazar).
  const [amount, setAmount] = useState(amountText(route.params?.dueAmount));
  // useState: ödeme yöntemi ('bank' | 'cash'); başta seçili değil, sakin seçmeli.
  const [paymentMethod, setPaymentMethod] = useState(null);
  // useState: isteğe bağlı açıklama (örn. "Ziraat'ten 1 Ekim'de attım").
  const [note, setNote] = useState('');

  // useState: istek sürerken true; form iki kez gönderilmez.
  const [loading, setLoading] = useState(false);
  // useState: formda veya sunucuda hata olursa gösterilecek mesaj.
  const [error, setError] = useState('');

  // send: "Bildirimi gönder" butonuna basınca çalışır. Telefonda kontrol eder, sonra backend'e yollar.
  const send = async () => {
    // Telefondaki kontroller kullanıcıya hızlı geri bildirim içindir; asıl kontrol backend'de tekrar yapılır.
    const num = parseAmount(amount);
    if (!(num > 0)) {
      setError('Geçerli bir tutar girin.');
      return;
    }
    if (num > 99999.99) {
      setError('Tutar en fazla 99.999,99 TL olabilir.');
      return;
    }
    if (!paymentMethod) {
      setError('Ödeme yöntemini seçin.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // API isteği: seçilen ay, tutar, yöntem ve açıklamayı POST /api/dues adresine gönderir.
      // Daire ve site bilgisi gönderilmez; backend bunları sakinin token'ından bulur.
      await api.post('/dues', { ...selectedMonth, amount: num, paymentMethod, note });
      // Ana ekrana dönülür; ana ekran öne gelince listeyi yeniden çeker ve yeni bildirim "Onay bekliyor" görünür.
      navigation.goBack();
    } catch (e) {
      // Örn. "Bu ay için zaten bekleyen veya onaylanmış bir bildiriminiz var."
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    // KeyboardAwareScrollView: klavye açılınca alanlar ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.group}>
        <Text style={textStyles.label}>HANGİ AYIN AİDATI?</Text>
        {/* Ay kutuları: 3 eşit sütun; basınca o ay seçilir (bu ay ve önceki 11 ay) */}
        {chunk(months).map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((a) => (
              <Option
                key={`${a.year}-${a.month}`}
                text={MONTH_NAMES[a.month - 1].slice(0, 3)}
                subtitle={String(a.year)}
                isSelected={a.month === selectedMonth.month && a.year === selectedMonth.year}
                onPress={() => setSelectedMonth(a)}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Tutar: sadece rakam ve virgül yazılabilir (cleanAmount), örn. 1500,50 */}
      <FormField
        label="Ödenen tutar (TL)"
        value={amount}
        onChangeText={(text) => setAmount(cleanAmount(text))}
        keyboardType="decimal-pad"
        maxLength={8}
        style={styles.largeField}
      />

      <View style={styles.group}>
        <Text style={textStyles.label}>ÖDEME YÖNTEMİ</Text>
        {/* Ödeme yöntemi kutuları: 2 eşit sütun; basınca o yöntem seçilir */}
        <View style={styles.row}>
          <Option text="Banka havalesi" isSelected={paymentMethod === 'bank'} onPress={() => setPaymentMethod('bank')} />
          <Option text="Elden" isSelected={paymentMethod === 'cash'} onPress={() => setPaymentMethod('cash')} />
        </View>
      </View>

      <FormField
        label="Açıklama (isteğe bağlı)"
        value={note}
        onChangeText={setNote}
        placeholder="Örn. Ziraat'ten 1 Ekim'de attım"
        maxLength={200}
        multiline
        style={styles.largeField}
      />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {error !== '' && <ErrorMessage message={error} />}

      {/* "Bildirimi gönder" butonu: basınca send çalışır ve bildirim backend'e gönderilir */}
      <Button title="Bildirimi gönder" icon="send" onPress={send} loading={loading} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Ferah düzen: bölümler arası geniş boşluk, büyük kutular (ekranın altında boşluk kalmasın)
  content: {
    padding: 18,
    paddingTop: 14,
    gap: 14,
  },
  group: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  // flexBasis 0: yazı uzunluğundan bağımsız, satırdaki kutular eşit genişlikte
  option: {
    flex: 1,
    flexBasis: 0,
    minHeight: 60,
    paddingHorizontal: 6,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  isSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryBackground,
  },
  pressed: {
    opacity: 0.7,
  },
  optionText: {
    fontFamily: fonts.text,
    fontSize: 15.5,
    fontWeight: '600',
    color: colors.text,
  },
  optionSubtitle: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.muted,
  },
  selectedText: {
    color: colors.primary,
  },
  largeField: {
    minHeight: 58,
  },
});
