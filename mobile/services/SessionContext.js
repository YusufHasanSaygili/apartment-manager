// Oturum bilgisi (token, kullanıcı, site) tüm uygulamayla paylaşılır.
// React Context: bir veriyi her ekrana tek tek prop olarak geçmek yerine, uygulamanın
// her yerinden useSession() ile okunabilir hale getirir. App.js oturum varsa yönetici
// ekranını, yoksa açılış ekranını göstermek için bunu kullanır.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api, { setSessionDroppedHandler, setToken } from './api';
import { getPushToken } from './notifications';
import { connectSocket, disconnectSocket, useSocketEvent } from './socket';

// Token telefonda bu anahtar adıyla saklanır.
const TOKEN_KEY = 'sessionToken';

// Sunucu soket bağlantısını bir kodla reddederse gösterilecek uyarı başlıkları (kod → başlık).
const CONNECTION_REJECT_TITLES = { DAIREDEN_CIKARILDI: 'Oturum kapandı', SIFRE_DEGISTI: 'Şifre değişti' };

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  // useState: giriş yapan kullanıcının bilgileri ({ token, kullanici, site }).
  // null → giriş yapılmamış. Değişince App.js ekranları otomatik olarak değiştirir.
  const [session, setSession] = useState(null);

  // useState: açılışta kayıtlı token kontrol edilirken false. Kontrol bitmeden ekran
  // seçilmez; yoksa giriş yapmış kullanıcı bir an açılış ekranını görürdü.
  const [ready, setReady] = useState(false);

  // useRef: oturum zaten düşürüldü mü. Aynı anda birkaç istek 401 alırsa mesaj tek kez gösterilsin diye.
  // useState değil useRef: değişince ekranın yeniden çizilmesine gerek yok.
  const droppedRef = useRef(false);

  // useState: açılışta kayıtlı oturum sunucuya sorulamadıysa hatanın mesajı ('' = sorun yok). Doluysa App.js
  // açılış ekranı yerine bu mesajı ve "Tekrar dene" butonunu gösterir; yoksa giriş yapmış kullanıcı
  // (internet yok, sunucu kapalı) kendini çıkış yapmış sanırdı.
  const [startupError, setStartupError] = useState('');

  // Otomatik giriş: telefonda kayıtlı token varsa GET /api/hesap/ben ile hâlâ geçerli mi diye sorulur.
  // useCallback: açılışta bir kez, sonra "Tekrar dene" butonuyla tekrar çağrılır.
  // errorMessage: sonuç en sonda tek seferde yazılır; böylece tekrar denerken ekran arada açılış ekranına atlamaz.
  const loadSavedSession = useCallback(async () => {
    let errorMessage = '';
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        setToken(token);
        const { data } = await api.get('/hesap/ben');
        // Token geçerli: anlık mesajlar için soket bağlantısı da bu token ile açılır.
        connectSocket(token);
        setSession({ token, ...data });
      }
    } catch (error) {
      setToken(null);
      // 401: token süresi dolmuş veya hesap silinmiş → kayıtlı token silinir, açılış ekranı gösterilir.
      // Diğer hatalarda (internet yok, sunucu kapalı, sunucu hatası) token silinmez; "Tekrar dene" ekranı çıkar,
      // sunucuya ulaşılınca oturum kaldığı yerden devam eder.
      if (error.durumKodu === 401) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } else {
        errorMessage = error.message;
      }
    } finally {
      setStartupError(errorMessage);
      setReady(true);
    }
  }, []);

  // useEffect: uygulama ilk açıldığında bir kez çalışır → otomatik giriş.
  useEffect(() => {
    loadSavedSession();
  }, [loadSavedSession]);

  // useEffect: oturum açıldığında (giriş, kayıt, katılma veya otomatik giriş) çalışır.
  // Telefonun push token'ı alınıp PUT /api/hesap/push-token ile hesaba kaydedilir; böylece
  // duyuru gibi bildirimler bu telefona gelir. Bağımlılık kullanıcı id'si: aynı kullanıcı için tekrar çalışmaz.
  // Hata olursa sessizce geçilir (bildirim alınamaz ama uygulama çalışmaya devam eder).
  const userId = session?.kullanici.id;
  useEffect(() => {
    if (!userId) return;
    getPushToken()
      .then((pushToken) => pushToken && api.put('/hesap/push-token', { token: pushToken }))
      .catch(() => {});
  }, [userId]);

  // Sunucudan gelen giriş/kayıt/katılma cevabıyla oturumu açar.
  // Token expo-secure-store ile telefonun şifreli deposuna yazılır (AsyncStorage değil):
  // başka uygulamalar okuyamaz. Ayrıca sonraki tüm API isteklerine eklenir ve soket bağlantısı açılır.
  // ...info: cevaptaki diğer her şey (kullanıcı, site ve sakinse daire) oturuma olduğu gibi yazılır.
  const openSession = async ({ token, ...info }) => {
    // Yeni oturum açıldı: "oturum düştü" işareti sıfırlanır ki bu oturum da düşerse mesaj tekrar gösterilsin.
    droppedRef.current = false;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setToken(token);
    connectSocket(token);
    setSession({ token, ...info });
  };

  // Çıkış: önce bu hesabın push token'ı backend'den silinir (çıkış yapmış telefona bildirim gitmesin),
  // sonra soket bağlantısı kapatılır, token telefondan ve isteklerden silinir, oturum boşaltılır → App.js açılış ekranına döner.
  // Push token silme isteği başarısız olsa bile (örn. internet yok) çıkış yine yapılır.
  const logout = async () => {
    await api.delete('/hesap/push-token').catch(() => {});
    disconnectSocket();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setSession(null);
  };

  // Oturum düştü (sunucu artık bu oturumu kabul etmiyor) veya hesap silindi: sunucuya istek atmadan sadece bu telefonda çıkış
  // yapılır ve nedeni gösterilir (örn. "Bu hesap daireden çıkarılmıştır"). App.js açılış ekranına döner.
  // useCallback: fonksiyon sabit kalsın; aşağıdaki useEffect ve soket dinleyicisi her çizimde yeniden kurulmasın.
  // title: uyarı penceresinin başlığı (varsayılan "Oturum kapandı"; hesap silinince "Hesap silindi").
  const sessionDropped = useCallback(async (message, title = 'Oturum kapandı') => {
    if (droppedRef.current) return;
    droppedRef.current = true;
    disconnectSocket();
    setToken(null);
    // Telefonun deposu (SecureStore) hata verse bile oturum kapatılır; hata burada yakalanır, böylece bu fonksiyonu
    // çağıran yerlerin (api.js, soket olayları, hesap silme ekranı) ayrıca hata yakalamasına gerek kalmaz.
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setSession(null);
    Alert.alert(title, message);
  }, []);

  // useEffect: sessionDropped fonksiyonunu api.js'e kaydeder; herhangi bir istek 401 alınca o çağrılır.
  useEffect(() => {
    setSessionDroppedHandler(sessionDropped);
  }, [sessionDropped]);

  // Soket olayları: sunucu bu oturumu kapatmak isteyince haber verir, uygulama açıksa oturum anında kapanır.
  // - removedFromFlat: yönetici bu sakini daireden çıkardı (hesabı silindi).
  // - accountDeleted: aynı hesap başka bir telefonda silindi. Başlık ve mesaj, silme ekranının kendi gösterdiğiyle
  //   aynıdır: hangisi önce gelirse gelsin kullanıcı aynı uyarıyı görür.
  // - passwordChanged: şifre başka bir telefondan sıfırlandı; bu telefondaki (artık eski) oturum kapatılır.
  // Mesaj sunucudan gelir; başlık olaya göre seçilir. useCallback: dinleyiciler her çizimde yeniden kurulmasın.
  const removedFromFlat = useCallback(({ mesaj: message }) => sessionDropped(message), [sessionDropped]);
  const accountDeleted = useCallback(({ mesaj: message }) => sessionDropped(message, 'Hesap silindi'), [sessionDropped]);
  const passwordChanged = useCallback(({ mesaj: message }) => sessionDropped(message, 'Şifre değişti'), [sessionDropped]);
  useSocketEvent('dairedenCikarildi', removedFromFlat);
  useSocketEvent('hesapSilindi', accountDeleted);
  useSocketEvent('sifreDegisti', passwordChanged);

  // Soket bağlanamadıysa ve sunucu nedenini bir kodla bildirdiyse (telefon kapalıyken daireden çıkarılmış ya da
  // şifresi başka yerden değiştirilmiş olabilir) oturum kapatılır. CONNECTION_REJECT_TITLES: kod → uyarı başlığı.
  // Kodu olmayan bağlantı hatalarında (internet yok vb.) hiçbir şey yapılmaz, soket kendisi tekrar dener.
  const connectionRejected = useCallback(
    (error) => {
      const title = CONNECTION_REJECT_TITLES[error.data?.kod];
      if (title) sessionDropped(error.message, title);
    },
    [sessionDropped]
  );
  useSocketEvent('connect_error', connectionRejected);

  // Oturum bilgisini (kullanıcı, rol, site, daire) sunucudan yeniden çeker; token aynı kalır.
  // Yönetici devrinde rol değişince çağrılır: oturum güncellenince App.js yeni rolün ekranlarını kendiliğinden
  // gösterir (yönetici → sakin ekranları veya tersi), tekrar giriş gerekmez. Hata olursa sessizce geçilir
  // (401 ise api.js zaten oturumu kapatır).
  // useCallback: fonksiyon sabit kalsın; aşağıdaki soket dinleyicisi her çizimde yeniden kurulmasın.
  // setSession((previous) => ...): o anki oturumu okuyup token'ı korur; bu arada çıkış yapıldıysa (null) dokunmaz.
  const refreshSession = useCallback(async () => {
    try {
      const { data } = await api.get('/hesap/ben');
      setSession((previous) => (previous ? { token: previous.token, ...data } : previous));
    } catch {
      // ağ hatası: bir sonraki açılışta zaten güncel bilgi gelir
    }
  }, []);

  // Soket olayı: yöneticilik devredildi (bu kişi yönetici oldu ya da yöneticiliği bıraktı).
  // Uygulama açıksa ekranlar anında yeni role geçer; diğer cihazdaki uygulama da aynı anda değişir.
  useSocketEvent('rolDegisti', refreshSession);

  // Provider: içine sarılan tüm ekranlara oturum bilgisini ve fonksiyonları dağıtır.
  // startupError + loadSavedSession: App.js açılışta sunucuya ulaşılamazsa "Tekrar dene" ekranı için kullanır.
  // closeSession: sessionDropped fonksiyonunun ekranlara açılan adı. Hesap silindikten sonra DeleteAccountScreen bunu çağırır;
  // logout'tan farkı sunucuya istek atmamasıdır (hesap zaten silindi, push token isteği 401 alırdı).
  return (
    <SessionContext.Provider value={{ session, ready, startupError, loadSavedSession, openSession, logout, refreshSession, closeSession: sessionDropped }}>{children}</SessionContext.Provider>
  );
}

// Ekranların oturum bilgisine ulaşmak için kullandığı kısa yol: const { session } = useSession();
export function useSession() {
  return useContext(SessionContext);
}
