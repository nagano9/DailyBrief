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
  strength: Record<SignalStrength, string>;
  trendStatus: Record<TrendStatus, string>;
  /** e.g. "3 publishers · primary source" */
  corroboration: (publishers: number, hasPrimary: boolean) => string;
  thinEvidence: string;
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
    strength: { material: "Material", emerging: "Sinyal awal", actionable: "Menuntut keputusan" },
    trendStatus: { new: "Baru", recurring: "Berulang", structural: "Struktural" },
    corroboration: (publishers, hasPrimary) =>
      `${publishers} penerbit${hasPrimary ? " · ada sumber primer" : ""}`,
    thinEvidence: "bukti masih tipis",
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
    strength: { material: "Material", emerging: "Emerging", actionable: "Decision-forcing" },
    trendStatus: { new: "New", recurring: "Recurring", structural: "Structural" },
    corroboration: (publishers, hasPrimary) =>
      `${publishers} publisher${publishers === 1 ? "" : "s"}${hasPrimary ? " · primary source" : ""}`,
    thinEvidence: "evidence is thin",
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
