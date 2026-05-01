<p align="center"><code>npm i -g @ultrahope/halo</code></p>
<p align="center">Your diff becomes commit message candidates — right in the terminal.<br />Pick one, tweak it, or escalate to a stronger model. You have the final word.</p>
<p align="center">
  <img src=".github/demo.gif" alt="Halo demo" />
</p>

---

## Quickstart

```shell
npm install -g @ultrahope/halo
```

```shell
git add -p
git halo commit
```

Works immediately — no account needed. Free tier includes 5 requests per day; [unlimited plans](https://ultrahope.dev/pricing) are available.

For Jujutsu, run `halo jj setup`, then `jj halo describe`.

Compatibility commands are still supported during migration:
`ultrahope`, `git ultrahope`, `git hope`, and `git uh`.

## Docs

- [**Documentation**](https://ultrahope.dev/docs)
- [**Pricing**](https://ultrahope.dev/pricing)

## License

`packages/web` is [AGPL-3.0](packages/web/LICENSE), everything else is [MIT](LICENSE).
