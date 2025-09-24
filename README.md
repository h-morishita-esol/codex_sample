# 部活動経費マネージャー

React を用いた部費管理用 PWA です。GitHub Pages へのデプロイを想定した純粋な静的サイト構成になっており、バックエンドを用意しなくても動作します。データはすべて `localStorage` に保存され、JSON 形式でのインポート / エクスポートに対応しています。

## 主な機能

- 部費一覧（表形式）と参加チェック（◯ / ✕ のトグル）
- 部員の追加 / 編集 / 削除ダイアログ
- 日付＆金額の追加 / 編集 / 削除ダイアログ（追加すると一覧に列が増えます）
- 参加済み日付の合計金額を自動計算
- JSON 形式でのバックアップと復元
- PWA 対応（オフラインキャッシュ、ホーム画面追加対応）

## 初期データ

- 部員：森下結衣（クラス 2-3）
- 日付：今日の日付で 1,000 円

## ローカル開発（HTTP サーバー）

1. 依存関係の確認
   - Node.js（推奨 18 以上）がインストールされていることを確認します。
2. 開発サーバーを起動
   ```powershell
   node dev-server.js
   ```
3. ブラウザでアクセス
   - `http://localhost:8123`
   - Service Worker は localhost であれば HTTP でも動作します。

## GitHub Pages へ公開する方法

1. GitHub に新しいリポジトリ（例：`club-expense-manager`）を作成し、ローカルリポジトリを初期化します。
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<USERNAME>/club-expense-manager.git
   git push -u origin main
   ```
2. GitHub のリポジトリ画面で **Settings → Pages** を開きます。
3. **Source** を「Deploy from a branch」に設定し、ブランチは `main`、フォルダーは `(root)` を選択して **Save** します。
4. 数十秒～数分でデプロイが完了します。公開 URL は `https://<USERNAME>.github.io/club-expense-manager/` のようになります。
5. 初回公開直後にキャッシュが古いまま表示される場合は、ブラウザでハードリロード（Windows: Ctrl+Shift+R / macOS: Cmd+Shift+R）を実行してください。
6. 以後の更新は `main` ブランチへ push するたびに自動で反映されます。Service Worker のキャッシュを強制更新したいときは `service-worker.js` 内の `CACHE_NAME` を変更してからデプロイしてください。

## PWA メモ

- `manifest.json` と `service-worker.js` によりアプリシェルをキャッシュします。
- React / ReactDOM / Babel の CDN 資産も Service Worker でキャッシュするため、初回アクセス後はオフラインで動作します。
- キャッシュのバージョンは `service-worker.js` の `CACHE_NAME` を更新することでリセットできます。

