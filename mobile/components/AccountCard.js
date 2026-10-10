// Hesap kartı: ana ekranların en altında kişi bilgisi (baş harfler, ad, e-posta, rol) ve iki satır:
// "Çıkış yap" ve "Hesabımı sil". Ayar listesi gibi tek kartta durur; ikisi de yanlışlıkla basılmasın diye
// ana işlemlerden ayrı, en altta.
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSession } from '../services/SessionContext';
import { mix, radius, colors, fonts } from '../theme';
import Icon from './Icon';

// navigation: "Hesabımı sil" satırıyla DeleteAccount ekranını açmak için. role: kartta görünen rol etiketi.
export default function AccountCard({ navigation, role }) {
  // session: kullanıcının adı ve e-postası; logout: token'ı silip açılış ekranına döner.
  const { session, logout } = useSession();
  const { name, email } = session.user;
  // Baş harfler: "Ayşe Yılmaz" → "AY"
  const initials = name.split(' ').filter(Boolean).map((k) => k[0]).join('').slice(0, 2).toLocaleUpperCase('tr-TR');

  // "Çıkış yap" satırı: önce onay sorulur; "Çıkış yap" seçilirse logout çalışır.
  const confirmLogout = () =>
    Alert.alert('Çıkış yap', 'Hesabınızdan çıkmak istiyor musunuz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: logout },
    ]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.email} numberOfLines={1}>{email}</Text>
        </View>
        <View style={styles.role}>
          <Text style={styles.roleText}>{role.toLocaleUpperCase('tr-TR')}</Text>
        </View>
      </View>

      {/* "Çıkış yap" satırı: basınca confirmLogout çalışır */}
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={confirmLogout} accessibilityRole="button">
        <Icon name="logout" size={20} color={colors.muted} />
        <Text style={styles.rowLabel}>Çıkış yap</Text>
        <Feather name="chevron-right" size={18} color={colors.faint} />
      </Pressable>

      {/* "Hesabımı sil" satırı: basınca DeleteAccount ekranı açılır (orada şifre ve onay istenir) */}
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => navigation.navigate('DeleteAccount')}
        accessibilityRole="button"
      >
        <Icon name="deleteAccount" size={20} color={colors.error} />
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: colors.error }]}>Hesabımı sil</Text>
          <Text style={styles.rowSubtitle}>Kalıcıdır, geri alınamaz</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.faint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius,
    backgroundColor: mix(colors.primary, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.text,
    fontWeight: '700',
    fontSize: 14,
    color: colors.primary,
  },
  who: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.text,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  email: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
  },
  role: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius,
    backgroundColor: colors.emeraldBackground,
  },
  roleText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.emerald,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pressed: {
    backgroundColor: colors.surface2,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowSubtitle: {
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.muted,
  },
});
