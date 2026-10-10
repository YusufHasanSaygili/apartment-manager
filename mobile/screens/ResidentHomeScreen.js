// Sakin ana ekranı: sakin giriş yapınca açılan ekran.
// Üstte site adı ve daire kartı (daire adı + bu ayın aidat durumu), altında 2'li ızgarada (bento) işlemler:
// aidat bildirimi gönder (altın, geniş), aidat takvimim (mini takvimli, uzun), duyurular ve yöneticiye mesaj.
// Altta sakinin son aidat bildirimleri ve en altta hesap kartı (çıkış, hesap silme).
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import ErrorMessage from '../components/ErrorMessage';
import { useRefresh } from '../components/Refresh';
import AccountCard from '../components/AccountCard';
import SiteHeader from '../components/SiteHeader';
import Tile from '../components/Tile';
import { STATUSES, StatusBadge } from '../components/Status';
import { MONTH_NAMES, monthLabel, relativeDay, formatMoney } from '../format';
import { mix, radius, colors, fonts, textStyles } from '../theme';

// Bildirim durumu → rozetin rengi (Status.js'teki durum) ve yazısı
const REPORT_STATUS = {
  pending: { status: 'pending', text: 'Onay bekliyor' },
  approved: { status: 'paid', text: 'Ödendi' },
  rejected: { status: 'unpaid', text: 'Reddedildi' },
};
const METHODS = { bank: 'Banka havalesi', cash: 'Elden' };
// Mini takvimdeki ay baş harfleri (Ocak … Aralık)
const MONTH_INITIALS = ['O', 'Ş', 'M', 'N', 'M', 'H', 'T', 'A', 'E', 'E', 'K', 'A'];

// navigation: aidat bildirimi, takvim, duyurular, sohbet ve hesap silme ekranlarına geçmek için kullanılır.
export default function ResidentHomeScreen({ navigation }) {
  const { session } = useSession();
  // useSafeAreaInsets: telefonun üstteki saat/şarj çubuğunun (ve çentiğin) yüksekliği. Bu ekranda üst başlık çubuğu
  // olmadığı için kaydırılan sayfa bu yükseklik kadar aşağıdan başlar; yoksa içerik saatin altına girerdi.
  const { top: topOffset } = useSafeAreaInsets();
  // useState: ekranın verisi { mine, months, manager, newAnnouncements }. null → henüz yüklenmedi.
  const [screenData, setScreenData] = useState(null);
  // useState: veri yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // API istekleri (aynı anda): GET /api/dues/mine (son bildirimler, aidat tutarı), GET /api/dues/calendar
  // (bu yılın ayları: bu ayın durumu ve mini takvim), GET /api/messages/chats (yöneticinin adı, okunmamış mesaj),
  // GET /api/announcements (bugün gelen duyuru sayısı).
  // useCallback: load her çizimde yeniden oluşturulmaz; useFocusEffect ona bağlı olduğu için gereksiz istek atılmaz.
  const load = useCallback(async () => {
    setError('');
    try {
      const [mine, calendar, chats, announcements] = await Promise.all([
        api.get('/dues/mine'),
        api.get('/dues/calendar', { params: { year } }),
        api.get('/messages/chats'),
        api.get('/announcements'),
      ]);
      setScreenData({
        mine: mine.data,
        months: calendar.data.months,
        manager: chats.data[0] ?? null,
        newAnnouncements: announcements.data.filter((d) => relativeDay(d.date) === 'Bugün').length,
      });
    } catch (e) {
      setError(e.message);
    }
  }, [year]);

  // useFocusEffect: ekran her öne geldiğinde veri yenilenir; bildirim gönderip veya mesaj okuyup dönünce güncel olur.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Aşağı çekip yenileme (refreshControl): sayfa en üstteyken aşağı çekilince load tekrar çalışır (components/Refresh.js).
  const refreshControl = useRefresh(load);

  // Takvimdeki durumu ekrana çevirir: gelecek ayların "ödenmedi"si "henüz gelmedi", katılmadan önceki aylar "before"
  const monthStatusOf = (a) => (a.status === 'unpaid' && a.month > month ? 'upcoming' : a.status === 'empty' ? 'before' : a.status);
  const thisMonth = screenData ? monthStatusOf(screenData.months[month - 1]) : null;
  const thisMonthText = { paid: 'Ödendi', pending: 'Onay bekliyor', unpaid: 'Ödenmedi', before: 'Henüz katılmadınız' }[thisMonth];

  return (
    // ScrollView: içerik ekrana sığmazsa sayfa kaydırılır.
    <ScrollView style={[styles.container, { marginTop: topOffset }]} contentContainerStyle={styles.content} refreshControl={refreshControl}>
      {/* Selamlama ve site adı, adın sağında logo (SiteHeader, ImageBackground) */}
      <View style={styles.greetingBlock}>
        <SiteHeader greeting={`Hoş geldin, ${session.user.name}`} name={session.site.name} />
      </View>

      {/* Daire kartı: solda daire adı (büyük, mono), sağda bu ayın aidat durumu ("EKİM" zümrüt renkte) */}
      <View style={styles.card}>
        <View style={styles.flatCard}>
          <View>
            <Text style={textStyles.label}>DAİRENİZ</Text>
            {/* daire normalde hep doludur; sunucu dairenin kaydını bulamazsa null gelir, o durumda çizgi gösterilir */}
            <Text style={styles.flatLarge}>{session.flat?.name ?? '—'}</Text>
          </View>
          {thisMonth && thisMonthText && (
            <View style={styles.thisMonth}>
              <Text style={textStyles.label}>
                <Text style={{ color: colors.emerald }}>{MONTH_NAMES[month - 1].toLocaleUpperCase('tr-TR')}</Text> AİDATI
              </Text>
              <StatusBadge status={thisMonth === 'before' ? 'upcoming' : thisMonth} text={thisMonthText} />
            </View>
          )}
        </View>
      </View>

      {error !== '' ? (
        // Hata olursa "Tekrar dene" ile load yeniden çalışır
        <ErrorMessage message={error} onRetry={load} />
      ) : screenData === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          {/* "Aidat bildirimi gönder": geniş altın kutu; basınca ReportPayment açılır, yöneticinin belirlediği tutar
              da gönderilir ki formda hazır gelsin */}
          <Tile
            wide
            highlighted
            icon="reportPayment"
            title="Aidat bildirimi gönder"
            subtitle="Ödediğinizi yöneticiye bildirin"
            onPress={() => navigation.navigate('ReportPayment', { dueAmount: screenData.mine.dueAmount })}
          />
          <View style={styles.row}>
            <View style={styles.columns}>
              {/* "Aidat takvimim" (uzun, mini takvimli): basınca DueCalendar açılır (sakinin kendi dairesi) */}
              <Tile icon="calendar" title="Aidat takvimim" subtitle={String(year)} onPress={() => navigation.navigate('DueCalendar')}>
                <MiniCalendar months={screenData.months.map(monthStatusOf)} thisMonth={month} />
              </Tile>
            </View>
            <View style={styles.columns}>
              {/* "Duyurular": basınca duyuru listesi açılır; rozet bugün gelen duyuru sayısı */}
              <Tile
                icon="announcement"
                title="Duyurular"
                subtitle={screenData.newAnnouncements > 0 ? `${screenData.newAnnouncements} yeni duyuru` : 'Sitenin duyuruları'}
                badge={screenData.newAnnouncements > 0 ? String(screenData.newAnnouncements) : null}
                onPress={() => navigation.navigate('Announcements')}
              />
              {/* "Yöneticiye mesaj gönder": basınca Chat açılır; sakin sadece sitenin yöneticisiyle yazışabilir */}
              <Tile
                icon="message"
                title="Yöneticiye mesaj gönder"
                subtitle={screenData.manager?.name ?? 'Site yöneticisi'}
                badge={screenData.manager?.unread > 0 ? String(screenData.manager.unread) : null}
                onPress={() => navigation.navigate('Chat', { title: screenData.manager ? `${screenData.manager.name} · Yönetici` : undefined })}
              />
            </View>
          </View>

          <Text style={[textStyles.label, styles.section]}>SON BİLDİRİMLERİM</Text>
          {screenData.mine.reports.length === 0 && <Text style={textStyles.note}>Henüz bildirim göndermediniz.</Text>}
          {screenData.mine.reports.map((b) => {
            const d = REPORT_STATUS[b.status];
            const rejected = b.status === 'rejected';
            return (
              // Reddedilen bildirime basınca o ay için formu yeniden açar (ay ve yıl hazır gelir); diğerleri basılamaz.
              <Pressable
                key={b.id}
                style={({ pressed }) => [styles.card, styles.reportCard, pressed && styles.pressed]}
                disabled={!rejected}
                onPress={() => navigation.navigate('ReportPayment', { dueAmount: screenData.mine.dueAmount, month: b.month, year: b.year })}
                accessibilityRole={rejected ? 'button' : undefined}
                accessibilityHint={rejected ? 'Bu ay için yeniden bildirim gönderir' : undefined}
              >
                <View style={styles.reportHeader}>
                  <Text style={styles.reportMonth}>{monthLabel(b.month, b.year)}</Text>
                  <StatusBadge status={d.status} text={d.text} />
                </View>
                <Text style={styles.muted}>
                  {formatMoney(b.amount)} · {METHODS[b.paymentMethod]}
                  {b.note !== '' ? ` · “${b.note}”` : ''}
                </Text>
                {rejected && <Text style={styles.repeat}>Tekrar göndermek için dokunun ›</Text>}
              </Pressable>
            );
          })}
        </>
      )}

      {/* Hesap kartı: Çıkış yap ve Hesabımı sil */}
      <AccountCard navigation={navigation} role={`Sakin${session.flat ? ` · ${session.flat.name}` : ''}`} />
    </ScrollView>
  );
}

// Mini takvim (MiniCalendar): yılın 12 ayı, 4 sütunlu küçük kutularda ay baş harfleriyle. Ödenen ay yeşil, bekleyen sarı halka,
// ödenmeyen kırmızı; katılmadan önceki aylar soluk.
function MiniCalendar({ months, thisMonth }) {
  return (
    <View style={styles.mini}>
      {[0, 1, 2].map((s) => (
        <View key={s} style={styles.miniRow}>
          {months.slice(s * 4, s * 4 + 4).map((status, i) => {
            const monthIndex = s * 4 + i;
            const filled = ['paid', 'pending', 'unpaid'].includes(status);
            const color = STATUSES[status].color;
            return (
              <View
                key={monthIndex}
                style={[
                  styles.miniSquare,
                  filled && { backgroundColor: mix(color, 0.14), borderColor: color, borderWidth: 1.5 },
                  status === 'before' && { opacity: 0.45 },
                  monthIndex + 1 === thisMonth && !filled && { borderColor: colors.borderStrong },
                ]}
              >
                <Text style={[styles.miniLetter, filled && { color }]}>{MONTH_INITIALS[monthIndex]}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // paddingTop: saat çubuğunun altında (marginTop ile) kalan küçük boşluk
  content: {
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
  card: {
    padding: 16,
    gap: 8,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  flatCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
  },
  flatLarge: {
    marginTop: 6,
    fontFamily: fonts.mono,
    fontSize: 50,
    fontWeight: '600',
    lineHeight: 54,
    letterSpacing: -2,
    color: colors.text,
  },
  thisMonth: {
    alignItems: 'flex-end',
    gap: 6,
  },
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
  miniSquare: {
    flex: 1,
    flexBasis: 0,
    aspectRatio: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLetter: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.muted,
  },
  section: {
    marginTop: 6,
  },
  reportCard: {
    gap: 6,
  },
  pressed: {
    opacity: 0.75,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportMonth: {
    fontFamily: fonts.text,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    fontFamily: fonts.text,
    fontSize: 13,
    color: colors.muted,
  },
  repeat: {
    fontFamily: fonts.text,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
