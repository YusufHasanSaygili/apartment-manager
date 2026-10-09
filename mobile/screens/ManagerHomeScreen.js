// Yönetici ana ekranı: yönetici giriş yapınca açılan ekran.
// Üstte site adı ve özet bilgi, altında bu ayın aidat durumunu gösteren hız kadranı, onun altında 2'li ızgarada
// (bento) tüm yönetici işlemleri: bekleyen aidatlar, daire haritası (mini haritayla), mesajlar, duyurular, daireler
// ve davet kodları, aidat hatırlatması, aidat tutarı, yöneticilik devri. En altta hesap kartı (çıkış, hesap silme).
// Kurulum yapılmadıysa bunların yerine 3 adımlı kurulum yol haritası görünür.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import Button from '../components/Button';
import ErrorMessage from '../components/ErrorMessage';
import { useRefresh } from '../components/Refresh';
import AccountCard from '../components/AccountCard';
import SiteHeader from '../components/SiteHeader';
import Tile from '../components/Tile';
import Gauge from '../components/Gauge';
import Icon from '../components/Icon';
import { STATUSES } from '../components/Status';
import { MONTH_NAMES, formatMoney } from '../format';
import { mix, radius, colors, fonts, textStyles } from '../theme';

// navigation: işlemlerin ekranlarına (harita, bekleyen aidatlar, duyurular...) geçmek için kullanılır.
export default function ManagerHomeScreen({ navigation }) {
  // session burada asla null değildir: App.js bu ekranı sadece oturum açıkken gösterir.
  const { session } = useSession();
  // useSafeAreaInsets: telefonun üstteki saat/şarj çubuğunun (ve çentiğin) yüksekliği. Bu ekranda üst başlık çubuğu
  // olmadığı için kaydırılan sayfa bu yükseklik kadar aşağıdan başlar; yoksa içerik saatin altına girerdi.
  const { top: topOffset } = useSafeAreaInsets();

  // useState: ekranın verisi { ozet, map, okunmamis, latestAnnouncement }. null → henüz yüklenmedi.
  // ozet: bina/daire sayısı, aidat tutarı, bekleyen sayısı; map: bu ayın daire durumları (kadran ve mini harita için).
  const [screenData, setScreenData] = useState(null);
  // useState: veri yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');
  // useState: hatırlatma isteği sürerken true; kutuda "Gönderiliyor…" yazar, tekrar basılamaz.
  const [reminding, setReminding] = useState(false);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // API istekleri (aynı anda, Promise.all): GET /api/kurulum (özet), GET /api/yonetim/aidatlar/harita (bu ayın
  // daire durumları), GET /api/mesajlar/sohbetler (okunmamış mesaj sayısı), GET /api/duyurular (son duyuru).
  // Kurulum yapılmadıysa diğerleri istenmez.
  // useCallback: load fonksiyonu her çizimde yeniden oluşturulmaz (sadece ay/yıl değişirse). useFocusEffect bu
  // fonksiyona bağlı olduğu için, yoksa her çizimde istek tekrar atılırdı.
  const load = useCallback(async () => {
    setError('');
    try {
      const { data: summary } = await api.get('/kurulum');
      if (summary.binaSayisi === 0) {
        setScreenData({ ozet: summary });
        return;
      }
      const [map, chats, announcements] = await Promise.all([
        api.get('/yonetim/aidatlar/harita', { params: { ay: month, yil: year } }),
        api.get('/mesajlar/sohbetler'),
        api.get('/duyurular'),
      ]);
      setScreenData({
        ozet: summary,
        map: map.data,
        okunmamis: chats.data.reduce((t, s) => t + s.okunmamis, 0),
        latestAnnouncement: announcements.data[0]?.baslik ?? null,
      });
    } catch (e) {
      setError(e.message);
    }
  }, [month, year]);

  // useFocusEffect: ekran her ÖNE GELDİĞİNDE çalışır (useEffect'ten farkı bu). Onay, mesaj okuma veya
  // kurulumdan geri dönülünce sayılar ve kadran kendiliğinden güncellenir.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Aşağı çekip yenileme (refreshControl): sayfa en üstteyken aşağı çekilince load tekrar çalışır (components/Refresh.js).
  const refreshControl = useRefresh(load);

  // API isteği: POST /api/yonetim/aidatlar/hatirlatma ile bu ayın aidatını ödemeyen sakinlere hatırlatma gönderir.
  // Sonuçta kaç daireye gönderildiği, bildirimi kapalı sakin varsa o da yöneticiye gösterilir.
  const sendReminder = async () => {
    setReminding(true);
    try {
      const { data } = await api.post('/yonetim/aidatlar/hatirlatma');
      const unreachableCount = data.odemeyen - data.bildirimGiden;
      Alert.alert(
        'Hatırlatma gönderildi',
        data.odemeyen === 0
          ? 'Bu ay ödemeyen daire yok, kimseye hatırlatma gönderilmedi.'
          : `${data.bildirimGiden} daireye hatırlatma gönderildi.` +
              (unreachableCount > 0 ? ` ${unreachableCount} sakinin bildirimleri kapalı olduğu için ulaşılamadı.` : ''),
      );
    } catch (e) {
      Alert.alert('Hatırlatma gönderilemedi', e.message);
    } finally {
      setReminding(false);
    }
  };

  // Hatırlatma tüm ödemeyenlerin telefonuna gider; yanlışlıkla basılmasın diye önce onay sorulur.
  // "Gönder" seçilirse sendReminder çalışır; "Vazgeç" pencereyi kapatır, istek atılmaz.
  const confirmReminder = () => {
    if (reminding) return;
    Alert.alert('Aidat hatırlatması', `${MONTH_NAMES[month - 1]} ayının aidatını ödemeyen tüm sakinlere hatırlatma bildirimi gönderilsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Gönder', onPress: sendReminder },
    ]);
  };

  const summary = screenData?.ozet;
  const amountText = summary?.aidatTutari == null ? 'Belirlenmedi' : formatMoney(summary.aidatTutari);

  return (
    // ScrollView: içerik ekrana sığmazsa sayfa kaydırılır.
    <ScrollView style={[styles.container, { marginTop: topOffset }]} contentContainerStyle={styles.icerik} refreshControl={refreshControl}>
      {/* Selamlama, site adı (sağında logo, SiteHeader, ImageBackground) ve kısa özet (bina, daire, aidat) */}
      <View style={styles.greetingBlock}>
        <SiteHeader greeting={`Hoş geldin, ${session.kullanici.ad}`} ad={session.site.ad} />
        {summary && (
          <Text style={[textStyles.label, styles.siteMeta]}>
            {summary.binaSayisi === 0
              ? 'SİTENİZ HAZIR, 3 ADIMDA KURUN'
              : `${summary.binaSayisi} BİNA · ${summary.daireSayisi} DAİRE · ${amountText.toLocaleUpperCase('tr-TR')} / AY`}
          </Text>
        )}
      </View>

      {error !== '' ? (
        // Hata olursa "Tekrar dene" ile load yeniden çalışır
        <ErrorMessage mesaj={error} onRetry={load} />
      ) : screenData === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : summary.binaSayisi === 0 ? (
        <BeforeSetup navigation={navigation} aidatTutari={summary.aidatTutari} />
      ) : (
        <>
          <SummaryCard map={screenData.map} ay={month} yil={year} />

          {/* Bento ızgara. "Bekleyen aidatlar": geniş, altın kutu; basınca PendingPayments ekranı açılır */}
          <Tile
            wide
            highlighted={summary.bekleyenSayisi > 0}
            icon="pendingList"
            baslik="Bekleyen aidatlar"
            subtitle={summary.bekleyenSayisi > 0 ? `${summary.bekleyenSayisi} aidat onayınızı bekliyor` : 'Onay bekleyen aidat yok'}
            badge={summary.bekleyenSayisi > 0 ? String(summary.bekleyenSayisi) : null}
            onPress={() => navigation.navigate('PendingPayments')}
          />
          <View style={styles.row}>
            {/* "Daire haritası" kutusu (iki kutu boyunda, içinde mini harita): basınca FlatMap açılır */}
            <View style={styles.columns}>
              <Tile icon="map" baslik="Daire haritası" subtitle="Kim ödedi, kim ödemedi" onPress={() => navigation.navigate('FlatMap')}>
                <MiniMap map={screenData.map} />
              </Tile>
            </View>
            <View style={styles.columns}>
              {/* "Mesajlar" kutusu: basınca Chats açılır; rozet okunmamış mesaj sayısı */}
              <Tile
                icon="message"
                baslik="Mesajlar"
                subtitle={screenData.okunmamis > 0 ? `${screenData.okunmamis} okunmamış` : 'Yeni mesaj yok'}
                badge={screenData.okunmamis > 0 ? String(screenData.okunmamis) : null}
                onPress={() => navigation.navigate('Chats')}
              />
              {/* "Duyurular" kutusu: basınca Announcements açılır; altında son duyurunun başlığı */}
              <Tile
                icon="announcement"
                baslik="Duyurular"
                subtitle={screenData.latestAnnouncement ? `Son: ${screenData.latestAnnouncement}` : 'Henüz duyuru yok'}
                onPress={() => navigation.navigate('Announcements')}
              />
            </View>
          </View>
          <View style={styles.row}>
            {/* "Daireler" kutusu: basınca Flats açılır (davet kodları) */}
            <Tile icon="key" baslik="Daireler" subtitle="Davet kodları" onPress={() => navigation.navigate('Flats')} />
            {/* "Hatırlatma gönder" kutusu: basınca önce onay sorulur (confirmReminder), sonra sendReminder çalışır */}
            <Tile
              icon="bell"
              baslik="Hatırlatma gönder"
              subtitle={reminding ? 'Gönderiliyor…' : "Her ayın 10'unda otomatik"}
              onPress={confirmReminder}
            />
          </View>
          <View style={styles.row}>
            {/* "Aidat tutarı" kutusu: basınca DueAmount açılır, mevcut tutar da gönderilir */}
            <Tile
              icon="lira"
              baslik="Aidat tutarı"
              subtitle={summary.aidatTutari == null ? 'Belirlenmedi' : `${amountText} / ay`}
              onPress={() => navigation.navigate('DueAmount', { aidatTutari: summary.aidatTutari })}
            />
            {/* "Yöneticiliği devret" kutusu: basınca Handover açılır */}
            <Tile icon="handover" baslik="Yöneticiliği devret" subtitle="Bir sakine" onPress={() => navigation.navigate('Handover')} />
          </View>
        </>
      )}

      {/* Hesap kartı: Çıkış yap ve Hesabımı sil */}
      <AccountCard navigation={navigation} rol="Yönetici" />
    </ScrollView>
  );
}

// Bu ayın aidat özeti: solda hız kadranı (ödeyenlerin oranı), sağda Ödedi / Bekliyor / Ödemedi sayıları.
// Oran sadece sakini olan dairelere göre hesaplanır (boş daireler aidat ödemez).
function SummaryCard({ map, ay: month, yil: year }) {
  const { odendi: paid, bekliyor: waiting, odenmedi: unpaid } = map.ozet;
  const occupied = paid + waiting + unpaid;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={textStyles.label}>{`${MONTH_NAMES[month - 1]} ${year} aidatı`.toLocaleUpperCase('tr-TR')}</Text>
        <Text style={styles.muted}>{occupied} dolu daire</Text>
      </View>
      <View style={styles.summaryBody}>
        <Gauge ratio={occupied === 0 ? 0 : paid / occupied} />
        <View style={styles.summaryList}>
          {[
            ['odendi', paid],
            ['bekliyor', waiting],
            ['odenmedi', unpaid],
          ].map(([d, n]) => (
            <View key={d} style={styles.summaryRow}>
              <Icon ad={STATUSES[d].icon} size={17} color={STATUSES[d].color} />
              <Text style={styles.summaryName}>{STATUSES[d].ad}</Text>
              <Text style={styles.summaryCount}>{n}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Mini harita (MiniMap): ilk 16 dairenin bu ayki durumu, 4 sütunluk küçük kareler (ince renk tonu + çerçeve).
function MiniMap({ map }) {
  const flats = map.binalar.flatMap((b) => b.daireler).slice(0, 16);
  // 4'erli satırlara bölünür; son satır eksikse boş yer tutucularla tamamlanır ki kareler hizalı kalsın.
  const rows = [];
  for (let i = 0; i < flats.length; i += 4) rows.push(flats.slice(i, i + 4));
  return (
    <View style={styles.mini}>
      {rows.map((row, s) => (
        <View key={s} style={styles.miniRow}>
          {[0, 1, 2, 3].map((i) => {
            const d = row[i];
            if (!d) return <View key={i} style={styles.miniSquareEmpty} />;
            const color = STATUSES[d.durum].color;
            return (
              <View
                key={d.id}
                style={[
                  styles.miniSquare,
                  d.durum === 'bos'
                    ? { borderColor: colors.border }
                    : { backgroundColor: mix(color, 0.26), borderColor: mix(color, 0.6) },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

// Kurulum yapılmadıysa: 3 adımlı yol haritası ve iki buton (kurulum, aidat tutarı)
function BeforeSetup({ navigation, aidatTutari: dueAmount }) {
  const steps = [
    ['Binaları ve daireleri oluşturun', 'Her daireye 6 haneli davet kodu verilir.'],
    ['Aylık aidat tutarını belirleyin', 'Sakinlerin formunda hazır gelir.'],
    ['Davet kodlarını paylaşın', 'Sakinler kodla katılır.'],
  ];
  return (
    <>
      <View style={styles.steps}>
        {steps.map(([title, subtitle], i) => (
          <View key={title} style={[styles.step, i > 0 && styles.stepLine]}>
            <View style={[styles.stepNumber, i === 0 && styles.stepNumberActive]}>
              <Text style={[styles.stepNumberText, i === 0 && { color: colors.onEmerald }]}>{i + 1}</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, i > 0 && { color: colors.muted, fontWeight: '500' }]}>{title}</Text>
              <Text style={styles.muted}>{subtitle}</Text>
            </View>
          </View>
        ))}
      </View>
      {/* "Bina ve daire kurulumu" butonu: basınca Setup ekranına geçilir */}
      <Button baslik="Bina ve daire kurulumu" icon="setup" onPress={() => navigation.navigate('Setup')} />
      {/* "Aidat tutarını belirle" butonu: basınca DueAmount ekranı açılır */}
      <Button
        baslik={dueAmount == null ? 'Aidat tutarını belirle' : 'Aidat tutarını değiştir'}
        icon="lira"
        variant="secondary"
        onPress={() => navigation.navigate('DueAmount', { aidatTutari: dueAmount })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // paddingTop: saat çubuğunun altında (marginTop ile) kalan küçük boşluk
  icerik: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 12,
  },
  loading: {
    marginVertical: 40,
  },
  greetingBlock: {
    marginBottom: 4,
  },
  siteMeta: {
    marginTop: 6,
  },
  muted: {
    fontFamily: fonts.metin,
    fontSize: 13,
    color: colors.muted,
  },
  card: {
    padding: 16,
    gap: 10,
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
  summaryBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryList: {
    flex: 1,
    gap: 9,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryName: {
    flex: 1,
    fontFamily: fonts.metin,
    fontSize: 13.5,
    color: colors.text,
  },
  summaryCount: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  // Bento satırı: iki kutu yan yana, eşit genişlikte
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  columns: {
    flex: 1,
    flexBasis: 0,
    gap: 10,
  },
  mini: {
    gap: 4,
  },
  miniRow: {
    flexDirection: 'row',
    gap: 4,
  },
  // Her satırda 4 eşit kare (flex: 1 genişliği paylaştırır, aspectRatio yüksekliği genişliğe eşitler)
  miniSquare: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 2,
    borderWidth: 1,
  },
  miniSquareEmpty: {
    flex: 1,
  },
  steps: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  step: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 12,
  },
  stepLine: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: radius,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberActive: {
    backgroundColor: colors.emeraldFill,
  },
  stepNumberText: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: fonts.metin,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
});
