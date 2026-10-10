// Açılış animasyonu: uygulama her açıldığında yaklaşık 5 saniye oynar, sonra kendini kaldırır.
// Hikâye: apartmanın pencereleri tek tek yanar; çoğu kırmızı ve sarı (aidatlar düzensiz), sadece 2 tanesi yeşil.
// Uygulamanın ikonu gelip binaya çarpar, çarpma noktasından yeşil dalga yayılır ve bütün pencereler yeşile döner
// (Apartmanım ile aidatlar düzene girer). Sonra kamera binaya dalar ve açılış/ana ekran görünür.
// Animasyonlar react-native-reanimated ile telefonun arayüz iş parçacığında (UI thread) çalışır, takılmaz.
// Ekrana dokunulursa animasyon atlanır. Telefonda "animasyonları azalt" ayarı açıksa hiç oynatılmaz.
//
// Nasıl çalışır (kısaca): her hareketli parça için 0'dan 1'e giden bir "animasyon değeri" (shared value) var.
// - withTiming(1, { duration }): değeri verilen sürede yumuşakça 1'e götürür.
// - withDelay(ms, ...): animasyonu ms kadar bekleyip başlatır (zaman çizelgesindeki sırayı bu kurar).
// - withSequence(a, b, ...): animasyonları art arda oynatır (örn. sarsıntıda sağa-sola-sağa-dur).
// - useAnimatedStyle / useAnimatedProps: bu değeri stile (konum, boyut, saydamlık) veya SVG rengine çevirir.
// - interpolate / interpolateColor: 0-1 arasındaki değeri başka bir aralığa eşler (örn. 0→1 iken boyut 1→16, renk sarı→yeşil).
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import { radius, colors } from '../theme';
import Icon from './Icon';

// createAnimatedComponent: SVG dikdörtgenini Reanimated'ın canlandırabileceği hale getirir (rengi animasyonla değişir).
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const SIZE = 210; // binanın ekrandaki genişliği/yüksekliği (piksel)
const K = SIZE / 56; // çizim birimi → piksel (bina 56 birimlik bir kareye çizildi, 4. birimden başlıyor)
const DARK_WINDOW = '#2A3832'; // sönük pencere rengi
const GREEN = colors.success;

// Zaman çizelgesi (milisaniye). Her adım bir öncekinin bitişine göre hesaplanır.
// Sabit olarak yazılması, bir süreyi değiştirince sonraki bütün adımların kendiliğinden kaymasını sağlar.
const LIGHT_START = 400; // ilk pencerenin yandığı an
const LIGHT_INTERVAL = 70; // pencereler arası bekleme
// ikonun binaya çarptığı an: 15 pencerenin yanması + 350 ms bekleme + 620 ms uçuş
const IMPACT_AT = LIGHT_START + 15 * LIGHT_INTERVAL + 350 + 620;
const ZOOM_START = IMPACT_AT + 720 + 650; // yeşil dalga bitince kameranın binaya daldığı an
const END_AT = ZOOM_START + 950; // animasyonun tamamen bittiği an

// Pencereler (çizim birimiyle): ön binada 4 sıra x 3 sütun kare pencere, arka binada 3 uzun pencere.
const WINDOWS = [
  ...Array.from({ length: 12 }, (_, i) => ({ x: 14 + (i % 3) * 7, y: 15 + Math.floor(i / 3) * 8, w: 5, h: 5 })),
  ...[27, 36, 45].map((y) => ({ x: 40, y, w: 10, h: 4 })),
];
// Çarpma noktası: ön binanın sol kenarı, yüksekliğinin %45'i (çizim birimi)
const IMPACT_POINT = { x: 8, y: 8 + 50 * 0.45 };

// Rastgele renk dağılımı: 2 yeşil, 6 sarı, gerisi kırmızı; yanma sırası da karışık.
// Her pencereye bir renk ve rastgele bir "sortKey" sayısı verilir; pencereler bu sayıya göre sırayla yanar.
function assignColors() {
  const windowColors = WINDOWS.map((_, i) => (i < 2 ? GREEN : i < 8 ? colors.warning : colors.error));
  return windowColors.sort(() => Math.random() - 0.5).map((color) => ({ color, sortKey: Math.random() }));
}

// Tek pencere: kendi faz değeri var. 0 = sönük, 1 = ilk rengi (kırmızı/sarı/yeşil), 2 = yeşil (çarpmadan sonra).
// Ayrı bir bileşen olmasının nedeni: hook'lar döngü içinde çağrılamaz; her pencerenin kendi useSharedValue'su
// olsun diye 15 pencere bu bileşenden 15 kez çizilir. lightAt / greenAt: o pencerenin yanacağı ve yeşile döneceği an (ms).
function Window({ x, y, w, h, color, lightAt, greenAt }) {
  // useSharedValue: animasyon değeri; değişince React yeniden çizmez, Reanimated doğrudan telefonda günceller.
  const phase = useSharedValue(0);

  // useEffect: pencere ekrana gelince zamanlamasını kurar: önce kendi renginde yanar, sonra yeşile döner.
  // withSequence ikinci adımı birincinin bitişinden (lightAt + 260 ms) sonra başlattığı için ikinci bekleme
  // "greenAt - lightAt - 260" olarak hesaplanır; böylece yeşile dönüş tam greenAt anında olur.
  useEffect(() => {
    phase.value = withSequence(
      withDelay(lightAt, withTiming(1, { duration: 260 })),
      withDelay(greenAt - lightAt - 260, withTiming(2, { duration: 300 })),
    );
  }, [phase, lightAt, greenAt]);

  // useAnimatedProps: fazı renge çevirir (0→sönük, 1→kendi rengi, 2→yeşil); renkler arası yumuşak geçiş yapar.
  // (useAnimatedStyle stil için, useAnimatedProps ise SVG'nin fill gibi özellikleri için kullanılır.)
  const props = useAnimatedProps(() => ({ fill: interpolateColor(phase.value, [0, 1, 2], [DARK_WINDOW, color, GREEN]) }));
  return <AnimatedRect x={x} y={y} width={w} height={h} rx={w === 5 ? 1.2 : 1.5} animatedProps={props} />;
}

// onFinish: animasyon bitince (veya atlanınca) çağrılır; App.js bu bileşeni ekrandan kaldırır.
export default function IntroAnimation({ onFinish }) {
  // useReducedMotion: telefonun erişilebilirlik ayarında "animasyonları azalt/kaldır" açıksa true döner.
  // Hareketten rahatsız olan kullanıcılar için animasyon hiç oynatılmaz.
  const reduceMotion = useReducedMotion();
  // useWindowDimensions: ekranın genişliği ve yüksekliği; bina her telefonda ortaya yerleşsin diye kullanılır.
  const { width: W, height: H } = useWindowDimensions();
  // useState: renk dağılımı sadece ilk açılışta bir kez rastgele seçilir (her çizimde değişmesin diye).
  const [distribution] = useState(assignColors);

  // Binanın ekrandaki sol üst köşesi ve çarpma noktasının ekran koordinatı
  const buildingLeft = (W - SIZE) / 2;
  const buildingTop = (H - SIZE) / 2 - 40;
  const impact = { x: buildingLeft + (IMPACT_POINT.x - 4) * K, y: buildingTop + (IMPACT_POINT.y - 4) * K };

  // useSharedValue: animasyon değerleri: entrance (giriş, bina belirir), flight (uçuş, ikon gelir), vanish (ikon binaya girer),
  // shake (sarsıntı), ring (halka), frame (çerçeve rengi), zoom, curtain (perde). Hepsi 0'dan başlar (curtain 1'den: başta tamamen kapalı).
  // useState yerine bunlar kullanılır çünkü saniyede 60 kez değişirler; React'i her seferinde yeniden çizdirmek takılma yapardı.
  const entrance = useSharedValue(0);
  const flight = useSharedValue(0);
  const vanish = useSharedValue(0);
  const shake = useSharedValue(0);
  const ring = useSharedValue(0);
  const frame = useSharedValue(0);
  const zoom = useSharedValue(0);
  const curtain = useSharedValue(1);

  // useEffect: açılışta bir kez çalışır. Telefonun koyu açılış ekranını (splash) kapatır, zaman çizelgesini
  // başlatır ve END_AT anında onFinish'i çağırır. "Animasyonları azalt" açıksa hemen bitirir.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {}); // splash zaten kapalıysa gelen hatayı yok say
    if (reduceMotion) {
      onFinish();
      return;
    }
    entrance.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) });
    flight.value = withDelay(IMPACT_AT - 620, withTiming(1, { duration: 620, easing: Easing.bezier(0.6, 0, 1, 0.7) }));
    vanish.value = withDelay(IMPACT_AT, withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) }));
    shake.value = withDelay(
      IMPACT_AT,
      withSequence(withTiming(9, { duration: 70 }), withTiming(-5, { duration: 90 }), withTiming(2, { duration: 90 }), withTiming(0, { duration: 120 })),
    );
    ring.value = withDelay(IMPACT_AT, withTiming(1, { duration: 900, easing: Easing.bezier(0.1, 0.7, 0.3, 1) }));
    frame.value = withDelay(IMPACT_AT + 720, withTiming(1, { duration: 400 }));
    zoom.value = withDelay(ZOOM_START, withTiming(1, { duration: 850, easing: Easing.bezier(0.7, 0, 0.9, 0.4) }));
    curtain.value = withDelay(ZOOM_START + 600, withTiming(0, { duration: 350 }));
    const timer = setTimeout(onFinish, END_AT);
    // Temizlik: bileşen erken kaldırılırsa (ekrana dokunup atlanırsa) bekleyen zamanlayıcı iptal edilir.
    return () => clearTimeout(timer);
    // Sadece ilk açılışta çalışmalı; shared value'lar ve onFinish sabit kalır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useAnimatedStyle: içindeki fonksiyon telefonun arayüz iş parçacığında çalışır; kullandığı shared value
  // her değiştiğinde stil yeniden hesaplanır ve ekrana yansır.
  // Bina: girişte aşağıdan yukarı belirir, çarpmada sarsılır, sonunda ön binanın ortasına doğru büyür (zoom).
  // Zoom önce yavaşça 1.15'e, sonra hızla 16 katına çıkar: "kamera binanın içine dalıyor" hissi verir.
  const buildingStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateY: (1 - entrance.value) * 16 },
      { translateX: shake.value },
      { scale: interpolate(zoom.value, [0, 0.3, 1], [1, 1.15, 16]) },
    ],
  }));

  // Uygulama ikonu: sol alttan kavis çizerek gelir, çarpınca içeri girip kaybolur.
  // Kavis: uçuşun %55'inde ikon yatayda yolun yarısını geçmiş ama dikeyde neredeyse inmiş olur; bu yüzden düz değil eğri gider.
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flight.value, [0, 0.01], [0, 1]) * (1 - vanish.value),
    transform: [
      { translateX: interpolate(flight.value, [0, 0.55, 1], [-impact.x, -impact.x * 0.45, 0]) + vanish.value * 30 },
      { translateY: interpolate(flight.value, [0, 0.55, 1], [260, 40, 0]) },
      { rotate: `${interpolate(flight.value, [0, 0.55, 1], [-30, -12, 0])}deg` },
      { scale: interpolate(flight.value, [0, 0.55, 1], [0.7, 0.95, 1]) * (1 - vanish.value * 0.8) },
    ],
  }));

  // Yeşil halka (ring): çarpma noktasından dışa yayılıp kaybolur (büyüdükçe saydamlaşır; başlamadan önce görünmez)
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 1 - ring.value,
    transform: [{ scale: 0.5 + ring.value * 8.5 }],
  }));

  // Ön binanın çerçevesi en sonda beyazdan yeşile döner
  const frameProps = useAnimatedProps(() => ({ stroke: interpolateColor(frame.value, [0, 1], [colors.text, GREEN]) }));
  // Perde: siyah arka plan; zoom sonunda saydamlaşır ve altta uygulama görünür
  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtain.value }));

  // "Animasyonları azalt" açıksa hiçbir şey çizilmez (useEffect zaten onFinish'i çağırdı).
  // Bu satır hook'lardan sonra durur çünkü hook'lar her çizimde aynı sırayla çağrılmak zorundadır.
  if (reduceMotion) return null;

  // Her pencerenin yeşile dönme anı: çarpma noktasına uzaklığı arttıkça biraz daha geç (dalga etkisi).
  // Math.hypot iki nokta arasındaki düz uzaklığı verir; her piksel uzaklık 3.2 ms gecikme ekler.
  const greenAt = (p) => IMPACT_AT + Math.hypot((p.x - IMPACT_POINT.x) * K, (p.y + p.h / 2 - IMPACT_POINT.y) * K) * 3.2;
  // lightOrder: pencere numaralarının rastgele "sortKey" değerine göre dizilmiş hali; indexOf ile her pencerenin kaçıncı yanacağı bulunur.
  const lightOrder = [...distribution.keys()].sort((a, b) => distribution[a].sortKey - distribution[b].sortKey);

  return (
    // Perde: tüm ekranı kaplayan koyu katman (splash ile aynı renk; splash kapanınca fark edilmez).
    <Animated.View style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]}>
      {/* Ekranı kaplayan görünmez buton: dokununca onFinish çalışır, animasyon atlanır ve uygulama hemen açılır */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onFinish} accessibilityRole="button" accessibilityLabel="Açılış animasyonunu geç">
        <Animated.View style={[styles.building, { left: buildingLeft, top: buildingTop }, buildingStyle]}>
          {/* Bina çizimi: arka bina, ön bina (çerçevesi sonunda yeşile döner), 15 pencere ve kapı.
              viewBox: çizim 56 birimlik koordinatla yapılır, Svg bunu SIZE piksele kendisi ölçekler. */}
          <Svg width={SIZE} height={SIZE} viewBox="4 4 56 56">
            <Rect x={34} y={20} width={22} height={38} rx={4} fill="#121B17" stroke={colors.muted} strokeWidth={2} />
            <AnimatedRect x={8} y={8} width={30} height={50} rx={5} fill="#18241F" strokeWidth={2.4} animatedProps={frameProps} />
            {WINDOWS.map((p, i) => (
              <Window
                key={i}
                {...p}
                color={distribution[i].color}
                lightAt={LIGHT_START + lightOrder.indexOf(i) * LIGHT_INTERVAL}
                greenAt={greenAt(p)}
              />
            ))}
            <Path d="M19 58v-6.5a4 4 0 0 1 8 0V58" fill="none" stroke={colors.text} strokeWidth={2.4} />
          </Svg>
        </Animated.View>

        {/* Yeşil halka ve uygulama ikonu çarpma noktasında konumlanır */}
        <Animated.View style={[styles.ring, { left: impact.x - 20, top: impact.y - 20 }, ringStyle]} />
        <Animated.View style={[styles.icon, { left: impact.x - 62, top: impact.y - 31 }, iconStyle]}>
          <Icon name="paid" size={34} color={colors.primary} background={colors.background} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // zIndex: perde, alttaki navigasyon ekranlarının üstünde durur.
  curtain: {
    backgroundColor: colors.background,
    zIndex: 10,
  },
  building: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    // Büyütme merkezi: ön binanın ortası (çizim biriminde x=23, y=35.5 → piksel)
    transformOrigin: [(23 - 4) * K, (35.5 - 4) * K, 0],
  },
  ring: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: GREEN,
  },
  icon: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: radius,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
