import type { Lang, SignalStrength, TrendStatus } from "../brief/types";

/**
 * All reader-facing copy. Both languages are defined together so a missing
 * translation is a type error rather than a half-Indonesian English page.
 */
export interface Strings {
  siteTagline: string;
  latestEdition: string;
  readEdition: string;
  archive: string;
  archiveTitle: string;
  archiveIntro: string;
  allEditions: string;
  summary: string;
  signals: string;
  whatChanged: string;
  whyItMatters: string;
  secondOrder: string;
  action: string;
  trends: string;
  trendsIntro: string;
  watchNext: string;
  sources: string;
  sourcesNote: string;
  subscribeTitle: string;
  subscribeBlurb: string;
  subscribePlaceholder: string;
  subscribeButton: string;
  subscribeSoon: string;
  consentLabel: string;
  privacyPolicy: string;
  /** Accessible name for a citation link, e.g. "Sumber 3". */
  citationLabel: (n: number) => string;
  skipToContent: string;
  about: string;
  aboutTitle: string;
  aboutLede: string;
  homeIntro: string;
  cadence: string;
  aboutWhatTitle: string;
  aboutWhatBody: string;
  aboutHowTitle: string;
  aboutTiers: { name: string; body: string }[];
  aboutRulesTitle: string;
  aboutRules: string[];
  aboutAiTitle: string;
  aboutAiBody: string;
  aboutLimitsTitle: string;
  aboutLimitsBody: string;
  strength: Record<SignalStrength, string>;
  trendStatus: Record<TrendStatus, string>;
  /** e.g. "3 publishers · primary source" */
  corroboration: (publishers: number, hasPrimary: boolean) => string;
  /** Shown whenever no cited source is primary, however many outlets carried it. */
  noPrimarySource: string;
  /** Its counterpart, so the evidence line always states a verdict. */
  hasPrimarySource: string;
  publisherCount: (n: number) => string;
  /** The selection funnel that opens each edition: candidates in, signals out. */
  funnelCandidates: string;
  funnelRead: string;
  funnelSignals: string;
  funnelCited: string;
  /** Heading over the source notes in the right margin. */
  evidenceFor: string;
  /** Heading over the entity index in the right margin. */
  entitiesLabel: string;
  /** Labels the citations under the second-order rung. */
  secondOrderSources: string;
  trendSince: (n: number, since: string) => string;
  methodology: string;
  methodologyBody: string;
  otherLang: string;
  noEditions: string;
  editionsCount: (n: number) => string;
  citedSources: (n: number) => string;
  disclaimer: string;
}

export const STRINGS: Record<Lang, Strings> = {
  id: {
    siteTagline:
      "Radar intelijen strategis harian: AI dan model frontier, energi dan kelistrikan, strategi korporasi dan BUMN.",
    latestEdition: "Edisi terbaru",
    readEdition: "Baca edisi",
    archive: "Arsip",
    archiveTitle: "Arsip edisi",
    archiveIntro: "Seluruh edisi, terbaru lebih dulu. Setiap edisi permanen dan dapat dirujuk.",
    allEditions: "Semua edisi",
    summary: "Ringkasan",
    signals: "Lima sinyal hari ini",
    whatChanged: "Yang berubah",
    whyItMatters: "Mengapa penting",
    secondOrder: "Efek lanjutan",
    action: "Tindakan",
    trends: "Tren yang sedang terbentuk",
    trendsIntro:
      "Tema yang berulang di arsip. Dihitung dari sinyal yang benar-benar diterbitkan, bukan dari penilaian sesaat.",
    watchNext: "Yang perlu dipantau",
    sources: "Sumber",
    sourcesNote:
      "Setiap sinyal di atas mengutip sumber di bawah ini. Kami tidak menerbitkan ulang isi artikel — klik untuk membaca di penerbit aslinya.",
    subscribeTitle: "Terima radar setiap pagi",
    subscribeBlurb: "Satu email, sebelum jam kerja dimulai. Tanpa spam, berhenti kapan saja.",
    subscribePlaceholder: "email@perusahaan.co.id",
    subscribeButton: "Berlangganan",
    subscribeSoon: "Pendaftaran segera dibuka.",
    consentLabel: "Saya setuju email saya disimpan untuk pengiriman briefing harian, sesuai",
    privacyPolicy: "kebijakan privasi",
    citationLabel: (n) => `Sumber ${n}`,
    skipToContent: "Lompat ke isi",
    about: "Tentang",
    aboutTitle: "Tentang radar ini",
    aboutLede: "Apa yang Anda baca, bagaimana ia disusun, dan aturan apa yang mengikat kami.",
    homeIntro:
      "Lima sinyal setiap pagi dari tiga domain: AI dan model frontier, energi dan kelistrikan, strategi korporasi dan BUMN. Setiap sinyal wajib mengutip sumber yang bisa Anda periksa sendiri.",
    cadence: "Terbit setiap pagi",
    aboutWhatTitle: "Apa ini",
    aboutWhatBody:
      "Briefing harian untuk pembaca yang perlu tahu apa yang bergerak sebelum rapat dimulai. Bukan agregator berita: dari sekitar empat ratus kandidat yang terkumpul tiap hari, hanya lima yang terbit — dan masing-masing dibawa naik dari fakta ke pola, ke efek lanjutan, ke tindakan. Yang kami tawarkan adalah seleksi dan pertimbangan, bukan volume.",
    aboutHowTitle: "Bagaimana ia disusun",
    aboutTiers: [
      {
        name: "Sumber wajib-pantau",
        body: "Sumber primer dan resmi, diperiksa setiap kali berjalan — lab yang mengumumkan modelnya sendiri, regulator yang menerbitkan keputusannya sendiri.",
      },
      {
        name: "Penemuan terbuka",
        body: "Kueri terhadap indeks berita, sehingga semesta sumbernya bisa berubah tiap hari. Ini yang menjangkau lembaga yang tidak menerbitkan feed sama sekali.",
      },
      {
        name: "Sinyal awal",
        body: "arXiv, rilis GitHub, dan komunitas teknis. Berisik dan dini secara sengaja — kadang mendahului liputannya berbulan-bulan.",
      },
      {
        name: "Verifikasi",
        body: "Berapa penerbit berbeda yang berdiri di balik sebuah klaim, dan apakah salah satunya sumber primer. Dihitung kode dari kutipannya, tidak pernah diklaim model.",
      },
      {
        name: "Penalaran strategis",
        body: "Fakta, lalu pola, lalu efek lanjutan, lalu tindakan. Keempatnya wajib, sehingga berhenti di ringkasan berita menjadi mustahil.",
      },
      {
        name: "Memori sinyal",
        body: "Tema yang sama lintas hari. Ini yang membedakan “ada berita” dari “ini sudah keempat kalinya dalam tiga minggu, dan sudah berhenti menjadi berita”.",
      },
    ],
    aboutRulesTitle: "Aturan yang mengikat kami",
    aboutRules: [
      "Setiap sinyal wajib mengutip sumber yang benar-benar terambil hari itu. Yang kutipannya tidak resolve dibuang, bukan diperbaiki.",
      "Bila terlalu sedikit sinyal lolos validasi, edisi hari itu tidak terbit. Kami memilih absen daripada terbit tipis.",
      "Kami tidak menerbitkan ulang isi artikel. Yang Anda baca adalah analisis kami; sumbernya ditautkan agar bisa Anda periksa.",
      "Angka hanya dikutip bila ada di sumbernya. Tidak ada estimasi.",
      "Kekuatan bukti dihitung kode, bukan dinilai sendiri oleh model yang menulis klaimnya.",
      "Koreksi dilakukan terbuka. Setiap edisi ada di bawah kontrol versi, jadi riwayat perubahannya permanen.",
    ],
    aboutAiTitle: "Peran otomasi",
    aboutAiBody:
      "Edisi disusun oleh model bahasa dari kandidat yang dikumpulkan otomatis. Kami tidak menyamarkannya sebagai tulisan manusia — model dan versi mesin yang dipakai tercatat di setiap edisi dan bisa dibaca langsung dari file JSON-nya. Yang kami klaim adalah disiplin prosesnya: sumber yang dikurasi, kutipan yang terverifikasi, dan aturan yang ditegakkan kode, bukan oleh niat baik.",
    aboutLimitsTitle: "Batasnya",
    aboutLimitsBody:
      "Ini bukan nasihat investasi, hukum, perpajakan, atau teknis. Ia ringkasan informasi publik untuk membantu Anda masuk ke rapat dengan konteks yang lebih baik. Sebagian kutipan melewati indeks berita alih-alih tautan langsung penerbit; yang seperti itu ditandai “via”.",
    strength: { material: "Material", emerging: "Sinyal awal", actionable: "Menuntut keputusan" },
    trendStatus: { new: "Baru", recurring: "Berulang", structural: "Struktural" },
    corroboration: (publishers, hasPrimary) =>
      `${publishers} penerbit${hasPrimary ? " · ada sumber primer" : ""}`,
    noPrimarySource: "tanpa sumber primer",
    hasPrimarySource: "sumber primer",
    publisherCount: (n) => `${n} penerbit`,
    funnelCandidates: "kandidat",
    funnelRead: "dibaca",
    funnelSignals: "sinyal",
    funnelCited: "sumber dikutip",
    evidenceFor: "Dasar",
    entitiesLabel: "Disebut",
    secondOrderSources: "dasar",
    trendSince: (n, since) => `${n}x sejak ${since}`,
    methodology: "Metodologi",
    methodologyBody:
      "Enam lapisan: sumber wajib-pantau, penemuan terbuka, sinyal awal dari riset dan rilis teknis, verifikasi silang, penalaran strategis, dan memori sinyal lintas hari. Setiap sinyal wajib mengutip sumber yang benar-benar terambil hari itu; klaim tanpa kutipan yang dapat diverifikasi tidak diterbitkan.",
    otherLang: "English",
    noEditions: "Belum ada edisi yang diterbitkan.",
    editionsCount: (n) => `${n} edisi`,
    citedSources: (n) => `${n} sumber dikutip`,
    disclaimer:
      "Radar ini adalah analisis atas informasi publik untuk keperluan informasi umum. Bukan nasihat investasi, hukum, atau teknis.",
  },
  en: {
    siteTagline:
      "A daily strategic intelligence radar: AI and frontier models, energy and electricity, corporate strategy and state-owned enterprises.",
    latestEdition: "Latest edition",
    readEdition: "Read edition",
    archive: "Archive",
    archiveTitle: "Edition archive",
    archiveIntro: "Every edition, newest first. Each one is permanent and citable.",
    allEditions: "All editions",
    summary: "Summary",
    signals: "Today's five signals",
    whatChanged: "What changed",
    whyItMatters: "Why it matters",
    secondOrder: "Second-order effect",
    action: "Action",
    trends: "Trends forming",
    trendsIntro:
      "Themes recurring across the archive. Computed from signals actually published, not asserted in the moment.",
    watchNext: "What to watch",
    sources: "Sources",
    sourcesNote:
      "Every signal above cites the sources below. We do not republish article content — follow the link to read it at the original publisher.",
    subscribeTitle: "Get the radar every morning",
    subscribeBlurb: "One email, before the working day starts. No spam, unsubscribe anytime.",
    subscribePlaceholder: "you@company.com",
    subscribeButton: "Subscribe",
    subscribeSoon: "Sign-ups open shortly.",
    consentLabel: "I agree my email may be stored to deliver the daily briefing, per the",
    privacyPolicy: "privacy policy",
    citationLabel: (n) => `Source ${n}`,
    skipToContent: "Skip to content",
    about: "About",
    aboutTitle: "About this radar",
    aboutLede: "What you are reading, how it is made, and the rules that bind us.",
    homeIntro:
      "Five signals every morning across three domains: AI and frontier models, energy and electricity, corporate strategy and state-owned enterprises. Every signal must cite a source you can check yourself.",
    cadence: "Published every morning",
    aboutWhatTitle: "What this is",
    aboutWhatBody:
      "A daily brief for readers who need to know what moved before a meeting starts. Not an aggregator: of roughly four hundred candidates gathered daily, five are published — each carried from fact to pattern to second-order effect to action. What we offer is selection and judgement, not volume.",
    aboutHowTitle: "How it is made",
    aboutTiers: [
      {
        name: "Must-monitor sources",
        body: "Primary and official sources, checked on every run — the lab announcing its own model, the regulator publishing its own decision.",
      },
      {
        name: "Open discovery",
        body: "Queries against a news index, so the source universe can change daily. This is what reaches institutions that publish no feed at all.",
      },
      {
        name: "Emerging signal",
        body: "arXiv, GitHub releases, and technical communities. Noisy and early by design — sometimes months ahead of the coverage.",
      },
      {
        name: "Verification",
        body: "How many distinct publishers stand behind a claim, and whether any of them is primary. Computed in code from the citations, never asserted by the model.",
      },
      {
        name: "Strategic reasoning",
        body: "Fact, then pattern, then second-order effect, then action. All four are required, which makes stopping at a news summary impossible.",
      },
      {
        name: "Signal memory",
        body: "The same theme across days. This is what separates “there is news” from “this is the fourth time in three weeks, and it has stopped being news”.",
      },
    ],
    aboutRulesTitle: "The rules that bind us",
    aboutRules: [
      "Every signal must cite a source actually retrieved that day. Ones whose citations do not resolve are dropped, not repaired.",
      "If too few signals survive validation, the edition does not publish. We would rather skip a day than publish a thin one.",
      "We do not republish article content. What you read is our analysis; the sources are linked so you can check it.",
      "Figures are cited only when the sources give them. No estimates.",
      "Evidence strength is computed in code, not graded by the model that wrote the claim.",
      "Corrections are made in the open. Every edition is under version control, so its revision history is permanent.",
    ],
    aboutAiTitle: "The role of automation",
    aboutAiBody:
      "Editions are composed by a language model from automatically gathered candidates. We do not disguise that as human writing — the model and engine version are recorded in every edition and readable straight from its JSON. What we claim is the discipline of the process: curated sources, verified citations, and rules enforced by code rather than good intentions.",
    aboutLimitsTitle: "Its limits",
    aboutLimitsBody:
      "This is not investment, legal, tax, or technical advice. It summarises public information to help you walk into a meeting better briefed. Some citations route through a news index rather than a direct publisher link; those are marked “via”.",
    strength: { material: "Material", emerging: "Emerging", actionable: "Decision-forcing" },
    trendStatus: { new: "New", recurring: "Recurring", structural: "Structural" },
    corroboration: (publishers, hasPrimary) =>
      `${publishers} publisher${publishers === 1 ? "" : "s"}${hasPrimary ? " · primary source" : ""}`,
    noPrimarySource: "no primary source",
    hasPrimarySource: "primary source",
    publisherCount: (n) => `${n} publisher${n === 1 ? "" : "s"}`,
    funnelCandidates: "candidates",
    funnelRead: "read",
    funnelSignals: "signals",
    funnelCited: "sources cited",
    evidenceFor: "Basis",
    entitiesLabel: "Named",
    secondOrderSources: "basis",
    trendSince: (n, since) => `${n}x since ${since}`,
    methodology: "Methodology",
    methodologyBody:
      "Six layers: must-monitor sources, open discovery, emerging signal from research and technical releases, cross-source verification, strategic reasoning, and longitudinal signal memory. Every signal must cite a source actually retrieved that day; claims without a verifiable citation are not published.",
    otherLang: "Bahasa Indonesia",
    noEditions: "No editions published yet.",
    editionsCount: (n) => `${n} edition${n === 1 ? "" : "s"}`,
    citedSources: (n) => `${n} source${n === 1 ? "" : "s"} cited`,
    disclaimer:
      "This radar is analysis of public information for general information purposes. It is not investment, legal, or technical advice.",
  },
};
