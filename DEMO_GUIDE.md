# 🎬 Media Scraper — Demo Walkthrough

This demo showcases the **Media Scraper system**: a queue-based, high-concurrency scraper that can handle **~5000 concurrent requests** on **1 CPU / 1 GB RAM**.

The following steps explain **how to run**, **which URLs to visit**, and **what each part demonstrates**.

---

## 🧭 Step-by-Step Demo Flow

### 🧱 Step 1 — Start the Entire System

```bash
make up
```

**Purpose:**

- Builds all Docker services (`api`, `worker`, `redis`, `postgres`, `landing`).
- Waits until `/health` returns OK.

**Demonstrates:**
✅ One-command reproducible setup.
✅ API stability under startup stress.
✅ Full CI/CD readiness.

---

### 🌐 Step 2 — Check the Core URLs

| URL                                                               | Purpose            | Description                                                                                               |
| ----------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| [health api url](http://localhost:4000/health)                    | 🩺 Health Check    | Confirms that API, PostgreSQL, and Redis are connected. Returns `{ ok: true }`.                           |
| [metrics api url](http://localhost:4000/metrics)                  | 📈 System Metrics  | Shows CPU %, memory, Redis latency, event-loop lag, and queue stats (waiting, active, completed, failed). |
| [frontend site](http://localhost:3000)                            | 🖼️ Landing Page    | Displays scraped images/videos using `/media` API. Supports pagination, filtering, and search.            |
| [frontend monitors site](http://localhost:4000/dashboard/metrics) | 🔄 Queue Dashboard | Visualizes BullMQ jobs (waiting, active, completed, failed). Optional but great for demo.                 |

---

### 🚀 Step 3 — Trigger Scraping via API (smoke test)

#### 1️⃣ Trigger scraping request

```bash
curl -u admin:admin -X POST http://localhost:4000/scrape   -H "Content-Type: application/json"   -d '{"urls":["https://www.tiktok.com/","https://www.momos.com/"]}'
```

# 2️⃣ Run smoke test

```bash
make smoke
```

**Purpose:**

- Test `/scrape` endpoint with Basic Auth.
- Validate API correctness and queue connection.
- Receive `HTTP 202 Accepted` instantly (as jobs are queued asynchronously).

**Demonstrates:**
✅ Non-blocking Fastify API.
✅ Instant 202 response even under heavy concurrency.
✅ Queue-first architecture (API does not scrape directly).
✅ System readiness & health under low load.

---

### 🔥 Step 4 — Run Load Tests (Performance Validation)

```bash
make load
```

**This runs two scenarios:**

| File                            | Scenario                      | Goal                                             |
| ------------------------------- | ----------------------------- | ------------------------------------------------ |
| `load/02_burst_5k_requests.yml` | 5000 concurrent HTTP requests | Stress-test API concurrency (burst test).        |
| `load/03_batch_5k_urls.yml`     | 500 requests × 10 URLs each   | Verify large payload handling (5000 URLs total). |

**Reports generated:**

```
load/report-burst.json
load/report-batch.json
```

**Demonstrates:**
✅ API’s ability to accept and respond to 5000 concurrent requests.
✅ System stability under 1 CPU / 1 GB RAM constraint.
✅ Queue buffering and deferred processing.

---

### 📊 Step 5 — View Performance Metrics

**Look for:**

- `p95 latency < 100 ms`
- `100% 202 responses`
- `no 5xx`
- memory < 1 GB

Then check live metrics:

```bash
curl -u admin:admin http://localhost:4000/metrics | jq
```

or open in browser:

http://localhost:3000/dashboard/metrics

**Demonstrates:**
✅ Healthy event loop (lag < 10 ms).
✅ Controlled queue backlog growth.
✅ Consistent resource usage.

---

### 🧩 Step 6 — View Scraped Results on Landing Page

Open:

```
http://localhost:3000
```

**Features to demo:**

- Grid of images/videos
- Pagination
- Filter by type (`image`, `video`)
- Search by keyword

**Demonstrates:**
✅ Frontend integration with `/media` endpoint.
✅ Data persistence in PostgreSQL.

---

## 🧮 Internal Architecture Explained

```
Client → Fastify API → Redis Queue → Worker (Puppeteer + Prisma) → PostgreSQL
```

- **API**: lightweight, responds instantly with `202`
- **Queue**: buffers jobs, isolates load from scraper
- **Worker**: executes scraping asynchronously using Puppeteer
- **Database**: stores unique media URLs per page

---

## 🧱 Version Evolution

| Version                           | Summary                                                                                                                          | Result                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **v1 (Express + queueMicrotask)** | Added microtask buffering to return fast, but API still bottlenecked under 3k+ concurrent requests due to event-loop saturation. | ❌ Not scalable                       |
| **v2 (Fastify + BullMQ)**         | Replaced Express with Fastify, added jobBuffer + backpressure handling, separated scraping to worker.                            | ✅ Stable at 5000 concurrent requests |
| **v2.1 (Optimized Puppeteer)**    | Reused Chromium instance, disabled GPU/sandbox, tuned page concurrency.                                                          | ✅ Efficient CPU/memory use           |

---

## 🧩 Why This Demo Matters

This project demonstrates **event-loop isolation and queue-based scalability** — how to design a Node.js service that can:

- Accept massive concurrency
- Respond instantly (202)
- Offload heavy tasks (scraping)
- Maintain reliability within 1 CPU / 1 GB RAM

It’s a reproducible model for **high-throughput, low-latency systems** in limited-resource environments.

---

### 👤 Author

**Le Thanh Phuoc**
Software Engineer
