// Tekrarlayan duyurular ekranı (yönetici): belirli gün(ler)de ve saatte kendiliğinden yayınlanacak duyuruları
// ekler ve siler ("Her pazartesi 08:00 — Çöp günü"). Vakti gelince duyuru, duyurular listesine düşer ve
// sitedeki herkese bildirim gider. Üstte ekleme formu, altta mevcut tekrarlayan duyuruların listesi vardır.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import api from '../services/api';
import Button from '../components/Button';
import TextButton from '../components/TextButton';
// ChoiceButton: seçilebilir gün düğmesi (ortak component); multiple: birden fazla gün seçilebilir.
import ChoiceButton from '../components/ChoiceButton';
import FormField from '../components/FormField';
import ErrorMessage from '../components/ErrorMessage';
import { formatDateTime } from '../format';
import Icon from '../components/Icon';
import { radius, colors, fonts, textStyles } from '../theme';

// Gün seçim düğmeleri Pazartesi'den başlar (Türkiye'de hafta Pazartesi başlar).
// value: backend'e giden sayı (JavaScript'teki gibi 0 = Pazar, 1 = Pazartesi ... 6 = Cumartesi).
const DAYS = [
  { value: 1, short: 'Pzt' },
  { value: 2, short: 'Sal' },
  { value: 3, short: 'Çar' },
  { value: 4, short: 'Per' },
  { value: 5, short: 'Cum' },
  { value: 6, short: 'Cmt' },
  { value: 0, short: 'Paz' },
];

// Seçili günleri okunur metne çevirir: 7 gün → "Her gün", değilse "Pzt, Per" (Pazartesi'den başlayan sırayla).
const dayText = (days) =>
  days.length === 7
    ? 'Her gün'
    : DAYS.filter((g) => days.includes(g.value))
        .map((g) => g.short)
        .join(', ');

// 8, 5 → "08:05" (padStart: tek haneli sayının başına 0 ekler).
const timeText = (hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

export default function RecurringAnnouncementsScreen() {
  // useState: mevcut tekrarlayan duyurular. null → henüz yüklenmedi.
  const [list, setList] = useState(null);
  // useState: liste yüklenemezse gösterilecek hata.
  const [listError, setListError] = useState('');

  // useState: form alanları. selectedDays: seçili günlerin sayıları (örn. [1, 4] → Pazartesi ve Perşembe).
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  // saat ve dakika ayrı kutularda elle yazılır ("08" : "00").
  const [hourInput, setHourInput] = useState('08');
  const [minuteInput, setMinuteInput] = useState('00');
  // useState: ekleme isteği sürerken true (form iki kez gönderilmez) ve formdaki hata mesajı.
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState('');

  // API isteği: GET /api/tekrarlanan-duyurular ile kendi sitemin tekrarlayan duyurularını çeker.
  // useCallback: fonksiyon her çizimde yeniden oluşmasın diye saklanır; böylece aşağıdaki useFocusEffect gereksiz yere tekrar çalışmaz.
  const load = useCallback(async () => {
    setListError('');
    try {
      const { data } = await api.get('/tekrarlanan-duyurular');
      setList(data);
    } catch (e) {
      setListError(e.message);
    }
  }, []);

  // useFocusEffect: ekran her öne geldiğinde liste yeniden çekilir ("son gönderim" bilgisi güncellenir).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Bir gün düğmesine basınca o gün seçiliyse çıkarılır, değilse eklenir.
  // Önceki değerden yeni dizi üretilir (filter / [...]); state doğrudan değiştirilmez.
  const toggleDay = (value) =>
    setSelectedDays((previous) => (previous.includes(value) ? previous.filter((g) => g !== value) : [...previous, value]));

  // add: "Ekle" butonuna basınca çalışır. Telefonda kısa kontrol (hızlı geri bildirim), asıl kontrol backend'de.
  // Saat ve dakika iki ayrı kutudan alınıp "08:30" biçiminde birleştirilir; düzenli ifade (regex: metnin belli bir kalıba uyup uymadığını kontrol eden desen)
  // ile saat 0–23, dakika 0–59 olduğu kontrol edilir. Desenin parçaları:
  //   ^ ve $ → metnin tamamı kalıba uymalı (başında/sonunda fazlalık olamaz)
  //   ([01]?\d|2[0-3]) → saat: 0–19 ("8", "08", "19") veya 20–23
  //   :([0-5]\d) → iki nokta, ardından dakika: 00–59 (her zaman iki hane)
  // exec: uyarsa parantez içindeki kısımları verir (match[1] = saat, match[2] = dakika), uymazsa null döner.
  const add = async () => {
    // İki kutudaki değerler "08:30" biçiminde birleştirilir (dakika tek haneliyse başına 0 eklenir).
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(`${hourInput}:${minuteInput.padStart(2, '0')}`);
    if (title.trim().length < 2 || !content.trim()) return setFormError('Başlık (en az 2 karakter) ve içerik girin.');
    if (selectedDays.length === 0) return setFormError('En az bir gün seçin.');
    if (!match) return setFormError('Saati 0–23, dakikayı 0–59 arasında girin.');

    setFormError('');
    setAdding(true);
    try {
      // API isteği: POST /api/tekrarlanan-duyurular ile yeni tekrarlayan duyuruyu gönderir.
      // Site bilgisi gönderilmez; backend yöneticinin sitesini token'dan bulur.
      const { data } = await api.post('/tekrarlanan-duyurular', {
        baslik: title,
        icerik: content,
        gunler: selectedDays,
        saat: Number(match[1]),
        dakika: Number(match[2]),
      });
      // Başarılı: yeni kayıt listeye eklenir, form temizlenir (saat aynı kalır, art arda eklemek kolay olsun).
      // sort: liste backend'deki gibi saate göre sıralı kalsın (saat × 60 + dakika = günün kaçıncı dakikası).
      setList((previous) =>
        [...(previous ?? []), data].sort((a, b) => a.saat * 60 + a.dakika - (b.saat * 60 + b.dakika))
      );
      setTitle('');
      setContent('');
      setSelectedDays([]);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setAdding(false);
    }
  };

  // Silme geri alınamaz; önce onay sorulur. Onaylanırsa DELETE /api/tekrarlanan-duyurular/:id isteği atılır
  // ve kayıt listeden çıkarılır. Daha önce yayınlanmış duyurular duyurular listesinde kalır.
  const confirmDelete = (t) =>
    Alert.alert('Tekrarlayan duyuruyu sil', `"${t.baslik}" bundan sonra yayınlanmayacak. Silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/tekrarlanan-duyurular/${t.id}`);
            setList((previous) => previous.filter((x) => x.id !== t.id));
          } catch (e) {
            Alert.alert('Silinemedi', e.message);
          }
        },
      },
    ]);

  return (
    // KeyboardAwareScrollView: klavye açılınca alanlar ve buton klavyenin altında kalmaz.
    // Liste en fazla 20 kayıt olduğu için FlatList yerine map ile aynı kaydırılan alana çizilir.
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.icerik}
      bottomOffset={100}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[textStyles.aciklama, styles.aciklama]}>
        Seçtiğiniz gün ve saatte duyuru kendiliğinden yayınlanır ve herkese bildirim gider (Türkiye saati).
      </Text>

      <FormField label="Başlık" value={title} onChangeText={setTitle} maxLength={80} placeholder="Örn. Çöp günü" />
      <FormField
        label="İçerik"
        value={content}
        onChangeText={setContent}
        maxLength={1000}
        multiline
        style={styles.longField}
        placeholder="Örn. Çöpler akşam 20.00'de alınacak."
      />

      <Text style={[textStyles.label, styles.label]}>GÜNLER</Text>
      {/* 7 gün tek satırda, eşit genişlikte (flex: 1) */}
      <View style={styles.gunler}>
        {DAYS.map((g) => {
          const isSelected = selectedDays.includes(g.value);
          return (
            // Gün düğmesi: basınca toggleDay çalışır, gün seçilir veya seçimden çıkarılır (seçiliyse dolu renkli).
            <ChoiceButton key={g.value} text={g.short} isSelected={isSelected} multiple style={styles.gun} onPress={() => toggleDay(g.value)} />
          );
        })}
      </View>

      {/* Saat elle yazılır: iki kutu (saat : dakika), sadece rakam, en fazla 2 hane */}
      <Text style={[textStyles.label, styles.label]}>SAAT</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={styles.hourInput}
          value={hourInput}
          onChangeText={(m) => setHourInput(m.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          accessibilityLabel="Saat"
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          style={styles.hourInput}
          value={minuteInput}
          onChangeText={(m) => setMinuteInput(m.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={2}
          selectTextOnFocus
          accessibilityLabel="Dakika"
        />
        <Text style={[textStyles.aciklama, styles.timeNote]}>{'saat : dakika\nTürkiye saati'}</Text>
      </View>

      {formError !== '' && <ErrorMessage mesaj={formError} />}
      {/* "Ekle" butonu: basınca add çalışır ve tekrarlayan duyuru backend'e kaydedilir */}
      <Button baslik="Ekle" icon="add" onPress={add} loading={adding} />

      <Text style={[textStyles.label, styles.listTitle]}>KAYITLI</Text>
      {/* Liste hatasında "Tekrar dene" butonu load'u yeniden çalıştırır */}
      {listError !== '' && <ErrorMessage mesaj={listError} onRetry={load} />}
      {list === null && listError === '' && <ActivityIndicator color={colors.primary} />}
      {list?.length === 0 && <Text style={styles.bos}>Henüz tekrarlayan duyuru yok.</Text>}
      {list?.map((t) => (
        <View key={t.id} style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.scheduleRow}>
              <Icon ad="repeat" size={16} color={colors.primary} />
              <Text style={styles.zaman}>
                {dayText(t.gunler)} · {timeText(t.saat, t.dakika)}
              </Text>
            </View>
            {/* "Sil" düğmesi: basınca confirmDelete çalışır (önce onay sorulur) */}
            <TextButton baslik="Sil" danger centered={false} onPress={() => confirmDelete(t)} />
          </View>
          <Text style={styles.cardTitle}>{t.baslik}</Text>
          <Text style={styles.cardText}>{t.icerik}</Text>
          <Text style={styles.last}>
            {t.sonGonderim ? `Son gönderim: ${formatDateTime(t.sonGonderim)}` : 'Henüz gönderilmedi'}
          </Text>
        </View>
      ))}
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
  longField: {
    minHeight: 100,
    textAlignVertical: 'top', // Android'de yazı kutunun üstünden başlasın
  },
  label: {
    marginBottom: 7,
  },
  gunler: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  // Gün düğmesi: 7 düğme satırı eşit paylaşır (minWidth ve yan boşluk sıfırlanır ki dar ekranda sığsın)
  gun: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  hourInput: {
    width: 72,
    height: 52,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  colon: {
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '600',
    color: colors.muted,
  },
  timeNote: {
    marginLeft: 6,
    fontSize: 12,
    lineHeight: 16,
  },
  listTitle: {
    marginTop: 20,
    marginBottom: 8,
  },
  bos: {
    fontFamily: fonts.metin,
    fontSize: 15,
    color: colors.muted,
  },
  card: {
    marginBottom: 12,
    padding: 16,
    gap: 6,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zaman: {
    fontFamily: fonts.mono,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.primary,
  },
  cardTitle: {
    fontFamily: fonts.metin,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  cardText: {
    fontFamily: fonts.metin,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  last: {
    fontFamily: fonts.metin,
    fontSize: 13,
    color: colors.faint,
  },
});
