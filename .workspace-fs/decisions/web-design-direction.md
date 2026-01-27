# Web Design Direction

## Summary

Ultrahopeのウェブデザインは、**暖かみのあるダークトーン**と**Satoshiフォント**を基調とし、「灯り」のような静かな存在感を持つ。王道のレイアウトを踏襲しつつ、細部の空気感で個性を出す。

---

## 思考の軌跡

### 1. 最初の問い：「どんなデザインが良いか」

開発者ツールのデザインといえば、まず思い浮かぶのは：

- ダーク基調
- ターミナル感
- シアン/グリーンのアクセント
- Vercel、Linear、Raycast のようなクリーンでミニマルな方向

これは「王道」であり、悪くはない。しかし **みんなそれをやっている**。2020年代の開発者ツールはこの美学がコモディティ化した。

### 2. Alternative を探る

差別化の方向として検討したもの：

| 方向性 | 特徴 | 懸念 |
|--------|------|------|
| ライト + 紙/インク感 | クリーム背景、活版印刷的 | 開発者ツールとして異質すぎるか |
| ブルータリズム / ローファイ | ラフ、ボーダー太め、システムフォント | やりすぎると「いかにも」 |
| グラデーション + 有機的形状 | Chroma/Amp的、メッシュ、ぼかし | これも増えてきた |
| レトロテック / CRT感 | スキャンライン、グリッチ | ノスタルジーに寄りすぎ |

**結論**：どれかに振り切ると「いかにも」になる。基本は王道で、空気感で差別化する。

### 3. 参考にしたいプロダクト

Cursor、Zed、Windsurf を挙げた。

これらの共通点：
- ダーク基調
- 次世代AIツール感
- 高コントラスト
- どこか温かみがある

しかし「発光」ではない。LED的なギラギラではなく、**灯り**。

### 4. 「発光」ではなく「灯り」

この区別が重要だった。

| 発光 | 灯り |
|------|------|
| LED、ネオン | 間接照明、ランプ |
| デジタル、派手 | アナログ、落ち着き |
| エネルギッシュ | 静か、人間味 |
| 冷たい光 | 暖かい光 |

Ultrahopeは「夜、手元のランプで作業している」ような空気感を目指す。

### 5. アクセントカラーを持たない

多くのプロダクトはブランドカラーを持つ（Cursorのオレンジ、Linearのパープルなど）。

Ultrahopeは**アクセントカラーを固定しない**：
- コンテキストに応じて色が変わる（エラーは赤、成功は緑など機能的な色のみ）
- 「色で覚えてもらう」ではなく「空気感で覚えてもらう」
- グレートーンが基本、ただし暖色寄り

これは珍しいアプローチだが、UNIXツールの「余計なものを持たない」思想とも合致する。

### 6. タイポグラフィのリズム

Tailwindのデフォルトスケールは見やすいが凡庸。Cursor、Amp、Chromaを参考に：

- 見出しと本文のコントラストが大胆
- 見出しに存在感（ウェイト太め、サイズ大きめ）
- 本文は抑えめ
- letter-spacing をタイトに（特に見出し）
- line-height も詰める（見出しは1.1-1.2）

### 7. フォント選定：Satoshi

最終的に **Satoshi**（Indian Type Foundry）を選択。

選定理由：
- **Grotesk + Geometric のハイブリッド** — 丸みとシャープさが共存
- **Industrial Era / Modernism にインスパイア** — 時代を感じさせつつモダン
- **Inter/Geist ほど使われていない** — 差別化になる
- **無料**（Fontshare / ITF Free Font License）
- **名前が「Satoshi」** — 象徴的

---

## Design Principles

### 1. 灯り、発光ではなく

明るさは「照らす」のではなく「灯る」。攻撃的な光ではなく、そこにいると落ち着く光。

### 2. 王道の上に空気を乗せる

レイアウトや構造は奇をてらわない。差別化は色味、余白、タイポグラフィの微細なニュアンスで行う。

### 3. 色で主張しない

固定のブランドカラーを持たない。グレートーンを基調に、機能的な色だけを使う。

### 4. 急いでいない

余白を贅沢に。トランジションをほんの少しゆっくりに。「待たせる」のではなく「急かさない」。

---

## Specifications

### Color Palette

```
Background (dark):    #1a1814  /* 純黒ではなく、暖かみのある暗さ */
Background (darker):  #0f0d0a
Surface:              #252119
Text (primary):       #e8e4dc  /* 真っ白ではなく、ウォームグレー */
Text (secondary):     #9a9590
Text (muted):         #6b6560
Border:               #3a352e
```

アクセントカラーは定義しない。必要に応じてコンテキストで決める。

### Typography

**Font Family:**
- Sans: `Satoshi, system-ui, sans-serif`
- Mono: `JetBrains Mono, ui-monospace, monospace`

**Scale (参考値):**
```
text-xs:   12px / 1.5
text-sm:   14px / 1.5
text-base: 16px / 1.6
text-lg:   18px / 1.5
text-xl:   20px / 1.4
text-2xl:  24px / 1.3
text-3xl:  32px / 1.2
text-4xl:  40px / 1.1
text-5xl:  48px / 1.1
text-6xl:  64px / 1.05
```

**Letter Spacing:**
- 見出し（2xl以上）: `-0.02em` 〜 `-0.04em`
- 本文: `0` または `0.01em`

**Font Weight:**
- 見出し: `700`（Bold）または `900`（Black）
- 本文: `400`（Regular）または `500`（Medium）

### Spacing

余白は一般的なUIより少し広めに取る。呼吸を感じさせる。

### Transitions

```css
transition-duration: 200ms;  /* 一般的な150msより少しゆっくり */
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
```

### Texture (optional)

背景にうっすらノイズ/グレインを入れることを検討。1-2%の透明度で、フィルム感を出す。

---

## References

### Products with similar taste
- [Cursor](https://cursor.com) — 暖かみのあるダーク、カスタムタイポグラフィ
- [Amp](https://ampcode.com) — クリーンでありながら個性がある
- [Chroma](https://trychroma.com) — 記号的なアクセント、大胆な見出し
- [Zed](https://zed.dev) — シャープで高コントラスト
- [Windsurf](https://codeium.com/windsurf) — モダンだがエッジィ

### Typography
- [Cursor Gothic](https://the-brandidentity.com/project/how-kimera-built-cursors-identity-around-a-custom-typeface-system) — Cursorのカスタムフォント、Waldenburgベース。「Akzidenz-Groteskの合理性とUniversのアナログ感」を両立。暖色寄りのパレットと合わせている。
- [Satoshi](https://www.fontshare.com/fonts/satoshi) — Indian Type Foundry。Grotesk + Geometric のハイブリッド。

---

## Open Questions

- [ ] 実際にカラーパレットを適用してみて、暖色の度合いを調整する
- [ ] ノイズ/グレインテクスチャを入れるかどうか
- [ ] コードブロックのスタイリング（灯り感をどう表現するか）
- [ ] ダークモードのみか、ライトモードも用意するか

---

## Changelog

- 2026-01-27: 初版作成。デザイン方向性の議論をドキュメント化。
