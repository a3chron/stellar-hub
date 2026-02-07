# stellar-hub
Web hub for stellar

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

### 1. Create remaining pages:

Theme detail page (app/[author]/[slug]/page.tsx)
Upload form page (app/upload/page.tsx)
Homepage with trending themes


### 2. Add features:

Search functionality
Color scheme filtering
Theme groups display
Edit theme (for owners)
Delete theme (for owners)


### 3. CLI Integration:

Point CLI to your deployed API
Test full download flow


### 4. Deploy:

Vercel for Next.js
Update BETTER_AUTH_URL to production URL
Update GitHub OAuth callback URL