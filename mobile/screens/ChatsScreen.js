// Sohbetler ekranı (yönetici): sitedeki sakinleri, her biriyle son mesajla ve okunmamış mesaj sayısıyla listeler.
// Son yazışılan sakin en üstte; hiç yazışılmamış sakinler altta, daire adına göre sıralı.
// Bir sakine dokununca o sakinle sohbet ekranı açılır. Yeni mesaj gelince liste kendiliğinden güncellenir.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useSocketEvent } from '../services/socket';
import ErrorMessage from '../components/ErrorMessage';
import { useRefresh } from '../components/Refresh';
import { relativeDay, formatTime } from '../format';
import { radius, colors, fonts, textStyles } from '../theme';

// Listede son mesajın zamanı: bugünse saat ("21:11"), değilse "Dün" / "3 gün önce"
const shortTime = (date) => (relativeDay(date) === 'Bugün' ? formatTime(date) : relativeDay(date));

// navigation: bir sakine dokununca Sohbet ekranını açmak için kullanılır.
export default function ChatsScreen({ navigation }) {
  // useState: sunucudan gelen sohbet listesi. null → henüz yüklenmedi.
  const [chats, setChats] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');

  // API isteği: GET /api/messages/chats ile sakinleri ve her biriyle son mesajı çeker.
  // useCallback: fonksiyon her çizimde yeniden oluşmaz; useFocusEffect onu bağımlılık olarak kullandığı için
  // aksi halde ekran her yenilendiğinde istek tekrar atılırdı.
  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/messages/chats');
      setChats(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde çalışır; bir sohbetten geri dönünce son mesaj güncellenir.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Soket olayları: herhangi bir sakinden yeni mesaj gelince (veya ben gönderince) ya da bağlantı
  // yeniden kurulunca liste yeniden çekilir; böylece son mesaj ve sıralama sayfa yenilemeden güncellenir.
  // navigation.isFocused(): ekran şu an görünüyor mu. Sohbet ekranı açıkken bu liste arkada bekler;
  // o sırada gelen mesajlar için boşuna istek atılmaz, geri dönünce useFocusEffect zaten yeniler.
  // useCallback: dinleyici her çizimde silinip yeniden eklenmesin diye fonksiyon sabit tutulur;
  // sadece navigation veya load değişirse yeniden oluşturulur.
  const loadIfVisible = useCallback(() => {
    if (navigation.isFocused()) load();
  }, [navigation, load]);
  useSocketEvent('newMessage', loadIfVisible);
  useSocketEvent('connect', loadIfVisible);

  // Aşağı çekip yenileme (refreshControl): sayfa en üstteyken aşağı çekilince load tekrar çalışır (components/Refresh.js).
  const refreshControl = useRefresh(load);

  // Okunmamış mesajı olan sohbetler üstte ayrı bölümde, diğer sakinler altta. Toplam okunmamış sayısı özet kartında.
  const unreadChats = (chats ?? []).filter((x) => x.unread > 0);
  const rest = (chats ?? []).filter((x) => x.unread === 0);
  const total = unreadChats.reduce((t, x) => t + x.unread, 0);
  const sections = [
    { title: 'OKUNMAMIŞ', data: unreadChats },
    { title: 'DİĞER SAKİNLER', data: rest },
  ].filter((b) => b.data.length > 0);

  return (
    // SectionList: bölümlü liste (Okunmamış / Diğer sakinler). Aşağı çekince liste yenilenir.
    <SectionList
      style={styles.container}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(x) => x.id}
      refreshControl={refreshControl}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <>
          {/* Hata kutusundaki "Tekrar dene" butonu: basınca load çalışır ve liste yeniden istenir */}
          {error !== '' && <ErrorMessage message={error} onRetry={load} />}
          {chats === null && error === '' && <ActivityIndicator color={colors.primary} />}
          {/* Özet kartı: toplam okunmamış mesaj ve kaç sohbette olduğu */}
          {chats && chats.length > 0 && (
            <View style={styles.summary}>
              <Text style={styles.summaryCount}>{total}</Text>
              <Text style={textStyles.note}>{total > 0 ? `okunmamış mesaj\n${unreadChats.length} sohbette` : 'Okunmamış mesaj yok'}</Text>
            </View>
          )}
        </>
      }
      renderSectionHeader={({ section }) => <Text style={[textStyles.label, styles.section]}>{section.title}</Text>}
      ListEmptyComponent={
        chats && (
          <Text style={styles.empty}>Henüz kayıtlı sakin yok. Sakinler davet koduyla katıldıkça burada görünür.</Text>
        )
      }
      renderItem={({ item: x }) => {
        const unread = x.unread > 0;
        const noMessages = !x.lastMessage;
        return (
          // Satıra basınca o sakinle Sohbet ekranı açılır; başlıkta sakinin adı ve dairesi görünür.
          <Pressable
            style={({ pressed }) => [styles.row, unread && styles.rowUnread, noMessages && styles.rowEmpty, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Chat', { personId: x.id, title: `${x.name} (${x.subtitle})` })}
            accessibilityRole="button"
            accessibilityHint={`${x.name} ile sohbeti açar`}
          >
            {/* Daire rozeti (örn. "A5"); köşedeki nokta (dot): sarı = okunmamış mesaj var, yeşil = hepsi okundu */}
            <View style={[styles.avatar, noMessages && styles.avatarEmpty]}>
              <Text style={[styles.avatarText, noMessages && { color: colors.muted }]}>{x.subtitle}</Text>
              {!noMessages && <View style={[styles.dot, { backgroundColor: unread ? colors.warning : colors.success }]} />}
            </View>
            <View style={styles.center}>
              <View style={styles.topRow}>
                <Text style={[styles.name, noMessages && styles.nameEmpty]} numberOfLines={1}>
                  {x.name}
                </Text>
                {x.lastMessage && <Text style={styles.date}>{shortTime(x.lastMessage.date)}</Text>}
              </View>
              {/* Son mesajın tek satırlık önizlemesi; benim yazdığım mesajın başında "Siz:" yazar (okundu bilgisi listede gelmediği için tik gösterilmez) */}
              <View style={styles.topRow}>
                <Text style={[styles.preview, unread && styles.unreadText, noMessages && styles.previewEmpty]} numberOfLines={1}>
                  {x.lastMessage ? `${x.lastMessage.fromMe ? 'Siz: ' : ''}${x.lastMessage.content}` : 'Henüz mesaj yok'}
                </Text>
                {/* Okunmamış sayısı: gri kare içinde beyaz sayı (0 ise gösterilmez) */}
                {unread && (
                  <View style={styles.counter} accessibilityLabel={`${x.unread} okunmamış mesaj`}>
                    <Text style={styles.counterText}>{x.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        );
      }}
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
    gap: 6,
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.muted,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  summaryCount: {
    fontFamily: fonts.mono,
    fontSize: 34,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    marginTop: 10,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius,
    backgroundColor: colors.card,
  },
  rowUnread: {
    backgroundColor: colors.surface2,
  },
  rowEmpty: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  // Okunma noktası: avatarın sağ alt köşesinde, zemin renginde halkayla
  dot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  center: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  nameEmpty: {
    fontWeight: '500',
    color: colors.muted,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.muted,
  },
  preview: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 13.5,
    color: colors.muted,
  },
  previewEmpty: {
    fontSize: 12.5,
    color: colors.faint,
  },
  unreadText: {
    color: colors.text,
  },
  counter: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius,
    backgroundColor: '#3B4943',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
