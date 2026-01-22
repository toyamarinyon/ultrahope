# Core Package Architecture

## Decision: packages/core で LLM ロジックを分離

**packages/core** に純粋な LLM 抽象化レイヤーを切り出し、web と cli から共有する。

## 構成

```
packages/
  core/                        # 純粋なLLMロジック (認証・課金なし)
    src/
      types.ts                 # LLMProvider, LLMResponse, Target
      prompts.ts               # PROMPTS定義
      providers/
        cerebras.ts            # Cerebras実装
      index.ts                 # translate() — 純粋なLLM呼び出しのみ
    package.json               # name: @ultrahope/core (private)
  web/                         # 認証 + 課金 + API
    src/lib/llm/
      index.ts                 # core.translate() + recordTokenConsumption()
  cli/                         # ユーザー向けCLI
    src/
      commands/translate.ts    # web API経由 or core直接呼び出し
```

## 依存関係

```
web → core  (translate + billing wrapper)
cli → core  (認証不要のローカルテスト用)
cli → web   (認証が必要な本番API経由)
```

## メリット

1. **関心の分離**: core=純粋LLM, web=認証+課金+API, cli=ユーザー向け
2. **テスト容易**: core単体の関数としてテストできる
3. **依存方向が明確**: web/cli が core を使う一方向

## 実装

1. `packages/core/` 作成
2. `packages/web/src/lib/llm/` から types, prompts, providers を移動
3. `packages/web/src/lib/llm/index.ts` は core を import + billing wrapper
4. `packages/web/src/lib/llm/cli.ts` を `packages/core/` に移動
