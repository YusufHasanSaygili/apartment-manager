// Şifremi unuttum ekranı: iki adımda şifre sıfırlanır.
// 1. adım: kullanıcı e-postasını yazar, "Kod gönder"e basar; e-postasına 6 haneli bir kod gelir.
// 2. adım: kodu ve yeni şifresini yazar; şifre değişir ve kullanıcı doğrudan giriş yapmış olur.
// route.params.email: giriş ekranında yazılmışsa e-posta kutusu dolu gelir.
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import Button from '../components/Button';
import TextButton from '../components/TextButton';
import FormField from '../components/FormField';
import CodeField from '../components/CodeField';
import ErrorMessage from '../components/ErrorMessage';
import { colors, fonts } from '../theme';

export default function ForgotPasswordScreen({ route }) {
  // openSession: şifre değişince sunucudan gelen token ile oturumu açar; App.js ana ekrana geçer.
  const { openSession } = useSession();

  // useState: form alanları. codeSent: 2. adıma geçildi mi (kod ve yeni şifre alanları görünür).
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  // useState: istek sürerken true (buton tekrar basılamaz); info: kod gönderildi mesajı; error: hata mesajı.
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  // API isteği: POST /api/account/password-reset/request-code ile e-postayı gönderir. Sunucu, e-posta kayıtlı olsun
  // olmasın aynı mesajı döner (hangi e-postaların kayıtlı olduğu anlaşılmasın diye); mesaj ekranda gösterilir.
  const requestCode = async () => {
    if (!email.trim()) return setError('E-posta adresinizi girin.');
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/account/password-reset/request-code', { email });
      setInfo(data.message);
      setCodeSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // API isteği: POST /api/account/password-reset ile e-posta, kod ve yeni şifreyi gönderir.
  // Başarılıysa sunucu token döner; oturum açılır ve uygulama kendiliğinden ana ekrana geçer.
  const resetPassword = async () => {
    if (!/^\d{6}$/.test(code.trim())) return setError('E-postanıza gelen 6 haneli kodu girin.');
    if (newPassword.length < 8) return setError('Yeni şifre en az 8 karakter olmalı.');
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/account/password-reset', { email, code: code.trim(), newPassword });
      // Başarılıysa setLoading(false) çağrılmaz: oturum açılınca bu ekran kapanıp ana ekrana geçilir.
      await openSession(data);
    } catch (e) {
      // Örn. "Kod hatalı veya süresi dolmuş." (mesajı backend ve services/api.js hazırlar)
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    // KeyboardAwareScrollView: klavye açılınca alanlar ve butonlar klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.note}>
        Hesabınızın e-posta adresini yazın; şifrenizi sıfırlamak için 6 haneli bir kod göndereceğiz.
      </Text>

      {/* E-posta alanı: kod gönderildikten sonra değiştirilemez (editable false), yanlışlıkla başka e-postaya
          kod denenmesin diye. Değiştirmek için "Farklı e-posta" bağlantısı kullanılır. */}
      <FormField
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!codeSent}
      />

      {!codeSent ? (
        // "Kod gönder" butonu: basınca requestCode çalışır ve kod e-postaya gönderilir.
        <Button title="Kod gönder" onPress={requestCode} loading={loading} />
      ) : (
        <>
          {info !== '' && <Text style={styles.info}>{info}</Text>}
          {/* Kod alanı: e-postadaki 6 haneli kod kutulara yazılır; telefon kodu önerirse otomatik doldurulur */}
          <CodeField label="E-postanıza gelen kod" value={code} onChangeText={setCode} autoComplete="one-time-code" />
          <FormField
            label="Yeni şifre (en az 8 karakter)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
          />
          {error !== '' && <ErrorMessage message={error} />}
          {/* "Şifremi değiştir" butonu: basınca resetPassword çalışır; kod doğruysa şifre değişir ve giriş yapılır */}
          <Button title="Şifremi değiştir" onPress={resetPassword} loading={loading} />
          {/* "Kodu tekrar gönder" bağlantısı: basınca requestCode yeniden çalışır; yeni kod gelir, eskisi geçersiz olur */}
          <TextButton title="Kodu tekrar gönder" onPress={requestCode} disabled={loading} />
          {/* "Farklı e-posta" bağlantısı: 1. adıma döner, e-posta kutusu yeniden düzenlenebilir olur */}
          <TextButton
            title="Farklı e-posta"
            onPress={() => {
              setCodeSent(false);
              setCode('');
              setNewPassword('');
              setInfo('');
              setError('');
            }}
          />
        </>
      )}

      {/* 1. adımdaki hata (2. adımın hatası yukarıda, kendi butonunun hemen üstünde gösterilir) */}
      {!codeSent && error !== '' && <ErrorMessage message={error} />}
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
  info: {
    marginBottom: 16,
    fontFamily: fonts.text,
    fontSize: 15,
    lineHeight: 22,
    color: colors.success,
  },
});
