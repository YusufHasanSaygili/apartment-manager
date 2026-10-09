// Site oluşturma ekranı: yönetici olacak kişi kendi bilgilerini ve site adını girer.
// Gönderince backend yeni siteyi ve yönetici hesabını oluşturur, oturum açılır.
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import Button from '../components/Button';
import FormField from '../components/FormField';
import ErrorMessage from '../components/ErrorMessage';
import { colors, fonts } from '../theme';

export default function CreateSiteScreen() {
  // useState: formdaki 4 alanın değerleri. Kullanıcı yazdıkça güncellenir.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [siteName, setSiteName] = useState('');

  // useState: istek sürerken true olur; butonda dönen simge çıkar, form iki kez gönderilmez.
  const [loading, setLoading] = useState(false);

  // useState: formda veya sunucuda bir hata olursa gösterilecek mesaj.
  const [error, setError] = useState('');

  // useSession: ortak oturum bilgisinden openSession fonksiyonunu alır; kayıt başarılı olunca çağrılır.
  const { openSession } = useSession();

  // Form gönderme: önce telefonda basit kontrol, sonra backend'e istek.
  const createSite = async () => {
    // Boş alanı sunucuya hiç göndermeden yakalar (asıl kontrol yine backend'de yapılır).
    if (!name.trim() || !email.trim() || !password || !siteName.trim()) {
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
      // API isteği: form bilgilerini POST /api/hesap/site-olustur adresine gönderir.
      // Cevapta token, kullanıcı ve site bilgisi gelir.
      const { data } = await api.post('/hesap/site-olustur', { ad: name, eposta: email, sifre: password, siteAdi: siteName });
      // Oturum açılınca App.js otomatik olarak yönetici ana ekranına geçer.
      // Bu ekran kapandığı için başarıda loading'i false yapmaya gerek yok; sadece hatada yapılır.
      await openSession(data);
    } catch (e) {
      // Hata mesajı services/api.js tarafından hazırlanmıştır (örn. "Bu e-posta ... zaten bir hesap var").
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    // KeyboardAwareScrollView: klavye açılınca sayfayı dokunulan alana otomatik kaydırır;
    // böylece yazılan alan klavyenin altında kalmaz. bottomOffset: alanla klavye arasında bırakılan boşluk;
    // 100 verildi ki son alana dokununca altındaki "Devam et" butonu da klavyenin üstünde görünsün.
    // keyboardShouldPersistTaps: klavye açıkken butona tek dokunuşla basılabilsin.
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.aciklama}>
        Siteyi oluşturan kişi sitenin yöneticisi olur. Daireler bir sonraki adımda eklenecek.
      </Text>

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
      <FormField label="Site / Apartman adı" value={siteName} onChangeText={setSiteName} />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {error !== '' && <ErrorMessage mesaj={error} />}

      {/* "Devam et" butonu: basınca createSite çalışır ve form backend'e gönderilir */}
      <Button baslik="Devam et" onPress={createSite} loading={loading} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  icerik: {
    padding: 24,
    gap: 4,
  },
  aciklama: {
    marginBottom: 20,
    fontFamily: fonts.metin,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
});
