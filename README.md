# 🧠 Media Scraper

A high-performance, queue-driven scraping system that extracts **image and video URLs** from web pages — built to handle **~5000 concurrent requests** on a **1 CPU / 1 GB RAM** environment.

---

## 🚀 Features

- **Fastify + BullMQ** backend with Redis queue
- **PostgreSQL + Prisma** persistence
- **Puppeteer** renderer for CSR websites
- **Efficient job buffering** and background processing
- **Basic Auth** secured API
- **Dockerized deployment** (1 CLI startup)
- **Smoke & load testing** with Artillery
- **/metrics** endpoint for real-time monitoring

---

## 🧩 System Architecture

Client → Fastify API → Redis Queue → Worker (Puppeteer + Prisma) → PostgreSQL

- **API Layer (Fastify)**

  - Accepts batch URLs via `POST /scrape`
  - Enqueues lightweight job objects to Redis
  - Returns `202 Accepted` immediately (non-blocking)

- **Worker Layer (BullMQ)**
  - Dequeues and runs jobs asynchronously
  - Scrapes SSR (via fetch + Cheerio) and CSR (via Puppeteer) pages
  - Stores extracted `image` and `video` URLs in PostgreSQL

---

## 🧱 Tech Stack

| Layer                | Tech                           |
| -------------------- | ------------------------------ |
| Backend              | Fastify, Zod, BullMQ, IORedis  |
| Database             | PostgreSQL + Prisma ORM        |
| Scraping             | Cheerio + Puppeteer            |
| Frontend             | React (Landing Page)           |
| Containerization     | Docker Compose                 |
| Testing & Monitoring | Artillery, Makefile Automation |

---

## ⚙️ Setup & Run (Single CLI)

### 1. Prerequisites

- Docker & Docker Compose
- Node.js ≥ 20 (for local development)

### 2. Start everything (API, Worker, DB, Redis, Landing)

```bash
make start
```

This single command will:

1. Build and start all containers
2. Wait until the API `/health` is live
3. Run **smoke** and **load** tests
4. Generate JSON performance reports

If you want to start all services without running tests and reports:

```bash
make up
```

After completion:

```
🌐 Frontend: http://localhost:3000
🔗 API:      http://localhost:4000
```

### 🔐 Credentials

Default Basic Auth: `admin / admin` (configurable in `.env.example`).
Change for production.

---

## 🧪 Testing and Monitoring

### 1. Smoke Test

Quick verification that the API is healthy and responds with `202`.

```bash
make smoke
```

### 2. Load Test

Simulates high concurrency (~5000 requests) and large URL batches.

```bash
make load
```

- `tests/02_burst_5k_requests.yml`: 5000 concurrent requests (burst test)
- `tests/03_batch_5k_urls.yml`: 500 requests × 10 URLs each (5000 URLs total)
- Reports generated under `/load/*.json`

### 3. Monitor Runtime

```bash
curl -u admin:admin http://localhost:4000/metrics
```

Outputs:

- CPU %, memory, event-loop lag
- Redis latency & memory
- Queue job stats (waiting, active, avg delay)

---

## 🧮 Evolution & Optimization Journey

### 🧱 Version 1 – Express Prototype

- Used **Express.js** with in-memory request buffering.
- Tried `queueMicrotask()` to defer job pushing after sending response.
- Used simple Redis enqueue with `bull.add()`.
- **Bottleneck:** API thread blocked under heavy concurrency (Node event loop saturation).
- Result: response latency increased after ~3000 requests.

### ⚡ Version 2 – Fastify + BullMQ (Current)

- Rebuilt with **Fastify**, which has lower overhead per connection.
- Introduced **jobBuffer** pattern and `setImmediate()` to batch Redis calls.
- Added **`maxRequestsPerSocket=0`**, `keepAliveTimeout=60s` to sustain large concurrent sockets.
- Worker runs Puppeteer in single shared browser instance to conserve memory.
- Queue operations configured with:
  ```js
  { maxRetriesPerRequest: null, enableReadyCheck: false }
  ```
- Added metrics (`/health`, `/metrics`) for monitoring.

Result:

- **~10× faster response throughput**
- **Stable under 5000 concurrent requests**
- API remains responsive even while Worker processes backlog.

---

## 🔄 Queue Reliability & Trade-offs

The API returns `202 Accepted` immediately and then attempts to enqueue each URL to Redis (BullMQ).
This keeps p99 latency low (<10s) on **1 CPU / 1 GB RAM**, even under ~5000 concurrent requests, because the request is not blocked by scraping or database work.

Trade-off: we currently prioritize latency over durability.

- There is **no write-ahead persistence** before enqueue.
- There is **no automatic retry** if Redis / BullMQ is temporarily unavailable.
- This means a request can be "accepted" (202) but its jobs may be dropped if queue insertion fails at that moment.

Production mode can switch to a durable path:

1. Store URLs in Postgres with status `PENDING`.
2. Enqueue to Redis asynchronously.
3. If enqueue fails, mark those URLs as `ENQUEUE_FAILED` for retry / status checks.

That production mode adds DB I/O to the request path (slightly higher tail latency) but prevents silent data loss.

## 📦 Docker Configuration

| Service    | CPU     | RAM    | Description                 |
| ---------- | ------- | ------ | --------------------------- |
| `api`      | 1 CPU   | 1 GB   | Fastify API, queue producer |
| `worker`   | 0.5 CPU | 512 MB | Puppeteer scraper           |
| `redis`    | —       | -      | Queue storage               |
| `postgres` | —       | —      | Persistent database         |
| `landing`  | —       | —      | React UI                    |

Each service is orchestrated via `docker-compose.yml` at the project root.

---

## 🧰 Developer Commands

| Command            | Description                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| `make help`        | Show available commands                                                       |
| `make setup`       | Prepare `.env`, copy to `api/`, `worker/`, `landing/`, ensure `tests/` dir    |
| `make start`       | Build & start → wait for `/health` → run smoke + load → generate HTML reports |
| `make up`          | Build & start all services (no tests)                                         |
| `make down`        | Stop and remove containers                                                    |
| `make logs`        | Tail logs for **api** + **worker**                                            |
| `make logs-api`    | Tail logs for **api** only                                                    |
| `make logs-worker` | Tail logs for **worker** only                                                 |
| `make logs-db`     | Tail logs for **postgres**                                                    |
| `make logs-redis`  | Tail logs for **redis**                                                       |
| `make smoke`       | Run smoke test (`tests/01_smoke.yml`) → output `tests/report-smoke.json`      |
| `make load`        | Run burst + batch load tests → outputs JSON + `report-*.html` in `tests/`     |
| `make clear-queue` | Clear BullMQ queue inside **api** container (safe no-op if script missing)    |
| `make clean`       | Remove containers & volumes; clean `tests/*.json` & `tests/*.html`; rm `.env` |

---

## 🧠 Conclusion

The **Media Scraper** demonstrates how to build an **efficient, horizontally scalable scraping pipeline** using:

- Lightweight Fastify server
- Redis-backed queue (BullMQ)
- Puppeteer worker isolation
- Optimized network and event-loop control

This design sustains **5 000 concurrent API requests** on **1 CPU / 1 GB RAM** without service degradation.

---

### Author

**Le Thanh Phuoc**
Software Engineer
