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
  /** Foot-of-edition navigation to the neighbouring days. */
  prevEdition: string;
  nextEdition: string;
  /** Archive filtering. The site ships no JavaScript, so each domain is its
      own static page rather than a control. */
  archiveAllDomains: string;
  archiveDomainTitle: (domain: string) => string;
  archiveDomainIntro: (domain: string) => string;
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
  contact: string;
  contactTitle: string;
  contactBody: string;
  contactCta: string;
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
    prevEdition: "Edisi sebelumnya",
    nextEdition: "Edisi berikutnya",
    archiveAllDomains: "Semua domain",
    archiveDomainTitle: (d) => `Arsip: ${d}`,
    archiveDomainIntro: (d) =>
      `Edisi yang memuat sinyal ${d}, terbaru lebih dulu.`,
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
      "Setiap sinyal di atas mengutip sumber di bawah ini. Kami tidak menerbitkan ulang isi artikel; klik untuk membaca di penerbit aslinya.",
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
      "Briefing harian untuk pembaca yang perlu tahu apa yang bergerak sebelum rapat dimulai. DailyBrief bukan agregator berita; ia menyajikan sedikit sinyal yang telah dipilih, disusun, dan diberi konteks agar pembaca dapat menangkap implikasi strategisnya dengan cepat.",
    aboutHowTitle: "Bagaimana ia disusun",
    aboutTiers: [
      {
        name: "Informasi publik",
        body: "DailyBrief disusun dari informasi publik yang relevan dan dapat ditelusuri pembaca.",
      },
      {
        name: "Konteks pembaca",
        body: "Setiap edisi dirancang agar ringkas, jelas, dan berguna bagi pembaca profesional.",
      },
      {
        name: "Review internal",
        body: "Sebelum publikasi, edisi ditinjau untuk menjaga akurasi, relevansi, kejelasan, dan akuntabilitas editorial.",
      },
    ],
    aboutRulesTitle: "Aturan yang mengikat kami",
    aboutRules: [
      "DailyBrief menyajikan analisis atas informasi publik, bukan menyalin ulang isi artikel.",
      "Setiap edisi diarahkan untuk relevan, ringkas, dan berguna bagi pembaca profesional.",
      "AI dipakai sebagai alat bantu kerja editorial, bukan sebagai otoritas final.",
      "Bila ada koreksi material, pembaruan dilakukan secara bertanggung jawab.",
    ],
    aboutAiTitle: "Peran otomasi",
    aboutAiBody:
      "DailyBrief adalah produk editorial yang dibantu AI. Otomasi dipakai sebagai alat bantu dalam alur kerja editorial, sementara standar akhir tetap ditentukan oleh akurasi, relevansi, kejelasan, dan akuntabilitas penerbit. Pembaca tetap dapat membuka sumber asli yang ditautkan di setiap edisi.",
    aboutLimitsTitle: "Batasnya",
    aboutLimitsBody:
      "Ini bukan nasihat investasi, hukum, perpajakan, atau teknis. Ia ringkasan informasi publik untuk membantu Anda masuk ke rapat dengan konteks yang lebih baik. Sebagian kutipan melewati indeks berita alih-alih tautan langsung penerbit; yang seperti itu ditandai “via”.",
    contact: "Kontak",
    contactTitle: "Menghubungi kami",
    contactBody:
      "Untuk koreksi, pertanyaan tentang metodologi, atau permintaan liputan sektor tertentu, hubungi langsung lewat WhatsApp. Koreksi ditangani terbuka di edisi yang bersangkutan.",
    contactCta: "WhatsApp",
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
      "AI-assisted. Source-informed. Editorially accountable. DailyBrief menggunakan metodologi internal untuk memilih informasi publik yang relevan, menyusunnya menjadi konteks strategis, dan meninjau kualitasnya sebelum publikasi.",
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
    prevEdition: "Previous edition",
    nextEdition: "Next edition",
    archiveAllDomains: "All domains",
    archiveDomainTitle: (d) => `Archive: ${d}`,
    archiveDomainIntro: (d) => `Editions carrying a ${d} signal, newest first.`,
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
      "Every signal above cites the sources below. We do not republish article content; follow the link to read it at the original publisher.",
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
      "A daily brief for readers who need to know what moved before a meeting starts. DailyBrief is not a news aggregator; it presents a small number of selected signals with enough context for readers to understand their implications quickly.",
    aboutHowTitle: "How it is made",
    aboutTiers: [
      {
        name: "Public information",
        body: "DailyBrief is prepared from public information that readers can trace for themselves.",
      },
      {
        name: "Reader context",
        body: "Each edition is designed to be concise, clear, and useful for professional readers.",
      },
      {
        name: "Internal review",
        body: "Before publication, each edition is reviewed for accuracy, relevance, clarity, and editorial accountability.",
      },
    ],
    aboutRulesTitle: "The rules that bind us",
    aboutRules: [
      "DailyBrief presents analysis of public information, not republished article content.",
      "Each edition is designed to be relevant, concise, and useful to professional readers.",
      "AI is used as an editorial workflow aid, not as the final authority.",
      "Material corrections are handled responsibly.",
    ],
    aboutAiTitle: "The role of automation",
    aboutAiBody:
      "DailyBrief is an AI-assisted editorial product. Automation is used as an aid inside the editorial workflow, while the final standard remains accuracy, relevance, clarity, and publisher accountability. Readers can still open the original sources linked in every edition.",
    aboutLimitsTitle: "Its limits",
    aboutLimitsBody:
      "This is not investment, legal, tax, or technical advice. It summarises public information to help you walk into a meeting better briefed. Some citations route through a news index rather than a direct publisher link; those are marked “via”.",
    contact: "Contact",
    contactTitle: "Getting in touch",
    contactBody:
      "For corrections, questions about methodology, or a request to cover a particular sector, reach us on WhatsApp. Corrections are handled in the open, in the edition concerned.",
    contactCta: "WhatsApp",
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
      "AI-assisted. Source-informed. Editorially accountable. DailyBrief uses an internal methodology to select relevant public information, shape it into strategic context, and review quality before publication.",
    otherLang: "Bahasa Indonesia",
    noEditions: "No editions published yet.",
    editionsCount: (n) => `${n} edition${n === 1 ? "" : "s"}`,
    citedSources: (n) => `${n} source${n === 1 ? "" : "s"} cited`,
    disclaimer:
      "This radar is analysis of public information for general information purposes. It is not investment, legal, or technical advice.",
  },
};
