// Aidat takvimi ekranı: bir dairenin seçilen yıldaki 12 ayının aidat durumunu 2 sütunlu kutularda gösterir.
// Yönetici haritada bir daireye dokununca açılır (route'ta daireId gelir); sakin kendi ana ekranından açar
// (daireId gelmez → sunucu sakinin kendi dairesini döner). Kutuların hepsi aynı yükseklikte; solda durum ikonu,
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

// route.params: { daireId, flatName } (yönetici) veya boş (sakin)
export default function DueCalendarScreen({ route }) {
  const flatId = route.params?.daireId;
  // Yönetici mi bakıyor: flatId geldiyse evet. Hangi adrese istek atılacağını ve elle işaretlemeyi belirler.
  const manager = Boolean(flatId);
  const { session } = useSession();

  const today = new Date();
  const thisYear = today.getFullYear();
  // Bugünün ay sırası (yıl × 12 + ay): bundan sonraki ödenmemiş aylar "Henüz gelmedi" gösterilir.
  const thisMonthIndex = thisYear * 12 + today.getMonth() + 1;

  // useState: gösterilen yıl. Oklarla değişir; değişince takvim o yıl için yeniden istenir.
  const [year, setYear] = useState(thisYear);
  // useState: 12 ayın listesi [{ ay, durum, odemeYontemi }]. null → yükleniyor.
  const [months, setMonths] = useState(null);
  // useState: takvim yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');

  // useRef: son isteğin numarası; oklara hızlı basılınca eski yılın geç gelen cevabı ekrana yazılmasın diye.
  const lastRequest = useRef(0);

  // API isteği: yönetici için GET /api/yonetim/aidatlar/takvim/:daireId?yil=, sakin için GET /api/aidatlar/takvim?yil=
  // → seçilen yılın 12 ayı ve her ayın durumu.
  // useCallback: load sadece daire veya yıl değişince yeniden oluşur; aşağıdaki useEffect de o zaman tekrar çalışır.
  const load = useCallback(async () => {
    const requestNo = ++lastRequest.current;
    setError('');
    try {
      const url = manager ? `/yonetim/aidatlar/takvim/${flatId}` : '/aidatlar/takvim';
      const { data } = await api.get(url, { params: { yil: year } });
      if (requestNo === lastRequest.current) setMonths(data.aylar);
    } catch (e) {
      if (requestNo === lastRequest.current) setError(e.message);
    }
  }, [manager, flatId, year]);

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

  // Elle işaretleme (sadece yönetici): önce onay sorulur; "İşaretle" seçilirse POST /api/yonetim/aidatlar/elle
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
              await api.post('/yonetim/aidatlar/elle', { daireId: flatId, ay: month, yil: year });
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
    if (a.durum === 'odenmedi' && year * 12 + a.ay > thisMonthIndex) return 'gelecek';
    if (a.durum === 'bos' && !manager) return 'once';
    return a.durum;
  };

  const latestYear = thisYear + 1;
  const oldestYear = thisYear - 5;
  // Ayları 2'li satırlara böler (2 sütunlu ızgara)
  const rows = months ? Array.from({ length: 6 }, (_, i) => months.slice(i * 2, i * 2 + 2)) : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.icerik} refreshControl={refreshControl}>
      {/* Yıl seçici: oklarla önceki/sonraki yıl (5 yıl geriye, 1 yıl ileriye kadar) */}
      <Pager
        baslik={String(year)}
        subtitle={manager ? `Daire ${route.params.flatName}` : session.daire ? `Daire ${session.daire.ad}` : undefined}
        onPrevious={() => changeYear(-1)}
        onNext={() => changeYear(1)}
        previousDisabled={year <= oldestYear}
        nextDisabled={year >= latestYear}
        previousLabel="Önceki yıl"
        nextLabel="Sonraki yıl"
      />

      {manager && <Text style={textStyles.aciklama}>Ödenmemiş bir aya dokunarak elle “ödendi” işaretleyebilirsiniz.</Text>}

      {/* Hata kutusundaki "Tekrar dene" butonu: basınca load çalışır ve takvim yeniden istenir */}
      {error !== '' && <ErrorMessage mesaj={error} onRetry={load} />}
      {months === null && error === '' && <ActivityIndicator color={colors.primary} />}

      {rows.map((row, s) => (
        <View key={s} style={styles.row}>
          {row.map((a) => {
            const status = displayStatus(a);
            // Yönetici sadece ödenmemiş, henüz gelmemiş veya sakinsiz ("bos") aylara dokunabilir; ödenmiş ya da
            // onay bekleyen ay tekrar işaretlenemez. Basınca markManually çalışır.
            const tappable = manager && (status === 'odenmedi' || status === 'gelecek' || status === 'bos');
            return (
              <MonthBox
                key={a.ay}
                ad={MONTH_NAMES[a.ay - 1]}
                durum={status}
                subtitle={a.odemeYontemi === 'yonetici' ? 'Elle işaretlendi' : undefined}
                index={a.ay}
                onPress={tappable ? () => markManually(a.ay) : undefined}
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
  icerik: {
    padding: 18,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
