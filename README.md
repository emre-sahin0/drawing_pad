# Mimarcad - CAD Çizim Programı

Modern ve kullanıcı dostu bir web tabanlı CAD çizim programı. HTML5 Canvas ve JavaScript kullanılarak geliştirilmiştir.

## Özellikler

### 🎨 Çizim Araçları
- **Çizgi (L)**: İki nokta arasında düz çizgi çizme
- **Dikdörtgen (R)**: Dikdörtgen şekil çizme
- **Kare (S)**: Kare şekil çizme
- **Ölçü (D)**: Mesafe ölçümü ve boyut gösterme
- **Resim Ekleme (I)**: Harici resim dosyalarını ekleme

### 🔧 Seçim ve Düzenleme
- **Seç (V)**: Nesneleri seçme ve düzenleme
- **Sürükle & Bırak**: Seçili nesneleri taşıma
- **Silme**: Seçili nesneleri silme (Delete tuşu)
- **Tümünü Temizle**: Tüm nesneleri silme

### 🔍 Görüntüleme
- **Zoom In/Out**: Fare tekerleği veya +/- tuşları ile yakınlaştırma/uzaklaştırma
- **Zoom Fit (F)**: Tüm nesneleri görünür alana sığdırma
- **Grid Sistemi**: Otomatik grid çizgileri ve snap noktaları
- **Koordinat Göstergesi**: Fare pozisyonunun koordinatlarını gösterme

### 📐 Grid ve Snap
- **Otomatik Grid**: 20px aralıklarla grid çizgileri
- **Snap to Grid**: Çizimlerin grid noktalarına yapışması
- **Snap Points**: Seçili nesnelerin köşe noktalarında snap noktaları

### 📋 Özellikler Paneli
- Seçili nesnenin özelliklerini düzenleme
- Koordinat, boyut ve stil ayarları
- Gerçek zamanlı güncelleme

## Kullanım

### Klavye Kısayolları
- **V**: Seç aracı
- **L**: Çizgi aracı
- **R**: Dikdörtgen aracı
- **S**: Kare aracı
- **D**: Ölçü aracı
- **I**: Resim ekleme
- **Delete/Backspace**: Seçili nesneleri sil
- **Escape**: Çizimi iptal et
- **F**: Tümünü görünür alana sığdır
- **+/-**: Yakınlaştır/Uzaklaştır

### Fare Kontrolleri
- **Sol Tık + Sürükle**: Çizim yapma veya nesne taşıma
- **Fare Tekerleği**: Yakınlaştırma/Uzaklaştırma
- **Sağ Tık**: İptal (çizim sırasında)

### Resim Ekleme
1. Resim aracına tıklayın (I tuşu)
2. Bilgisayarınızdan bir resim dosyası seçin
3. Resim otomatik olarak canvas'a eklenecek
4. Resmi seçip sürükleyerek konumunu değiştirebilirsiniz

## Teknik Detaylar

### Teknolojiler
- **HTML5 Canvas**: Çizim yüzeyi
- **Vanilla JavaScript**: Uygulama mantığı
- **CSS3**: Modern arayüz tasarımı

### Dosya Yapısı
```
mimarcad/
├── index.html      # Ana HTML dosyası
├── styles.css      # CSS stilleri
├── cad.js          # JavaScript uygulaması
└── README.md       # Bu dosya
```

### Tarayıcı Desteği
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Kurulum

1. Dosyaları bilgisayarınıza indirin
2. `index.html` dosyasını bir web tarayıcısında açın
3. Program kullanıma hazır!

## Gelecek Özellikler

- [ ] Çoklu seçim (Shift + tık)
- [ ] Katman sistemi
- [ ] Farklı çizgi stilleri
- [ ] Metin ekleme
- [ ] Daire ve yay çizimi
- [ ] Dosya kaydetme/yükleme
- [ ] Undo/Redo
- [ ] Çıktı alma (PDF, PNG)

## Katkıda Bulunma

Bu proje açık kaynak kodludur. Katkılarınızı bekliyoruz!

## Lisans

MIT License - Detaylar için LICENSE dosyasına bakın.

---

**Mimarcad** - Profesyonel CAD çizim deneyimi için tasarlandı. 