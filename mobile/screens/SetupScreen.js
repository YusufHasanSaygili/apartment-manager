// Kurulum ekranı: yönetici bina sayısını ve her binadaki daire sayısını girer.
// Sayılar −/+ düğmeleriyle veya ortadaki kutuya yazarak değiştirilir. Altta oluşacak dairelerin önizlemesi
// (A1–A6, B1–B6...) canlı olarak görünür. Sistem daireleri otomatik oluşturur ve her birine davet kodu verir.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Button from '../components/Button';
import ErrorMessage from '../components/ErrorMessage';
import { BuildingCard } from '../components/Status';
import { radius, colors, fonts, textStyles } from '../theme';

// Bina adları için kullanılan harfler (en fazla 26 bina).
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Sayı satırı: solda etiket ve sınır bilgisi, sağda − kutu + adımlayıcı.
// −/+ değeri 1 azaltır/artırır (en az 1, en fazla max); ortadaki kutuya elle de yazılabilir (sadece rakam).
function NumberField({ label, subtitle, value, change, max }) {
  const num = Number(value) || 0;
  // −/+ basınca çalışır: yeni değer 1 ile max arasında tutulur
  const step = (diff) => change(String(Math.min(max, Math.max(1, num + diff))));
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.stepper}>
        {/* "−" düğmesi: basınca değer 1 azalır */}
        <Pressable style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]} onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel={`${label} azalt`}>
          <Text style={styles.stepLabel}>−</Text>
        </Pressable>
        <TextInput
          style={styles.box}
          value={value}
          onChangeText={(text) => change(text.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          accessibilityLabel={label}
        />
        {/* "+" düğmesi (zümrüt): basınca değer 1 artar */}
        <Pressable style={({ pressed }) => [styles.stepButton, styles.plus, pressed && styles.pressed]} onPress={() => step(1)} accessibilityRole="button" accessibilityLabel={`${label} artır`}>
          <Text style={[styles.stepLabel, { color: colors.onEmerald }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// navigation: kurulum bitince ana ekrana geri dönmek için kullanılır.
export default function SetupScreen({ navigation }) {
  // useState: iki kutudaki değerler (metin olarak tutulur, gönderirken sayıya çevrilir). Örnek değerlerle başlar.
  const [buildingCount, setBuildingCount] = useState('2');
  const [flatCount, setFlatCount] = useState('6');
  // useState: istek sürerken true; butonda dönen simge çıkar, kurulum iki kez gönderilmez.
  const [loading, setLoading] = useState(false);
  // useState: geçersiz giriş veya sunucu hatasında gösterilecek mesaj.
  const [error, setError] = useState('');

  const building = Number(buildingCount);
  const flat = Number(flatCount);
  const valid = building >= 1 && building <= 26 && flat >= 1 && flat <= 99;
  const lastBuilding = LETTERS[building - 1];

  // "Daireleri oluştur"a basınca çalışır: sayıları kontrol eder, sonra işlem geri alınamaz olduğu için onay sorar.
  const askConfirm = () => {
    if (!buildingCount || !flatCount) {
      setError('Bina sayısını ve her binadaki daire sayısını girin.');
      return;
    }
    if (building < 1 || flat < 1) {
      setError('Sayılar en az 1 olmalı.');
      return;
    }
    if (building > 26) {
      setError('En fazla 26 bina olabilir (A–Z).');
      return;
    }
    setError('');
    Alert.alert(
      'Kurulumu onayla',
      `${building} bina, toplam ${building * flat} daire oluşturulacak (A1 – ${lastBuilding}${flat}). Bu işlem daha sonra değiştirilemez.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Oluştur', onPress: runSetup },
      ],
    );
  };

  // API isteği: POST /api/setup ile bina ve daire sayısını gönderir; daireler ve davet kodları sunucuda oluşur.
  // Başarılıysa ana ekrana dönülür (orada kurulum tamamlanmış görünür).
  const runSetup = async () => {
    setLoading(true);
    try {
      await api.post('/setup', { buildingCount: building, flatCount: flat });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  // Önizleme: en fazla 3 bina ve her binada en fazla 12 daire gösterilir (fazlası "+N" ile belirtilir)
  const preview = valid
    ? Array.from({ length: Math.min(building, 3) }, (_, b) => ({
        name: LETTERS[b],
        flats: Array.from({ length: Math.min(flat, 12) }, (_, d) => ({ id: `${b}-${d}`, name: `${LETTERS[b]}${d + 1}`, status: 'emptyFlat' })),
      }))
    : [];

  return (
    // KeyboardAwareScrollView: klavye açılınca kutular ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content} bottomOffset={100} keyboardShouldPersistTaps="handled">
      <Text style={textStyles.note}>Binalar A, B, C… diye, daireler A1, A2… diye otomatik adlandırılır.</Text>

      <NumberField label="Bina sayısı" subtitle="En fazla 26 (A–Z)" value={buildingCount} change={setBuildingCount} max={26} />
      <NumberField label="Her binadaki daire" subtitle="En fazla 99" value={flatCount} change={setFlatCount} max={99} />

      {/* İki sayı da geçerliyse oluşacak daireler canlı olarak önizlenir */}
      {valid && (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={textStyles.label}>ÖNİZLEME</Text>
            <Text style={styles.subtitle}>
              {building * flat} daire · {building * flat} davet kodu
            </Text>
          </View>
          {preview.map((b) => (
            <BuildingCard key={b.name} name={b.name} flats={b.flats} hideIcon small columns={6} frameless />
          ))}
          {(building > 3 || flat > 12) && <Text style={styles.subtitle}>… A1 – {lastBuilding}{flat} arası tüm daireler oluşturulur.</Text>}
        </View>
      )}

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {error !== '' && <ErrorMessage message={error} />}

      {/* "Daireleri oluştur" butonu: basınca askConfirm çalışır; onaylanırsa runSetup backend'e gönderir */}
      <Button title="Daireleri oluştur" icon="setup" onPress={askConfirm} loading={loading} />
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
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowText: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.text,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.muted,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: radius,
    backgroundColor: colors.surface2,
  },
  stepButton: {
    width: 38,
    height: 38,
    borderRadius: radius,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    backgroundColor: colors.emeraldFill,
  },
  pressed: {
    opacity: 0.7,
  },
  stepLabel: {
    fontFamily: fonts.text,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  box: {
    width: 40,
    padding: 0,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
