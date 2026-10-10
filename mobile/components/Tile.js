// Ana ekranlardaki 2'li ızgaranın (bento) kutucuğu: üstte ikon (ve varsa sayı rozeti), hemen altında başlık ve açıklama.
// wide: satırı tek başına kaplayan yatay kutu (örn. "Bekleyen aidatlar"). highlighted: altın zeminli, öne çıkan kutu.
// children: başlığın üstüne eklenecek ek içerik (örn. mini daire haritası, mini takvim).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { mix, radius, colors, fonts } from '../theme';
import Icon from './Icon';

export default function Tile({ icon, title, subtitle, badge, onPress, wide = false, highlighted = false, style, children }) {
  // Vurgulu kutuda zemin altın, yazılar koyu; diğerlerinde zemin koyu kart, ikon altın.
  const background = highlighted ? colors.primary : colors.card;
  const text = highlighted ? colors.onPrimary : colors.text;
  const iconBackground = highlighted ? mix(colors.onPrimary, 0.14, colors.primary) : mix(colors.primary, 0.11);
  return (
    // Basınca ekranın verdiği onPress çalışır (ilgili ekrana gider)
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, badge].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.box,
        wide && styles.wide,
        { backgroundColor: background, borderColor: highlighted ? colors.primary : colors.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.header, wide && styles.headerWide]}>
        <View style={[styles.iconBox, { backgroundColor: iconBackground }]}>
          <Icon name={icon} size={22} color={highlighted ? colors.onPrimary : colors.primary} background={iconBackground} />
        </View>
        {/* Rozet: geniş kutuda sağda ortada, normal kutuda sağ üstte (kare, mono sayı) */}
        {badge && !wide ? (
          <View style={[styles.badge, highlighted && styles.badgeHighlighted]}>
            <Text style={[styles.badgeText, highlighted && { color: colors.primary }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {children}
      <View style={wide ? styles.textWide : styles.text}>
        <Text style={[styles.title, { color: text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, highlighted && { color: mix(colors.onPrimary, 0.7, colors.primary) }]}>{subtitle}</Text> : null}
      </View>
      {badge && wide ? (
        <View style={[styles.badge, highlighted && styles.badgeHighlighted]}>
          <Text style={[styles.badgeText, highlighted && { color: colors.primary }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // İçerik üstten başlar (ikonun hemen altında yazı); kısa yazılı kutuda boşluk oluşmaz.
  box: {
    flex: 1,
    flexBasis: 0, // yan yana kutular yazı uzunluğundan bağımsız eşit genişlikte olsun
    minHeight: 112,
    padding: 14,
    gap: 12,
    borderRadius: radius,
    borderWidth: 1,
  },
  wide: {
    flex: 0, // geniş kutu dikey listede kendi içeriği kadar yer kaplar
    flexBasis: 'auto',
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.75,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerWide: {
    flex: 0,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    gap: 1,
  },
  textWide: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: fonts.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 19,
  },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: 12.5,
    color: colors.muted,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeHighlighted: {
    backgroundColor: colors.onPrimary,
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
