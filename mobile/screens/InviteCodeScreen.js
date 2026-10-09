// Daire kodu ekranı: alttan açılan pencere (arkası %60 karartılmış daire listesi). Seçilen dairenin davet kodunu
// büyük puntoyla gösterir ve kodu WhatsApp, SMS vb. ile paylaşmayı sağlar.
// Dairede sakin varsa adı gösterilir ve yönetici "Sakini daireden çıkar" ile daireyi boşaltabilir
// (daire el değiştirdiğinde); o zaman daireye yeni davet kodu verilir ve burada hemen gösterilir.
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../services/api';
import { useSession } from '../services/SessionContext';
import Button from '../components/Button';
import Icon from '../components/Icon';
import { radius, colors, fonts, textStyles } from '../theme';

// route.params: daire listesinden gönderilen daire kimliği, adı (örn. "A3"), davet kodu, dolu bilgisi ve sakinin adı.
export default function InviteCodeScreen({ route, navigation }) {
  // managerFlat: dairede sitenin yöneticisi oturuyor (devirle yönetici olmuş); çıkarma butonu gösterilmez.
  const { daireId: flatId, flatName, sakinAdi: residentName, yoneticiDairesi: managerFlat } = route.params;
  // useState: davet kodu ve dolu bilgisi listeden gelen değerlerle başlar; sakin çıkarılınca yeni kod
  // gelir ve daire boş olur. State olduğu için ekran kendiliğinden yeni kodu gösterir.
  const [inviteCode, setInviteCode] = useState(route.params.davetKodu);
  const [occupied, setOccupied] = useState(route.params.dolu);
  // useState: çıkarma isteği sürerken true; buton dönen simge gösterir ve tekrar basılamaz.
  const [removing, setRemoving] = useState(false);
  // useSession: giriş yapan kullanıcının oturum bilgisi; paylaşım mesajına site adını koymak için gerekir.
  const { session } = useSession();
  // useSafeAreaInsets: alt gezinme çubuğunun yüksekliği; pencerenin butonları çubuğun arkasında kalmasın diye
  const { bottom: bottomInset } = useSafeAreaInsets();

  // Share: telefonun kendi paylaşım menüsünü açar (ek kütüphane gerekmez).
  // Sakine gidecek hazır mesajda site adı, daire ve kod bulunur.
  const share = async () => {
    try {
      await Share.share({
        message: `Apartmanım uygulamasında ${session.site.ad} sitesine katılmak için davet kodunuz: ${inviteCode} (Daire ${flatName})`,
      });
    } catch {
      Alert.alert('Paylaşılamadı', 'Paylaşım menüsü açılamadı. Lütfen tekrar deneyin.');
    }
  };

  // API isteği: POST /api/daireler/:id/sakini-cikar. Sakinin hesabı ve mesajları silinir
  // ve sunucu daireye yeni davet kodu verir; yeni kod ekranda gösterilir ve paylaşılabilir.
  const removeResident = async () => {
    setRemoving(true);
    try {
      const { data } = await api.post(`/daireler/${flatId}/sakini-cikar`);
      setInviteCode(data.davetKodu);
      setOccupied(false);
    } catch (e) {
      Alert.alert('Sakin çıkarılamadı', e.message);
    } finally {
      setRemoving(false);
    }
  };

  // Çıkarma geri alınamaz; önce onay sorulur. "Çıkar" seçilirse removeResident çalışır.
  // Metin, sakinin hesabının ve mesajlarının kalıcı silineceğini açıkça söyler; yönetici neyi onayladığını bilsin.
  const confirmRemove = () =>
    Alert.alert(
      'Sakini daireden çıkar',
      `${residentName ?? 'Sakin'} ${flatName} dairesinden çıkarılsın mı? Hesabı ve mesajları kalıcı olarak silinir, daireye yeni davet kodu verilir. Aidat geçmişi korunur.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Çıkar', style: 'destructive', onPress: removeResident },
      ],
    );

  // Kodun altında görünen kısa durum: kullanıldıysa yeşil "Kullanıldı", değilse soluk "Henüz kullanılmadı"
  const used = occupied || managerFlat;

  return (
    <View style={styles.container}>
      {/* Karartma: pencerenin arkasındaki listeyi karartır; boşluğa basınca pencere kapanır */}
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={() => navigation.goBack()}
        // Ekran okuyucu bu alanı atlar: pencerede aynı işi yapan "Kapat" butonu zaten var
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <View style={[styles.wrapper, { paddingBottom: 24 + bottomInset }]} accessibilityViewIsModal>
        {/* Tutamaç: alttan açılan pencere olduğunu gösteren küçük çizgi */}
        <View style={styles.handle} />
        {/* Üst: daire rozeti, daire adı ve dairede kimin oturduğu */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{flatName}</Text>
          </View>
          <View>
            <Text style={styles.baslik}>Daire {flatName}</Text>
            <Text style={textStyles.aciklama}>
              {managerFlat
                ? 'Site yöneticisinin dairesi'
                : occupied
                  ? `Sakin: ${residentName ?? 'kayıtlı bir sakin'}`
                  : 'Henüz sakin katılmadı'}
            </Text>
          </View>
        </View>

        {/* Kod kutusu: kesikli çerçeve içinde büyük, monospace kod. selectable: basılı tutarak kopyalanabilir. */}
        <View style={styles.codeBox}>
          <Text style={textStyles.label}>DAVET KODU</Text>
          <Text style={styles.kod} selectable accessibilityLabel={`Davet kodu ${inviteCode.split('').join(' ')}`}>
            {inviteCode.slice(0, 3)} {inviteCode.slice(3)}
          </Text>
          <View style={styles.codeStatus}>
            <Icon ad={used ? 'paid' : 'before'} size={15} color={used ? colors.success : colors.muted} />
            <Text style={[styles.codeStatusText, used && { color: colors.success }]}>
              {used ? 'Kullanıldı · tek kullanımlık' : 'Henüz kullanılmadı · tek kullanımlık'}
            </Text>
          </View>
        </View>

        {/* Üç durum: 1) dairede yönetici oturuyor → sadece bilgi (çıkarma butonu yok, backend de engeller);
          2) kod kullanılmış (dolu) → "Sakini daireden çıkar"; 3) boş → "Kodu paylaş".
          Kod tek kullanımlık: kullanıldıysa paylaşma butonu gösterilmez */}
        {managerFlat ? null : occupied ? (
          // "Sakini daireden çıkar" butonu: basınca confirmRemove çalışır (önce onay sorulur), onaylanırsa
          // removeResident ile sakin çıkarılır ve yeni davet kodu gösterilir
          <Button
            baslik="Sakini daireden çıkar"
            icon="removeResident"
            variant="dangerOutline"
            loading={removing}
            onPress={confirmRemove}
          />
        ) : (
          // "Kodu paylaş" butonu: basınca share çalışır ve telefonun paylaşım menüsü açılır
          <Button baslik="Kodu paylaş" icon="share" onPress={share} />
        )}
        {/* "Kapat" butonu: basınca pencere kapanır, daire listesine dönülür */}
        <Button baslik="Kapat" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pencere ekranın altına yaslanır
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  wrapper: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius,
    backgroundColor: colors.surface3,
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  baslik: {
    fontFamily: fonts.metin,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  codeBox: {
    alignItems: 'center',
    gap: 4,
    padding: 14,
    borderRadius: radius,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  kod: {
    fontFamily: fonts.mono,
    fontSize: 38,
    fontWeight: '600',
    letterSpacing: 4,
    color: colors.text,
  },
  codeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeStatusText: {
    fontFamily: fonts.metin,
    fontSize: 12.5,
    color: colors.muted,
  },
});
