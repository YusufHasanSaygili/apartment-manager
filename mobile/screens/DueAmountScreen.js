// Aidat tutarı ekranı: yönetici sitenin aylık aidat tutarını belirler veya değiştirir.
// Bu tutar sakinlerin bildirim formunda hazır gelir (sakin isterse değiştirebilir).
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Button from '../components/Button';
import ErrorMessage from '../components/ErrorMessage';
import { formatMoney, amountText, parseAmount, cleanAmount } from '../format';
import ChoiceButton from '../components/ChoiceButton';
import { radius, colors, fonts, textStyles } from '../theme';

// Hazır tutarlar: dokununca kutuya yazılır (yine de elle başka tutar girilebilir)
const PRESETS = [1500, 5000, 10000];

// route.params.dueAmount: mevcut tutar (yönetici ana ekranından gelir; yoksa kutu boş başlar).
export default function DueAmountScreen({ route, navigation }) {
  // useState: kutudaki tutar metni (örn. "750" veya "750,50").
  const [amount, setAmount] = useState(amountText(route.params?.dueAmount));
  // useState: istek sürerken true; form iki kez gönderilmez.
  const [loading, setLoading] = useState(false);
  // useState: hata olursa gösterilecek mesaj.
  const [error, setError] = useState('');

  // save: "Kaydet" butonuna basınca çalışır; tutarı kontrol edip backend'e gönderir.
  const save = async () => {
    // Telefondaki kontrol sadece hızlı geri bildirim içindir; asıl kontrol backend'de yapılır.
    const num = parseAmount(amount);
    if (!(num > 0) || num > 99999.99) {
      setError('0 ile 99.999,99 TL arasında bir tutar girin.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // API isteği: yeni tutarı PUT /api/setup/due-amount adresine gönderir.
      await api.put('/setup/due-amount', { dueAmount: num });
      // Ana ekrana dönülür; ana ekran öne gelince yeni tutarı yeniden çeker.
      navigation.goBack();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const num = parseAmount(amount);

  return (
    // KeyboardAwareScrollView: klavye açılınca alan ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={textStyles.note}>Sakinler aidat bildirimi gönderirken bu tutar hazır gelir.</Text>

      {/* Büyük tutar kutusu: ortada, monospace; elle yazılır (sadece rakam ve virgül, örn. 750 veya 750,50) */}
      <View style={styles.amountRow}>
        <Text style={styles.tl}>₺</Text>
        <TextInput
          style={styles.amount}
          value={amount}
          onChangeText={(text) => setAmount(cleanAmount(text))}
          keyboardType="decimal-pad"
          maxLength={8}
          placeholder="0"
          placeholderTextColor={colors.faint}
          selectionColor={colors.primary}
          accessibilityLabel="Aylık aidat tutarı (TL)"
        />
      </View>

      {/* Hazır tutar düğmeleri: basınca o tutar kutuya yazılır; kutudaki tutarla aynıysa seçili görünür */}
      <View style={styles.presets}>
        {PRESETS.map((t) => (
          <ChoiceButton key={t} text={formatMoney(t).replace(',00', '')} isSelected={num === t} style={styles.presetButton} onPress={() => setAmount(String(t))} />
        ))}
      </View>

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {error !== '' && <ErrorMessage message={error} />}

      {/* "Kaydet" butonu: basınca save çalışır ve tutar backend'e gönderilir */}
      <Button title="Kaydet" onPress={save} loading={loading} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    gap: 14,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tl: {
    fontFamily: fonts.mono,
    fontSize: 28,
    color: colors.muted,
  },
  amount: {
    minWidth: 120,
    padding: 0,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 52,
    fontWeight: '600',
    letterSpacing: -1.5,
    color: colors.text,
  },
  presets: {
    flexDirection: 'row',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    flexBasis: 0,
  },
});
