# similarity

To install dependencies:

```bash
bun install
```

---

### Usage

Setup `.env` file

```bash
cp .env.example .env
```

Run database within Docker:

```bash
docker compose up -d
```

Run db migrations:

```bash
bun drizzle-kit migrate
```

Push db schema:

```bash
bun drizzle-kit push
```

Seed database (using data from `./src/docs/docs.json`)

```bash
bun run seed.ts
```

Now provide some input when running similarity search:

```bash
bun run index.ts explain quntum computing
```

If input is related to the data in db you should see queried docs in the output.
