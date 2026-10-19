// Gmail のアプリ パスワードが SMTP で通るかだけを確かめる。
// デプロイし直さずに認証情報を検証できる。
//   node scripts/verify-gmail.mjs
import {createInterface} from "node:readline";
import nodemailer from "nodemailer";

const USER = process.env.REPORT_FROM_EMAIL ?? "sachikosagagogogo@gmail.com";

/** 入力を画面に出さずに 1 行読む。 */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({input: process.stdin, output: process.stdout});
    const onData = (char) => {
      // Enter / Ctrl-C 以外は表示を潰す。
      if (!["\n", "\r", "\u0004", "\u0003"].includes(char.toString("utf8"))) {
        process.stdout.write("\u001b[2K\u001b[200D" + question);
      }
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const raw = await askHidden(`${USER} のアプリ パスワードを貼り付けてください: `);
const pass = raw.replace(/\s/g, "");

if (pass.length !== 16) {
  console.log(`⚠ 空白を除くと ${pass.length} 文字でした。アプリ パスワードは 16 文字です。`);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {user: USER, pass},
});

try {
  await transporter.verify();
  console.log("✔ 認証に成功しました。このパスワードで登録して問題ありません。");
} catch (error) {
  console.log("✖ 認証に失敗しました。");
  console.log(`   ${error.message.split("\n")[0]}`);
  process.exitCode = 1;
}
