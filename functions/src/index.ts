import {initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import type {
  DocumentReference,
  DocumentSnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {defineSecret, defineString} from "firebase-functions/params";
import {logger} from "firebase-functions/v2";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import nodemailer from "nodemailer";

initializeApp();

const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const FROM_EMAIL = defineString("REPORT_FROM_EMAIL", {
  description: "送信に使う Gmail アドレス（SMTP 認証のユーザー名を兼ねる）",
  default: "okusuri@example.com",
});
const FROM_NAME = defineString("REPORT_FROM_NAME", {
  default: "おくすり記録",
});

const REGION = "asia-northeast1";
const TIME_ZONE = "Asia/Tokyo";

type SlotId = "morning" | "noon" | "evening";

const SLOT_ORDER: SlotId[] = ["morning", "noon", "evening"];
const SLOT_LABEL: Record<SlotId, string> = {
  morning: "朝",
  noon: "昼",
  evening: "夜",
};

/** 未記録も表せる 1 行分の報告内容。 */
interface ReportEntry {
  dateKey: string;
  slot: SlotId;
  /** true: 飲んだ / false: 飲んでない / null: 記録なし */
  taken: boolean | null;
  photoStoragePath?: string | null;
  recordId?: string;
}

/** 「YYYY-MM-DD」を日本時間で求める。 */
function jstDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function friendlyDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${month}/${day}`;
}

function normalizeSlots(raw: unknown): SlotId[] {
  const values = Array.isArray(raw) ? raw : [];
  const slots = values.filter((value): value is SlotId =>
    SLOT_ORDER.includes(value as SlotId)
  );
  const unique = [...new Set(slots)];
  if (unique.length === 0) return ["morning", "evening"];
  return unique.sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b));
}

/**
 * 報告対象を集める。
 * 対象日（前日）の各枠は、記録が無ければ「未記録」として並べる。
 * それより前の未送信分（あとから記録した遅れ分）も一緒に送る。
 */
async function collectEntries(
  household: DocumentReference,
  slots: SlotId[],
  targetDateKey: string,
  options: {reportMissing: boolean}
): Promise<ReportEntry[]> {
  const snapshot = await household
    .collection("records")
    .where("reportedAt", "==", null)
    .get();

  const entries: ReportEntry[] = [];
  const seen = new Set<string>();

  for (const doc of snapshot.docs) {
    const dateKey = doc.get("date") as string | undefined;
    const slot = doc.get("slot") as SlotId | undefined;
    if (!dateKey || !slot) continue;
    // まだ来ていない枠は次回にまわす。
    if (dateKey > targetDateKey) continue;

    entries.push({
      dateKey,
      slot,
      taken: doc.get("taken") === true,
      photoStoragePath: (doc.get("photoStoragePath") as string) ?? null,
      recordId: doc.id,
    });
    seen.add(`${dateKey}#${slot}`);
  }

  if (options.reportMissing) {
    for (const slot of slots) {
      if (!seen.has(`${targetDateKey}#${slot}`)) {
        entries.push({dateKey: targetDateKey, slot, taken: null});
      }
    }
  }

  return entries.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
    return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot);
  });
}

function resultLabel(taken: boolean | null): string {
  if (taken === null) return "記録なし";
  return taken ? "飲んだ" : "飲んでない";
}

function resultColor(taken: boolean | null): string {
  if (taken === null) return "#8B7E93";
  return taken ? "#D86FC4" : "#5A9FD4";
}

function buildTextBody(
  entries: ReportEntry[],
  patientName: string,
  targetDateKey: string
): string {
  const who = patientName ? `${patientName}さん` : "ご本人";
  const lines = entries.map((entry) => {
    const photo = entry.photoStoragePath ? "（写真あり）" : "";
    return `・${friendlyDate(entry.dateKey)} ${SLOT_LABEL[entry.slot]}: ${resultLabel(entry.taken)}${photo}`;
  });

  return [
    `${who}の${friendlyDate(targetDateKey)}のおくすり記録をお届けします。`,
    "",
    ...lines,
    "",
    "このメールはおくすり記録アプリから自動送信されています。",
  ].join("\n");
}

function buildHtmlBody(
  entries: ReportEntry[],
  patientName: string,
  targetDateKey: string
): string {
  const who = patientName ? `${patientName}さん` : "ご本人";
  const rows = entries
    .map((entry) => {
      const photo = entry.photoStoragePath ?
        "<span style=\"color:#8B7E93;font-size:12px\">写真あり</span>" :
        "";
      return `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #FDE9FB;font-weight:600;color:#4A3B52">
            ${friendlyDate(entry.dateKey)} ${SLOT_LABEL[entry.slot]}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #FDE9FB;color:${resultColor(entry.taken)};font-weight:700">
            ${resultLabel(entry.taken)}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #FDE9FB">${photo}</td>
        </tr>`;
    })
    .join("");

  return `
  <div style="font-family:-apple-system,'Hiragino Sans',sans-serif;background:linear-gradient(135deg,#FFF0FD,#F0F7FF);padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#FFFBFE;border-radius:20px;padding:24px;border:1px solid #FDCCF9">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;color:#8E3F80;font-weight:700">おくすり記録</p>
      <h1 style="margin:0 0 16px;font-size:20px;color:#4A3B52">
        ${who}の${friendlyDate(targetDateKey)}の記録
      </h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <p style="margin:18px 0 0;font-size:11px;color:#8B7E93">
        このメールはおくすり記録アプリから自動送信されています。写真は添付ファイルをご覧ください。
      </p>
    </div>
  </div>`;
}

interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

async function buildAttachments(
  entries: ReportEntry[]
): Promise<MailAttachment[]> {
  const bucket = getStorage().bucket();
  const attachments: MailAttachment[] = [];

  for (const entry of entries) {
    if (!entry.photoStoragePath) continue;
    try {
      const [buffer] = await bucket.file(entry.photoStoragePath).download();
      attachments.push({
        filename: `${entry.dateKey}_${entry.slot}.jpg`,
        content: buffer,
        contentType: "image/jpeg",
      });
    } catch (error) {
      logger.warn("写真の取得に失敗しました", {
        path: entry.photoStoragePath,
        error,
      });
    }
  }

  return attachments;
}

interface SendResult {
  householdId: string;
  sentTo: number;
  entries: number;
  skippedReason?: string;
}

async function sendReportForHousehold(
  doc: DocumentSnapshot,
  now: Date,
  options: {markReported: boolean} = {markReported: true}
): Promise<SendResult> {
  const householdId = doc.id;
  const recipients = ((doc.get("recipientEmails") as string[]) ?? [])
    .map((email) => email.trim())
    .filter((email) => email.length > 0)
    .slice(0, 2);

  if (recipients.length === 0) {
    return {householdId, sentTo: 0, entries: 0, skippedReason: "送信先未登録"};
  }

  const slots = normalizeSlots(doc.get("slots"));
  const patientName = ((doc.get("patientName") as string) ?? "").trim();
  const targetDateKey = shiftDateKey(jstDateKey(now), -1);

  // 使い始める前の日付を「記録なし」として報告しない。
  const createdAt = doc.get("createdAt") as Timestamp | undefined;
  const reportMissing = createdAt ?
    targetDateKey >= jstDateKey(createdAt.toDate()) :
    true;

  const entries = await collectEntries(doc.ref, slots, targetDateKey, {
    reportMissing,
  });

  if (entries.length === 0) {
    return {householdId, sentTo: 0, entries: 0, skippedReason: "対象データなし"};
  }

  const attachments = await buildAttachments(entries);
  const subject = `${patientName ? `${patientName}さんの` : ""}おくすり記録（${friendlyDate(targetDateKey)}）`;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {user: FROM_EMAIL.value(), pass: GMAIL_APP_PASSWORD.value()},
  });

  // 送信先どうしにアドレスが見えないよう 1 通ずつ送る。
  for (const recipient of recipients) {
    await transporter.sendMail({
      to: recipient,
      from: {address: FROM_EMAIL.value(), name: FROM_NAME.value()},
      subject,
      text: buildTextBody(entries, patientName, targetDateKey),
      html: buildHtmlBody(entries, patientName, targetDateKey),
      attachments,
    });
  }

  if (options.markReported) {
    const firestore = getFirestore();
    const batch = firestore.batch();
    for (const entry of entries) {
      if (!entry.recordId) continue;
      batch.update(doc.ref.collection("records").doc(entry.recordId), {
        reportedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return {householdId, sentTo: recipients.length, entries: entries.length};
}

/** 毎朝 8 時（日本時間）に前日分の記録をメールで送る。 */
export const sendDailyReports = onSchedule(
  {
    region: REGION,
    schedule: "0 8 * * *",
    timeZone: TIME_ZONE,
    secrets: [GMAIL_APP_PASSWORD],
    retryCount: 3,
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const now = new Date();
    const households = await getFirestore().collection("households").get();
    logger.info("日次レポートを開始します", {households: households.size});

    for (const doc of households.docs) {
      try {
        const result = await sendReportForHousehold(doc, now);
        logger.info("日次レポート", result);
      } catch (error) {
        logger.error("日次レポートの送信に失敗しました", {
          householdId: doc.id,
          error,
        });
      }
    }
  }
);

/** 動作確認用。アプリから自分の分だけ即時送信する。 */
export const sendReportNow = onCall(
  {region: REGION, secrets: [GMAIL_APP_PASSWORD]},
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "サインインが必要です");
    }

    const doc = await getFirestore().collection("households").doc(uid).get();
    if (!doc.exists) {
      throw new HttpsError("not-found", "設定が見つかりません");
    }

    const markReported = request.data?.markReported !== false;
    return sendReportForHousehold(doc, new Date(), {markReported});
  }
);
