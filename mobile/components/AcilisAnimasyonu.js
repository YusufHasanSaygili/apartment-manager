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
import { kose, renkler } from '../tema';
import Ikon from './Ikon';

// createAnimatedComponent: SVG dikdörtgenini Reanimated'ın canlandırabileceği hale getirir (rengi animasyonla değişir).
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const BOYUT = 210; // binanın ekrandaki genişliği/yüksekliği (piksel)
const K = BOYUT / 56; // çizim birimi → piksel (bina 56 birimlik bir kareye çizildi, 4. birimden başlıyor)
const KARANLIK = '#2A3832'; // sönük pencere rengi
const YESIL = renkler.basarili;

// Zaman çizelgesi (milisaniye). Her adım bir öncekinin bitişine göre hesaplanır.
// Sabit olarak yazılması, bir süreyi değiştirince sonraki bütün adımların kendiliğinden kaymasını sağlar.
const YANMA_BAS = 400; // ilk pencerenin yandığı an
const YANMA_ARA = 70; // pencereler arası bekleme
// ikonun binaya çarptığı an: 15 pencerenin yanması + 350 ms bekleme + 620 ms uçuş
const CARPMA = YANMA_BAS + 15 * YANMA_ARA + 350 + 620;
const ZOOM_BAS = CARPMA + 720 + 650; // yeşil dalga bitince kameranın binaya daldığı an
const BITIS = ZOOM_BAS + 950; // animasyonun tamamen bittiği an

// Pencereler (çizim birimiyle): ön binada 4 sıra x 3 sütun kare pencere, arka binada 3 uzun pencere.
const PENCERELER = [
  ...Array.from({ length: 12 }, (_, i) => ({ x: 14 + (i % 3) * 7, y: 15 + Math.floor(i / 3) * 8, w: 5, h: 5 })),
  ...[27, 36, 45].map((y) => ({ x: 40, y, w: 10, h: 4 })),
];
// Çarpma noktası: ön binanın sol kenarı, yüksekliğinin %45'i (çizim birimi)
const VURUS = { x: 8, y: 8 + 50 * 0.45 };

// Rastgele renk dağılımı: 2 yeşil, 6 sarı, gerisi kırmızı; yanma sırası da karışık.
// Her pencereye bir renk ve rastgele bir "sira" sayısı verilir; pencereler bu sayıya göre sırayla yanar.
function renkleriDagit() {
  const renkler15 = PENCERELER.map((_, i) => (i < 2 ? YESIL : i < 8 ? renkler.uyari : renkler.hata));
  return renkler15.sort(() => Math.random() - 0.5).map((renk) => ({ renk, sira: Math.random() }));
}

// Tek pencere: kendi faz değeri var. 0 = sönük, 1 = ilk rengi (kırmızı/sarı/yeşil), 2 = yeşil (çarpmadan sonra).
// Ayrı bir bileşen olmasının nedeni: hook'lar döngü içinde çağrılamaz; her pencerenin kendi useSharedValue'su
// olsun diye 15 pencere bu bileşenden 15 kez çizilir. yanma / yesillenme: o pencerenin yanacağı ve yeşile döneceği an (ms).
function Pencere({ x, y, w, h, renk, yanma, yesillenme }) {
  // useSharedValue: animasyon değeri; değişince React yeniden çizmez, Reanimated doğrudan telefonda günceller.
  const faz = useSharedValue(0);

  // useEffect: pencere ekrana gelince zamanlamasını kurar: önce kendi renginde yanar, sonra yeşile döner.
  // withSequence ikinci adımı birincinin bitişinden (yanma + 260 ms) sonra başlattığı için ikinci bekleme
  // "yesillenme - yanma - 260" olarak hesaplanır; böylece yeşile dönüş tam yesillenme anında olur.
  useEffect(() => {
    faz.value = withSequence(
      withDelay(yanma, withTiming(1, { duration: 260 })),
      withDelay(yesillenme - yanma - 260, withTiming(2, { duration: 300 })),
    );
  }, [faz, yanma, yesillenme]);

  // useAnimatedProps: fazı renge çevirir (0→sönük, 1→kendi rengi, 2→yeşil); renkler arası yumuşak geçiş yapar.
  // (useAnimatedStyle stil için, useAnimatedProps ise SVG'nin fill gibi özellikleri için kullanılır.)
  const props = useAnimatedProps(() => ({ fill: interpolateColor(faz.value, [0, 1, 2], [KARANLIK, renk, YESIL]) }));
  return <AnimatedRect x={x} y={y} width={w} height={h} rx={w === 5 ? 1.2 : 1.5} animatedProps={props} />;
}

// onBitti: animasyon bitince (veya atlanınca) çağrılır; App.js bu bileşeni ekrandan kaldırır.
export default function AcilisAnimasyonu({ onBitti }) {
  // useReducedMotion: telefonun erişilebilirlik ayarında "animasyonları azalt/kaldır" açıksa true döner.
  // Hareketten rahatsız olan kullanıcılar için animasyon hiç oynatılmaz.
  const azalt = useReducedMotion();
  // useWindowDimensions: ekranın genişliği ve yüksekliği; bina her telefonda ortaya yerleşsin diye kullanılır.
  const { width: W, height: H } = useWindowDimensions();
  // useState: renk dağılımı sadece ilk açılışta bir kez rastgele seçilir (her çizimde değişmesin diye).
  const [dagilim] = useState(renkleriDagit);

  // Binanın ekrandaki sol üst köşesi ve çarpma noktasının ekran koordinatı
  const binaSol = (W - BOYUT) / 2;
  const binaUst = (H - BOYUT) / 2 - 40;
  const vurus = { x: binaSol + (VURUS.x - 4) * K, y: binaUst + (VURUS.y - 4) * K };

  // useSharedValue: animasyon değerleri: giriş (bina belirir), uçuş (ikon gelir), kaybol (ikon binaya girer),
  // sarsıntı, halka, çerçeve rengi, zoom, perde. Hepsi 0'dan başlar (perde 1'den: başta tamamen kapalı).
  // useState yerine bunlar kullanılır çünkü saniyede 60 kez değişirler; React'i her seferinde yeniden çizdirmek takılma yapardı.
  const giris = useSharedValue(0);
  const ucus = useSharedValue(0);
  const kaybol = useSharedValue(0);
  const sarsinti = useSharedValue(0);
  const halka = useSharedValue(0);
  const cerceve = useSharedValue(0);
  const zoom = useSharedValue(0);
  const perde = useSharedValue(1);

  // useEffect: açılışta bir kez çalışır. Telefonun koyu açılış ekranını (splash) kapatır, zaman çizelgesini
  // başlatır ve BITIS anında onBitti'yi çağırır. "Animasyonları azalt" açıksa hemen bitirir.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {}); // splash zaten kapalıysa gelen hatayı yok say
    if (azalt) {
      onBitti();
      return;
    }
    giris.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) });
    ucus.value = withDelay(CARPMA - 620, withTiming(1, { duration: 620, easing: Easing.bezier(0.6, 0, 1, 0.7) }));
    kaybol.value = withDelay(CARPMA, withTiming(1, { duration: 200, easing: Easing.in(Easing.quad) }));
    sarsinti.value = withDelay(
      CARPMA,
      withSequence(withTiming(9, { duration: 70 }), withTiming(-5, { duration: 90 }), withTiming(2, { duration: 90 }), withTiming(0, { duration: 120 })),
    );
    halka.value = withDelay(CARPMA, withTiming(1, { duration: 900, easing: Easing.bezier(0.1, 0.7, 0.3, 1) }));
    cerceve.value = withDelay(CARPMA + 720, withTiming(1, { duration: 400 }));
    zoom.value = withDelay(ZOOM_BAS, withTiming(1, { duration: 850, easing: Easing.bezier(0.7, 0, 0.9, 0.4) }));
    perde.value = withDelay(ZOOM_BAS + 600, withTiming(0, { duration: 350 }));
    const zamanlayici = setTimeout(onBitti, BITIS);
    // Temizlik: bileşen erken kaldırılırsa (ekrana dokunup atlanırsa) bekleyen zamanlayıcı iptal edilir.
    return () => clearTimeout(zamanlayici);
    // Sadece ilk açılışta çalışmalı; shared value'lar ve onBitti sabit kalır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useAnimatedStyle: içindeki fonksiyon telefonun arayüz iş parçacığında çalışır; kullandığı shared value
  // her değiştiğinde stil yeniden hesaplanır ve ekrana yansır.
  // Bina: girişte aşağıdan yukarı belirir, çarpmada sarsılır, sonunda ön binanın ortasına doğru büyür (zoom).
  // Zoom önce yavaşça 1.15'e, sonra hızla 16 katına çıkar: "kamera binanın içine dalıyor" hissi verir.
  const binaStili = useAnimatedStyle(() => ({
    opacity: giris.value,
    transform: [
      { translateY: (1 - giris.value) * 16 },
      { translateX: sarsinti.value },
      { scale: interpolate(zoom.value, [0, 0.3, 1], [1, 1.15, 16]) },
    ],
  }));

  // Uygulama ikonu: sol alttan kavis çizerek gelir, çarpınca içeri girip kaybolur.
  // Kavis: uçuşun %55'inde ikon yatayda yolun yarısını geçmiş ama dikeyde neredeyse inmiş olur; bu yüzden düz değil eğri gider.
  const ikonStili = useAnimatedStyle(() => ({
    opacity: interpolate(ucus.value, [0, 0.01], [0, 1]) * (1 - kaybol.value),
    transform: [
      { translateX: interpolate(ucus.value, [0, 0.55, 1], [-vurus.x, -vurus.x * 0.45, 0]) + kaybol.value * 30 },
      { translateY: interpolate(ucus.value, [0, 0.55, 1], [260, 40, 0]) },
      { rotate: `${interpolate(ucus.value, [0, 0.55, 1], [-30, -12, 0])}deg` },
      { scale: interpolate(ucus.value, [0, 0.55, 1], [0.7, 0.95, 1]) * (1 - kaybol.value * 0.8) },
    ],
  }));

  // Yeşil halka: çarpma noktasından dışa yayılıp kaybolur (büyüdükçe saydamlaşır; başlamadan önce görünmez)
  const halkaStili = useAnimatedStyle(() => ({
    opacity: halka.value === 0 ? 0 : 1 - halka.value,
    transform: [{ scale: 0.5 + halka.value * 8.5 }],
  }));

  // Ön binanın çerçevesi en sonda beyazdan yeşile döner
  const cerceveProps = useAnimatedProps(() => ({ stroke: interpolateColor(cerceve.value, [0, 1], [renkler.yazi, YESIL]) }));
  // Perde: siyah arka plan; zoom sonunda saydamlaşır ve altta uygulama görünür
  const perdeStili = useAnimatedStyle(() => ({ opacity: perde.value }));

  // "Animasyonları azalt" açıksa hiçbir şey çizilmez (useEffect zaten onBitti'yi çağırdı).
  // Bu satır hook'lardan sonra durur çünkü hook'lar her çizimde aynı sırayla çağrılmak zorundadır.
  if (azalt) return null;

  // Her pencerenin yeşile dönme anı: çarpma noktasına uzaklığı arttıkça biraz daha geç (dalga etkisi).
  // Math.hypot iki nokta arasındaki düz uzaklığı verir; her piksel uzaklık 3.2 ms gecikme ekler.
  const yesillenme = (p) => CARPMA + Math.hypot((p.x - VURUS.x) * K, (p.y + p.h / 2 - VURUS.y) * K) * 3.2;
  // yanmaSirasi: pencere numaralarının rastgele "sira" değerine göre dizilmiş hali; indexOf ile her pencerenin kaçıncı yanacağı bulunur.
  const yanmaSirasi = [...dagilim.keys()].sort((a, b) => dagilim[a].sira - dagilim[b].sira);

  return (
    // Perde: tüm ekranı kaplayan koyu katman (splash ile aynı renk; splash kapanınca fark edilmez).
    <Animated.View style={[StyleSheet.absoluteFill, styles.perde, perdeStili]}>
      {/* Ekranı kaplayan görünmez buton: dokununca onBitti çalışır, animasyon atlanır ve uygulama hemen açılır */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onBitti} accessibilityRole="button" accessibilityLabel="Açılış animasyonunu geç">
        <Animated.View style={[styles.bina, { left: binaSol, top: binaUst }, binaStili]}>
          {/* Bina çizimi: arka bina, ön bina (çerçevesi sonunda yeşile döner), 15 pencere ve kapı.
              viewBox: çizim 56 birimlik koordinatla yapılır, Svg bunu BOYUT piksele kendisi ölçekler. */}
          <Svg width={BOYUT} height={BOYUT} viewBox="4 4 56 56">
            <Rect x={34} y={20} width={22} height={38} rx={4} fill="#121B17" stroke={renkler.soluk} strokeWidth={2} />
            <AnimatedRect x={8} y={8} width={30} height={50} rx={5} fill="#18241F" strokeWidth={2.4} animatedProps={cerceveProps} />
            {PENCERELER.map((p, i) => (
              <Pencere
                key={i}
                {...p}
                renk={dagilim[i].renk}
                yanma={YANMA_BAS + yanmaSirasi.indexOf(i) * YANMA_ARA}
                yesillenme={yesillenme(p)}
              />
            ))}
            <Path d="M19 58v-6.5a4 4 0 0 1 8 0V58" fill="none" stroke={renkler.yazi} strokeWidth={2.4} />
          </Svg>
        </Animated.View>

        {/* Yeşil halka ve uygulama ikonu çarpma noktasında konumlanır */}
        <Animated.View style={[styles.halka, { left: vurus.x - 20, top: vurus.y - 20 }, halkaStili]} />
        <Animated.View style={[styles.ikon, { left: vurus.x - 62, top: vurus.y - 31 }, ikonStili]}>
          <Ikon ad="odedi" boyut={34} renk={renkler.birincil} arka={renkler.arkaPlan} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // zIndex: perde, alttaki navigasyon ekranlarının üstünde durur.
  perde: {
    backgroundColor: renkler.arkaPlan,
    zIndex: 10,
  },
  bina: {
    position: 'absolute',
    width: BOYUT,
    height: BOYUT,
    // Büyütme merkezi: ön binanın ortası (çizim biriminde x=23, y=35.5 → piksel)
    transformOrigin: [(23 - 4) * K, (35.5 - 4) * K, 0],
  },
  halka: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: YESIL,
  },
  ikon: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: kose,
    borderWidth: 2,
    borderColor: renkler.birincil,
    backgroundColor: renkler.arkaPlan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
