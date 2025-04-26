# Similarity

This project provides a command-line interface (CLI) built with Bun and TypeScript to interact with PDF documents. It allows you to:

1.  **Load PDF files:** Extracts text content per page from PDF files.
2.  **Generate Embeddings:** Creates vector embeddings for each page's content using the OpenAI API (e.g., `text-embedding-ada-002`).
3.  **Store Data:** Saves file information, text chunks (pages), and their embeddings into a PostgreSQL database configured with the `pgvector` extension.
4.  **Semantic Search:** Finds text chunks in the database that are semantically similar to a given query using cosine similarity.
5.  **Ask Questions (RAG):** Uses the results of the semantic search as context to ask questions to an OpenAI model (e.g., `gpt-4.1-nano`), effectively implementing a basic Retrieval-Augmented Generation (RAG) system.

## Features

- PDF text extraction (page by page).
- Text embedding generation via OpenAI.
- Storage in PostgreSQL with `pgvector` for efficient similarity search.
- CLI for loading files, searching content, and asking context-aware questions.
- Configurable similarity threshold and result limits.
- Optional saving of Q&A results to Markdown files.

## Prerequisites

- [Bun](https://bun.sh/) (JavaScript/TypeScript runtime)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) (for running the PostgreSQL database)
- Access to OpenAI API (requires an API key)

## Setup

1.  **Clone the Repository (if applicable):**

2.  **Install Dependencies:**

    ```bash
    bun install
    ```

3.  **Set up Environment Variables:**
    Copy the example environment file and fill in your details:

    ```bash
    cp .env.example .env
    ```

    Edit `.env` and add your PostgreSQL connection string and OpenAI API key:

    ```dotenv
    # .env
    DATABASE_URL=postgresql://user:password@localhost:5432/similarity-db
    OPENAI_API_KEY=sk-your-openai-api-key-here
    ```

    - Ensure the `DATABASE_URL` matches the credentials in `docker-compose.yml`.

4.  **Start the Database:**
    Use Docker Compose to start the PostgreSQL database service with the `pgvector` extension enabled.

    ```bash
    docker compose up -d
    ```

    This command will pull the `ankane/pgvector` image if you don't have it locally and start the database container in the background. The data will be persisted in a `./data` volume.

5.  **Setup the Database:**
    Apply the necessary migrations to set up the database schema:

    ```bash
    bun drizzle-kit migrate
    ```

    Push schema to the database:

    ```bash
    bun drizzle-kit push
    ```

## Usage

The CLI is run using `bun run cli.ts`.

```bash
bun run cli.ts <command> [options]
```

### Available Commands

You can see all available commands and their descriptions by running:

```bash
bun run cli.ts --help
# or
bun run cli.ts -h
```

#### 1. `loadfile`

Loads a PDF file, extracts text page by page, generates embeddings for each page, and saves everything to the database.

**Usage:**

```bash
bun run cli.ts loadfile <path-to-pdf> [options]
```

**Arguments:**

- `<path-to-pdf>`: (Required) The path to the PDF file you want to ingest.

**Options:**

- `-h, --help`: Show help for the `loadfile` command.

**Example:**

```bash
bun run cli.ts loadfile ./documents/my_research_paper.pdf
```

#### 2. `search`

Searches the database for text chunks (pages) that are semantically similar to the provided query text.

**Usage:**

```bash
bun run cli.ts search <query> [options]
```

**Arguments:**

- `<query>`: (Required) The text query to search for similar content.

**Options:**

- `-l, --limit <number>`: Maximum number of similar chunks to return (default: `5`).
- `-t, --threshold <number>`: Similarity threshold (cosine similarity) between 0.0 and 1.0. Only chunks with similarity above this threshold are returned (default: `0.78`).
- `-h, --help`: Show help for the `search` command.

**Example:**

```bash
bun run cli.ts search "What are the main conclusions?" --limit 3 --threshold 0.8
```

#### 3. `ask`

Asks a question to the OpenAI AI model. It first performs a semantic search (like the `search` command) to find relevant text chunks from the loaded documents. These chunks are then provided as context to the AI along with the user's question to generate a more informed answer.

**Usage:**

```bash
bun run cli.ts ask <query> [options]
```

**Arguments:**

- `<query>`: (Required) The question you want to ask the AI.

**Options:**

- `-l, --limit <number>`: Maximum number of relevant chunks to retrieve and use as context (default: `5`).
- `-t, --threshold <number>`: Similarity threshold (0.0–1.0) for finding relevant chunks (default: `0.78`).
- `--md`: If present, saves the user prompt, AI response, and the context chunks used into a Markdown file (e.g., `out_1678886400000.md`).
- `-h, --help`: Show help for the `ask` command.

**Example:**

```bash
bun run cli.ts ask "Summarize the key findings regarding vector databases." --limit 3 --md
```

## Code Overview

- **`cli.ts`**: The main entry point for the CLI application. Parses arguments and delegates to the appropriate command handler.
- **`src/commands/`**: Contains the logic for each CLI command.
  - `registry.ts`: Maps command names to their corresponding command class instances.
  - `interface.ts`: Defines the `CliCommand` interface that all commands must implement.
  - `load-file.ts`: Implements the `LoadFileCommand` class. Uses `pdfjs-dist` to parse PDFs.
  - `search.ts`: Implements the `SearchCommand` class.
  - `ask.ts`: Implements the `AskCommand` class. Interacts with OpenAI for Q&A.
- **`src/db/`**: Handles database interactions.
  - `index.ts`: Initializes the Drizzle ORM client connection.
  - `schema.ts`: Defines the database tables (`files`, `file_chunks`) and relations using Drizzle ORM schema syntax. Includes the `pgvector` HNSW index definition.
  - `file-chunks.ts`: Contains database query functions, specifically `findSimilarChunksByCosineDistance` for performing vector similarity searches.
- **`src/openai/`**: Manages interactions with the OpenAI API.
  - `index.ts`: Initializes the OpenAI client using the API key from environment variables.
  - `embeddings.ts`: Contains the `generateEmbedding` function to get embeddings for text using a specific model.
- **`src/constants.ts`**: Defines shared constants like embedding dimensions and default search parameters.
- **`docker-compose.yml`**: Defines the PostgreSQL + `pgvector` database service for Docker.
- **`.env.example`**: Template for environment variables (`DATABASE_URL`, `OPENAI_API_KEY`).

## Key Dependencies

- **Runtime:** Bun
- **Language:** TypeScript
- **ORM:** Drizzle ORM (`drizzle-orm`, `drizzle-orm/node-postgres`)
- **Database:** PostgreSQL with `pgvector` extension (via `ankane/pgvector` Docker image)
- **PDF Parsing:** `pdfjs-dist`
- **AI:** OpenAI Node.js Library (`openai`)
