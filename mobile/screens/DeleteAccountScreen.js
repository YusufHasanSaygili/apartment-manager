// Hesabımı sil ekranı: kullanıcı hesabını kalıcı olarak siler.
// Sakin: neyin silinip neyin kalacağı açıklanır, şifre istenir, son bir onaydan sonra hesap silinir.
// Yönetici: hesabını silemez; önce yöneticiliği devretmesi gerektiği yazılır ve Devir ekranına geçiş butonu gösterilir.
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import Button from '../components/Button';
import FormField from '../components/FormField';
import ErrorMessage from '../components/ErrorMessage';
import Icon from '../components/Icon';
import { radius, colors, fonts } from '../theme';

// navigation: yöneticiyi Handover (devir) ekranına göndermek için kullanılır.
export default function DeleteAccountScreen({ navigation }) {
  // session: rolü öğrenmek için; closeSession: silme başarılı olunca bu telefondaki oturumu kapatıp mesaj gösterir.
  const { session, closeSession } = useSession();
  // manager: aynı ekran iki rolde de açılır; bu değere göre aşağıda farklı içerik gösterilir.
  const manager = session.kullanici.rol === 'yonetici';

  // useState: şifre kutusundaki metin, istek sürerken true olan yükleniyor bayrağı ve hata mesajı.
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // API isteği: DELETE /api/hesap ile şifreyi gönderir (axios'ta DELETE gövdesi "data" ile verilir).
  // Başarılıysa oturum bu telefonda kapatılır, uygulama açılış ekranına döner ve "Hesabınız silindi" gösterilir.
  // Şifre yanlışsa sunucu 400 döner; mesaj ekranda gösterilir, kullanıcı tekrar deneyebilir.
  const deleteAccount = async () => {
    setError('');
    setDeleting(true);
    try {
      await api.delete('/hesap', { data: { sifre: password } });
    } catch (e) {
      // deleting sadece hata olunca false yapılır: başarıda ekran zaten kapanıp açılış ekranına geçilir.
      setError(e.message);
      setDeleting(false);
      return;
    }
    // Hesap silindi: telefondaki oturum kapatılır (closeSession kendi hatasını içeride yakalar; hesap zaten silindiği
    // için ekranda "silinemedi" gibi yanlış bir hata gösterilmez).
    await closeSession('Hesabınız ve kişisel bilgileriniz silindi.', 'Hesap silindi');
  };

  // Silme geri alınamaz; şifre girildikten sonra bir kez daha onay sorulur. "Sil" seçilirse deleteAccount çalışır.
  const confirmDelete = () => {
    if (!password) return setError('Şifrenizi girin.');
    Alert.alert('Hesabı kalıcı olarak sil', 'Bu işlem geri alınamaz. Hesabınız silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: deleteAccount },
    ]);
  };

  // Yönetici hesabı silinemez (backend de 403 döner); önce yöneticilik bir sakine devredilmelidir.
  if (manager) {
    return (
      <View style={styles.managerBox}>
        {/* Uyarı kartı: gri zeminde sarı kalkan, başlık ve açıklama */}
        <View style={styles.card}>
          <View style={styles.largeIcon}>
            <Icon ad="shield" size={30} color={colors.warning} background={colors.surface3} />
          </View>
          <Text style={styles.cardTitle}>Önce yöneticiliği devredin</Text>
          <Text style={styles.metin}>
            Site yöneticisiz kalamaz. Yöneticiliği bir sakine devrettikten sonra sakin olursunuz ve hesabınızı buradan
            silebilirsiniz.
          </Text>
        </View>
        {/* "Yöneticiliği devret" butonu: basınca Handover (devir) ekranı açılır */}
        <Button baslik="Yöneticiliği devret" icon="handover" onPress={() => navigation.navigate('Handover')} />
      </View>
    );
  }

  return (
    // KeyboardAwareScrollView: klavye açılınca şifre kutusu ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      {/* Uyarı kartı: kırmızı çerçeve, piksellere dağılan kimlik kartı ikonu ve silinecek bilgiler */}
      <View style={[styles.card, styles.cardDanger]}>
        <View style={[styles.largeIcon, styles.largeIconDanger]}>
          <Icon ad="deleteAccount" size={30} color={colors.error} background={colors.errorBackground} />
        </View>
        <Text style={styles.cardTitle}>Hesabınız kalıcı olarak silinecek</Text>
        <Text style={styles.metin}>
          Adınız, e-postanız ve mesajlarınız silinir; bu hesapla bir daha giriş yapılamaz. Aidat geçmişi dairede kalır ama
          sizinle bağlantısı kaldırılır. Bu işlem geri alınamaz.
        </Text>
      </View>

      {/* Şifre: hesabı sadece sahibinin silebilmesi için tekrar istenir (sağdaki göz ikonuyla görülebilir) */}
      <FormField label="Şifreniz" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />

      {error !== '' && <ErrorMessage mesaj={error} />}
      {/* "Hesabımı kalıcı olarak sil" butonu: basınca confirmDelete çalışır (önce son onay sorulur) */}
      <Button baslik="Hesabımı kalıcı olarak sil" icon="deleteAccount" variant="danger" onPress={confirmDelete} loading={deleting} />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  icerik: {
    padding: 18,
    gap: 14,
  },
  managerBox: {
    flex: 1,
    padding: 18,
    gap: 14,
    backgroundColor: colors.background,
  },
  card: {
    padding: 16,
    gap: 9,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardDanger: {
    borderColor: colors.errorBorder,
  },
  // Büyük ikon kutusu: yöneticide gri zeminde sarı kalkan; sakinde koyu kırmızı zeminde kırmızı ikon (buton da aynı kırmızı)
  largeIcon: {
    width: 56,
    height: 56,
    borderRadius: radius,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeIconDanger: {
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  cardTitle: {
    fontFamily: fonts.metin,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  metin: {
    fontFamily: fonts.metin,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
});
