# 💧 PFAS-Sentinel™ | Proje Anlama Rehberi ve Yarışma Yol Haritası

**Yarışma:** Xylem Global Student Innovation Challenge 2026  
**Kategori:** Challenge #2: Water Quality (Su Kalitesi)  
**Teknoloji Hazırlık Seviyesi (TRL):** TRL 3 (Analitik, Sayısal ve Siber-Fiziksel Dijital İkiz Prototipi)  
**Proje Tam Adı:** *PFAS-Sentinel™ — Microfluidic MIP-Electrochemical Biosensor & PINN Digital Twin for Real-Time PFAS Early Warning and Media Lifecycle Optimization*

---

## 1. En Kritik Nokta: Teknik Dürüstlük ve Yarışma Konumlandırması (TRL 3 → TRL 6)

Yarışma jürisinde (Xylem mühendisleri, elektrokimyacılar ve veri bilimciler) maksimum güven yaratmak için projemizi **tamamen şeffaf ve bilimsel olarak doğrulanabilir** bir çerçevede sunuyoruz:

### A. Şu Anki Aşama (TRL 3 — Çalışan Siber-Fiziksel Dijital İkiz ve Matematiksel Kanıt)
* **Elimizde Ne Var?**
  1. **Gerçek Fizik Destekli Sinir Ağı (PINN) ve 1D Adveksiyon-Sorpsiyon PDE Çözücü:** Hiçbir "hedef parametre sızıntısı (ground-truth leak)" olmadan, yalnızca orta-yatak ($z/L = 0.50$) gözlemlerinden ve kısmi diferansiyel denklem ($\frac{\partial \hat{C}}{\partial t} + u_{\text{MTZ}}\frac{\partial \hat{C}}{\partial z} = 0$) kısıtlarından **analitik zincir kuralı (backpropagation) ve Adam optimizasyonu** ile öğrenen gerçek bir hibrit model (`simulation/pfas_sentinel_pinn_model.py` ve `src/data/pfasPhysicsEngine.ts`).
  2. **Döngüsel Olmayan (Non-Circular) Ters Kalibrasyon ve 4×4 Çapraz Seçicilik Matrisi ($\mathbf{S}^{-1}$):** İleri fiziksel elektrokimya simülatörü ile ters kalibrasyon modeli birbirinden tamamen bağımsızdır. Ayrıca C4 (PFBA, PFBS) ve C8 (PFOA, PFOS) moleküllerinin MIP oyuklarındaki %8–15'lik çapraz bağlanma girişimi (**cross-reactivity**), **4×4 Tikhonov matris ters çevrimi** ve **4 adet NIP (boş polimer) referans kanalı** ile matematiksel olarak ayrıştırılır (~%4.5 ortalama mutlak hata).
  3. **Literatür ve Resmi Vaka Çalışması Doğrulaması:** Uydurma anket verileri yerine; **US EPA Nisan 2024 Nihai PFAS Kuralı (89 FR 32532)**, **AWWA Maliyet Analizi**, **Xylem/Evoqua'nın yayınlanmış KKWWD (Maine) ve SHWSD (Colorado) belediye vaka çalışmaları** ve hakemli makalelerdeki (*McCleaf et al., Water Research 2017; Park et al., EST 2020*) pilot kolon kırılma (Bed Volumes / BV) verileriyle doğrulanmıştır.

### B. Yarışma Sonrası 6 Aylık Doğrulama Yol Haritası (TRL 3 → TRL 6)
* Donanım spesifikasyonlarımızı (**1–4 ppt hedef LOD**, **12–15 dk analiz süresi**, **ölçekli üretimde 11.80$ hedef kartuş BOM maliyeti**) "halihazırda sahada bitmiş ürün" gibi abartmak yerine, literatür öncüllerine dayanan **Hedef Mühendislik Spesifikasyonları (Target TRL 4–6 Specs)** olarak sunuyoruz:
  * **1–2. Ay (TRL 3 → 4):** Üniversite temiz oda (cleanroom) laboratuvarında 32 kanallı COC/MIP kartuşların üretimi ve EPA Method 533 LC-MS/MS referansıyla gerçek su matrislerinde 4×4 çapraz seçicilik kalibrasyonu.
  * **3–4. Ay (TRL 4 → 5):** Laboratuvar ölçekli hızlı kolon testlerinde (RSSCT) sürekli akış altında 30 günlük kartuş ömrü ve PINN kırılma tahmininin doğrulanması.
  * **5–6. Ay (TRL 5 → 6):** Belediye su arıtma tesislerindeki mevcut aktif karbon (GAC) ve reçine (IX) tanklarının standart `1/4" NPT` orta-yatak numune portuna yan-akış (slipstream) bağlantısı yapılarak saha pilot testi.

---

## 2. Projemiz (PFAS-Sentinel™) Tam Olarak Nedir?

Projemizin tek cümlelik ana mesajı:
> **Mevcut aktif karbon ve reçine tanklarının ortasındaki standart numune portuna (`z/L = 0.50`) takılan 15 dakikalık gerçek zamanlı sensör ve 1D Adveksiyon-Sorpsiyon PINN kırılma tahmini ile filtre değişim maliyetlerinde ve tehlikeli atıkta %25–30 tasarruf.**

### A. Çözdüğümüz Gerçek Mühendislik Sorunu
1. **PFAS ve 4.0 ppt Sınırı:** ABD Çevre Koruma Ajansı (EPA) PFOA ve PFOS için **4.0 ppt (ng/L)** bağlayıcı sınır ve PFBS/PFHxS/PFNA/GenX için **Tehlike İndeksi ($\text{HI} \le 1.0$)** getirdi; AB ise Ocak 2026'da **100 ng/L (20 PFAS toplamı)** sınırını zorunlu kıldı.
2. **Mevcut Orta-Yatak Portlarının Körlüğü:** Belediye GAC ve IX tanklarının gövdesinde zaten fiziksel orta-yatak numune muslukları ($z/L = 0.50$) bulunur. Ancak tesisler bu musluklardan ayda bir şişeyle manuel numune alıp merkeze (**LC-MS/MS** laboratuvarına) kargolar. Sonuç **10–14 gün sonra** çıkar ve test başına **300$ – 500$** ödenir.
3. **Kromatografik Roll-Up ($C_t > C_0$) ve Erken Değişim İsrafı:** Kısa zincirli PFAS'lar (PFBA, PFBS) karbon yataktan çok erken sızar; hatta sonradan gelen PFOS/PFOA ve humik asit (NOM) tarafından yataktan sökülerek çıkış suyuna giriş suyundan bile yüksek konsantrasyonda (**%120–130 $C_0$ Roll-Up**) fışkırır. 14 günlük laboratuvar gecikmesi yüzünden ceza yemekten korkan tesisler, **yatak kapasitesinin %20–30'u daha boşken filtreleri erkenden değiştirir.**

### B. 3 Katmanlı Çözüm Mimarimiz (Detaylı Teknik İnceleme ve Teknoloji Sözlüğü)

Projemizde geçen tüm teknik terimlerin, kısaltmaların ve kullanılan donanım/yazılım teknolojilerinin detaylı açıklaması aşağıdadır:

---

#### 🔬 KATMAN 1: Donanım Katmanı (Mikroakışkan MIP-Elektrokimyasal Biyosensör)
*(Uygulamadaki 2. Sekme: `src/components/MipBiosensorTab.tsx`)*

Bu katman, su arıtma tankının **Girişine ($C_0$)**, **Tam Ortasına ($C_{\text{mid}}$, yani $z/L = 0.50$ standart `1/4" NPT` numune musluğuna)** ve **Çıkışına ($C_t$)** takılan fiziksel ölçüm cihazımızdır. İki parçadan oluşur: **11.80$** hedef maliyetli değiştirilebilir **32 Kanallı Mikroakışkan Kartuş** ("tıraş bıçağı") ve sabit **Elektronik Okuyucu Pod** ("tıraş makinesi").

* **1. Microfluidics (Mikroakışkan Teknolojisi) & COC (Cyclic Olefin Copolymer):**
  * **Nedir?** Suyun geniş bir borudan değil, saç teli kalınlığında mikro-kanallardan geçirilmesidir. Kartuşun dış gövdesi **COC** adı verilen, PFAS moleküllerinin plastik duvarlara yapışmasını (adsorpsiyon kaybını) önleyen özel bir optik/tıbbi polimerden üretilir.
  * **Ne İşe Yarar?** Durgun suda trilyonda 4 parçalık (4 ppt) PFAS'ın sensör yüzeyine çarpıp tutunması saatler sürer. Mikro-kanallarda su incecik bir katman halinde (**Laminar Akış**) hızla aktığı için PFAS molekülleri sensör yüzeyine zorla bastırılır (**Hidrodinamik Ön-Deriştirme**) ve ölçüm süresi **12–15 dakikaya** (hızlı tarama modunda **<2 dakikaya**) iner.
* **2. MIP (Molecularly Imprinted Polymer — Moleküler Baskılı Polimer):**
  * **Nedir?** Sensörün kalbidir. "Yapay antikor" veya **"Anahtar-Kilit Kalıbı"** gibi çalışır. Polimer zar üretilirken içine şablon olarak hedef PFAS molekülleri (PFOA, PFOS, PFBS, PFBA) konulur; polimer sertleştikten sonra bu şablon moleküller yıkanıp çıkarılır. Geriye sadece o PFAS molekülünün zincir uzunluğuna (**C4 veya C8**) ve baş grubuna (**Karboksilat $-\text{COO}^-$ veya Sülfonat $-\text{SO}_3^-$**) birebir uyan **3 boyutlu nano-boşluklar (kaviteler)** kalır (*Oseyemi & Rezai Eylül 2025* mimarisi).
  * **Ne İşe Yarar?** Suda PFAS'tan milyonlarca kat daha fazla bulunan klorür, sülfat veya büyük çamur molekülleri bu nano-deliklere sığamaz. Sadece PFAS molekülleri "anahtarın kilide girmesi gibi" bu yuvalara oturur.
* **3. Amine-Functionalized Nanocarbon Electrode Array (Amin-Fonksiyonelleştirilmiş Nanokarbon Elektrot Dizisi):**
  * **Nedir?** MIP zarının hemen altında bulunan, yüzeyi pozitif yüklü protonlanmış amin gruplarıyla ($-\text{NH}_3^+$) kaplanmış grafen ve karbon nanotüp (CNT) içeren **32 kanallı** elektrik iletkeni yüzeydir (*UConn ve Verralize* mimarisi).
  * **Nasıl Ölçüm Yapar (Redox Gate / Kapı Etkisi)?** PFAS molekülleri suda negatif yüklüdür (anyoniktir). Pozitif yüklü $-\text{NH}_3^+$ uçları PFAS'ı elektrostatik olarak mıknatıs gibi çeker. PFAS molekülleri MIP deliklerine girip yerleştiğinde, elektrot yüzeyindeki redoks probunun ($[\text{Fe(CN)}_6]^{3-/4-}$) elektron alışverişini engeller. Yani **suda ne kadar çok PFAS varsa, elektrik direnci ($\Delta R_{\text{ct}}$) o kadar artar!**
* **4. EIS (Electrochemical Impedance Spectroscopy — Elektrokimyasal Empedans Spektroskopisi) & Nyquist Grafiği:**
  * **Nedir?** Sensöre farklı frekanslarda (0.1 Hz ile 200 kHz arası) çok küçük bir alternatif akım (AC) sinyali gönderip, zarın gösterdiği karmaşık direnci (empedansı) ölçme tekniğidir.
  * **$R_{\text{ct}}$ (Charge-Transfer Resistance — Yük Transfer Direnci):** 2. sekmede gördüğün yarım daire şeklindeki grafiklere **Nyquist Eğrisi** denir. Yarım dairenin çapı bize doğrudan $R_{\text{ct}}$ direncini (Ohm cinsinden) verir. PFAS molekülleri gözenekleri tıkadıkça yarım daire büyür; çipimiz bu çap büyümesinden sudaki PFAS konsantrasyonunu **ppt (ng/L)** cinsinden hesaplar.
* **5. NIP (Non-Imprinted Polymer — Baskısız Polimer Referans Kanalları) & 4×4 Çapraz Seçicilik Matrisi ($\mathbf{S}^{-1}$):**
  * **NIP Nedir?** 32 kanalın 28 tanesi PFAS yakalayan MIP kanalıdır (PFBA, PFBS, PFOA, PFOS için 7'şer kanal). Kalan **4 kanal (Kanal 29–32)** ise içinde PFAS kalıbı/deliği **olmayan** düz polimerdir; buna **NIP** denir.
  * **Ne İşe Yarar?** Gerçek nehir veya kuyu suyunda **NOM (Natural Organic Matter — Doğal Organik Madde / Humik ve Fulvik Asit)** yani çürümüş bitki/toprak kalıntıları vardır. Bu maddeler sensör yüzeyine yapışıp "yalancı alarm" verebilir. NIP kanalları PFAS tutmaz ama çamuru (NOM) tutar. Çipimiz **MIP sinyalinden NIP sinyalini çıkararak ($\Delta R_{\text{ct,MIP}} - \Delta R_{\text{ct,NIP}}$)** çamur parazitini siler!
  * **4×4 Çapraz Seçicilik Dekonvolüsyonu (Tikhonov Regularized Matrix Inversion):** Kısa zincirli ve uzun zincirli PFAS'lar birbirinin yuvasına %8–15 oranında yan 제 (cross-reactivity) bağlanabilir. Cihazımız 4 kanal grubundan gelen sinyali $4\times 4$'lük bir matris denklemine ($\mathbf{c} = \mathbf{S}^{-1}\mathbf{r}$) sokarak her bir PFAS türünün gerçek miktarını birbirinden ayırır.
* **6. Gömülü Elektronik Çipler (AD5940, ADG732, ARM Cortex-M33) ve Xylem YSI/WTW Entegrasyonu:**
  * **Analog Devices AD5940:** Elektrokimyasal empedans (EIS) ölçümü ve donanımsal Fourier dönüşümü (DFT) yapan endüstriyel analog ön-uç (AFE) mikroçipidir.
  * **ADG732 Multiplexer (Çoğullayıcı):** Tek bir AD5940 çipinin 32 farklı elektrot kanalını sırayla milisaniyeler içinde okumasını sağlayan 32:1 elektronik anahtardır.
  * **ARM Cortex-M33 MCU/NPU:** Cihazın içindeki düşük güç tüketimli mikrodenetleyici ve uç yapay zeka (Edge AI) işlemcisidir.
  * **Xylem YSI / WTW Sondaları & Inverse Edge AI Matrix De-Embedding:** Suyun sıcaklığı, pH'ı ve tuzluluğu (iletkenliği) değiştiğinde elektrokimyasal sinyal kayar. Cihazımız, Xylem'in tesislerde zaten kurulu olan **YSI ve WTW** su kalitesi sensörlerinden **RS-485 Modbus RTU** protokolüyle anlık pH, sıcaklık ve iletkenlik verisini okur. Ardından 3 fizikokimyasal formülle sinyali normalize eder:
    * *Arrhenius Denklemi:* Sıcaklık değişiminin elektron transfer hızına etkisini düzeltir.
    * *Henderson-Hasselbalch Denklemi:* Suyun pH'ına göre $-\text{NH}_3^+$ amin gruplarının ne kadarının pozitif yüklü kaldığını hesaplayıp düzeltir.
    * *Gouy-Chapman / Debye Uzunluğu ($\kappa^{-1}$):* Sudaki tuz iyonlarının elektriksel çekimi perdeleme etkisini düzeltir.

---

#### 🧠 KATMAN 2: Yapay Zeka ve Dijital İkiz Katmanı (PINN Breakthrough Lab)
*(Uygulamadaki 3. Sekme: `src/components/PinnBreakthroughTab.tsx` ve `simulation/pfas_sentinel_pinn_model.py`)*

Birinci katman "Şu an suda ne kadar PFAS var?" sorusunu yanıtlar. İkinci katman ise **"Filtre tankı ne zaman dolacak ve çıkıştan ne zaman zehirli su sızacak?"** sorusunu haftalar öncesinden bilen yapay zeka beynidir.

* **1. GAC (Granular Activated Carbon) & IX (Ion Exchange Resin):**
  * Su arıtma tesislerinin PFAS yakalamak için kullandığı iki ana filtre dolgu malzemesidir. **GAC** gözenekli aktif karbon kömürüdür; **IX** ise PFAS'ı elektrostatik olarak yakalayan sentetik iyon değiştirici reçine boncuklarıdır (Xylem'in **Evoqua** markası her ikisinin de pazar lideridir).
* **2. Influent ($C_0$), Mid-Bed ($C_{\text{mid}}$) ve Effluent ($C_t$) Noktaları:**
  * **$C_0$ (Influent):** Filtre tankına üstten giren kirli ham su konsantrasyonu.
  * **$C_{\text{mid}}$ (Mid-Bed — $z/L = 0.50$):** Filtre tankının tam ortasına (yarı yüksekliğine) taktığımız erken uyarı sensörünün okuduğu konsantrasyon.
  * **$C_t$ (Effluent — $z/L = 1.0$):** Filtrenin en altından çıkıp şehre/şebekeye verilen arıtılmış su konsantrasyonu.
* **3. Breakthrough (Sızma / Kırılma) ve MTZ (Mass Transfer Zone — Kütle Transfer Bölgesi):**
  * Su yukarıdan aşağıya karbon tankından geçerken, karbonun üst katmanları PFAS ile tamamen dolar. Doymuş üst katman ile henüz temiz olan alt katman arasındaki "aktif yakalama cephesine" **MTZ** denir. Bu dalga ($u_{\text{MTZ}}$ hızıyla) günler geçtikçe aşağı doğru iner. En alta ulaştığı an çıkış suyuna PFAS karışır; buna **Breakthrough (Kırılma)** denir.
* **4. Chromatographic Roll-Up ($C_t / C_0 > 1.0$ — Kromatografik Fışkırma):**
  * **PFBA** ve **PFBS** (4 karbonlu kısa zincirli PFAS'lar) karbona zayıf tutunur. **PFOA** ve **PFOS** (8 karbonlu uzun zincirli PFAS'lar) ve humik asitler (NOM) ise karbona çok daha güçlü tutunur.
  * Arkadan gelen PFOA/PFOS molekülleri, daha önce karbona tutunmuş olan PFBA moleküllerini yerinden söküp (**desorpsiyon / rekabetçi yer değiştirme**) aşağı doğru iter. Sonuçta biriken PFBA dalgası çıkıştan öyle bir fışkırır ki, çıkış suyundaki PFBA oranı giriş suyunun **%120–135'ine ($C_t > C_0$)** çıkar! Yani filtre suyu temizlemek yerine biriktirip suya geri kusar.
* **5. PINN (Physics-Informed Neural Network — Fizik Destekli Sinir Ağı):**
  * **Nedir?** Standart yapay zeka sadece geçmiş veriye bakar; fizik kurallarını bilmediği için suyun debisi veya kirliliği değiştiğinde hatalı tahmin yapar. **PINN** ise yapay sinir ağının eğitim kaybı (loss) fonksiyonuna doğrudan **Akışkanlar ve Kimya Mühendisliği Diferansiyel Denklemlerini (PDE)** gömen hibrit bir yapay zeka teknolojisidir.
  * **Thomas Kinetik Modeli ve 1D Adveksiyon-Sorpsiyon PDE:**
    $$\mathcal{L}_{\text{PINN}} = \mathcal{L}_{\text{data}}(z=0.5L) + \lambda_{\text{PDE}} \left\| \frac{\partial \hat{C}}{\partial t} + u_{\text{MTZ}} \frac{\partial \hat{C}}{\partial z} \right\|_2^2 + \lambda_{\text{BC}} \mathcal{L}_{\text{boundary}}$$
  * **Nasıl Çalışır?** Tankın ortasındaki ($C_{\text{mid}}$) sensörümüz her 15 dakikada bir PFAS dalgasının tankın yarısına ne zaman ulaştığını bildirir; **Xylem Sensus / MJK** debimetresi de suyun akış hızını ($Q$) verir. PINN modelimiz **Adam (Adaptive Moment Estimation) optimizasyonu ve analitik geri yayılım (backpropagation)** kullanarak karbonun gerçek tutma hızını ($k_{\text{Th}}$), kapasitesini ($q_0$) ve kütle transfer dalgası hızını ($u_{\text{MTZ}}$) canlı olarak çözer. Böylece çıkıştan ($C_t$) PFAS sızmadan **haftalar önce** kesin kırılma gününü ve yatak hacmini (BV) tahmin eder.
* **6. EBCT (Empty Bed Contact Time) ve BV (Bed Volumes — Yatak Hacmi):**
  * **EBCT (Boş Yatak Temas Süresi):** Suyun karbon tankının içinde geçirdiği ortalama süredir (genelde GAC için 10–12 dakika, IX reçine için 2–3 dakika).
  * **BV (Bed Volumes):** Tankın kendi hacminin kaç katı kadar suyu başarıyla arıttığını gösteren endüstriyel ölçü birimidir (örneğin *18.000 BV su arıtıldı*).

---

#### 🤖 KATMAN 3: Otonom Ajan, SCADA Otomasyonu ve İş Modeli Katmanı
*(Uygulamadaki 1., 4. ve 5. Sekmeler: `CyberPhysicalTwinTab.tsx`, `AgenticEwsTab.tsx`, `BusinessAndPitchTab.tsx`)*

Sensörümüz ölçtü (Katman 1), yapay zekamız kırılma gününü hesapladı (Katman 2). Üçüncü katman ise bu tahmini **otomatik fiziksel aksiyona ve finansal tasarrufa** dönüştüren kapalı-çevrim kontrol katmanıdır.

* **1. Xylem Vue powered by GoAigua (Smart Water Engine - SWE):**
  * Xylem'in dünyadaki belediyelere ve su idarelerine sunduğu merkezi dijital ikiz ve analitik yazılım platformudur. Bizim PFAS-Sentinel sistemimiz sıfırdan kopuk bir yazılım değil, doğrudan **Xylem Vue** içine entegre olan bir modül olarak tasarlanmıştır.
* **2. SCADA, PLC ve OPC-UA / Modbus RTU:**
  * **SCADA & PLC (Programmable Logic Controller):** Su arıtma tesislerindeki motorları, pompaları ve motorlu vanaları kontrol eden endüstriyel otomasyon bilgisayarlarıdır.
  * **OPC-UA & Modbus RTU:** Yazılımımızın tesisin PLC vanalarına güvenli komut göndermek için kullandığı endüstriyel haberleşme protokolleridir.
* **3. Lead-Lag Vessel Configuration & Autonomous Switchover (Öncü-Yedek Tank Değişimi):**
  * Su tesislerinde filtre tankları ikişerli seri (**Lead = Öncü Tank**, **Lag = Yedek/Cilalayıcı Tank**) bağlanır. Su önce 1. tanktan (Lead), sonra 2. tanktan (Lag) geçer.
  * Sistemimiz, 1. tankın çıkışında PFAS seviyesi **4.0 ppt** yasal sınırına ulaşmadan hemen önce PLC vanalarına otomatik komut gönderir: **2. tankı (Lag) ana tank (Lead) konumuna alır**, 1. tankı ise karbonu değiştirilmek üzere izole eder. Böylece hem halka tek damla PFAS gitmez hem de 1. tanktaki karbon **%96+ kapasiteye kadar** sonuna kadar kullanılmış olur!
* **4. Evoqua Rejenerasyon Ekibi & Xylem MitiGATOR™ Mobil Filosu:**
  * **Evoqua:** Xylem'in aktif karbon ve reçine tedarik/rejenerasyon koludur. Sistemimiz tank dolmadan önce Evoqua'ya tam zamanında (*Just-in-Time*) iş emri açar.
  * **Xylem MitiGATOR™:** Xylem'in acil durumlar için ürettiği, tır dorsesi üzerine kurulmuş **mobil PFAS arıtma ünitesidir**. Tesise aniden yangın söndürme köpüğü (AFFF Surge) karışırsa sistem otomatik olarak MitiGATOR™ mobil ünitesini sahaya çağırır.
* **5. EPA Hazard Index (HI) & SHA-256 Kriptografik Uyumluluk Sertifikası:**
  * **Hazard Index (Tehlike İndeksi):** ABD EPA kuralına göre suda birden fazla PFAS türü varsa (PFBS, PFHxS, PFNA, GenX) bunların tehlike oranları toplanır ve toplam indeksin $\text{HI} \le 1.0$ olması zorunludur.
  * **SHA-256 Dijital Denetim İzi (Audit Trail):** Sistemimiz her 15 dakikada bir yapılan ölçümleri ve vana aksiyonlarını **SHA-256 kriptografik özet (hash)** ile mühürleyerek belediyenin resmi denetçilere sunabileceği `.JSON` uyumluluk raporu üretir.
* **6. Servitization (Hizmetleştirme), CAPEX/OPEX ve "Razor-and-Blade" İş Modeli:**
  * **CAPEX (Capital Expenditure):** İlk satın alma/kurulum maliyeti. **OPEX (Operational Expenditure):** Yıllık işletme ve bakım maliyeti.
  * Belediyeler yüksek ilk yatırım (CAPEX) yapmakta zorlanır. Bu yüzden **Servitization (Hizmet olarak sunma)** ve **Razor-and-Blade (Tıraş Makinesi ve Bıçağı)** modeli kullanıyoruz: Xylem okuyucu podları Evoqua bakım sözleşmesi kapsamında **sıfır peşinatla (Zero CAPEX)** kurar; belediye sadece aylık yazılım aboneliği ve **11.80$**'lık yedek kartuşlar için ödeme yapar. Karbon filtre ömrü **%25–30 uzadığı** için belediye her yıl net yüz binlerce dolar tasarruf eder!

---

## 3. Uygulamadaki 5 Ana Sekme Rehberi

`BASLAT.bat` dosyasına çift tıkladığında (veya `npm run dev` ile) açılan web uygulamasındaki 5 sekme birbiriyle **%100 senkronize** çalışır:

1. **`1. Cyber-Physical Twin (SWE)` (`src/components/CyberPhysicalTwinTab.tsx`):**
   - 3 gerçekçi referans tesis (*KKWWD Maine GAC*, *Stratmoor Hills CO IX*, *Brabant Water NL Hybrid*) ve 4 senaryo butonu içerir.
   - Zaman kaydırıcısında hem **Gün (Day)** hem de **Yatak Hacmi (Bed Volumes - BV)** canlı hesaplanır.
2. **`2. Microfluidic MIP & 3D CAD` (`src/components/MipBiosensorTab.tsx`):**
   - 4 katmanlı izometrik 3D kartuş kesiti, **AD5940 + Cortex-M33** devre mimarisi, döngüsel olmayan **Nyquist EIS simülatörü**, **4×4 Çapraz Seçicilik Matrisi ($\mathbf{S}$)** ve 5 su matrisinde **In-Silico Kalibrasyon Stres Testi (~%4.5 MAE)** yer alır.
3. **`3. PINN Breakthrough Lab` (`src/components/PinnBreakthroughTab.tsx`):**
   - `L_PINN` kısmi diferansiyel denklem (1D Advection-Sorption PDE) ve 2 katmanlı sinir ağı optimizasyonunu canlı çalıştırır.
   - *McCleaf et al. (2017)* ve *Park et al. (2020)* hakemli literatür verileriyle uyumu gösterir ve `.CSV` veri seti indirmeni sağlar.
4. **`4. Agentic EWS & MitiGATOR™` (`src/components/AgenticEwsTab.tsx`):**
   - Seçili tesise, güne ve debiye göre **tamamen dinamik** olarak çalışan 4 aşamalı kapalı-çevrim kontrol akışı ve indirilebilir `.JSON` EPA/AB telemetri kaydı sunar.
5. **`5. Servitization ROI & Pitch` (`src/components/BusinessAndPitchTab.tsx`):**
   - İnteraktif OPEX/Atık/Karbon hesaplayıcı, resmi EPA/AWWA/Xylem/Literatür doğrulama tablosu, dürüst mühendislik sınırları matrisi, endüstriyel rakip analizi ve resmi jüri kriterlerine (*Innovation & Creativity*, *Challenge Fit & Feasibility*, *Impact & Scalability*) uyumlu **3 dakikalık sunum metni** içerir.
