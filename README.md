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

- Search functionality
- Color scheme filtering
- Theme groups display
- Edit theme (for owners)
- Delete theme (for owners)
- Github workflow upload new theme version
