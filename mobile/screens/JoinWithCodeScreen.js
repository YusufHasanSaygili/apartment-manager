// Davet koduyla katılma ekranı: sakin, yöneticiden aldığı 6 haneli kodu ve hesap bilgilerini girer.
// Hesap, kodun ait olduğu siteye ve daireye otomatik bağlanır.
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import Button from '../components/Button';
import FormField from '../components/FormField';
import CodeField from '../components/CodeField';
import ErrorMessage from '../components/ErrorMessage';
import { colors, fonts } from '../theme';

export default function JoinWithCodeScreen() {
  // useState: formdaki 4 alanın değerleri. Kullanıcı yazdıkça güncellenir.
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // useState: istek sürerken true; butonda dönen simge çıkar, form iki kez gönderilmez.
  const [loading, setLoading] = useState(false);

  // useState: formda veya sunucuda bir hata olursa gösterilecek mesaj.
  const [error, setError] = useState('');

  // openSession: katılma başarılı olunca token'ı kaydeder ve sakin ana ekranına geçirir.
  const { openSession } = useSession();

  // join: "Katıl" butonuna basınca çalışır. Önce telefonda basit kontrol, sonra backend'e istek.
  const join = async () => {
    if (inviteCode.length !== 6) {
      setError('Davet kodu 6 haneli olmalı.');
      return;
    }
    if (!name.trim() || !email.trim() || !password) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalı.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // API isteği: kodu ve hesap bilgilerini POST /api/account/join adresine gönderir.
      // Cevapta token, kullanıcı, site ve daire bilgisi gelir.
      const { data } = await api.post('/account/join', { inviteCode, name, email, password });
      // Oturum açılınca App.js rol 'resident' olduğu için sakin ana ekranına geçer.
      // Başarılı durumda setLoading(false) gerekmez; bu ekran kapanıyor.
      await openSession(data);
    } catch (e) {
      // Örn. "Davet kodu geçersiz veya kullanılmış." (mesajı backend ve services/api.js hazırlar)
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    // KeyboardAwareScrollView: klavye açılınca sayfayı dokunulan alana kaydırır.
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.note}>
        Davet kodunu site yöneticinizden alabilirsiniz. Hesabınız kodun ait olduğu daireye bağlanır.
      </Text>

      {/* Davet kodu alanı: 6 ayrı kutu; sadece rakam kabul eder (rakam olmayanları CodeField siler) */}
      <CodeField label="Davet kodu (6 haneli)" value={inviteCode} onChangeText={setInviteCode} />
      <FormField label="Adınız Soyadınız" value={name} onChangeText={setName} autoComplete="name" />
      <FormField
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      {/* secureTextEntry: şifre yazılırken karakterler gizlenir */}
      <FormField
        label="Şifre (en az 8 karakter)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {error !== '' && <ErrorMessage message={error} />}

      {/* "Katıl" butonu: basınca join çalışır ve bilgiler backend'e gönderilir */}
      <Button title="Katıl" onPress={join} loading={loading} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    gap: 4,
  },
  note: {
    marginBottom: 20,
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
});
