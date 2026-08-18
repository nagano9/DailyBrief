import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The personal-relevance layer.
 *
 * Without it the output is "Top 5 AI News" — true, and worth very little.
 * The profile is what lets the same Nvidia datacentre story be read as a
 * project-finance signal rather than a chip story, and an Anthropic
 * multi-agent result be read as an organisational-governance signal.
 *
 * Kept in a separate file, not baked into the prompt, so the reader's focus
 * can change without a code change — and so it is obvious what is being sent
 * to the model on the reader's behalf.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = process.env.BRIEF_PROFILE ?? path.resolve(__dirname, "../..", "profile.json");

export interface Profile {
  role: string;
  focusAreas: string[];
  readingIntent: string;
  notes?: string;
}

export function loadProfile(): Profile | null {
  if (!fs.existsSync(PROFILE_PATH)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8")) as Partial<Profile>;
    if (!parsed.role || !Array.isArray(parsed.focusAreas) || parsed.focusAreas.length === 0) {
      console.warn(`[profile] ${PROFILE_PATH} is missing 'role' or 'focusAreas' — ignoring`);
      return null;
    }
    return {
      role: parsed.role,
      focusAreas: parsed.focusAreas,
      readingIntent: parsed.readingIntent ?? "",
      notes: parsed.notes,
    };
  } catch (e) {
    console.warn(`[profile] cannot read ${PROFILE_PATH}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Render the profile for the prompt.
 *
 * Framed as "translate implications toward these areas", never as "only
 * cover these areas" — a radar that only reports what the reader already
 * watches has stopped being a radar.
 */
export function profileContext(profile: Profile | null, lang: string): string {
  if (!profile) return "";
  const areas = profile.focusAreas.map((a) => `- ${a}`).join("\n");
  if (lang === "en") {
    return `READER CONTEXT
${profile.role}

Areas where this reader can actually act:
${areas}

Intent: ${profile.readingIntent}
${profile.notes ? `Notes: ${profile.notes}` : ""}

Use this to decide what an implication MEANS for this reader, not to restrict what you cover. A major development outside these areas still belongs in the five if it is genuinely more important — say plainly why it matters to them.`;
  }
  return `KONTEKS PEMBACA
${profile.role}

Area di mana pembaca ini benar-benar bisa bertindak:
${areas}

Maksud membaca: ${profile.readingIntent}
${profile.notes ? `Catatan: ${profile.notes}` : ""}

Gunakan ini untuk menentukan APA ARTI sebuah implikasi bagi pembaca ini, bukan untuk membatasi cakupan. Perkembangan besar di luar area ini tetap layak masuk lima besar bila memang lebih penting — jelaskan saja mengapa itu relevan baginya.`;
}
