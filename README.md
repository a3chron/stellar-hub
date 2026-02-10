# stellar-hub
Web hub for stellar

> [!NOTE] 
> Check out [stellar-cli](https://github.com/a3chron/stellar) for info about stellar.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) with your browser to see the result.

---

For nixOS users, biome linting & formating (pnpm format / lint) wont work, please run:
```bash
# format
nix shell nixpkgs#biome --command biome format . --write

# lint:check
nix shell nixpkgs#biome --command biome check

# lint (& format)
nix shell nixpkgs#biome --command biome check --write .
```


## TODOs

Very big todo: clean up API

- Search functionality
- Color scheme filtering
- Github workflow upload new theme version

<br />
<p align="center"><a href="https://github.com/a3chron/stellar-hub/blob/main/LICENSE"><img alt="GitHub License" src="https://img.shields.io/github/license/a3chron/stellar-hub?style=for-the-badge&labelColor=363a4f&color=b7bdf8">
</a></p>