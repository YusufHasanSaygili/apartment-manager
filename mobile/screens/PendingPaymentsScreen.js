// Bekleyen bildirimler ekranı: yönetici sakinlerden gelen "aidatı verdim" bildirimlerini görür,
// her birini onaylar veya reddeder. Sonuçlanan bildirim listeden çıkar.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import Button from '../components/Button';
import ErrorMessage from '../components/ErrorMessage';
import { useRefresh } from '../components/Refresh';
import { monthLabel, formatMoney, formatDateTime } from '../format';
import { radius, colors, fonts } from '../theme';

export default function PendingPaymentsScreen() {
  // useState: sunucudan gelen bekleyen bildirimler. null → henüz yüklenmedi.
  const [reports, setReports] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');
  // useState: şu an işlenen (onaylanan/reddedilen) bildirimin id'si; o kartın butonları
  // dönen simge gösterir ve tekrar basılamaz.
  const [processingId, setProcessingId] = useState(null);

  // API isteği: GET /api/yonetim/aidatlar/bekleyen ile sitedeki bekleyen bildirimleri çeker.
  // useCallback: fonksiyon sabit kalır, useEffect gereksiz yere tekrar çalışmaz.
  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/yonetim/aidatlar/bekleyen');
      setReports(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // useEffect: ekran ilk açıldığında bir kez çalışır ve listeyi yükler.
  useEffect(() => {
    load();
  }, [load]);

  // Aşağı çekip yenileme (refreshControl): sayfa en üstteyken aşağı çekilince load tekrar çalışır (components/Refresh.js).
  const refreshControl = useRefresh(load);

  // action: 'onayla' veya 'reddet'. API isteği: POST /api/yonetim/aidatlar/:id/onayla|reddet.
  // Başarılı olunca bildirim listeden çıkarılır (sunucudan yeniden çekmeye gerek yok).
  const resolveReport = async (id, action) => {
    // Bir işlem sürerken başka bir karta basılırsa yok sayılır (işlemler sırayla yapılır).
    if (processingId !== null) return;
    setProcessingId(id);
    try {
      await api.post(`/yonetim/aidatlar/${id}/${action}`);
      setReports((previous) => previous.filter((b) => b.id !== id));
    } catch (e) {
      // Örn. bildirim bu arada başka bir cihazdan sonuçlandırıldıysa: liste yenilenir.
      Alert.alert('İşlem yapılamadı', e.message);
      load();
    } finally {
      setProcessingId(null);
    }
  };

  // Reddetme geri alınamaz; yanlışlıkla basılmasın diye önce onay sorulur.
  const confirmReject = (b) =>
    Alert.alert('Bildirimi reddet', `${b.daire} dairesinin ${monthLabel(b.ay, b.yil)} bildirimi reddedilsin mi? Sakin bu ay için tekrar bildirim gönderebilir.`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Reddet', style: 'destructive', onPress: () => resolveReport(b.id, 'reddet') },
    ]);

  // Hata varsa ortak hata kutusu; "Tekrar dene" load'u yeniden çalıştırır.
  if (error !== '') {
    return (
      <View style={styles.center}>
        <ErrorMessage mesaj={error} onRetry={load} />
      </View>
    );
  }

  // Liste gelene kadar yükleniyor simgesi gösterilir.
  if (reports === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    // FlatList: bildirimleri listeler; boşsa ListEmptyComponent gösterilir.
    // keyExtractor: React'in her kartı ayırt etmesi için benzersiz anahtar (bildirim id'si).
    <FlatList
      refreshControl={refreshControl}
      style={styles.container}
      contentContainerStyle={styles.icerik}
      data={reports}
      keyExtractor={(b) => b.id}
      ListEmptyComponent={<Text style={styles.bos}>Onay bekleyen aidat yok.</Text>}
      renderItem={({ item: b }) => (
        <View style={styles.card}>
          {/* Üst satır: solda daire rozeti, sağda tutar ve altında hangi ayın aidatı olduğu */}
          <View style={styles.topRow}>
            <View style={styles.flatBadge}>
              <Text style={styles.daire}>{b.daire}</Text>
            </View>
            <View style={styles.amountBlock}>
              <Text style={styles.tutar}>{formatMoney(b.tutar)}</Text>
              <Text style={styles.muted}>{monthLabel(b.ay, b.yil)}</Text>
            </View>
          </View>
          {/* Ödeme yöntemi ve bildirimin gönderildiği tarih; altında sakinin adı tek başına */}
          <Text style={styles.muted}>
            {b.odemeYontemi === 'banka' ? 'Banka havalesi' : 'Elden'} · {formatDateTime(b.tarih)}
          </Text>
          <Text style={styles.sakin}>{b.sakin}</Text>
          {b.aciklama !== '' && (
            <View style={styles.quote}>
              <Text style={styles.aciklama}>“{b.aciklama}”</Text>
            </View>
          )}

          <View style={styles.buttons}>
            {/* "Onayla" butonu (₺ coin ikonlu): basınca resolveReport(id, 'onayla') çalışır; o ay ödenmiş sayılır */}
            <View style={styles.button}>
              <Button baslik="Onayla" icon="paid" onPress={() => resolveReport(b.id, 'onayla')} loading={processingId === b.id} />
            </View>
            {/* "Reddet" butonu: basınca önce onay sorulur (confirmReject), onaylanırsa bildirim reddedilir */}
            <View style={styles.button}>
              <Button baslik="Reddet" variant="secondary" onPress={() => confirmReject(b)} loading={processingId === b.id} />
            </View>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  icerik: {
    padding: 18,
    gap: 12,
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  bos: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: fonts.metin,
    fontSize: 15,
    color: colors.muted,
  },
  card: {
    padding: 16,
    gap: 6,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  flatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius,
    backgroundColor: colors.surface3,
  },
  daire: {
    fontFamily: fonts.mono,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  amountBlock: {
    alignItems: 'flex-end',
  },
  tutar: {
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    fontFamily: fonts.metin,
    fontSize: 13,
    color: colors.muted,
  },
  sakin: {
    fontFamily: fonts.metin,
    fontSize: 15.5,
    fontWeight: '600',
    color: colors.text,
  },
  // Açıklama: solda ince çizgiyle alıntı gibi
  quote: {
    marginTop: 2,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
  },
  aciklama: {
    fontFamily: fonts.metin,
    fontSize: 14,
    fontStyle: 'italic',
    color: colors.text,
  },
  // İki buton yan yana, eşit genişlikte (flex: 1).
  buttons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  button: {
    flex: 1,
  },
});
