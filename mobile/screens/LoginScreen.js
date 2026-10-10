// Giriş ekranı: hesabı olan kullanıcı (yönetici veya sakin) e-posta ve şifresiyle giriş yapar.
// Şifresini unutan kullanıcı "Şifremi unuttum" bağlantısıyla sıfırlama ekranına geçer.
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import Button from '../components/Button';
import TextButton from '../components/TextButton';
import FormField from '../components/FormField';
import ErrorMessage from '../components/ErrorMessage';
import { colors } from '../theme';

// navigation: "Şifremi unuttum" bağlantısıyla ForgotPassword ekranını açmak için kullanılır.
export default function LoginScreen({ navigation }) {
  // useState: formdaki e-posta ve şifre. Kullanıcı yazdıkça güncellenir.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // useState: istek sürerken true; butonda dönen simge çıkar, form iki kez gönderilmez.
  const [loading, setLoading] = useState(false);

  // useState: hatalı giriş vb. durumda gösterilecek mesaj.
  const [error, setError] = useState('');

  // openSession: giriş başarılı olunca token'ı kaydeder ve uygulamayı ana ekrana geçirir.
  const { openSession } = useSession();

  // login: "Giriş yap" butonuna basınca çalışır. Formu kontrol eder, backend'e gönderir,
  // başarılıysa oturumu açar, hatalıysa mesajı ekranda gösterir.
  const login = async () => {
    // Boş alanı sunucuya göndermeden yakalar.
    if (!email.trim() || !password) {
      setError('E-posta ve şifre girin.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // API isteği: e-posta ve şifreyi POST /api/account/login adresine gönderir.
      // Cevapta token, kullanıcı ve site bilgisi gelir.
      const { data } = await api.post('/account/login', { email, password });
      // Oturum açılınca App.js otomatik olarak ana ekrana geçer (bu ekran kapanır).
      // Bu yüzden başarılı durumda setLoading(false) çağrılmaz; ekran zaten kapanıyor.
      await openSession(data);
    } catch (e) {
      // Örn. "E-posta veya şifre hatalı." (mesajı backend ve services/api.js hazırlar)
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
      {/* E-posta alanı: autoCapitalize="none" ile ilk harf büyütülmez, e-posta klavyesi açılır */}
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
        label="Şifre"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
      />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {error !== '' && <ErrorMessage message={error} />}

      {/* "Giriş yap" butonu: basınca login çalışır ve bilgiler backend'e gönderilir */}
      <Button title="Giriş yap" onPress={login} loading={loading} />

      {/* "Şifremi unuttum" bağlantısı: basınca ForgotPassword ekranı açılır; yazılmış e-posta da oraya taşınır */}
      <TextButton title="Şifremi unuttum" onPress={() => navigation.navigate('ForgotPassword', { email })} />
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
});
