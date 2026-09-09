interface RoleMismatchRule {
  person: RegExp;
  wrongRole: RegExp;
  expected: string;
}

interface RequiredRoleSourceRule {
  pattern: RegExp;
  description: string;
}

export class FactAuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FactAuditError";
  }
}

const ROLE_MISMATCHES: RoleMismatchRule[] = [
  {
    person: /purbaya(?:\s+yudhi\s+sadewa)?/i,
    wrongRole: /\b(danantara\s+ceo|ceo\s+danantara|kepala\s+danantara|kepala\s+bp\s+bumn|pimpinan\s+danantara)\b/i,
    expected: "Purbaya Yudhi Sadewa is Finance Minister, not Danantara leadership",
  },
];

const REQUIRED_ROLE_SOURCE: RequiredRoleSourceRule[] = [
  {
    pattern: /\b(?:ceo|direktur utama|dirut|kepala|chairman|menteri|wakil menteri|gubernur bi|ketua)\b/i,
    description: "named roles must be explicitly sourced, never inferred from topic context",
  },
];

export function auditProseFacts(value: string, where: string): void {
  for (const rule of ROLE_MISMATCHES) {
    if (rule.person.test(value) && rule.wrongRole.test(value)) {
      throw new FactAuditError(`${where} contains protected role mismatch; ${rule.expected}`);
    }
  }
}

export function roleAuditInstruction(lang: "id" | "en"): string {
  if (lang === "en") {
    return [
      "FACT AUDIT RULES:",
      "- Do not infer titles from topic context. A person commenting on an institution is not necessarily an officer of that institution.",
      "- Named roles such as CEO, chair, minister, director, governor, or head of agency may be written only when the candidate material explicitly gives that title.",
      "- If the candidate is ambiguous, write the institution that made the statement or use neutral attribution such as \"the report says\".",
      "- Protected entity check: Purbaya Yudhi Sadewa is Finance Minister. Do not describe him as Danantara CEO, Danantara head, BP BUMN head, or Danantara leadership.",
    ].join("\n");
  }

  return [
    "ATURAN AUDIT FAKTUAL:",
    "- Jangan menebak jabatan dari konteks topik. Orang yang mengomentari sebuah lembaga tidak otomatis pejabat lembaga itu.",
    "- Jabatan seperti CEO, chairman, menteri, direktur utama, dirut, gubernur, ketua, atau kepala lembaga hanya boleh ditulis bila materi kandidat menyebutkannya secara eksplisit.",
    "- Jika kandidat ambigu, tulis lembaga atau gunakan atribusi netral seperti \"laporan menyebutkan\".",
    "- Pemeriksaan entitas terlindungi: Purbaya Yudhi Sadewa adalah Menteri Keuangan. Jangan menyebutnya CEO Danantara, Kepala Danantara, Kepala BP BUMN, atau pimpinan Danantara.",
  ].join("\n");
}

export function highRiskRolePatterns(): RequiredRoleSourceRule[] {
  return REQUIRED_ROLE_SOURCE;
}
