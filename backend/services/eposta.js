// E-posta gönderme: "şifremi unuttum" kodunu kullanıcının e-postasına gönderir.
// nodemailer: Node.js'in standart e-posta kütüphanesi; SMTP (e-posta gönderme protokolü) ile çalışır.
// Hangi e-posta hesabından gönderileceği koda yazılmaz, .env'deki SMTP_ ayarlarından okunur:
// Gmail, alan adlı bir e-posta veya başka bir sağlayıcıya geçmek için sadece .env değişir.
const nodemailer = require('nodemailer');

// Bağlantı ayarları bir kez okunur (ilk e-posta gönderilirken). SMTP ayarları yoksa null kalır.
let tasiyici = null;
function tasiyiciAl() {
  if (tasiyici) return tasiyici;
  const { SMTP_SUNUCU, SMTP_PORT, SMTP_KULLANICI, SMTP_SIFRE } = process.env;
  if (!SMTP_SUNUCU || !SMTP_KULLANICI || !SMTP_SIFRE) return null;
  const port = Number(SMTP_PORT) || 587;
  tasiyici = nodemailer.createTransport({
    host: SMTP_SUNUCU,
    port,
    // 465 portu baştan şifreli (SSL) bağlanır; 587 önce düz bağlanıp STARTTLS ile şifreli bağlantıya geçer.
    secure: port === 465,
    auth: { user: SMTP_KULLANICI, pass: SMTP_SIFRE },
  });
  return tasiyici;
}

// Bir e-posta gönderir. SMTP ayarlanmamışsa veya gönderim başarısız olursa hata fırlatır (çağıran yakalar).
async function epostaGonder({ kime, konu, metin }) {
  const t = tasiyiciAl();
  if (!t) throw new Error('E-posta ayarları (.env içindeki SMTP_) yapılmamış.');
  await t.sendMail({ from: process.env.SMTP_GONDEREN || process.env.SMTP_KULLANICI, to: kime, subject: konu, text: metin });
}

module.exports = { epostaGonder };
