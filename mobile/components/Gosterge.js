// Hız kadranı: bu ay aidatını ödeyen dairelerin oranını araba kadranı gibi gösterir.
// 180 derecelik yay üçe bölünmüştür: kırmızı (düşük), sarı (orta), yeşil (iyi). İbre açılışta 0'dan oranın
// açısına doğru döner; altta yüzde yazar.
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { renkler, yaziTipi } from '../tema';

// AnimatedG: SVG grubunu (ibre) Reanimated ile döndürebilmek için
const AnimatedG = Animated.createAnimatedComponent(G);

// oran: 0–1 arası ödeme oranı (2/7 → 0.29), genislik: kadranın ekrandaki genişliği
export default function Gosterge({ oran, genislik = 168 }) {
  // useSharedValue: ibrenin açısı (derece). 0 = en sol (yüzde 0), 180 = en sağ (yüzde 100).
  const aci = useSharedValue(0);
  // useEffect: oran gelince (veya değişince) ibre yavaşça yeni açıya döner.
  useEffect(() => {
    aci.value = withTiming(oran * 180, { duration: 1600, easing: Easing.bezier(0.25, 0.9, 0.3, 1.1) });
  }, [aci, oran]);
  // useAnimatedProps: ibre grubunu (100, 100) merkezi etrafında döndürür
  const ibreProps = useAnimatedProps(() => ({ rotation: aci.value, originX: 100, originY: 100 }));

  return (
    <View style={{ width: genislik }}>
      <Svg width={genislik} height={(genislik * 140) / 200} viewBox="0 0 200 140" accessibilityLabel={`Ödeme oranı yüzde ${Math.round(oran * 100)}`}>
        {/* Arka iz ve üç renkli bölge (kırmızı, sarı, yeşil) */}
        <Path d="M20 100A80 80 0 0 1 180 100" fill="none" stroke={renkler.yuzey3} strokeWidth={15} />
        <Path d="M20 100A80 80 0 0 1 58.2 31.8" fill="none" stroke={renkler.hata} strokeWidth={15} opacity={0.9} />
        <Path d="M61.8 29.7A80 80 0 0 1 138.2 29.7" fill="none" stroke={renkler.uyari} strokeWidth={15} opacity={0.9} />
        <Path d="M141.8 31.8A80 80 0 0 1 180 100" fill="none" stroke={renkler.basarili} strokeWidth={15} opacity={0.9} />
        {/* İbre: sola bakan ince üçgen, açıyla döner; ortada göbek */}
        <AnimatedG animatedProps={ibreProps}>
          <Path d="M100 96 36 100l64 4Z" fill={renkler.yazi} />
        </AnimatedG>
        <Circle cx={100} cy={100} r={8} fill={renkler.yazi} />
        <Circle cx={100} cy={100} r={3} fill={renkler.kart} />
      </Svg>
      {/* Yüzde yazısı: SVG metni Android'de gömülü yazı tipini kullanmadığı için (harfler üst üste biniyordu)
          normal Text olarak kadranın altına, ortaya konur */}
      <Text style={styles.yuzde}>%{Math.round(oran * 100)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  yuzde: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    fontFamily: yaziTipi.mono,
    fontSize: 20,
    fontWeight: '600',
    color: renkler.yazi,
  },
});
