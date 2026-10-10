// Yöneticiliği devret ekranı: yönetici, sitedeki bir dairenin sakinini yeni yönetici yapar; kendisi sakin olur.
// Önce yeni yöneticinin dairesi seçilir (örn. "B12 · Ahmet"). Yöneticinin kayıtlı bir dairesi yoksa (siteyi kuran
// yönetici) devirden sonra oturacağı boş daire de seçilir. Devirden sonra ekranlar kendiliğinden sakin ekranlarına geçer.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import Button from '../components/Button';
import ErrorMessage from '../components/ErrorMessage';
import { mix, radius, colors, fonts, textStyles } from '../theme';

// Daire adına Türkçe yönelme eki: "A3" → "A3'e", "B6" → "B6'ya", "A10" → "A10'a" (sayının okunuşuna göre).
const ONES_SUFFIXES = ["'a", "'e", "'ye", "'e", "'e", "'e", "'ya", "'ye", "'e", "'a"];
const TENS_SUFFIXES = ['', "'a", "'ye", "'a", "'a", "'ye", "'a", "'e", "'e", "'a"];
const withDativeSuffix = (name) => {
  const num = Number(name.replace(/\D/g, ''));
  return name + (num % 10 === 0 && num > 0 ? TENS_SUFFIXES[(num / 10) % 10] : ONES_SUFFIXES[num % 10]);
};

// Seçim hücresi: eşit genişlikte kutu. color: seçiliyken kullanılan durum rengi (yeşil = yeni yönetici gelir,
// kırmızı = sizin gideceğiniz daire). badge: (isteğe bağlı) soldaki daire etiketi.
function Cell({ text, badge, isSelected, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [
        styles.cell,
        badge && styles.cellPerson,
        isSelected && { backgroundColor: mix(color, 0.14), borderColor: mix(color, 0.6) },
        pressed && { opacity: 0.7 },
      ]}
    >
      {badge ? (
        <View style={[styles.badge, isSelected && { backgroundColor: color }]}>
          <Text style={[styles.badgeText, isSelected && { color: colors.background }]}>{badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.cellText, isSelected && { color }]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

// Elemanları n'li satırlara böler; son satır boş yer tutucularla tamamlanır ki kutular hizalı kalsın.
const chunk = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

export default function HandoverScreen() {
  // refreshSession: devirden sonra rolü sunucudan yeniden çeker; App.js sakin ekranlarına geçer.
  const { refreshSession } = useSession();

  // useState: sunucudan gelen seçenekler { candidates, myFlat, emptyFlats }. null → yükleniyor.
  const [choices, setChoices] = useState(null);
  // useState: seçenekler yüklenemezse hata mesajı; doluysa ekranda "Tekrar dene" kutusu gösterilir.
  const [error, setError] = useState('');
  // useState: seçilen yeni yöneticinin dairesi ve (gerekiyorsa) yöneticinin kendi oturacağı daire.
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [ownFlat, setOwnFlat] = useState(null);
  // useState: devir isteği sürerken true; buton tekrar basılamaz.
  const [handingOver, setHandingOver] = useState(false);

  // API isteği: GET /api/handover/options ile sakini olan daireleri ve boş daireleri çeker.
  // useCallback: fonksiyon sabit kalsın; useEffect bağımlılığı ve "Tekrar dene" butonu aynı fonksiyonu kullanır.
  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/handover/options');
      setChoices(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // useEffect: ekran ilk açıldığında seçenekler bir kez yüklenir.
  useEffect(() => {
    load();
  }, [load]);

  // Kendi dairesi kayıtlıysa seçmesine gerek yok; değilse boş dairelerden birini seçmek zorunlu.
  const requireOwnFlat = choices && !choices.myFlat;
  // ready: gerekli tüm seçimler yapıldı mı; değilse devret butonu sadece uyarı gösterir.
  const ready = selectedCandidate && (!requireOwnFlat || ownFlat);

  // API isteği: POST /api/handover ile seçimleri gönderir. Başarılıysa oturum yenilenir ve uygulama
  // kendiliğinden sakin ekranlarına geçer (bu ekran da kapanır).
  const handover = async () => {
    setHandingOver(true);
    try {
      const { data } = await api.post('/handover', {
        newManagerFlatId: selectedCandidate.flatId,
        // ownFlatId sadece gerekiyorsa eklenir (false yayılınca hiçbir alan eklenmez).
        ...(requireOwnFlat && { ownFlatId: ownFlat.id }),
      });
      Alert.alert('Devir tamamlandı', `Yöneticilik ${data.newManager} adlı sakine devredildi. Artık sakin olarak devam ediyorsunuz.`);
      await refreshSession();
    } catch (e) {
      Alert.alert('Devredilemedi', e.message);
      setHandingOver(false);
      // Liste eskimiş olabilir (örn. seçilen daire bu arada doldu): seçimler sıfırlanır, seçenekler yeniden çekilir.
      setSelectedCandidate(null);
      setOwnFlat(null);
      load();
    }
  };

  // Devir geri alınamaz (geri almak için yeni yöneticinin tekrar devretmesi gerekir); önce onay sorulur.
  const confirmHandover = () => {
    const own = requireOwnFlat ? ownFlat.name : choices.myFlat.name;
    Alert.alert(
      'Yöneticiliği devret',
      `${selectedCandidate.name} dairesindeki ${selectedCandidate.residentName} yönetici olacak. Siz ${own} dairesinin sakini olacaksınız ve yönetici ekranlarına erişiminiz kalkacak. Onaylıyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Devret', style: 'destructive', onPress: handover },
      ]
    );
  };

  if (error !== '') {
    return (
      <View style={styles.center}>
        {/* "Tekrar dene" butonu: basınca load çalışır ve seçenekler yeniden istenir */}
        <ErrorMessage message={error} onRetry={load} />
      </View>
    );
  }
  if (!choices) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Butonun yazısı ne olacağını söyler: "A3'e devret, A4'e geç"
  const targetFlat = choices.myFlat ?? ownFlat;
  const buttonLabel = selectedCandidate && targetFlat ? `${withDativeSuffix(selectedCandidate.name)} devret, ${withDativeSuffix(targetFlat.name)} geç` : 'Yöneticiliği devret';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={textStyles.note}>
        Seçtiğiniz dairenin sakini yönetici olur; siz sakin olursunuz. Daireler, aidat geçmişi ve duyurular olduğu gibi kalır.
      </Text>

      <View style={styles.section}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>1</Text>
        </View>
        <Text style={styles.title}>Yeni yönetici</Text>
      </View>
      {choices.candidates.length === 0 ? (
        <Text style={styles.empty}>Sitede henüz kayıtlı sakin yok. Yöneticilik bir sakine devredilebilir.</Text>
      ) : (
        // Adaylar 2 eşit sütunda; seçilen yeşil (yönetici olarak gelecek kişi).
        // Aday kutusu: basınca setSelectedCandidate çalışır, o dairenin sakini yeni yönetici olarak seçilir.
        chunk(choices.candidates, 2).map((row, i) => (
          <View key={i} style={styles.row}>
            {[0, 1].map((j) =>
              row[j] ? (
                <Cell
                  key={row[j].flatId}
                  badge={row[j].name}
                  text={row[j].residentName}
                  color={colors.success}
                  isSelected={selectedCandidate?.flatId === row[j].flatId}
                  onPress={() => setSelectedCandidate(row[j])}
                />
              ) : (
                <View key={j} style={[styles.cell, styles.cellPerson, styles.placeholder]} />
              ),
            )}
          </View>
        ))
      )}

      <View style={styles.section}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>2</Text>
        </View>
        <Text style={styles.title}>Sizin daireniz</Text>
      </View>
      {choices.myFlat ? (
        <Text style={textStyles.note}>Devirden sonra {choices.myFlat.name} dairesinin sakini olacaksınız.</Text>
      ) : (
        <>
          <Text style={textStyles.note}>Devirden sonra oturacağınız boş daire. Seçtiğiniz daire kırmızı (siz gidiyorsunuz).</Text>
          {/* Boş daireler 5 eşit sütunda. Boş daire kutusu: basınca setOwnFlat çalışır */}
          {chunk(choices.emptyFlats, 5).map((row, i) => (
            <View key={i} style={styles.row}>
              {[0, 1, 2, 3, 4].map((j) =>
                row[j] ? (
                  <Cell
                    key={row[j].id}
                    text={row[j].name}
                    color={colors.error}
                    isSelected={ownFlat?.id === row[j].id}
                    onPress={() => setOwnFlat(row[j])}
                  />
                ) : (
                  <View key={j} style={[styles.cell, styles.placeholder]} />
                ),
              )}
            </View>
          ))}
          {/* Boş daire yoksa ne yapılacağı açıklanır (yoksa liste boş görünür ve kullanıcı takılı kalır) */}
          {choices.emptyFlats.length === 0 && (
            <Text style={styles.empty}>
              Sitede boş daire yok. Oturduğunuz dairenin sakinini önce daireden çıkarın veya yöneticiliği o daireye devredin.
            </Text>
          )}
        </>
      )}

      {/* Devret butonu: iki seçim de yapılınca confirmHandover çalışır (önce onay sorulur); eksikse uyarı çıkar */}
      <View style={styles.footer}>
        <Button
          title={buttonLabel}
          icon="handover"
          onPress={ready ? confirmHandover : () => Alert.alert('Seçim eksik', 'Önce yeni yöneticiyi ve dairenizi seçin.')}
          loading={handingOver}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    gap: 8,
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: radius,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.text,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  // Yer tutucu: hücreyle aynı kutu ama görünmez; son satırdaki tek kutu genişleyip hizayı bozmasın diye
  placeholder: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  // flexBasis 0: yazı uzunluğundan bağımsız, satırdaki bütün kutular eşit genişlikte
  cell: {
    flex: 1,
    flexBasis: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cellPerson: {
    justifyContent: 'flex-start',
    paddingHorizontal: 10,
    minHeight: 52,
  },
  cellText: {
    flexShrink: 1,
    fontFamily: fonts.text,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius,
    backgroundColor: colors.surface3,
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text,
  },
  empty: {
    fontFamily: fonts.text,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  footer: {
    marginTop: 16,
  },
});
