# Web版テトリス 完成・起動手順

実装が完了しました！
クライアント（ゲーム本体）とサーバー（通信仲介）の両方を立ち上げることで、1人プレイ・2人プレイがお楽しみいただけます。

## 変更内容の概要
1. **クライアント側の実装**
   - Python版のロジック（`config.py`, `tetris.py`）を忠実にJavaScript（`config.js`, `Tetris.js`）へ移植しました。
   - SRS回転、T-Spin判定、REN（コンボ）、ホールド機能などが動作します。
   - レンダリングにはHTML5 CanvasとプレーンなCSSを利用し、ネオン風のダークテーマでリッチなUIに仕上げています。
   - ご提示いただいた月と星のアイコンをSVGで再現してロゴに使用しています。
   - すべての重い演算処理（盤面更新、スコア計算、ブロック回転等）はクライアント側で実行されます。
2. **サーバー側の実装**
   - Node.js + Socket.IOを使用し、ルームコードを利用した軽量なマッチングサーバーを実装しました。
   - 対戦相手の盤面の同期と、複数ライン消去時のお邪魔ブロック送信を処理します。

## 起動方法

VS Code等のターミナルを**2つ**開いて、以下のコマンドをそれぞれ実行してください。

### 1. サーバーの起動 (ターミナル 1)
```powershell
cd path/to/useful_tools/tetris_web/server
npm start
# ※ または node index.js
```
サーバーが起動すると「`Server is running on port 3001`」と表示されます。

### 2. クライアントの起動 (ターミナル 2)
```powershell
cd path/to/useful_tools/tetris_web/client
npm run dev
```
起動後、ターミナルに表示されるローカルURL（例: `http://localhost:5173`）をブラウザで開いてください。

Analyzed server.md:L1-103

CUIのみのサーバー（Ubuntu等のLinuxサーバー）でオンライン公開・稼働させる手順をご案内します。
（プロジェクト内の [`server.md`](file:///C:/Users/tossh/Desktop/ai_obj/useful_tools/tetris_web/client/server.md) と [`youtete.md`](file:///C:/Users/tossh/Desktop/ai_obj/useful_tools/tetris_web/youtete.md) の構成に準拠した **Nginx + Node.js (ポート3005) + PM2** の手順です）

---

### ステップ1: 手元のWindowsパソコンで本番用ファイルをビルドする

CUIサーバー側でビルドするよりも、今動いているWindowsパソコンで本番用ファイル（`dist` フォルダ）を作って転送するのが最も確実です。

Windowsのターミナルで以下を実行してください。

```powershell
cd c:\Users\tossh\Desktop\ai_obj\useful_tools\tetris_web\client
npm run build
```

これで `client/dist` フォルダの中に配信用のHTML/CSS/JS一式が生成されます。

---

### ステップ2: CUIサーバーへファイルを転送する

WindowsのPowerShellから `scp` コマンド（またはWinSCP等）を使って、CUIサーバーの `/var/www/tetris_web` にファイルを送ります。

#### ① すでに以前CUIサーバーで動かしていて、今回の修正だけ反映したい場合
今回は [`server/index.js`](file:///C:/Users/tossh/Desktop/ai_obj/useful_tools/tetris_web/server/index.js) は変更していないため、**`client/dist` の中身を上書き転送するだけ**で反映されます（サーバーの再起動も不要です）。

```powershell
# WindowsのPowerShellで実行（ユーザー名とサーバーIPは環境に合わせて変更してください）
scp -r c:\Users\tossh\Desktop\ai_obj\useful_tools\tetris_web\client\dist\* ユーザー名@サーバーのIP:/var/www/tetris_web/client/dist/
```

#### ② ゼロから新しいCUIサーバーに配置する場合
1. CUIサーバー側でフォルダを作成します：
   ```bash
   sudo mkdir -p /var/www/tetris_web/client/dist /var/www/tetris_web/server
   sudo chown -R $USER:$USER /var/www/tetris_web
   ```
2. Windows側から `dist` と `server` を転送します：
   ```powershell
   scp -r c:\Users\tossh\Desktop\ai_obj\useful_tools\tetris_web\client\dist\* ユーザー名@サーバーのIP:/var/www/tetris_web/client/dist/
   scp c:\Users\tossh\Desktop\ai_obj\useful_tools\tetris_web\server\index.js c:\Users\tossh\Desktop\ai_obj\useful_tools\tetris_web\server\package.json ユーザー名@サーバーのIP:/var/www/tetris_web/server/
   ```

---

### ステップ3: CUIサーバー側でバックエンド（Socket.IO）とNginxを起動する

（※すでに一度構築済みのサーバーであれば、このステップは不要です。新規構築または再起動する場合のみCUIサーバーで実行してください）

#### 1. バックエンドサーバー（ポート3005）の起動・常駐化
```bash
cd /var/www/tetris_web/server
npm install

# PM2でバックグラウンド常駐起動（ポート3005番）
sudo npm install -g pm2
pm2 delete tetris-server 2>/dev/null || true
PORT=3005 pm2 start index.js --name "tetris-server"
pm2 save
pm2 startup
```

#### 2. Nginxの設定（フロントエンド配信 ＋ ポート3005への通信転送）
`/etc/nginx/sites-available/tetris` を作成・編集します：

```bash
sudo nano /etc/nginx/sites-available/tetris
```

中身を以下のようにします（`server_name` はサーバーのIPアドレスまたはドメイン名、もしくは `_` のままで動作します）：

```nginx
server {
    listen 80;
    server_name _;

    # フロントエンド（ビルドしたdistフォルダ）の配信
    location / {
        root /var/www/tetris_web/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Socket.IO（オンライン対戦通信）をポート3005へ転送
    location /socket.io/ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

設定を有効化してNginxを再起動します：
```bash
sudo ln -sf /etc/nginx/sites-available/tetris /etc/nginx/sites-enabled/tetris
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

これで `http://サーバーのIPアドレス/` にブラウザからアクセスすると、最新のサイバーUI版テトリスでオンライン2人対戦が可能になります！
まず手元のパソコンで `npm run build` を実行しておきましょうか？




---

## 遊び方

> [!TIP]
> 操作方法:
> - **矢印キー (← →)**: 左右移動
> - **矢印キー (↓)**: ソフトドロップ
> - **矢印キー (↑)**: 右回転
> - **Zキー**: 左回転
> - **スペースキー**: ハードドロップ
> - **Cキー / Shiftキー**: ホールド

### 1人プレイ
タイトル画面で「1 Player」を選択すると、すぐにゲームが開始されます。

### 2人プレイ（オンライン対戦）
1. 2つのブラウザウィンドウでゲームを開きます。
2. 両方で「2 Players (Online)」を選択します。
3. 任意の**同じルームコード**（例: `1234`）を入力してJoinボタンを押します。
4. 2人目がルームに入った瞬間に、自動で両者のゲームが開始されます。
5. 2ライン以上同時に消すか、REN（コンボ）をつなぐと、相手にお邪魔ブロックが送られます！
