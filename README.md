# おくすり記録（okusuri）

服薬したかどうかを 1 タップで記録し、翌朝 8 時にご家族へメールで届けるアプリです。iOS アプリと Web アプリがあり、メール送信はどちらも同じ Cloud Functions が行います。

- 事前画面で **送信先メールアドレス（上限 2 件）** と **薬を飲む時間帯（例: 毎日 朝・夜）** を登録
- ホーム画面には **最後の報告の次の枠**（前日夜まで報告済みなら「8/21 朝」）が出る
- 枠の中でカメラが起動し、その場で薬の写真を撮影
- 「飲んだ」「飲んでない」をタップすると記録が保存され、画面内に完了表示が出る
- 記録は毎朝 8 時（日本時間）に Cloud Functions からメール送信。飲んだ場合は写真も添付

配色は `#FDCCF9` のパステルピンクを基調に、淡いブルーをアクセントとして重ねています。定義は
`lib/theme/app_theme.dart` の `AppColors` に集約してあるので、色の調整はここだけで済みます。

## 動かす

```bash
flutter pub get
flutter run -d <iPhone の device id>
```

Firebase を設定していない状態でも起動できます。その場合は記録が端末内にのみ保存され、
ホーム画面に「送信サーバーに未接続です」と表示されます（接続後にまとめて送信されます）。

> カメラは実機のみ動作します。iOS シミュレータではカメラ枠に「カメラを起動できませんでした」と出ます。

## Web アプリ

ブラウザ版は `webapp/` です。記録の形、送信先（上限 2 件）、服薬時間帯、翌朝 8 時（日本時間）のメールは iOS 版と同じです。ブラウザを開いたままにする必要はありません。

```bash
cd webapp
npm install
npm run dev
```

公開するときは、関数やメール設定を巻き込まないよう Hosting だけデプロイします。

```bash
cd webapp && npm run build && cd ..
firebase deploy --only hosting
```

Web 版の匿名アカウントは iPhone アプリとは別です。同じ家族に届けるには、Web 版の設定にも同じ送信先を登録します。カメラが使えない環境では「アルバムから選ぶ」で写真を付けられます。

## Firebase / メール送信のセットアップ

メール送信はアプリではなくサーバー側で行います（iOS はアプリが閉じている間に処理を実行できないため）。

### 1. Firebase プロジェクトを用意する

```bash
npm install -g firebase-tools
dart pub global activate flutterfire_cli

firebase login
firebase use --add                # 作成した Firebase プロジェクトを選択
flutterfire configure             # ios/Runner/GoogleService-Info.plist などを生成
```

Firebase コンソールで以下を有効化します。

| 機能 | 設定 |
| --- | --- |
| Authentication | 「匿名」プロバイダを有効化 |
| Firestore | 本番モードで作成（リージョンは `asia-northeast1` 推奨） |
| Storage | 有効化 |
| Blaze プラン | スケジュール実行に必要 |

`flutterfire configure` が生成する `lib/firebase_options.dart` を
`lib/services/cloud_sync.dart` が読み込みます。生成前はビルドが通らないため、
このコマンドは最初に実行してください。

生成物（`lib/firebase_options.dart`、`ios/Runner/GoogleService-Info.plist`、
`android/app/google-services.json`、`.firebaserc`）はプロジェクト固有の値を含むため
`.gitignore` で除外しています。クローンした直後は上の 2 コマンドで作り直してください。

### 2. Gmail の準備

メールは送信元の Gmail アカウントから SMTP で直接送ります。外部の配信サービスを
経由しないため無料で、`gmail.com` を名乗る外部送信にならないので迷惑メール判定も
受けにくくなります。

1. 送信元にする Google アカウントで 2 段階認証を有効化
2. [アプリ パスワード](https://myaccount.google.com/apppasswords)を発行（16 桁）
3. パスワードを Secret Manager に登録する

```bash
firebase functions:secrets:set GMAIL_APP_PASSWORD
```

送信元アドレスは `functions/.env` で指定します（`functions/.env.example` をコピー）。
このアドレスは SMTP 認証のユーザー名も兼ねるため、アプリ パスワードを発行した
アカウント自身のアドレスである必要があります。

```bash
cp functions/.env.example functions/.env
```

### 3. ルールと関数をデプロイ

```bash
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,storage,functions
```

デプロイされる関数は 2 つです。

| 関数 | 役割 |
| --- | --- |
| `sendDailyReports` | 毎朝 8:00（Asia/Tokyo）に前日分の記録をメール送信 |
| `sendReportNow` | 動作確認用。呼び出した本人の分だけ即時送信する callable |

`sendReportNow` は `{"markReported": false}` を渡すと送信済みフラグを立てずに試せます。

## データ構造

```
households/{uid}
  recipientEmails: string[]   # 上限 2 件
  slots: ("morning"|"noon"|"evening")[]
  patientName: string
  timezone: "Asia/Tokyo"

households/{uid}/records/{YYYY-MM-DD#slot}
  date: "2026-08-21"
  slot: "evening"
  taken: bool                 # true=飲んだ / false=飲んでない
  photoUrl: string|null
  photoStoragePath: string|null
  recordedAt: timestamp
  reportedAt: timestamp|null   # null なら未送信

Storage: households/{uid}/photos/{YYYY-MM-DD#slot}.jpg
```

前日分で記録が無かった枠は、メール上で「記録なし」として報告されます。
あとから記録した遅れ分は、次の朝の便に含まれます。

## 構成

```
lib/
  main.dart                    アプリ起動と初回設定/ホームの振り分け
  app_scope.dart               AppController の共有（InheritedNotifier）
  models/                      設定・記録・服薬枠
  services/
    app_controller.dart        画面から使う状態のまとめ役
    dose_schedule.dart         「次に報告する枠」の計算（テスト対象）
    local_store.dart           端末内保存（設定・記録・写真）
    cloud_sync.dart            Firestore / Storage への同期
  screens/                     事前設定・ホーム・履歴
  widgets/                     カメラ枠と共通パーツ
functions/src/index.ts         毎朝 8 時のメール送信
webapp/                        ブラウザ版（同じ Firebase に記録する）
```

## テスト

```bash
flutter test          # 報告枠のロジック
flutter analyze
cd functions && npx tsc --noEmit
```
# okusuri
