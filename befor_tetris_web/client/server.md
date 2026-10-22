UbuntuサーバーにWebアプリを公開するための、標準的で安定した構成（**Nginx + Node.js + PM2**）の手順

---

### ステップ1: クライアント（フロントエンド）のビルド
まず、現在作業しているパソコン（ローカル）で、ブラウザ用のファイルを生成します。
`client` ディレクトリで以下のコマンドを実行してください。
```powershell
cd C:\Users\hosshi\Desktop\useful_tools\tetris_web\client
npm run build
```
これにより、`client/dist` というフォルダが生成されます。この中身が、実際にWebブラウザに配信されるファイル群になります。

### ステップ2: サーバーへのファイル転送
作成したファイルとバックエンドのプログラムをUbuntuサーバーへ転送します。
（FTPソフトや `scp` コマンド等を使ってください）

サーバー側には以下のような構成でファイルを配置します。
```text
/var/www/tetris_web/
  ├── client/
  │    └── dist/       <-- さきほどビルドしたdistフォルダの中身
  └── server/          <-- serverフォルダの中身 (index.js, package.json等)
```
※ `/var/www/tetris_web` というフォルダを作る前提で進めます。

### ステップ3: Ubuntuサーバーの環境構築
UbuntuサーバーにSSHで接続し、必要なソフトウェア（Node.js と Nginx）をインストールします。

**1. Node.jsとnpmのインストール**
```bash
# Node.js公式リポジトリを追加 (バージョン20系の場合)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**2. バックエンドサーバー（Socket.IO）のセットアップと永続化**
転送した `server` フォルダへ移動し、パッケージをインストールします。
```bash
cd /var/www/tetris_web/server
npm install
```
サーバーがダウンしても自動で再起動するように「**PM2**」というツールを使います。
```bash
sudo npm install -g pm2
pm2 start index.js --name "tetris-server"
# サーバー再起動時にもPM2が自動起動するように設定
pm2 startup
pm2 save
```

**3. Nginxのインストールと設定**
Nginxを使って、静的ファイル（ゲーム画面）の配信と、Socket.IO（バックエンド通信）のルーティングを行います。
```bash
sudo apt-get install -y nginx
```

Nginxの設定ファイルを作成します。
```bash
sudo nano /etc/nginx/sites-available/tetris
```
以下の内容を貼り付けて保存します（`your_domain_or_ip` の部分は、実際のドメイン名かUbuntuサーバーのIPアドレスに書き換えてください）。

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    # フロントエンド（Reactアプリ）の配信
    location / {
        root /var/www/tetris_web/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Socket.IOの通信をバックエンド(ポート3001)へ転送
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

設定を有効化して、Nginxを再起動します。
```bash
sudo ln -s /etc/nginx/sites-available/tetris /etc/nginx/sites-enabled/
# デフォルトの設定を無効化（必要に応じて）
sudo rm /etc/nginx/sites-enabled/default
# 文法チェック
sudo nginx -t
# Nginxを再起動
sudo systemctl restart nginx
```

### 完了！
これで、ブラウザから `http://サーバーのIPアドレス/` または設定したドメインにアクセスすれば、Web版テトリスが遊べるようになります。オンライン対戦もサーバーを経由して実行されます。

もしファイアウォール（UFWなど）を有効にしている場合は、HTTP（80番ポート）の通信を許可するのをお忘れなく（`sudo ufw allow 'Nginx Full'` 等）。手順の途中で分からない部分があれば、詳しく解説しますのでお知らせください！