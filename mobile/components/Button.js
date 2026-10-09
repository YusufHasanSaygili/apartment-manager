// Ortak buton component'i: uygulamadaki tüm butonlar aynı görünüm ve davranışta olsun diye.
// Dört türü var: 'primary' (altın, ana işlem), 'secondary' (koyu dolgu, diğer seçenekler),
// 'danger' (kırmızı dolgu, geri alınamaz işlem) ve 'dangerOutline' (koyu kırmızı zemin, daha hafif uyarı).
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, colors, fonts } from '../theme';
import Icon from './Icon';

// Her türün zemin rengi, yazı rengi ve (varsa) çerçeve rengi. Tek tabloda durduğu için yeni tür eklemek kolay.
const VARIANTS = {
  primary: { background: colors.primary, text: colors.onPrimary },
  secondary: { background: colors.surface2, text: colors.text },
  danger: { background: colors.errorFill, text: '#FFFFFF' }, // ikonla aynı kırmızı ailesi, beyaz yazı okunaklı
  dangerOutline: { background: colors.errorBackground, text: colors.error, frame: colors.errorBorder },
};

// baslik: buton yazısı, subtitle: (isteğe bağlı) başlığın altındaki küçük açıklama,
// icon: (isteğe bağlı) yazının solundaki ikonun adı (components/Icon.js), onPress: basınca çalışacak fonksiyon,
// loading: true ise yazı yerine dönen simge çıkar ve buton tekrar basılamaz
// (aynı formun iki kez gönderilmesini önler).
export default function Button({ baslik: title, subtitle, icon, onPress, variant = 'primary', loading = false }) {
  // Seçilen türün renklerini tablodan alır; aşağıda zemin, yazı ve ikon bu renklerle boyanır.
  const color = VARIANTS[variant];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color.background },
        color.frame && { borderWidth: 1, borderColor: color.frame },
        (pressed || loading) && styles.pressed,
      ]}
      // Basınca ekranın gönderdiği onPress fonksiyonu çalışır (örn. giriş yap, aidat bildir).
      // Yükleniyorken disabled olduğu için ikinci basış hiçbir şey yapmaz.
      onPress={onPress}
      disabled={loading}
      // Ekran okuyucu için: bunun bir buton olduğunu ve meşgulken beklemesi gerektiğini bildirir.
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={color.text} />
      ) : (
        <View style={styles.row}>
          {/* İkon verilmişse yazının solunda, yazıyla aynı renkte çizilir */}
          {icon ? <Icon ad={icon} size={20} color={color.text} background={color.background} /> : null}
          <View style={styles.textStyles}>
            <Text style={[styles.text, { color: color.text }]}>{title}</Text>
            {/* subtitle verilmişse başlığın altında küçük puntoyla gösterilir.
                "subtitle && ..." yerine üçlü (? :) kullanılır: subtitle boş metin ("") olursa && onu ekrana yazmaya
                çalışır ve React Native, Text dışındaki metin yüzünden çöker. ? : ise boşta null döner. */}
            {subtitle ? <Text style={[styles.subtitle, { color: color.text }]}>{subtitle}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // minHeight 54: parmakla rahat basılabilecek boyut (en az 44 önerilir).
  button: {
    minHeight: 54,
    paddingHorizontal: 20,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textStyles: {
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  text: {
    fontFamily: fonts.metin,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: fonts.metin,
    fontSize: 12,
    opacity: 0.75,
  },
});
