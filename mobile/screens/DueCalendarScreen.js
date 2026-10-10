// Aidat takvimi ekranı: bir dairenin seçilen yıldaki 12 ayının aidat durumunu 2 sütunlu kutularda gösterir.
// Yönetici haritada bir daireye dokununca açılır (route'ta flatId gelir); sakin kendi ana ekranından açar
// (flatId gelmez → sunucu sakinin kendi dairesini döner). Kutuların hepsi aynı yükseklikte; solda durum ikonu,
// sağda ay adı ve durum. Henüz gelmemiş aylarda takvimin etrafındaki ok döner.
// Yönetici, ödenmemiş bir aya dokunarak o ayı elle "ödendi" işaretleyebilir.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import ErrorMessage from '../components/ErrorMessage';
import { useRefresh } from '../components/Refresh';
import Pager from '../components/Pager';
import { MonthBox } from '../components/Status';
import { MONTH_NAMES } from '../format';
import { colors, textStyles } from '../theme';

// route.params: { flatId, flatName } (yönetici) veya boş (sakin)
export default function DueCalendarScreen({ route }) {
  const flatId = route.params?.flatId;
  // Yönetici mi bakıyor: flatId geldiyse evet. Hangi adrese istek atılacağını ve elle işaretlemeyi belirler.
  const isManagerView = Boolean(flatId);
  const { session } = useSession();

  const today = new Date();
  const thisYear = today.getFullYear();
  // Bugünün ay sırası (yıl × 12 + ay): bundan sonraki ödenmemiş aylar "Henüz gelmedi" gösterilir.
  const thisMonthIndex = thisYear * 12 + today.getMonth() + 1;

  // useState: gösterilen yıl. Oklarla değişir; değişince takvim o yıl için yeniden istenir.
  const [year, setYear] = useState(thisYear);
  // useState: 12 ayın listesi [{ month, status, paymentMethod }]. null → yükleniyor.
  const [months, setMonths] = useState(null);
  // useState: takvim yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');

  // useRef: son isteğin numarası; oklara hızlı basılınca eski yılın geç gelen cevabı ekrana yazılmasın diye.
  const lastRequest = useRef(0);

  // API isteği: yönetici için GET /api/manager/dues/calendar/:flatId?year=, sakin için GET /api/dues/calendar?year=
  // → seçilen yılın 12 ayı ve her ayın durumu.
  // useCallback: load sadece daire veya yıl değişince yeniden oluşur; aşağıdaki useEffect de o zaman tekrar çalışır.
  const load = useCallback(async () => {
    const requestNo = ++lastRequest.current;
    setError('');
    try {
      const url = isManagerView ? `/manager/dues/calendar/${flatId}` : '/dues/calendar';
      const { data } = await api.get(url, { params: { year } });
      if (requestNo === lastRequest.current) setMonths(data.months);
    } catch (e) {
      if (requestNo === lastRequest.current) setError(e.message);
    }
  }, [isManagerView, flatId, year]);

  // useEffect: ekran açılınca ve yıl değişince takvimi yükler.
  useEffect(() => {
    load();
  }, [load]);

  // Ok butonları yılı değiştirir; eski yılın takvimi yeni yıl yüklenene kadar görünmesin diye aylar temizlenir.
  // (Aşağı çekip yenilemede ve elle işaretlemeden sonra temizlenmez; takvim yerinde kalıp güncellenir.)
  const changeYear = (diff) => {
    setMonths(null);
    setYear((y) => y + diff);
  };

  // Aşağı çekip yenileme (refreshControl): sayfa en üstteyken aşağı çekilince load tekrar çalışır (components/Refresh.js).
  const refreshControl = useRefresh(load);

  // Elle işaretleme (sadece yönetici): önce onay sorulur; "İşaretle" seçilirse POST /api/manager/dues/manual
  // isteğiyle o ay ödendi sayılır ve takvim yeniden yüklenir.
  const markManually = (month) =>
    Alert.alert(
      'Ödendi olarak işaretle',
      `${route.params.flatName} dairesinin ${MONTH_NAMES[month - 1]} ${year} aidatı ödendi olarak işaretlensin mi?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İşaretle',
          onPress: async () => {
            try {
              await api.post('/manager/dues/manual', { flatId, month, year });
              load();
            } catch (e) {
              Alert.alert('İşaretlenemedi', e.message);
            }
          },
        },
      ],
    );

  // Sunucudan gelen durumu ekrandaki duruma çevirir: gelecek ayların "ödenmedi"si "henüz gelmedi" olur;
  // sakin kendi takviminde "sakin yok" yerine "katılmadan önce" görür.
  const displayStatus = (a) => {
    if (a.status === 'unpaid' && year * 12 + a.month > thisMonthIndex) return 'upcoming';
    if (a.status === 'empty' && !isManagerView) return 'before';
    return a.status;
  };

  const latestYear = thisYear + 1;
  const oldestYear = thisYear - 5;
  // Ayları 2'li satırlara böler (2 sütunlu ızgara)
  const rows = months ? Array.from({ length: 6 }, (_, i) => months.slice(i * 2, i * 2 + 2)) : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={refreshControl}>
      {/* Yıl seçici: oklarla önceki/sonraki yıl (5 yıl geriye, 1 yıl ileriye kadar) */}
      <Pager
        title={String(year)}
        subtitle={isManagerView ? `Daire ${route.params.flatName}` : session.flat ? `Daire ${session.flat.name}` : undefined}
        onPrevious={() => changeYear(-1)}
        onNext={() => changeYear(1)}
        previousDisabled={year <= oldestYear}
        nextDisabled={year >= latestYear}
        previousLabel="Önceki yıl"
        nextLabel="Sonraki yıl"
      />

      {isManagerView && <Text style={textStyles.note}>Ödenmemiş bir aya dokunarak elle “ödendi” işaretleyebilirsiniz.</Text>}

      {/* Hata kutusundaki "Tekrar dene" butonu: basınca load çalışır ve takvim yeniden istenir */}
      {error !== '' && <ErrorMessage message={error} onRetry={load} />}
      {months === null && error === '' && <ActivityIndicator color={colors.primary} />}

      {rows.map((row, s) => (
        <View key={s} style={styles.row}>
          {row.map((a) => {
            const status = displayStatus(a);
            // Yönetici sadece ödenmemiş, henüz gelmemiş veya sakinsiz ("empty") aylara dokunabilir; ödenmiş ya da
            // onay bekleyen ay tekrar işaretlenemez. Basınca markManually çalışır.
            const tappable = isManagerView && (status === 'unpaid' || status === 'upcoming' || status === 'empty');
            return (
              <MonthBox
                key={a.month}
                name={MONTH_NAMES[a.month - 1]}
                status={status}
                subtitle={a.paymentMethod === 'manager' ? 'Elle işaretlendi' : undefined}
                index={a.month}
                onPress={tappable ? () => markManually(a.month) : undefined}
              />
            );
          })}
        </View>
      ))}
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
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
