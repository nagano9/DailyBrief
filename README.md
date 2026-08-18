# Daily Strategic Briefing

Radar intelijen strategis harian pada tiga domain — **AI dan model frontier**,
**energi dan kelistrikan**, **strategi korporasi dan BUMN** — dan setiap
klaimnya dapat ditelusuri ke sumber aslinya.

> **Status:** mesin radar berjalan dan terverifikasi. Terbit dalam bahasa
> Indonesia saja secara default; tidak ada lapisan berbayar sampai jalur
> pembayaran ada. Lihat [Peta jalan](#peta-jalan).

---

## Mengapa bukan sekadar RSS

Model `RSS → ringkas` punya bias seleksi sumber yang tidak bisa ia lihat
sendiri: perkembangan yang penting tetapi terbit di luar daftar feed menjadi
tak terlihat. Dan sebagian sumber terpenting **tidak menerbitkan RSS sama
sekali** — diverifikasi, bukan diasumsikan:

| Sumber | Endpoint RSS | Cara dijangkau |
|---|---|---|
| Anthropic | 404 di `/rss.xml`, `/news/rss.xml`, `/news/feed.xml` | discovery |
| IEA | 404 di `/rss/news`, `/rss/all`, `/api/rss/news` | discovery |
| Kementerian ESDM | 404 di `/id/rss/berita`, `/id/rss`, `/rss` | discovery |
| IRENA | mengembalikan HTML, bukan feed | discovery |
| Reuters, IDX, Kementerian BUMN | 404 / 403 | discovery |

Karena itu arsitekturnya bertingkat, bukan satu lapis.

## Enam tingkat

```
  Tier 1  Wajib-pantau      sumber primer dan resmi, diperiksa setiap run
  Tier 2  Discovery terbuka kueri, sehingga semesta sumber bisa berubah harian
  Tier 3  Sinyal awal       arXiv, rilis GitHub, komunitas teknis
     ↓
  Tier 4  Verifikasi        jumlah penerbit berbeda + ada/tidaknya sumber primer
  Tier 5  Penalaran         fakta → pola → implikasi → tindakan
  Tier 6  Memori            tema yang sama lintas hari: sinyal lemah → struktural
     ↓
              LIMA SINYAL HARI INI
```

Tier 1–3 adalah pengambilan. **Tier 4 dan 6 dihitung secara deterministik oleh
kode, tidak pernah diklaim oleh model** — model yang menilai buktinya sendiri
akan menilainya dengan murah hati. Tier 5 adalah modelnya.

Registry saat ini: **38 sumber** — T1=15, T2=15, T3=8. Diuji terakhir: 38/38
hidup, 440 item unik, 10 detik.

### Tier 5 — tangga penalaran

Peringkas berhenti di `whatChanged`. Keempat bidang ini wajib, sehingga
berhenti di situ menjadi mustahil secara struktural:

| Bidang | Isi |
|---|---|
| `whatChanged` | Fakta. Apa yang benar-benar berbeda hari ini. |
| `whyItMatters` | Pola yang sedang terbentuk dan mengapa itu mengubah sesuatu. |
| `secondOrder` | Akibat dari akibat — bagian yang dilewatkan hampir semua liputan. |
| `action` | Sesuatu yang konkret dan bisa dikerjakan minggu ini. |

### Tier 6 — memori sinyal

Setiap sinyal yang terbit disimpan di `signals/history.jsonl` (append-only),
lalu sinyal esok hari dicocokkan dengan arsip itu.

Pencocokannya memakai **kunci tema** (`themeKey`) yang dikeluarkan model —
slug kanonik seperti `ai-datacenter-project-finance` — bukan kemiripan kata
antar-headline. Pendekatan leksikal diukur mengenali 0 dari 10 pasangan tema
yang sama; dengan kunci tema, 5 dari 5.

Statusnya:

- **Baru** — belum pernah muncul
- **Berulang** — 2–3 kali dalam 30 hari
- **Struktural** — ≥4 kali dan membentang ≥7 hari

Status itu juga disuntikkan ke dalam prompt, sehingga model bisa berkata "ini
sudah berhenti menjadi berita dan menjadi kondisi", bukan melaporkan setiap
hari seolah hari pertama. **Ini satu-satunya lapisan yang tidak bisa dihasilkan
oleh pengambilan sehari, sebagus apa pun** — dan karena itu arsipnya adalah
asetnya.

## Yang ditegakkan kode

| Aturan | Titik penegakan | Akibat |
|---|---|---|
| Sinyal wajib mengutip indeks yang resolve | `compose.ts` `resolveSignals()` | Sinyal dibuang |
| Tangga penalaran wajib lengkap | `compose.ts` `resolveSignals()` | Sinyal dibuang |
| Minimal 3 sinyal valid | `compose.ts` | Edisi tidak terbit |
| Mayoritas sumber Tier 1 gagal | `scripts/brief.ts` | Pipeline berhenti |
| Sinyal tanpa `themeKey` | `compose.ts` `resolveSignals()` | Sinyal dibuang |
| Email dikumpulkan tanpa kebijakan privasi | `render.ts` `subscribeBlock()` | Form tidak dirender |
| Cuplikan sumber bocor ke arsip | `.gitignore` + pemisahan `.cache/` | — |

Rinciannya di [docs/EDITORIAL.md](docs/EDITORIAL.md).

## Menjalankan

Prasyarat: Node.js 22+.

```bash
npm install
```

| Perintah | Fungsi | Biaya |
|---|---|---|
| `npm run brief:dry-run` | Ambil semua sumber, laporkan komposisi pool kandidat | tanpa LLM |
| `npm run brief:selftest` | Uji validasi, korroborasi, dan klasifikasi tren | tanpa LLM |
| `npm run brief` | Susun edisi hari ini | 1 panggilan LLM per bahasa |
| `npm run site` | Bangun situs dari `editions/` ke `site/` | instan |

`brief:dry-run` mencetak sebaran tier, penerbit, dan domain pada pool
kandidat. Itu yang membuat perubahan registry terukur, bukan sekadar terasa —
menambah sumber tanpa memperbaiki pool berarti memperburuk keadaan.

Menyusun ulang tanpa mengambil sumber lagi:

```bash
BRIEF_REUSE_CACHE=true npm run brief
```

## Lapisan relevansi personal

[profile.json](profile.json) berisi peran dan area perhatian pembaca, lalu
disuntikkan ke prompt. Ini yang membuat berita Nvidia bisa dibaca sebagai
sinyal project finance, dan hasil multi-agen Anthropic sebagai sinyal tata
kelola organisasi.

Dibingkai sebagai "terjemahkan implikasinya ke arah ini", **bukan** "hanya
liput ini" — radar yang hanya melaporkan apa yang sudah diperhatikan pembaca
sudah berhenti menjadi radar.

## Yang belum ada

**Live open-web search.** Tier 2 berjalan di atas kueri indeks berita, bukan
pencarian web sungguhan. Sumber bertipe `search` sudah didukung dan akan gagal
secara terbuka sampai `SEARCH_PROVIDER` dan `SEARCH_API_KEY` diisi — gagal
terbuka, bukan diam-diam kosong, karena sumber discovery yang tiap hari tidak
menyumbang apa-apa adalah titik buta yang menyerupai sistem yang bekerja.

**Image discovery.** Sengaja tidak dibangun. Gambar bukan bukti, dan
menyematkan gambar penerbit ke halaman komersial menimbulkan persoalan hak
cipta yang tidak sebanding manfaatnya.

**Tautan langsung penerbit untuk hasil discovery.** URL Google News adalah
pengalihan buram yang hanya terselesaikan lewat JS. Kami menandainya "via
Google News" alih-alih menyamarkannya sebagai tautan langsung.

## Peta jalan

**Selesai.** Radar enam tingkat, kutipan terverifikasi, korroborasi, memori
sinyal berbasis kunci tema, situs dengan permalink, hreflang, JSON-LD, RSS,
sitemap, dan arsip permanen. Bahasa Inggris tersedia lewat `BRIEF_LANGS=id,en`
saat ada permintaan.

**Berikutnya — monetisasi.** Penyimpanan subscriber, pengiriman email harian,
lalu lapisan berbayar dan pembayaran. Mesin premium sengaja **dihapus**, bukan
sekadar ditunda: ia membakar token tiap hari untuk konten yang tidak bisa
dibeli, dan membuat batas paywall ditentukan model alih-alih redaksi.
Bangun kembali saat pembayaran ada.

**Kemudian — kedalaman.** Halaman entitas (per perusahaan, per proyek, per
regulasi), pencarian lintas arsip, provider pencarian web untuk Tier 2, dan
pengelompokan tren berbasis entitas sebagai pelengkap kunci tema.

## Struktur proyek

Mesin radar berjalan **paralel** dengan pipeline digest upstream, tidak
menggantikannya — sehingga merge dari upstream tetap bersih.

```
lib/brief/          radar: types, registry, fetch, publishers, memory, profile, prompt, compose
lib/site/           renderer situs: templat, string per bahasa
scripts/brief.ts    jalankan radar untuk satu hari
scripts/site.ts     bangun situs dari editions/
sources.radar.json  registry sumber bertingkat (satu-satunya sumber kebenaran)
profile.json        lapisan relevansi personal
editions/           arsip terbit — di-commit
signals/            memori sinyal — di-commit; kehilangan ini menghapus Tier 6
docs/EDITORIAL.md   standar redaksi dan titik penegakannya
```

Bagian upstream yang dipakai ulang: lapisan backend LLM (`lib/ai/`, enam
backend di balik satu variabel `LLM_BACKEND`) dan helper `curlFetch`.
Konfigurasinya di [docs/UPSTREAM-README.md](docs/UPSTREAM-README.md).

## Lisensi dan atribusi

Turunan dari [`leiting-eric/DailyBrief`](https://github.com/leiting-eric/DailyBrief)
(MIT, Copyright 2026 Eric). Pemberitahuan lisensi wajib dipertahankan di setiap
distribusi, termasuk distribusi komersial. Rinciannya di [NOTICE.md](NOTICE.md).

Radar ini bukan nasihat investasi, hukum, perpajakan, atau teknis.
