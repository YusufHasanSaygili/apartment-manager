// Aidat durumlarının ortak görünümü: daire haritası, aidat takvimi, daire listesi ve ana ekranlar bu parçaları kullanır.
// Her durumun tek bir rengi, ikonu ve adı vardır (STATUSES). Kutular koyu zemin üstünde o rengin ince tonuyla çizilir.
// Ödeyen kutularda soldan sağa geçen bir parlama, ödemeyen kutularda kırmızı "nefes alma" efekti oynar.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { mix, radius, colors, fonts } from '../theme';
import Icon from './Icon';

// Durum kodu → renk, ikon ve ekranda görünen ad. Kodlar backend'den gelir (odendi, bekliyor, odenmedi, bos);
// gelecek, once, dolu ve bosDaire mobilde hesaplanır.
export const STATUSES = {
  odendi: { color: colors.success, icon: 'paid', ad: 'Ödedi' },
  bekliyor: { color: colors.warning, icon: 'pending', ad: 'Bekliyor' },
  odenmedi: { color: colors.error, icon: 'unpaid', ad: 'Ödemedi' },
  bos: { color: colors.none, icon: 'none', ad: 'Sakin yok' },
  gelecek: { color: colors.muted, icon: 'upcoming', ad: 'Henüz gelmedi' },
  once: { color: colors.none, icon: 'before', ad: 'Katılmadan önce' },
  dolu: { color: colors.success, icon: 'resident', ad: 'Sakin katılmış' },
  bosDaire: { color: colors.none, icon: 'none', ad: 'Henüz katılmamış' },
};
// Renkli (dolgulu) çizilen durumlar; diğerleri sadece ince çerçeveli
const FILLED = ['odendi', 'bekliyor', 'odenmedi', 'dolu'];

// Renkli kutunun zemini: yukarıda durum renginin %15'i, aşağıda %6'sı (yukarıdan aşağı koyulaşan ince ton,
// plastik düz dolgu yerine). Çerçeve durum renginin %34'ü. backgroundColor: geçiş çizilemezse kullanılan düz ton.
const filledBackground = (color) => ({
  backgroundColor: mix(color, 0.1),
  experimental_backgroundImage: `linear-gradient(180deg, ${mix(color, 0.15)}, ${mix(color, 0.06)})`,
  borderColor: mix(color, 0.34),
});

// Shine (parlama): kutunun üstünden çapraz bir ışık çizgisi soldan sağa geçer (ödeyene "ödüllendirildi" hissi).
// delay: yan yana kutular aynı anda parlamasın diye her kutuya farklı başlangıç.
function Shine({ delay = 0 }) {
  // useSharedValue: çizginin yatay konumu (0 = solda dışarıda, 1 = sağda dışarıda)
  const position = useSharedValue(0);
  // useEffect: kutu ekrana gelince parlamayı başlatır; withRepeat ile sonsuza kadar tekrarlar (-1).
  useEffect(() => {
    position.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 2100 })), -1),
    );
  }, [position, delay]);
  // useAnimatedStyle: konum değiştikçe çizgiyi sağa kaydırır ve çapraz durması için 25 derece eğer
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -90 + position.value * 220 }, { rotate: '25deg' }] }));
  return <Animated.View pointerEvents="none" style={[styles.shine, style]} />;
}

// Breathe (nefes): ödemeyen kutunun üstünde kırmızı katman soluk ↔ parlak arasında yavaşça gidip gelir.
function Breathe() {
  // useSharedValue: kırmızı katmanın saydamlığı. Animasyon arka planda (UI thread'de) değiştiği için
  // useState gibi ekranı yeniden çizdirmez, akıcı kalır.
  const brightness = useSharedValue(0.08);
  // useEffect: 1.6 sn'de parlar, 1.6 sn'de söner; sonsuz tekrar.
  useEffect(() => {
    brightness.value = withRepeat(withTiming(0.32, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [brightness]);
  const style = useAnimatedStyle(() => ({ opacity: brightness.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.breathe, style]} />;
}

// FlatBox, daire kutusu (harita, daire listesi, kurulum önizlemesi): üstte daire adı, altta durum ikonu.
// onPress verilirse basılabilir olur (haritada takvime, listede davet koduna gider).
// hideIcon: daire listesinde sadece ad gösterilir. small: kurulum önizlemesindeki küçük kutular.
export function FlatBox({ ad: name, durum: status, onPress, hideIcon = false, small = false, index = 0, accessibilityName }) {
  const d = STATUSES[status];
  const filled = FILLED.includes(status);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityName ?? `Daire ${name}: ${d.ad}`}
      style={({ pressed }) => [
        styles.daire,
        small && styles.flatSmall,
        filled
          ? filledBackground(d.color)
          : [{ backgroundColor: colors.card, borderColor: colors.border }, styles.striped],
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.flatName, small && styles.flatNameSmall, !filled && { color: colors.faint }]}>{name}</Text>
      {!hideIcon && <Icon ad={d.icon} size={18} color={d.color} background={colors.card} />}
      {status === 'odendi' && <Shine delay={(index % 3) * 900} />}
      {status === 'odenmedi' && <Breathe />}
    </Pressable>
  );
}

// "Henüz gelmedi" ikonu: dıştaki ok saat yönünde yavaşça döner (gelecek), içindeki takvim sabit kalır.
function UpcomingIcon() {
  // useSharedValue: dönen okun açısı (derece)
  const angle = useSharedValue(0);
  // useEffect: 3.5 sn bekler, 1.5 sn'de bir tur atar; sonsuz tekrar.
  useEffect(() => {
    angle.value = withRepeat(withSequence(withTiming(0, { duration: 3500 }), withTiming(360, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 0 })), -1);
  }, [angle]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }));
  return (
    <View>
      <Animated.View style={style}>
        <Icon ad="upcomingArrow" size={20} color={colors.muted} />
      </Animated.View>
      <View style={StyleSheet.absoluteFill}>
        <Icon ad="upcomingCalendar" size={20} color={colors.muted} />
      </View>
    </View>
  );
}

// MonthBox, ay kutusu (aidat takvimi): solda ikon kutusu, sağda ay adı ve durum yazısı. Bütün kutular aynı yükseklikte.
// subtitle: durum yazısının yerine geçen özel yazı (örn. "Elle işaretlendi"), onPress: basınca çalışır (elle işaretleme).
export function MonthBox({ ad: name, durum: status, subtitle, onPress, index = 0 }) {
  const d = STATUSES[status];
  const filled = FILLED.includes(status);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}: ${subtitle ?? d.ad}`}
      style={({ pressed }) => [
        styles.ay,
        filled
          ? filledBackground(d.color)
          : { borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.monthIcon, { backgroundColor: mix(d.color, 0.12, filled ? mix(d.color, 0.12) : colors.background) }]}>
        {status === 'gelecek' ? <UpcomingIcon /> : <Icon ad={d.icon} size={20} color={d.color} />}
      </View>
      <View style={styles.monthText}>
        <Text style={[styles.monthName, !filled && { color: colors.muted, fontWeight: '500' }]}>{name}</Text>
        <Text style={[styles.monthStatus, { color: d.color }]} numberOfLines={1}>
          {subtitle ?? d.ad}
        </Text>
      </View>
      {status === 'odendi' && <Shine delay={(index % 2) * 1200} />}
      {status === 'odenmedi' && <Breathe />}
    </Pressable>
  );
}

// Legend: durumların renk/ikon açıklaması ve (verilirse) sayıları. items: [[status, num], ...]
export function Legend({ items }) {
  return (
    <View style={styles.legend}>
      {items.map(([status, num]) => (
        <View key={status} style={styles.legendItem}>
          <Icon ad={STATUSES[status].icon} size={15} color={STATUSES[status].color} />
          <Text style={[styles.legendText, { color: FILLED.includes(status) ? STATUSES[status].color : colors.muted }]}>
            {STATUSES[status].ad}
            {num !== undefined && <Text style={styles.legendCount}> {num}</Text>}
          </Text>
        </View>
      ))}
    </View>
  );
}

// StatusBadge, durum rozeti: küçük renkli etiket (örn. "Onay bekliyor"). text verilmezse durumun adı yazılır.
export function StatusBadge({ durum: status, text }) {
  const d = STATUSES[status];
  return (
    <View style={[styles.badge, { backgroundColor: mix(d.color, 0.12), borderColor: mix(d.color, 0.4) }]}>
      <Icon ad={d.icon} size={15} color={d.color} />
      <Text style={[styles.badgeText, { color: d.color }]}>{text ?? d.ad}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  // Daire kutusu: genişliği dışarıdan (satırdaki yer) belirlenir, yüksekliği genişliğe oranla
  daire: {
    flex: 1,
    flexBasis: 0,
    aspectRatio: 1 / 0.92,
    borderRadius: radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  // Sakini olmayan daire: çok soluk çapraz çizgi deseni (10 px'lik karo tekrar eder, her karoda iki ince çizgi)
  striped: {
    experimental_backgroundImage:
      'linear-gradient(135deg, transparent 43%, rgba(255,255,255,0.025) 43%, rgba(255,255,255,0.025) 50%, transparent 50%, transparent 93%, rgba(255,255,255,0.025) 93%)',
    experimental_backgroundSize: '10px 10px',
    experimental_backgroundRepeat: 'repeat',
  },
  flatSmall: {
    aspectRatio: 1,
  },
  flatName: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  flatNameSmall: {
    fontSize: 12,
  },
  shine: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  breathe: {
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radius,
  },
  ay: {
    flex: 1,
    flexBasis: 0,
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: radius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  monthIcon: {
    width: 32,
    height: 32,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: {
    flex: 1,
  },
  monthName: {
    fontFamily: fonts.metin,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  monthStatus: {
    fontFamily: fonts.metin,
    fontSize: 12,
    fontWeight: '500',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontFamily: fonts.metin,
    fontSize: 13,
  },
  legendCount: {
    fontFamily: fonts.mono,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.metin,
    fontSize: 12.5,
    fontWeight: '600',
  },
});

// BuildingCard, bina kartı: "A Blok" başlığı, sağda daire sayısı ve daireler 4'lü hizalı satırlarda.
// daireler: [{ id, ad, durum }], onFlatPress: daireye basınca çalışır (verilmezse kutular basılamaz).
// hideIcon / small / columns: FlatBox'a ve satır uzunluğuna aktarılır (kurulum önizlemesinde 6 sütun, küçük kutu).
export function BuildingCard({ ad: name, daireler: flats, onFlatPress, hideIcon, small, columns = 4, frameless = false }) {
  // Daireler columns sayısı kadar daireli satırlara bölünür; son satır boş yer tutucularla tamamlanır ki kutular hizalı kalsın.
  const rows = [];
  for (let i = 0; i < flats.length; i += columns) rows.push(flats.slice(i, i + columns));
  return (
    <View style={[styles.building, frameless && styles.buildingFrameless]}>
      <View style={styles.buildingTop}>
        <Text style={styles.buildingName}>{name} Blok</Text>
        <Text style={styles.buildingCount}>{`${flats.length} DAİRE`}</Text>
      </View>
      <View style={[styles.rows, small && { gap: 5 }]}>
        {rows.map((row, s) => (
          <View key={s} style={[styles.row, small && { gap: 5 }]}>
            {Array.from({ length: columns }, (_, i) =>
              row[i] ? (
                <FlatBox
                  key={row[i].id}
                  ad={row[i].ad}
                  durum={row[i].durum}
                  hideIcon={hideIcon}
                  small={small}
                  index={s * columns + i}
                  accessibilityName={row[i].accessibilityName}
                  onPress={onFlatPress && (() => onFlatPress(row[i]))}
                />
              ) : (
                <View key={i} style={styles.placeholder} />
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const buildingStyles = StyleSheet.create({
  building: {
    padding: 14,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  buildingFrameless: {
    padding: 0,
    borderWidth: 0,
  },
  buildingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  buildingName: {
    flex: 1,
    fontFamily: fonts.metin,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  buildingCount: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  placeholder: {
    flex: 1,
    flexBasis: 0,
  },
});
Object.assign(styles, buildingStyles);
