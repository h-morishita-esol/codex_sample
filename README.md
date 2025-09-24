# 部活動経費マネージャー

React を使って部活動の経費精算を管理する PWA です。GitHub Pages へのデプロイを念頭に、完全にクライアントサイドで動作します。データは端末の `localStorage` に保存され、JSON ファイルでのインポート / エクスポートにも対応しています。

## 主な機能

- メンバー一覧の表示と欠席／出席トグル（ドラッグ＆ドロップで並べ替え可能）
- メンバーの追加 / 編集 / 削除ダイアログ
- 日付別の徴収額の追加 / 編集 / 削除ダイアログ（追加すると自動的に一覧へ反映）
- 出席状況に基づく個人別合計と全体合計の算出
- JSON 形式でのバックアップと復元
- PWA 対応（オフラインキャッシュ、ホーム画面追加など）
- 画面最上部からのプルダウンでの更新（Service Worker の更新確認を含む）

## 初期データ

- メンバー: 華道花子（クラス 2-3）
- 徴収日: 今日の日付で 1,000 円

## 使い方のヒント

- 行の左端をドラッグするとメンバーを並べ替えできます。
- バックアップ欄のボタンで JSON をダウンロード／読み込みできます。
- タッチデバイスでは、画面一番上で下方向に引っ張るとプルダウン更新が始まります。閾値を超えるとメッセージが変わり、離すと最新キャッシュを取得したうえでページを再読み込みします。

## ローカル開発（HTTP サーバー）

1. 事前確認
   - Node.js（推奨 18 以上）がインストールされていることを確認してください。
2. 開発サーバーの起動
   ```powershell
   node dev-server.js
   ```
3. ブラウザーでアクセス
   - `http://localhost:8123`
   - Service Worker は localhost でも HTTP で動作します。

## GitHub Pages へのデプロイ

1. GitHub に新しいリポジトリ（例: `club-expense-manager`）を作成し、ローカルリポジトリを初期化して push します。
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<USERNAME>/club-expense-manager.git
   git push -u origin main
   ```
2. GitHub リポジトリの **Settings → Pages** を開きます。
3. **Source** を「Deploy from a branch」、ブランチを `main`、フォルダーを `(root)` に設定して **Save** します。
4. 数分後に公開されます。URL は `https://<USERNAME>.github.io/club-expense-manager/` になります。
5. ブラウザーで強制再読み込み（Windows: Ctrl+Shift+R / macOS: Cmd+Shift+R）を行い、最新キャッシュを取得してください。
6. その後の更新では、`main` ブランチへ push した際に `service-worker.js` の `CACHE_NAME` を更新してキャッシュをリセットしてください。

## PWA に関するメモ

- `manifest.json` と `service-worker.js` により PWA 機能を提供しています。
- React / ReactDOM / Babel は CDN から取得し、Service Worker でキャッシュしています。
- キャッシュバージョンの切り替えは `service-worker.js` の `CACHE_NAME` を変更することで行えます。
- プルダウン更新は Service Worker の `registration.update()` を呼び出したのちページを再読み込みします。オフライン時は直前のキャッシュが利用されます。
