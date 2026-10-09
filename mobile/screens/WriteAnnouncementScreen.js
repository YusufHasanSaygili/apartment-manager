// Duyuru yazma ekranı: yönetici tüm siteye duyuru yapar ("Bugün çöp günü", "Tadilat olacak").
// Listeden bir duyuruya dokunulduysa aynı ekran düzenleme modunda açılır: alanlar dolu gelir,
// "Kaydet" ile düzeltilir, "Duyuruyu sil" ile silinir.
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Button from '../components/Button';
import FormField from '../components/FormField';
import ErrorMessage from '../components/ErrorMessage';
import { colors, textStyles } from '../theme';

// route.params.announcement: düzenlenecek duyuru (listeden dokunulduysa). Yoksa yeni duyuru yazılır.
export default function WriteAnnouncementScreen({ route, navigation }) {
  const editing = route.params?.announcement;

  // useState: başlık ve içerik alanlarının değerleri (düzenlemede mevcut değerlerle başlar).
  const [title, setTitle] = useState(editing?.baslik ?? '');
  const [content, setContent] = useState(editing?.icerik ?? '');
  // useState: istek sürerken true; duyuru iki kez gönderilmez.
  const [loading, setLoading] = useState(false);
  // useState: hata olursa gösterilecek mesaj.
  const [error, setError] = useState('');

  // publish: "Yayınla" / "Kaydet" butonuna basınca çalışır. Telefonda kısa kontrol (hızlı geri bildirim),
  // asıl kontrol backend'de. Başarılıysa duyurular listesine dönülür.
  const publish = async () => {
    if (title.trim().length < 2 || !content.trim()) {
      setError('Başlık (en az 2 karakter) ve içerik girin.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // API isteği: yeni duyuruda POST /api/duyurular, düzenlemede PUT /api/duyurular/:id.
      // Site bilgisi gönderilmez; backend yöneticinin sitesini token'dan bulur.
      if (editing) {
        await api.put(`/duyurular/${editing.id}`, { baslik: title, icerik: content });
      } else {
        await api.post('/duyurular', { baslik: title, icerik: content });
      }
      navigation.goBack();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  // Silme geri alınamaz; önce onay sorulur. Onaylanırsa DELETE /api/duyurular/:id isteği atılır
  // ve listeye dönülür (liste öne gelince kendini yeniler).
  const confirmDelete = () =>
    Alert.alert('Duyuruyu sil', `"${editing.baslik}" duyurusu silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          // Silme sürerken butonlar kilitlenir (aynı anda "Kaydet"e basılamaz).
          setLoading(true);
          try {
            await api.delete(`/duyurular/${editing.id}`);
            navigation.goBack();
          } catch (e) {
            setError(e.message);
            setLoading(false);
          }
        },
      },
    ]);

  return (
    // KeyboardAwareScrollView: klavye açılınca alanlar ve buton klavyenin altında kalmaz.
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[textStyles.aciklama, styles.aciklama]}>Duyuru sitedeki herkesin duyurular listesinde görünür.</Text>

      {/* counter: yazılan karakter sayısı / en fazla (backend de aynı sınırları kontrol eder) */}
      <FormField label="Başlık" counter={`${title.length} / 80`} value={title} onChangeText={setTitle} maxLength={80} placeholder="Örn. Bugün çöp günü" />
      {/* multiline: içerik birden fazla satır olabilir */}
      <FormField
        label="İçerik"
        counter={`${content.length} / 1000`}
        value={content}
        onChangeText={setContent}
        maxLength={1000}
        multiline
        style={styles.longField}
        placeholder="Örn. Çöpler akşam 20.00'de alınacak."
      />

      {/* Hata varsa ortak hata kutusu gösterilir */}
      {error !== '' && <ErrorMessage mesaj={error} />}

      {/* "Yayınla" / "Kaydet" butonu: basınca publish çalışır ve duyuru backend'e gönderilir */}
      <Button baslik={editing ? 'Kaydet' : 'Yayınla'} onPress={publish} loading={loading} />

      {/* "Duyuruyu sil" butonu: sadece düzenlemede görünür; basınca confirmDelete çalışır (önce onay sorulur) */}
      {editing && (
        <View style={styles.remove}>
          <Button baslik="Duyuruyu sil" icon="trash" variant="dangerOutline" onPress={confirmDelete} loading={loading} />
        </View>
      )}
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
    gap: 4,
  },
  aciklama: {
    marginBottom: 16,
  },
  remove: {
    marginTop: 12,
  },
  longField: {
    minHeight: 140,
    textAlignVertical: 'top', // Android'de yazı kutunun üstünden başlasın
  },
});
