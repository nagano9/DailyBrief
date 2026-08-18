# Standar Redaksi / Editorial Standards

Dokumen ini adalah kontrak dengan pembaca. Ia menjelaskan apa yang kami
terbitkan, apa yang tidak, dan bagaimana sebuah klaim bisa diperiksa.
Sebagian besar aturan di sini ditegakkan oleh kode, bukan oleh niat baik —
setiap bagian menyebutkan letak penegakannya.

*This document is the contract with the reader. Where a rule is enforced by
code rather than by good intentions, the enforcement point is named.*

---

## 1. Setiap sinyal wajib punya kutipan yang resolve

Setiap butir di bagian **Lima sinyal hari ini** harus merujuk ke minimal satu artikel
yang benar-benar terambil oleh pipeline pada hari itu. Model bahasa mengutip
dengan **nomor indeks**, bukan URL, lalu kode yang menerjemahkan nomor itu
menjadi URL.

Alasannya praktis: model menyalin URL dengan tidak andal — dipotong,
dinormalisasi, kadang dikarang. Nomor indeks bisa diperiksa secara
deterministik.

Sinyal yang mengutip indeks di luar rentang **dibuang, bukan diperbaiki**.
Target harian adalah lima sinyal; bila yang lolos validasi kurang dari tiga,
edisi hari itu **tidak terbit**. Ambang itu ada supaya run model yang buruk
merosot menjadi kegagalan yang terlihat, bukan briefing tipis di bawah
masthead kami.

> Ditegakkan di: `lib/brief/compose.ts` → `resolveSignals()` dan pemeriksaan
> `BRIEF_MIN_SIGNALS` yang melempar error.

## 1b. Korroborasi dihitung, bukan diklaim

Setiap sinyal membawa jumlah **penerbit berbeda** di balik kutipannya, dan
penanda apakah salah satunya benar-benar sumber primer. Keduanya dihitung
kode dari kutipan itu sendiri.

"Primer" ditentukan saat pengambilan, bukan dari tingkat sumbernya. Feed RSS
Tier 1 adalah lembaga yang menerbitkan tentang dirinya sendiri; kueri
*discovery* Tier 1 mengembalikan penerbit mana pun yang diindeks. Menyamakan
keduanya membuat 14% item Tier 1 diberi label primer secara keliru — termasuk
situs berita polres yang muncul dari kueri OJK/IDX.

Yang dihitung adalah penerbit berbeda, bukan jumlah kutipan: tiga kantor
berita yang mengambil satu siaran pers adalah bukti seharga satu penerbit
yang berpakaian tiga. Bila sebuah sinyal hanya bersandar pada satu penerbit
tanpa sumber primer, halaman menuliskannya sebagai "bukti masih tipis".

Model tidak pernah menilai kekuatan buktinya sendiri. Model yang menilai
buktinya sendiri akan menilainya dengan murah hati.

> Ditegakkan di: `lib/brief/compose.ts` → `corroborate()`.

## 1c. Tren dihitung dari arsip, bukan dari kesan

Status "berulang" dan "struktural" berasal dari pencocokan **kunci tema**
(`themeKey`) terhadap `signals/history.jsonl` — arsip append-only dari sinyal yang benar-benar
diterbitkan. Sebuah tema disebut struktural hanya bila muncul minimal empat
kali dalam 30 hari dan membentang minimal tujuh hari.

Arsipnya append-only karena menulis ulang sejarah adalah persis yang tidak
boleh dilakukan lapisan memori: tren yang bisa direvisi diam-diam bukan bukti.
Menjalankan ulang satu tanggal akan menambahkan barisnya lagi; duplikat
dikuncupkan saat pembacaan, bukan dengan mengedit yang sudah tertulis.

Implementasi pertama mencocokkan kemiripan leksikal antar-headline. Diukur
terhadap lima headline realistis untuk tema yang sama pada hari berbeda, ia
mengenali **0 dari 10 pasangan** — kata-katanya memang tidak berulang.
Menurunkan ambang tidak menolong. Karena itu model kini mengeluarkan slug
kanonik per sinyal, dan pencocokannya dilakukan atas slug itu: penilaian "ini
cerita yang sama?" pindah ke lapisan yang mampu menilainya, sementara
pencocokannya tetap deterministik di kode. Pengukuran ulang: **5 dari 5**.

> Ditegakkan di: `lib/brief/memory.ts` → `classifySignal()`, `summariseTrends()`.

## 2. Kami tidak menerbitkan ulang isi artikel

Yang kami terbitkan adalah **analisis atas apa yang terjadi**, disertai
tautan ke penerbit aslinya. Kami tidak memuat badan artikel, tidak memuat
kutipan panjang, dan tidak menyajikan ringkasan yang bisa menggantikan
pembacaan sumber.

Ini keputusan editorial sekaligus keputusan hukum. Produk yang menjual akses
ke ringkasan konten berbayar milik penerbit lain berdiri di atas fondasi yang
rapuh; produk yang menjual pertimbangan tidak.

Cuplikan sumber (`excerpt`) yang terambil dari feed disimpan di `.cache/` dan
**tidak pernah** masuk ke `editions/` maupun ke HTML terbit.

> Ditegakkan di: `scripts/brief.ts` (cuplikan hanya ke `.cache/`, yang
> ter-gitignore); `lib/site/render.ts` hanya merender field `Edition`.

## 3. Angka hanya dikutip bila ada di sumber

MW, Rupiah, dolar, persentase, tanggal — semuanya hanya boleh muncul bila
tercantum di kandidat. Tidak ada estimasi, tidak ada pembulatan kreatif,
tidak ada angka "kira-kira".

> Ditegakkan di: aturan prompt (`lib/brief/prompt.ts`) dan, pada akhirnya,
> oleh koreksi pembaca. Ini aturan yang paling bergantung pada pengawasan
> manusia — lihat bagian 7.

## 4. Fakta dan inferensi dibedakan

Tangga penalaran memisahkan keduanya secara struktural. **Yang berubah**
memuat fakta — apa yang dilaporkan sumber. **Mengapa penting**, **Efek
lanjutan**, dan **Tindakan** memuat penilaian kami, dan ditulis dengan bahasa
yang menandai dirinya sebagai penilaian ("mengindikasikan", "berpotensi").

Pembaca harus selalu bisa memisahkan mana yang dilaporkan sumber dan mana
yang disimpulkan redaksi. Karena itu pemisahannya diberi label di halaman,
bukan diserahkan pada gaya bahasa.

## 5. Batas kompetensi

Briefing ini **bukan** nasihat investasi, hukum, perpajakan, atau teknis. Ia
adalah ringkasan informasi publik untuk membantu pembaca masuk ke rapat
dengan konteks yang lebih baik. Pernyataan ini muncul di footer setiap
halaman, bukan disembunyikan di halaman syarat dan ketentuan.

## 6. Kemandirian dan konflik kepentingan

Produk ini disusun dari sumber terbuka dan **tidak memuat informasi
non-publik dari organisasi mana pun**, termasuk dari tempat kerja penyusun.
Tidak ada data internal, dokumen internal, atau angka yang belum diumumkan
yang masuk ke dalam pipeline.

Registry sumber (`sources.radar.json`) dan profil pembaca (`profile.json`)
bersifat publik dan dapat diperiksa
siapa pun. Setiap sumber yang ditambahkan atau dinonaktifkan tercatat di
riwayat git.

## 7. Koreksi

Kesalahan diperbaiki di edisi yang bersangkutan, dengan catatan koreksi yang
terlihat — bukan diam-diam. Karena `editions/*.json` berada di bawah kontrol
versi, riwayat perubahan setiap edisi permanen dan dapat ditelusuri.

Perbaikan diam-diam adalah cara tercepat menghancurkan kepercayaan yang
seluruh dokumen ini berusaha bangun.

## 8. Peran otomasi, dinyatakan terbuka

Edisi disusun oleh model bahasa dari kandidat yang dikumpulkan secara
otomatis. Model dan versi mesin yang dipakai tercatat di `meta` setiap edisi
(`meta.model`, `meta.engineVersion`) dan bisa dibaca siapa pun dari file JSON.

Kami tidak menyamarkan ini sebagai tulisan manusia. Yang kami klaim adalah
disiplin prosesnya: sumber yang dikurasi, kutipan yang terverifikasi, dan
aturan yang ditegakkan kode.

---

## Ringkasan yang ditegakkan kode

| Aturan | Titik penegakan | Akibat bila dilanggar |
|---|---|---|
| Sinyal tanpa kutipan | `compose.ts` `resolveSignals()` | Sinyal dibuang |
| Kutipan di luar rentang | `compose.ts` `resolveSignals()` | Sinyal dibuang |
| Tangga penalaran tak lengkap | `compose.ts` `resolveSignals()` | Sinyal dibuang |
| Sinyal tanpa `themeKey` | `compose.ts` `resolveSignals()` | Sinyal dibuang |
| Email dikumpulkan tanpa `PRIVACY_URL` | `render.ts` `subscribeBlock()` | Form tidak dirender |
| Kurang dari 3 sinyal valid | `compose.ts` | Edisi tidak terbit (throw) |
| Mayoritas sumber Tier 1 gagal | `scripts/brief.ts` | Pipeline berhenti (throw) |
| Lebih dari separuh sumber gagal | `scripts/brief.ts` | Pipeline berhenti (throw) |
| Registry tanpa Tier 1 di satu domain | `registry.ts` `validate()` | Gagal saat muat |
| Cuplikan sumber bocor ke publik | `.gitignore` + pemisahan `.cache/` | — |
| `domain` / `strength` di luar enum | `compose.ts` `resolveSignals()` | Dinormalisasi |
| `dueDate` bukan format ISO | `compose.ts` `parseWatch()` | Field dibuang |

Seluruh baris di atas diuji oleh `npm run brief:selftest`, termasuk kanari yang
memastikan isi modul premium tidak pernah muncul di halaman publik.
