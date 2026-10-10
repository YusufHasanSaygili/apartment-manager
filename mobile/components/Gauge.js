// Hız kadranı: bu ay aidatını ödeyen dairelerin oranını araba kadranı gibi gösterir.
// 180 derecelik yay üçe bölünmüştür: kırmızı (düşük), sarı (orta), yeşil (iyi). İbre açılışta 0'dan oranın
// açısına doğru döner; altta yüzde yazar.
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

// AnimatedG: SVG grubunu (ibre) Reanimated ile döndürebilmek için
const AnimatedG = Animated.createAnimatedComponent(G);

// ratio: 0–1 arası ödeme oranı (2/7 → 0.29), width: kadranın ekrandaki genişliği
export default function Gauge({ ratio, width = 168 }) {
  // useSharedValue: ibrenin açısı (derece). 0 = en sol (yüzde 0), 180 = en sağ (yüzde 100).
  const angle = useSharedValue(0);
  // useEffect: oran gelince (veya değişince) ibre yavaşça yeni açıya döner.
  useEffect(() => {
    angle.value = withTiming(ratio * 180, { duration: 1600, easing: Easing.bezier(0.25, 0.9, 0.3, 1.1) });
  }, [angle, ratio]);
  // useAnimatedProps: ibre grubunu (100, 100) merkezi etrafında döndürür
  const needleProps = useAnimatedProps(() => ({ rotation: angle.value, originX: 100, originY: 100 }));

  return (
    <View style={{ width }}>
      <Svg width={width} height={(width * 140) / 200} viewBox="0 0 200 140" accessibilityLabel={`Ödeme oranı yüzde ${Math.round(ratio * 100)}`}>
        {/* Arka iz ve üç renkli bölge (kırmızı, sarı, yeşil) */}
        <Path d="M20 100A80 80 0 0 1 180 100" fill="none" stroke={colors.surface3} strokeWidth={15} />
        <Path d="M20 100A80 80 0 0 1 58.2 31.8" fill="none" stroke={colors.error} strokeWidth={15} opacity={0.9} />
        <Path d="M61.8 29.7A80 80 0 0 1 138.2 29.7" fill="none" stroke={colors.warning} strokeWidth={15} opacity={0.9} />
        <Path d="M141.8 31.8A80 80 0 0 1 180 100" fill="none" stroke={colors.success} strokeWidth={15} opacity={0.9} />
        {/* İbre: sola bakan ince üçgen, açıyla döner; ortada göbek */}
        <AnimatedG animatedProps={needleProps}>
          <Path d="M100 96 36 100l64 4Z" fill={colors.text} />
        </AnimatedG>
        <Circle cx={100} cy={100} r={8} fill={colors.text} />
        <Circle cx={100} cy={100} r={3} fill={colors.card} />
      </Svg>
      {/* Yüzde yazısı: SVG metni Android'de gömülü yazı tipini kullanmadığı için (harfler üst üste biniyordu)
          normal Text olarak kadranın altına, ortaya konur */}
      <Text style={styles.percent}>%{Math.round(ratio * 100)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  percent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
});
