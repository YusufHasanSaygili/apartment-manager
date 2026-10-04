// Oturum bilgisi (token, kullanıcı, site) tüm uygulamayla paylaşılır.
// React Context: bir veriyi her ekrana tek tek prop olarak geçmek yerine, uygulamanın
// her yerinden useOturum() ile okunabilir hale getirir. App.js oturum varsa yönetici
// ekranını, yoksa açılış ekranını göstermek için bunu kullanır.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api, { oturumDusunceAyarla, tokenAyarla } from './api';
import { pushTokenAl } from './bildirim';
import { soketBaglan, soketKes, useSoketOlayi } from './soket';

// Token telefonda bu anahtar adıyla saklanır.
const TOKEN_ANAHTARI = 'oturumToken';

// Sunucu soket bağlantısını bir kodla reddederse gösterilecek uyarı başlıkları (kod → başlık).
const BAGLANTI_RED_BASLIKLARI = { DAIREDEN_CIKARILDI: 'Oturum kapandı', SIFRE_DEGISTI: 'Şifre değişti' };

const OturumContext = createContext(null);

export function OturumProvider({ children }) {
  // useState: giriş yapan kullanıcının bilgileri ({ token, kullanici, site }).
  // null → giriş yapılmamış. Değişince App.js ekranları otomatik olarak değiştirir.
  const [oturum, setOturum] = useState(null);

  // useState: açılışta kayıtlı token kontrol edilirken false. Kontrol bitmeden ekran
  // seçilmez; yoksa giriş yapmış kullanıcı bir an açılış ekranını görürdü.
  const [hazir, setHazir] = useState(false);

  // useRef: oturum zaten düşürüldü mü. Aynı anda birkaç istek 401 alırsa mesaj tek kez gösterilsin diye.
  // useState değil useRef: değişince ekranın yeniden çizilmesine gerek yok.
  const dustuRef = useRef(false);

  // useState: açılışta kayıtlı oturum sunucuya sorulamadıysa hatanın mesajı ('' = sorun yok). Doluysa App.js
  // açılış ekranı yerine bu mesajı ve "Tekrar dene" butonunu gösterir; yoksa giriş yapmış kullanıcı
  // (internet yok, sunucu kapalı) kendini çıkış yapmış sanırdı.
  const [acilisHatasi, setAcilisHatasi] = useState('');

  // Otomatik giriş: telefonda kayıtlı token varsa GET /api/hesap/ben ile hâlâ geçerli mi diye sorulur.
  // useCallback: açılışta bir kez, sonra "Tekrar dene" butonuyla tekrar çağrılır.
  // hataMesaji: sonuç en sonda tek seferde yazılır; böylece tekrar denerken ekran arada açılış ekranına atlamaz.
  const kayitliOturumuYukle = useCallback(async () => {
    let hataMesaji = '';
    try {
      const token = await SecureStore.getItemAsync(TOKEN_ANAHTARI);
      if (token) {
        tokenAyarla(token);
        const { data } = await api.get('/hesap/ben');
        // Token geçerli: anlık mesajlar için soket bağlantısı da bu token ile açılır.
        soketBaglan(token);
        setOturum({ token, ...data });
      }
    } catch (hata) {
      tokenAyarla(null);
      // 401: token süresi dolmuş veya hesap silinmiş → kayıtlı token silinir, açılış ekranı gösterilir.
      // Diğer hatalarda (internet yok, sunucu kapalı, sunucu hatası) token silinmez; "Tekrar dene" ekranı çıkar,
      // sunucuya ulaşılınca oturum kaldığı yerden devam eder.
      if (hata.durumKodu === 401) {
        await SecureStore.deleteItemAsync(TOKEN_ANAHTARI);
      } else {
        hataMesaji = hata.message;
      }
    } finally {
      setAcilisHatasi(hataMesaji);
      setHazir(true);
    }
  }, []);

  // useEffect: uygulama ilk açıldığında bir kez çalışır → otomatik giriş.
  useEffect(() => {
    kayitliOturumuYukle();
  }, [kayitliOturumuYukle]);

  // useEffect: oturum açıldığında (giriş, kayıt, katılma veya otomatik giriş) çalışır.
  // Telefonun push token'ı alınıp PUT /api/hesap/push-token ile hesaba kaydedilir; böylece
  // duyuru gibi bildirimler bu telefona gelir. Bağımlılık kullanıcı id'si: aynı kullanıcı için tekrar çalışmaz.
  // Hata olursa sessizce geçilir (bildirim alınamaz ama uygulama çalışmaya devam eder).
  const kullaniciId = oturum?.kullanici.id;
  useEffect(() => {
    if (!kullaniciId) return;
    pushTokenAl()
      .then((pushToken) => pushToken && api.put('/hesap/push-token', { token: pushToken }))
      .catch(() => {});
  }, [kullaniciId]);

  // Sunucudan gelen giriş/kayıt/katılma cevabıyla oturumu açar.
  // Token expo-secure-store ile telefonun şifreli deposuna yazılır (AsyncStorage değil):
  // başka uygulamalar okuyamaz. Ayrıca sonraki tüm API isteklerine eklenir ve soket bağlantısı açılır.
  // ...bilgi: cevaptaki diğer her şey (kullanıcı, site ve sakinse daire) oturuma olduğu gibi yazılır.
  const oturumAc = async ({ token, ...bilgi }) => {
    // Yeni oturum açıldı: "oturum düştü" işareti sıfırlanır ki bu oturum da düşerse mesaj tekrar gösterilsin.
    dustuRef.current = false;
    await SecureStore.setItemAsync(TOKEN_ANAHTARI, token);
    tokenAyarla(token);
    soketBaglan(token);
    setOturum({ token, ...bilgi });
  };

  // Çıkış: önce bu hesabın push token'ı backend'den silinir (çıkış yapmış telefona bildirim gitmesin),
  // sonra soket bağlantısı kapatılır, token telefondan ve isteklerden silinir, oturum boşaltılır → App.js açılış ekranına döner.
  // Push token silme isteği başarısız olsa bile (örn. internet yok) çıkış yine yapılır.
  const cikisYap = async () => {
    await api.delete('/hesap/push-token').catch(() => {});
    soketKes();
    await SecureStore.deleteItemAsync(TOKEN_ANAHTARI);
    tokenAyarla(null);
    setOturum(null);
  };

  // Oturum düştü (sunucu artık bu oturumu kabul etmiyor) veya hesap silindi: sunucuya istek atmadan sadece bu telefonda çıkış
  // yapılır ve nedeni gösterilir (örn. "Bu hesap daireden çıkarılmıştır"). App.js açılış ekranına döner.
  // useCallback: fonksiyon sabit kalsın; aşağıdaki useEffect ve soket dinleyicisi her çizimde yeniden kurulmasın.
  // baslik: uyarı penceresinin başlığı (varsayılan "Oturum kapandı"; hesap silinince "Hesap silindi").
  const oturumDustu = useCallback(async (mesaj, baslik = 'Oturum kapandı') => {
    if (dustuRef.current) return;
    dustuRef.current = true;
    soketKes();
    tokenAyarla(null);
    // Telefonun deposu (SecureStore) hata verse bile oturum kapatılır; hata burada yakalanır, böylece bu fonksiyonu
    // çağıran yerlerin (api.js, soket olayları, hesap silme ekranı) ayrıca hata yakalamasına gerek kalmaz.
    await SecureStore.deleteItemAsync(TOKEN_ANAHTARI).catch(() => {});
    setOturum(null);
    Alert.alert(baslik, mesaj);
  }, []);

  // useEffect: oturumDustu fonksiyonunu api.js'e kaydeder; herhangi bir istek 401 alınca o çağrılır.
  useEffect(() => {
    oturumDusunceAyarla(oturumDustu);
  }, [oturumDustu]);

  // Soket olayları: sunucu bu oturumu kapatmak isteyince haber verir, uygulama açıksa oturum anında kapanır.
  // - dairedenCikarildi: yönetici bu sakini daireden çıkardı (hesabı silindi).
  // - hesapSilindi: aynı hesap başka bir telefonda silindi. Başlık ve mesaj, silme ekranının kendi gösterdiğiyle
  //   aynıdır: hangisi önce gelirse gelsin kullanıcı aynı uyarıyı görür.
  // - sifreDegisti: şifre başka bir telefondan sıfırlandı; bu telefondaki (artık eski) oturum kapatılır.
  // Mesaj sunucudan gelir; başlık olaya göre seçilir. useCallback: dinleyiciler her çizimde yeniden kurulmasın.
  const dairedenCikarildi = useCallback(({ mesaj }) => oturumDustu(mesaj), [oturumDustu]);
  const hesapSilindi = useCallback(({ mesaj }) => oturumDustu(mesaj, 'Hesap silindi'), [oturumDustu]);
  const sifreDegisti = useCallback(({ mesaj }) => oturumDustu(mesaj, 'Şifre değişti'), [oturumDustu]);
  useSoketOlayi('dairedenCikarildi', dairedenCikarildi);
  useSoketOlayi('hesapSilindi', hesapSilindi);
  useSoketOlayi('sifreDegisti', sifreDegisti);

  // Soket bağlanamadıysa ve sunucu nedenini bir kodla bildirdiyse (telefon kapalıyken daireden çıkarılmış ya da
  // şifresi başka yerden değiştirilmiş olabilir) oturum kapatılır. BAGLANTI_RED_BASLIKLARI: kod → uyarı başlığı.
  // Kodu olmayan bağlantı hatalarında (internet yok vb.) hiçbir şey yapılmaz, soket kendisi tekrar dener.
  const baglantiReddedildi = useCallback(
    (hata) => {
      const baslik = BAGLANTI_RED_BASLIKLARI[hata.data?.kod];
      if (baslik) oturumDustu(hata.message, baslik);
    },
    [oturumDustu]
  );
  useSoketOlayi('connect_error', baglantiReddedildi);

  // Oturum bilgisini (kullanıcı, rol, site, daire) sunucudan yeniden çeker; token aynı kalır.
  // Yönetici devrinde rol değişince çağrılır: oturum güncellenince App.js yeni rolün ekranlarını kendiliğinden
  // gösterir (yönetici → sakin ekranları veya tersi), tekrar giriş gerekmez. Hata olursa sessizce geçilir
  // (401 ise api.js zaten oturumu kapatır).
  // useCallback: fonksiyon sabit kalsın; aşağıdaki soket dinleyicisi her çizimde yeniden kurulmasın.
  // setOturum((onceki) => ...): o anki oturumu okuyup token'ı korur; bu arada çıkış yapıldıysa (null) dokunmaz.
  const oturumuYenile = useCallback(async () => {
    try {
      const { data } = await api.get('/hesap/ben');
      setOturum((onceki) => (onceki ? { token: onceki.token, ...data } : onceki));
    } catch {
      // ağ hatası: bir sonraki açılışta zaten güncel bilgi gelir
    }
  }, []);

  // Soket olayı: yöneticilik devredildi (bu kişi yönetici oldu ya da yöneticiliği bıraktı).
  // Uygulama açıksa ekranlar anında yeni role geçer; diğer cihazdaki uygulama da aynı anda değişir.
  useSoketOlayi('rolDegisti', oturumuYenile);

  // Provider: içine sarılan tüm ekranlara oturum bilgisini ve fonksiyonları dağıtır.
  // acilisHatasi + kayitliOturumuYukle: App.js açılışta sunucuya ulaşılamazsa "Tekrar dene" ekranı için kullanır.
  // oturumuKapat: oturumDustu'nun ekranlara açılan adı. Hesap silindikten sonra HesapSil ekranı bunu çağırır;
  // cikisYap'tan farkı sunucuya istek atmamasıdır (hesap zaten silindi, push token isteği 401 alırdı).
  return (
    <OturumContext.Provider value={{ oturum, hazir, acilisHatasi, kayitliOturumuYukle, oturumAc, cikisYap, oturumuYenile, oturumuKapat: oturumDustu }}>{children}</OturumContext.Provider>
  );
}

// Ekranların oturum bilgisine ulaşmak için kullandığı kısa yol: const { oturum } = useOturum();
export function useOturum() {
  return useContext(OturumContext);
}
