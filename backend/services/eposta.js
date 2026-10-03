// E-posta gönderme: "şifremi unuttum" kodunu kullanıcının e-postasına gönderir.
// nodemailer: Node.js'in standart e-posta kütüphanesi; SMTP (e-posta gönderme protokolü) ile çalışır.
// Hangi e-posta hesabından gönderileceği koda yazılmaz, .env'deki SMTP_ ayarlarından okunur:
// Gmail, alan adlı bir e-posta veya başka bir sağlayıcıya geçmek için sadece .env değişir.
const nodemailer = require('nodemailer');

// Bir e-posta gönderir. SMTP ayarlanmamışsa veya gönderim başarısız olursa hata fırlatır (çağıran yakalar).
// Bağlantı her gönderimde yeniden kurulur: günde birkaç e-posta için bağlantıyı saklamaya (önbelleğe) gerek yok.
async function epostaGonder({ kime, konu, metin }) {
  const { SMTP_SUNUCU, SMTP_PORT, SMTP_KULLANICI, SMTP_SIFRE, SMTP_GONDEREN } = process.env;
  if (!SMTP_SUNUCU || !SMTP_KULLANICI || !SMTP_SIFRE) throw new Error('E-posta ayarları (.env içindeki SMTP_) yapılmamış.');
  const port = Number(SMTP_PORT) || 587;
  const tasiyici = nodemailer.createTransport({
    host: SMTP_SUNUCU,
    port,
    // 465 portu baştan şifreli (SSL) bağlanır; 587 önce düz bağlanıp STARTTLS ile şifreli bağlantıya geçer.
    secure: port === 465,
    auth: { user: SMTP_KULLANICI, pass: SMTP_SIFRE },
  });
  await tasiyici.sendMail({ from: SMTP_GONDEREN || SMTP_KULLANICI, to: kime, subject: konu, text: metin });
}

module.exports = { epostaGonder };
