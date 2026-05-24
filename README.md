# PID Kontrollü Roket İniş Simülasyonu

Bu proje, dikey iniş yapan bir roketin irtifa, yatay konum ve açı stabilizasyonunu PID denetleyicilerle simüle eder. Three.js sahnesinde roket, iniş pisti, itki alevi, gimbal hareketi ve telemetri göstergeleri gerçek zamanlı izlenir.

## Kontrol katmanları

- İrtifa PID: hedef düşey iniş hızına göre ana motor itkisini ayarlar.
- Yatay konum PID: roketi iniş pistinin merkezine taşımak için hedef gövde açısı üretir.
- Açı PID: hedef gövde açısına ulaşmak için motor gimbal komutunu hesaplar.

Rüzgar bozucusu, yakıt tüketimi, kütle değişimi, gimbal limiti, güvenli iniş hızı ve açı limitleri modele dahildir.

## Çalıştırma

```bash
npm install
npm run dev
```

Tarayıcıda açılan ekranda `Başlat` düğmesine basın. Harita veya dış API gerekmez.

## Vercel deploy

Vercel projesi için ayarlar `vercel.json` içinde hazırdır:

- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite

GitHub'a yükledikten sonra Vercel'de repoyu import etmek yeterlidir. Proje dış API anahtarı veya environment variable gerektirmez.

## Model

Simülasyon, düşey hız hatasını ana itkiye; yatay konum hatasını hedef açıya; açı hatasını da gimbal komutuna çevirir. Roket dinamiğinde yerçekimi, itki vektörü, rüzgar bozucusu, yakıt tüketimi ve kütle değişimi birlikte hesaplanır.

Bu sürüm araştırma/prototip amaçlıdır. Hassas mühendislik doğrulaması için gerçek motor eğrileri, aerodinamik katsayılar, atalet tensörü ve kontrol gecikmeleri ayrıca kalibre edilmelidir.
