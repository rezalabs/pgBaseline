# The tuning model

This document records the rules behind every generated value, the reason for each rule, and the source it rests on. The implementation is `src/lib/model/compute.ts`; the oracles that pin the rules are in `src/lib/model/compute.test.ts`.

The model is deterministic. Given the same inputs and reference date it produces the same settings, warnings, and memory ledger.

Part of the rule selection and several explanatory texts derive from PGTune, which is MIT licensed; `THIRD-PARTY-NOTICES.md` records what is reused and carries its notice.

## Inputs

| Input              | Default          | Effect                                                                              |
| ------------------ | ---------------- | ----------------------------------------------------------------------------------- |
| PostgreSQL version | 18               | Documented defaults, available settings, end-of-life warning                        |
| Operating system   | Linux            | Huge pages, `io_uring`, `effective_io_concurrency` availability, Windows memory cap |
| Workload           | Web              | Connection assumption, `work_mem` multiplier and cap, parallel worker cap, JIT      |
| RAM                | required         | Every memory ratio                                                                  |
| CPUs               | empty            | Parallel worker settings and extra autovacuum workers; left alone when empty        |
| Connections        | empty            | `max_connections` and the `work_mem` budget                                         |
| Storage            | SSD              | Planner costs and I/O concurrency                                                   |
| Database size      | 1 to 3 times RAM | Whether planner costs assume caching                                                |

## Memory rules

### shared_buffers

- Desktop profile: `max(16, RAM / 16)`.
- Below 1GB of RAM: `max(16, RAM * 0.15)`.
- Otherwise: `RAM * 0.25`.

Reason: the PostgreSQL documentation names 25% as a reasonable starting value on a dedicated server with 1GB or more of RAM, notes that more than 40% is unlikely to beat a smaller value because the OS page cache also serves reads, and recommends a smaller percentage on hosts below 1GB. A desktop profile shares the machine with other programs, so the model allocates 1/16.

Source: PostgreSQL 19 documentation, Resource Consumption, `shared_buffers`; PostgreSQL wiki, Tuning Your PostgreSQL Server.

### effective_cache_size

`RAM * 0.75`, or `RAM * 0.5` for the desktop profile.

Reason: the parameter is a planner estimate of shared buffers plus the OS page cache, not an allocation. The documentation states that it does not reserve memory. The wiki describes half of RAM as a conservative setting and three quarters as aggressive but reasonable.

Source: PostgreSQL 19 documentation, Query Planning, `effective_cache_size`; PostgreSQL wiki.

### work_mem

```text
base = shared_buffers / max_connections
adjusted = base * multiplier        (dw: 2, desktop: 0.5, otherwise: 1)
value = clamp(floor(adjusted), 4MB, cap)   (cap: 64MB; dw: 256MB; desktop: 16MB)
```

Reason: `work_mem` is charged per sort or hash node, and every parallel worker gets its own allowance, so the cluster-wide value must stay modest when connections are many. Starting from shared buffers divided by connections keeps the value proportional to the RAM actually available per session. The 4MB floor matches the PostgreSQL default, below which the server would spill even trivial sorts. The ceilings keep a single node from claiming an implausible share of memory.

Source: pganalyze `work_mem` check (divide `shared_buffers` by `max_connections`, bounded 1MB to 256MB); PostgreSQL 19 documentation, Resource Consumption, `work_mem`.

### maintenance_work_mem

`max(64, RAM / 16)`, or `RAM / 8` for analytics, capped at 2048MB, at 4096MB for analytics on PostgreSQL 18 and later outside Windows, and at 2047MB on Windows before PostgreSQL 18.

Reason: VACUUM, CREATE INDEX, and restores use this budget. Autovacuum workers multiply it, so the cluster-wide value is capped rather than scaled with RAM. PostgreSQL 18 lifted the historical 2GB ceiling for 64-bit Windows builds; earlier versions reject `maintenance_work_mem` at or above 2097152 kB on Windows because of a `long` width limit, which is why the model uses 2047MB rather than 2048MB there.

Source: PostgreSQL 19 documentation, Resource Consumption, `maintenance_work_mem`; pgsql-hackers thread on the 64-bit Windows limit.

### maintenance reserve

```text
reserve = maintenance_work_mem + autovacuum_work_mem * autovacuum_max_workers
```

`autovacuum_work_mem` is set to 1024MB only when `maintenance_work_mem` exceeds 1GB; otherwise it stays at `-1` and inherits `maintenance_work_mem`. Autovacuum workers rise to 4 at 16 CPUs and 6 at 32 or more, and `autovacuum_vacuum_cost_limit` is scaled by `200 * workers / 3` so each worker keeps roughly the default cost budget.

Reason: several autovacuum workers can run at once, so inheriting a multi-gigabyte maintenance value would multiply the reserve. PostgreSQL 17 removed the 1GB internal vacuum limit, which makes the explicit per-worker cap more important, not less.

Source: PostgreSQL 19 documentation, Vacuuming and Autovacuum; PostgreSQL 17 release notes.

## Connections

A provided value is used as given, clamped to 20 and 260,000. An empty value assumes 200 for web, 300 for OLTP, 100 for analytics and mixed, 20 for desktop, then reduces it so that `(RAM - shared_buffers) / (4MB * 3)` connections fit.

Reason: each connection is a separate process with per-session memory; the assumption keeps a small host from being handed more connections than the smallest useful `work_mem` allows.

Source: PostgreSQL 19 documentation, Connections and Authentication, `max_connections`; PostgreSQL wiki.

## Memory ledger

| Component                      | Formula                                                               |
| ------------------------------ | --------------------------------------------------------------------- |
| Shared buffers                 | `shared_buffers`                                                      |
| Sustained `work_mem`           | `work_mem * ceil(connections * 0.25) * 3`                             |
| Maintenance and autovacuum     | `maintenance_work_mem + autovacuum_work_mem * autovacuum_max_workers` |
| Free for the OS and page cache | `RAM - the three components above`                                    |
| Worst case at all connections  | `shared_buffers + work_mem * connections * 3 + maintenance reserve`   |

Verdict: `over` when less than 10% of RAM remains for the OS, `tight` when less than 20% remains or the all-connections worst case exceeds RAM, and `ok` otherwise.

Reason: the sustained assumption models a busy server where a quarter of connections run one sort or hash with three nodes each. Reporting the all-connections worst case separately avoids two opposite errors: pretending every connection peaks at once, and pretending none does.

## Planner and I/O rules

### random_page_cost

- 1.1 when the database fits in RAM or storage is not HDD.
- 4.0 on HDD.

Reason: on flash and on cached data, random reads cost close to sequential reads; on spinning disks a seek is far more expensive, and 4.0 keeps the planner from preferring random index access. The documentation's 4.0 default already reflects cached random reads, so HDD is the case where raising it relative to sequential access matters.

Source: PostgreSQL 19 documentation, Query Planning, `random_page_cost` and `seq_page_cost`.

### effective_io_concurrency and maintenance_io_concurrency

| Storage        | Value |
| -------------- | ----- |
| HDD            | 2     |
| SSD            | 200   |
| SAN or network | 300   |
| NVMe           | 1000  |

Emitted only when PostgreSQL uses the setting: `effective_io_concurrency` on Linux before 18, and on any platform from 18 because asynchronous I/O removed the `posix_fadvise` limitation; `maintenance_io_concurrency` from 13 with the same conditions.

Reason: the value describes how many storage requests the device can serve in parallel. PostgreSQL 18 raised the default to 16 for general hardware; matching the device is more accurate than the default. On non-Linux platforms before 18 a non-zero value was rejected because prefetch advice was unavailable, so the setting is omitted rather than guessed.

Source: PostgreSQL 19 documentation, Resource Consumption; PostgreSQL 18 release notes; the commit message for the default change; Dalibo performance handout for the storage-specific values.

## Write-ahead log

### max_wal_size and min_wal_size

`max_wal_size = clamp(shared_buffers * 2, 1024MB, 16384MB)`, `min_wal_size = clamp(max_wal_size / 2, 256MB, 4096MB)`.

Reason: checkpoints are triggered by time (`checkpoint_timeout`) or WAL volume, whichever comes first. A larger WAL budget lets the server finish more work between forced checkpoints. The 16GB ceiling keeps crash recovery time bounded.

Source: PostgreSQL 19 documentation, Write Ahead Log, `min_wal_size` and `max_wal_size`; Dalibo performance handout.

### checkpoint_completion_target

0.9 before PostgreSQL 14 only, because 14 made 0.9 the default.

Source: PostgreSQL 19 documentation, Write Ahead Log; PostgreSQL 14 release notes.

### wal_compression

`lz4` from 15 to 18, `on` from 19, omitted below 15.

Reason: LZ4 compresses full-page WAL images at low CPU cost and needs a build with LZ4 support; the model warns when it sets the value. From 19, `on` selects the best method available in the build. Below 15 only `pglz` exists and the default already applies it when enabled, so the value is not worth changing.

Source: PostgreSQL 19 documentation, Write Ahead Log; PostgreSQL 15 and 19 release notes.

## Parallel query

Emitted only when CPUs are provided and at least 4:

| Setting                                  | Value                                                    |
| ---------------------------------------- | -------------------------------------------------------- |
| `max_worker_processes`                   | `max(8, workers)`                                        |
| `max_parallel_workers` (10+)             | `workers`, capped at 32                                  |
| `max_parallel_workers_per_gather`        | `clamp(floor(workers / 2), 2, 4)`, up to 8 for analytics |
| `max_parallel_maintenance_workers` (11+) | `clamp(floor(workers / 4), 2, 4)`                        |

Reason: workers are processes, and each parallel worker applies `work_mem` again. The analytics profile allows wider gathers because scans dominate; short-query workloads keep the gather modest. `max_worker_processes` never drops below the PostgreSQL default of 8, because logical replication and extensions draw from the same pool.

Source: PostgreSQL 19 documentation, Resource Consumption, worker process settings.

## Version behaviour

| Version      | Behaviour                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 10           | No `max_parallel_maintenance_workers` (added in 11)                                                                                        |
| 10 to 13     | `checkpoint_completion_target = 0.9`, since the default is still 0.5                                                                       |
| 12 to 18     | `jit = off` for web, OLTP, and mixed workloads                                                                                             |
| 13 and later | `maintenance_io_concurrency` available                                                                                                     |
| 15 and later | `wal_compression = lz4`                                                                                                                    |
| 18 and later | `io_method = io_uring` on Linux; `effective_io_concurrency` on every platform; `autovacuum_max_workers` reloadable instead of restart-only |
| 19           | JIT is off by default, so no `jit` line; `wal_compression = on`; `autovacuum_max_parallel_workers` from 8 CPUs                             |

Reason: a setting that does not exist in the selected release would prevent startup, and changing a value that already matches the release default adds noise.

Source: PostgreSQL release notes for 14, 15, 17, 18, and 19; documentation pages for each version.

## Options deliberately left alone

- `synchronous_commit`, `fsync`, and `full_page_writes`: changing them trades durability for speed, which a hardware-based tool cannot judge.
- `huge_pages`: `try` is the default and needs OS configuration; the model emits guidance instead.
- `wal_level`, `max_wal_senders`, `archive_mode`: replication and archiving topology are deployment facts.
- Autovacuum scale factors and per-table storage parameters: these depend on table size and update rate.
- `shared_preload_libraries` and extension settings.

## Warnings

Each warning exists because the value it describes can stop the server, exhaust memory, or surprise an operator:

- Startup risk: LZ4 or `io_uring` unavailable in the build; container limits blocking `io_uring`.
- Memory risk: the all-connections worst case exceeding RAM; `work_mem` forced to its floor; less than 10% left for the OS.
- Notes: end-of-life releases, hosts below 1GB or above 1TB, huge page guidance, the Windows maintenance cap, the autovacuum per-worker cap, high connection counts, JIT left off, I/O concurrency omitted on unsupported platforms, databases larger than 3 times RAM.

## References

The site's Method page lists every source with a link. The same identifiers are defined once in `src/lib/model/sources.ts`, and each generated setting names the identifiers it relies on, so a claim can be traced from the interface to its source.
