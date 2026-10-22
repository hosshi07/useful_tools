**ポート3005番** に変更する手順をご案内します。

（※手元のWindowsにあるソースコードの方も、念のため3001から3005に変更しておきました）

現在Ubuntuサーバーで発生しているエラーを無視して、以下の手順で「別のポートで起動」し、「Nginxの通信先もそちらに変更」すれば、問題なく遊べるようになります。

### 1. PM2でポート3005を指定して起動する
Ubuntuのターミナルで以下のコマンドを実行してください。
（すでに `errored` になっているプロセスを消して、ポートを指定して新しく起動します）

```bash
cd /var/www/tetris_web/server

# 古いプロセスを消す
pm2 delete tetris-server

# ポート3005を指定して起動する
PORT=3005 pm2 start index.js --name "tetris-server"

# ステータス確認（onlineになればOK！）
pm2 status
```

### 2. Nginxの設定を変更する
次に、Nginxがアクセスを流す先（リバースプロキシ）を3005番に変更します。

```bash
sudo nano /etc/nginx/sites-available/tetris
```
ファイルを開き、真ん中あたりにある `proxy_pass` の行を以下のように書き換えてください。

【変更前】
`proxy_pass http://localhost:3001;`
↓
【変更後】
`proxy_pass http://localhost:3005;`

保存して閉じたら、Nginxを再起動します。
```bash
sudo systemctl restart nginx
```

これだけで完了です！
クライアント側（フロントエンド）はNginx経由で自動的に新しいポートに繋がるため、ブラウザ側での特別な変更や再ビルドは必要ありません。ブラウザをリロードして、2人プレイでJoinボタンを押してみてください！