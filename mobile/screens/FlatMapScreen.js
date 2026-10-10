// Daire haritası ekranı (yönetici): seçilen ayda her dairenin aidat durumunu bina bina gösterir.
// Ödeyen daireler yeşil (₺ coin ikonu ve parlama), onay bekleyenler sarı (saat), ödemeyenler kırmızı (yarım halka,
// nefes alan efekt), sakini olmayanlar çizgili gri (aralık kapı). Üstteki oklarla ay değiştirilir.
// Bir daireye dokununca o dairenin aidat takvimi açılır.
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import ErrorMessage from '../components/ErrorMessage';
import { useRefresh } from '../components/Refresh';
import Pager from '../components/Pager';
import { BuildingCard, STATUSES, Legend } from '../components/Status';
import { monthLabel } from '../format';
import { colors, fonts } from '../theme';

// Bugünün ayı (harita açılınca bu ay seçili gelir) ve gidilebilecek en ileri ay (gelecek yılın Aralık'ı).
const today = new Date();
const THIS_MONTH = { month: today.getMonth() + 1, year: today.getFullYear() };
const LAST_MONTH = { month: 12, year: today.getFullYear() + 1 };

// Ayı ileri/geri kaydırır; Date nesnesi yıl geçişini (Aralık → Ocak) kendisi halleder.
function shiftMonth({ month, year }, diff) {
  const date = new Date(year, month - 1 + diff, 1);
  return { month: date.getMonth() + 1, year: date.getFullYear() };
}

// navigation: daireye dokununca DueCalendar ekranını açmak için kullanılır.
export default function FlatMapScreen({ navigation }) {
  // useState: seçili ay. Değişince load yeniden oluşur ve harita o ay için istenir.
  const [selectedMonth, setSelectedMonth] = useState(THIS_MONTH);
  // useState: sunucudan gelen harita ({ buildings, summary }). null → yükleniyor.
  const [screenData, setScreenData] = useState(null);
  // useState: harita yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');

  // useRef: son isteğin numarası. Oklara hızlı basılınca eski ayın geç gelen cevabı yeni ayın üstüne yazılmasın diye
  // sadece en son isteğin cevabı ekrana konur.
  const lastRequest = useRef(0);

  // API isteği: GET /api/manager/dues/map?month=10&year=2026 → seçilen ayda tüm dairelerin durumu ve özet sayılar.
  // useCallback: fonksiyon her çizimde yeniden oluşmasın; useFocusEffect/useEffect buna bağlı olduğu için istek gereksiz yere tekrar atılmaz.
  const load = useCallback(async () => {
    const requestNo = ++lastRequest.current;
    setError('');
    try {
      const { data } = await api.get('/manager/dues/map', { params: selectedMonth });
      if (requestNo === lastRequest.current) setScreenData(data);
    } catch (e) {
      if (requestNo === lastRequest.current) setError(e.message);
    }
  }, [selectedMonth]);

  // Ok butonları ayı değiştirir; eski ayın haritası yeni ay yüklenene kadar görünmesin diye veri temizlenir.
  const changeMonth = (diff) => {
    setScreenData(null);
    setSelectedMonth((a) => shiftMonth(a, diff));
  };

  // useFocusEffect: ekran her öne geldiğinde (ve ay değişince) harita yeniden yüklenir; takvimde elle işaretleme
  // yapılıp geri dönülünce renkler güncel olur.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Aşağı çekip yenileme (refreshControl): sayfa en üstteyken aşağı çekilince load tekrar çalışır (components/Refresh.js).
  const refreshControl = useRefresh(load);

  const isLast = selectedMonth.month === LAST_MONTH.month && selectedMonth.year === LAST_MONTH.year;
  const summary = screenData?.summary;
  const occupied = summary ? summary.paid + summary.pending + summary.unpaid : 0;

  // Listenin üst kısmı: ay seçici, lejant (durumlar ve sayıları), hata veya yükleniyor
  const header = (
    <View style={styles.header}>
      {/* Ay seçici: sol ok bir önceki ay, sağ ok bir sonraki ay (gelecek yılın Aralık'ında durur) */}
      <Pager
        title={monthLabel(selectedMonth.month, selectedMonth.year)}
        subtitle={summary ? `${occupied} dolu daire · ${summary.paid} ödedi` : ' '}
        onPrevious={() => changeMonth(-1)}
        onNext={() => changeMonth(1)}
        nextDisabled={isLast}
        previousLabel="Önceki ay"
        nextLabel="Sonraki ay"
      />
      {summary && (
        <Legend
          items={[
            ['paid', summary.paid],
            ['pending', summary.pending],
            ['unpaid', summary.unpaid],
            ['empty', summary.empty],
          ]}
        />
      )}
      {/* Hata kutusundaki "Tekrar dene" butonu: basınca load çalışır ve harita yeniden istenir */}
      {error !== '' && <ErrorMessage message={error} onRetry={load} />}
      {screenData === null && error === '' && <ActivityIndicator color={colors.primary} />}
    </View>
  );

  return (
    // FlatList: binaları alt alta listeler; her bina kendi kartında, daireleri 4'lü satırlarda.
    <FlatList
      refreshControl={refreshControl}
      style={styles.container}
      contentContainerStyle={styles.content}
      data={screenData?.buildings ?? []}
      keyExtractor={(building) => building.id}
      ListHeaderComponent={header}
      ListEmptyComponent={screenData && <Text style={styles.empty}>Henüz daire oluşturulmamış.</Text>}
      renderItem={({ item: building }) => (
        // Daire kutusuna basınca o dairenin aidat takvimi açılır (daire adı başlıkta görünür)
        <BuildingCard
          name={building.name}
          flats={building.flats.map((d) => ({ ...d, accessibilityName: `Daire ${d.name}: ${STATUSES[d.status]?.label ?? d.status}. Aidat takvimini aç` }))}
          onFlatPress={(d) => navigation.navigate('DueCalendar', { flatId: d.id, flatName: d.name })}
        />
      )}
    />
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
  header: {
    gap: 12,
  },
  empty: {
    textAlign: 'center',
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.muted,
  },
});
