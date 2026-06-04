# Sky シャード予報カレンダー — 設計ドキュメント

作成日: 2026-06-05

---

## 概要

Sky: Children of the Light のシャード噴出を予報するWebアプリ。
月間カレンダー形式のダッシュボードで、今後の予定と詳細情報を日本語で確認できる。
身内のSkyプレイヤー向けにDiscordでURLを共有して使う。

---

## 技術スタック

| 項目 | 決定内容 |
|---|---|
| 言語 | HTML + CSS + JavaScript（フレームワークなし） |
| 外部ライブラリ | luxon（CDN）— タイムゾーン計算のみ |
| ホスティング | GitHub Pages（将来 Cloudflare Pages へ移行可） |
| ビルドステップ | なし（静的ファイルをそのままデプロイ） |
| 言語（UI） | 日本語のみ |

---

## ファイル構成

```
sky-shards/
├── index.html     HTMLの骨格（セクション構造のみ、コンテンツはapp.jsが生成）
├── style.css      Apple風デザイン（色・フォント・アニメーション）
├── shard.js       シャード予測ロジック（純粋関数、副作用なし）
└── app.js         UI描画・カレンダー制御・ボトムシート
```

---

## シャード予測ロジック（shard.js）

参照実装: https://github.com/PlutoyDev/sky-shards

### 基礎知識

- シャードは**赤（Red）**と**黒（Black）**の2種類
- 1日最大3回噴出（時刻はオフセット+間隔で決まる）
- 全計算の基準は **Sky時刻（America/Los_Angeles / Pacific Time）**
  - 夏時間（DST）によって日本時間が16時基準・17時基準と変わるため、Sky時刻を基準に計算してからローカル時刻に変換する
- 出現場所は「領域（Realm）× 噴出時刻」で一意に決まる
- 特定の曜日の組み合わせは「No Shard Day」（シャードなし）

### 5つの領域

Prairie / Forest / Valley / Wasteland / Vault

### 関数の使い方

```js
getShardInfo(skyDate)
// → { type: 'red' | 'black' | 'none', occurrences: Occurrence[] }

// Occurrence:
// {
//   startSky: DateTime,   // Sky時刻（luxon）
//   landSky: DateTime,    // 着地時刻（開始+8分40秒）
//   endSky: DateTime,
//   realm: string,
//   location: string,     // 英語（ゲーム内表記に準拠）
// }

getLocalOccurrences(skyDate, timezone)
// → Occurrence[] ただしstart/land/endがブラウザのローカル時刻に変換済み

isNoShardDay(skyDate, type)
// → boolean
```

---

## UIコンポーネント

### 1. 次のシャードカード（ページ上部）

ページ読み込み時に最も直近の噴出を計算して表示。

表示内容:
- シャード種別（赤 / 黒）
- 噴出開始時刻（ローカル時刻）
- 領域名・場所名
- 本日の噴出回数（例: 本日あと2回）

### 2. 月間カレンダー

- 7列グリッド（日〜土）
- 前月・翌月ナビゲーション（← →ボタン）
- 今日の日付をハイライト
- 各セルに色インジケーター
  - 赤シャード: 赤いドット / 上部ボーダー
  - 黒シャード: グレードット / 上部ボーダー
  - シャードなし: 淡色表示

### 3. ボトムシート（詳細）

日付セルをタップ・クリックすると下からスライドアップ。

表示内容:
- 日付・曜日
- シャード種別バッジ
- 各噴出のカード（ローカル時刻 / 領域 / 場所名）
- シャードなしの日は「この日はシャードなし」

閉じ方:
- シート外タップ
- 下方向スワイプ（モバイル）
- ✕ボタン

---

## デザイン方針

Apple Human Interface Guidelines に準拠したシンプル・スタイリッシュなデザイン。

### カラー

| 用途 | 値 |
|---|---|
| 背景 | `#ffffff` |
| セカンダリ背景 | `#f5f5f7` |
| 赤シャード | `#ff3b30` |
| 黒シャード | `#636366` |
| 今日ハイライト | `#1d1d1f`（黒塗り） |
| アクセント（選択） | `#0071e3` |
| テキスト | `#1d1d1f` |
| サブテキスト | `#86868b` |

### フォント

```css
font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
```

### アニメーション

- ボトムシート: `transform: translateY` + `transition: 0.3s cubic-bezier(0.32, 0.72, 0, 1)`
- カレンダーセルホバー: `background` フェード

---

## データフロー

```
ページ読み込み
  → luxon で現在のSky日付を取得
  → getShardInfo() で当月の全日分を計算
  → カレンダーグリッドを描画
  → 次のシャードカードを更新

日付セルをタップ
  → getLocalOccurrences(date) を呼び出し
  → ボトムシートにデータをセットしてスライドアップ
```

---

## デプロイ

GitHub Pages の設定:
- `Settings → Pages → Source: main branch / root`
- `index.html` がルートにある前提

将来 Cloudflare Pages へ移行する場合も、ファイルをそのまま使用可能（ビルドステップなし）。
