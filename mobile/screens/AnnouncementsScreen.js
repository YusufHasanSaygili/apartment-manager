// Duyurular ekranı: sitedeki duyuruları yeniden eskiye listeler. Hem yönetici hem sakin kullanır.
// Her kartta solda kare tarih bloğu (gün ve ay), başlık, zümrüt renkli göreli zaman ("Bugün · 09:12",
// "2 gün önce · 18:40") ve duyurunun metni var. Bugünün duyurusu zümrüt çerçeveyle öne çıkar.
// Yönetici için üstte iki kutu (Yeni duyuru, Tekrarlayan) vardır ve bir karta dokununca düzenleme ekranı açılır;
// sakin sadece okur.
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import ErrorMessage from '../components/ErrorMessage';
import { useRefresh } from '../components/Refresh';
import Icon from '../components/Icon';
import Tile from '../components/Tile';
import { relativeDay, formatTime, dateBlock } from '../format';
import { radius, colors, fonts, textStyles } from '../theme';

// navigation: yönetici için WriteAnnouncement ve RecurringAnnouncements ekranlarına geçmek için kullanılır.
export default function AnnouncementsScreen({ navigation }) {
  const { session } = useSession();
  // Rol kontrolü sadece ekranı düzenlemek için; asıl yetki kontrolü backend'de (sakin duyuru yazamaz/silemez).
  const manager = session.kullanici.rol === 'yonetici';

  // useState: duyuru listesi. null → henüz yüklenmedi.
  const [announcements, setAnnouncements] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata mesajı.
  const [error, setError] = useState('');

  // API isteği: GET /api/duyurular → sitenin duyuruları (yeniden eskiye).
  // useCallback: fonksiyon her çizimde yeniden oluşmasın; useFocusEffect/useEffect buna bağlı olduğu için istek gereksiz yere tekrar atılmaz.
  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/duyurular');
      setAnnouncements(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde liste yeniden yüklenir; duyuru yazıp/düzenleyip geri dönülünce güncel olur.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Aşağı çekip yenileme (refreshControl): sayfa en üstteyken aşağı çekilince load tekrar çalışır (components/Refresh.js).
  const refreshControl = useRefresh(load);

  // Listenin üst kısmı: yöneticiye iki kutu ve kısa ipucu; hata veya yükleniyor
  const header = (
    <View style={styles.header}>
      {manager && (
        <>
          <View style={styles.tiles}>
            {/* "Yeni duyuru" kutusu: basınca boş WriteAnnouncement ekranı açılır */}
            <Tile icon="add" baslik="Yeni duyuru" subtitle="Herkese bildirim gider" onPress={() => navigation.navigate('WriteAnnouncement')} />
            {/* "Tekrarlayan" kutusu: basınca RecurringAnnouncements ekranı açılır ("Her pazartesi çöp günü" gibi) */}
            <Tile icon="repeat" baslik="Tekrarlayan" subtitle="Gün ve saat seçerek" onPress={() => navigation.navigate('RecurringAnnouncements')} />
          </View>
          <Text style={textStyles.label}>SON DUYURULAR · DÜZENLEMEK İÇİN DOKUNUN</Text>
        </>
      )}
      {/* Hata kutusundaki "Tekrar dene" butonu: basınca load çalışır ve liste yeniden istenir */}
      {error !== '' && <ErrorMessage mesaj={error} onRetry={load} />}
      {announcements === null && error === '' && <ActivityIndicator color={colors.primary} />}
    </View>
  );

  return (
    // FlatList: duyuruları alt alta listeler.
    <FlatList
      refreshControl={refreshControl}
      style={styles.container}
      contentContainerStyle={styles.icerik}
      data={announcements ?? []}
      keyExtractor={(d) => d.id}
      ListHeaderComponent={header}
      ListEmptyComponent={announcements && <Text style={styles.bos}>Henüz duyuru yok.</Text>}
      renderItem={({ item: d }) => {
        const day = relativeDay(d.tarih);
        const isNew = day === 'Bugün';
        const block = dateBlock(d.tarih);
        return (
          // Yönetici karta basınca duyuru düzenleme ekranı (WriteAnnouncement) bu duyuruyla açılır; sakin için kart basılamaz.
          <Pressable
            style={({ pressed }) => [styles.card, isNew && styles.cardNew, pressed && manager && styles.pressed]}
            onPress={() => navigation.navigate('WriteAnnouncement', { announcement: d })}
            disabled={!manager}
            accessibilityRole={manager ? 'button' : undefined}
            accessibilityHint={manager ? 'Duyuruyu düzenler veya siler' : undefined}
          >
            <View style={styles.cardTop}>
              {/* Kare tarih bloğu: gün ve ayın kısa adı */}
              <View style={styles.tarih}>
                <Text style={styles.dateDay}>{block.gun}</Text>
                <Text style={styles.dateMonth}>{block.ay}</Text>
              </View>
              <View style={styles.titleBlock}>
                <Text style={styles.baslik}>{d.baslik}</Text>
                {/* Göreli zaman: zümrüt renkte; bugünün duyurusunda zümrüt zeminli etiket */}
                <View style={[styles.relative, isNew && styles.relativeNew]}>
                  <Icon ad={isNew ? 'announcement' : 'calendar'} size={14} color={colors.emerald} />
                  <Text style={styles.relativeText}>
                    {day} · {formatTime(d.tarih)}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.metin}>{d.icerik}</Text>
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
  icerik: {
    padding: 18,
    gap: 12,
  },
  header: {
    gap: 12,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
  },
  bos: {
    textAlign: 'center',
    fontFamily: fonts.metin,
    fontSize: 15,
    color: colors.muted,
  },
  card: {
    padding: 14,
    paddingHorizontal: 16,
    gap: 10,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardNew: {
    borderColor: colors.emeraldBorder,
  },
  pressed: {
    opacity: 0.75,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tarih: {
    width: 46,
    height: 46,
    borderRadius: radius,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontFamily: fonts.mono,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 19,
    color: colors.text,
  },
  dateMonth: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  titleBlock: {
    flex: 1,
    gap: 3,
  },
  baslik: {
    fontFamily: fonts.metin,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  relative: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  relativeNew: {
    paddingVertical: 2,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.emeraldBorder,
    backgroundColor: colors.emeraldBackground,
  },
  relativeText: {
    fontFamily: fonts.metin,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.emerald,
  },
  metin: {
    fontFamily: fonts.metin,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
