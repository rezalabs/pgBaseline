<script lang="ts">
  import { formatDate } from '../lib/model/format';
  import { RESEARCH_DATE, SITE_NAME, INSPIRATION_URL, staticFile } from '../lib/model/meta';
  import { SOURCES } from '../lib/model/sources';
  import { PG_VERSIONS } from '../lib/model/types';
  import type { PgVersion } from '../lib/model/types';
  import { VERSION_EOL, versionStatus } from '../lib/model/versions';
  import { navigate, pathFor } from '../lib/router';

  const today = new Date();
  // The status column is computed against the current date, so the caption is dated the same way.
  const REVIEW_DAY = today.toISOString().slice(0, 10);

  const statusLabel = (version: PgVersion): string => {
    const status = versionStatus(version, today);
    if (status === 'current') return 'Current';
    if (status === 'supported') return 'Supported';
    if (status === 'eol-soon') return 'End of life soon';
    return 'End of life';
  };

  const versionNotes: Partial<Record<PgVersion, string>> = {
    19: 'JIT off by default; parallel autovacuum; self-scaling I/O workers',
    18: 'Asynchronous I/O; io concurrency defaults raised to 16',
    17: 'Vacuum memory above 1GB; incremental backup',
    16: 'vacuum_buffer_usage_limit added',
    15: 'LZ4 and Zstandard WAL compression',
    14: 'checkpoint_completion_target defaults to 0.9',
    13: 'maintenance_io_concurrency added',
    12: 'JIT on by default; autovacuum cost delay 2ms',
    11: 'Parallel index creation; JIT introduced',
    10: 'Native partitioning; parallel query defaults raised',
  };

  function goTune(event: MouseEvent) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate('tune');
  }
</script>

<div class="method page">
  <div class="method__main">
    <header class="method__intro">
      <h1>How the numbers are chosen</h1>
      <p class="method__lead">
        {SITE_NAME} is a starting point, not a benchmark. The rules below follow PostgreSQL's documented
        behaviour and the sources cited at the end of this page.
      </p>
      <p class="method__meta">Last reviewed {formatDate(RESEARCH_DATE)}.</p>
    </header>

    <section class="method__section" aria-labelledby="method-what">
      <h2 id="method-what">What the tool does</h2>
      <p>
        You describe the server and the workload. The model turns those inputs into a cluster-wide
        starting configuration, a memory ledger that shows where the memory goes, and warnings for
        settings that can prevent startup or exhaust RAM. The page computes the output itself, with
        no server round trip.
      </p>
      <p>
        The model starts from PostgreSQL's documented ratios and deviates only where the hardware or
        workload justifies it. It also marks the settings that need a restart.
      </p>
    </section>

    <section class="method__section" aria-labelledby="method-inputs">
      <h2 id="method-inputs">Inputs</h2>
      <dl class="inputs">
        <div>
          <dt>PostgreSQL version</dt>
          <dd>
            Selects the documented defaults, the available settings, and the end-of-life warning.
            Defaults changed several times between PostgreSQL 10 and 19.
          </dd>
        </div>
        <div>
          <dt>Operating system</dt>
          <dd>
            Selects the asynchronous I/O method, whether <code>maintenance_work_mem</code> carries
            the pre-18 Windows cap, where <code>effective_io_concurrency</code> applies, and which huge
            page note is shown.
          </dd>
        </div>
        <div>
          <dt>Workload</dt>
          <dd>
            Changes the connection assumption, the <code>work_mem</code> multiplier, the parallel worker
            cap, and whether JIT is disabled.
          </dd>
        </div>
        <div>
          <dt>Memory and CPUs</dt>
          <dd>
            Memory drives every ratio. CPU count drives parallel workers and extra autovacuum
            workers; when it is empty those settings are left at their defaults.
          </dd>
        </div>
        <div>
          <dt>Connections</dt>
          <dd>
            A peak client count, not a pooler client count. Empty means the workload default,
            reduced when a 4MB <code>work_mem</code> floor would not fit.
          </dd>
        </div>
        <div>
          <dt>Storage and database size</dt>
          <dd>
            Storage selects planner and I/O concurrency values. Size decides whether the planner
            should treat reads as cached or storage-bound.
          </dd>
        </div>
      </dl>
    </section>

    <section class="method__section" aria-labelledby="method-rules">
      <h2 id="method-rules">Rules</h2>
      <!-- Scrollable region: focusable so keyboard users can scroll it. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="table-wrap" tabindex="0" role="region" aria-label="Tuning rules">
        <table>
          <caption>Starting rule for each setting family</caption>
          <thead>
            <tr>
              <th scope="col">Setting</th>
              <th scope="col">Rule</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">shared_buffers</th>
              <td>25% of RAM (15% below 1GB; 1/16 on a desktop)</td>
              <td>PostgreSQL's documented starting point; it still relies on the OS page cache.</td>
            </tr>
            <tr>
              <th scope="row">effective_cache_size</th>
              <td>75% of RAM (50% on a desktop)</td>
              <td>A planner estimate of shared buffers plus the OS cache. It reserves nothing.</td>
            </tr>
            <tr>
              <th scope="row">work_mem</th>
              <td>
                shared_buffers / max_connections, x2 for analytics, /2 for desktop, 4MB floor,
                capped at 64MB (256MB analytics)
              </td>
              <td>Allocated per sort or hash node, so a query can use it several times over.</td>
            </tr>
            <tr>
              <th scope="row">maintenance_work_mem</th>
              <td>RAM/16 or RAM/8, capped at 2GB; 4GB for analytics on 18+ outside Windows</td>
              <td>VACUUM, index builds, and restores; autovacuum is bounded separately.</td>
            </tr>
            <tr>
              <th scope="row">max_connections</th>
              <td>Your peak, or the workload default reduced by the 4MB floor</td>
              <td>Each connection is a process and multiplies per-session memory.</td>
            </tr>
            <tr>
              <th scope="row">Planner costs</th>
              <td>1.1 on flash or cached data, 4.0 on HDD; device concurrency for I/O</td>
              <td
                >Random reads cost close to sequential reads on flash, far more on spinning disks.</td
              >
            </tr>
            <tr>
              <th scope="row">WAL</th>
              <td>max_wal_size = 2 x shared_buffers, capped at 16GB; lz4 (15-18), on (19)</td>
              <td>Fewer forced checkpoints and smaller full-page WAL records.</td>
            </tr>
            <tr>
              <th scope="row">Parallel query</th>
              <td>Up to 32 workers, 4 per gather (8 for analytics)</td>
              <td>Each worker is a process with its own work_mem charge.</td>
            </tr>
            <tr>
              <th scope="row">Autovacuum</th>
              <td>4 to 6 workers on 16+ CPUs, 1GB per worker cap, scaled cost limit</td>
              <td
                >Keeps vacuum from lagging without letting workers claim the full maintenance
                budget.</td
              >
            </tr>
            <tr>
              <th scope="row">Asynchronous I/O</th>
              <td>io_uring on Linux 18+, left at worker elsewhere</td>
              <td>Highest-throughput method when the build, kernel, and container support it.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="method__section" aria-labelledby="method-memory">
      <h2 id="method-memory">The memory model</h2>
      <p>
        The ledger is a planning model, not a guarantee. It assumes a sustained load where 25% of
        connections run one sort or hash with three nodes each. That is deliberately less
        pessimistic than every connection peaking at once, which the model reports separately as the
        worst case.
      </p>
      <p>
        The maintenance reserve compounds: one manual maintenance operation plus up to
        <code>autovacuum_max_workers</code> autovacuum workers, each with
        <code>autovacuum_work_mem</code>. If less than 10% of RAM remains for the OS, the verdict is
        over budget; below 20%, or when the all-connections worst case exceeds RAM, it is tight.
      </p>
      <p>
        <code>work_mem</code> is charged per node, not per query or connection. A three-table hash join
        with a sort and a hash aggregate can use five times the value, and every parallel worker gets
        its own allowance. That is why the model keeps the cluster-wide value modest and points to per-role
        overrides for the few queries that need more.
      </p>
    </section>

    <section class="method__section" aria-labelledby="method-versions">
      <h2 id="method-versions">Version support</h2>
      <!-- Scrollable region: focusable so keyboard users can scroll it. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="table-wrap" tabindex="0" role="region" aria-label="PostgreSQL version support">
        <table>
          <caption>Support status on {formatDate(REVIEW_DAY)}</caption>
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col">Status</th>
              <th scope="col">End of life</th>
              <th scope="col">Notable change</th>
            </tr>
          </thead>
          <tbody>
            {#each PG_VERSIONS as version (version)}
              <tr>
                <th scope="row">{version}</th>
                <td>{statusLabel(version)}</td>
                <td>{formatDate(VERSION_EOL[version])}</td>
                <td>{versionNotes[version]}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="method__note">
        A version past its end-of-life date still produces a configuration, with a warning. The
        model does not invent features for old releases: settings that did not exist are omitted.
      </p>
    </section>

    <section class="method__section" aria-labelledby="method-limits">
      <h2 id="method-limits">What this does not do</h2>
      <ul class="limits">
        <li>
          It does not benchmark your workload. Query plans, indexes, and schema design matter more
          than any of these values.
        </li>
        <li>It does not replace a per-role configuration for reporting or batch users.</li>
        <li>
          It does not check your provider's parameter group, managed-service limits, or extension
          requirements.
        </li>
        <li>It does not decide replication, backup, pooling, or failover topology.</li>
        <li>
          It does not tune autovacuum thresholds or statistics per table; those are workload facts.
        </li>
        <li>It is not a promise of a specific latency or throughput number.</li>
      </ul>
    </section>

    <section class="method__section" aria-labelledby="method-prior">
      <h2 id="method-prior">Prior art</h2>
      <p>
        This site was inspired by <a href={INSPIRATION_URL}>PGTune</a>, a hardware-based PostgreSQL
        tuning tool. PGTune is MIT licensed, and this project reuses material from it: the shape of
        the generated configuration and the order of its settings, the selection of settings for
        each database type, several explanatory sentences and warning texts, and the database type,
        storage, and size labels. PGTune's copyright notice and license ship with this site and are
        preserved in the
        <a href={staticFile('third-party-notices.txt')}>third-party notices</a>.
      </p>
      <p>
        This project's own work is the Svelte implementation, the memory ledger, the per-setting
        evidence with documentation links, version support and end-of-life handling, the research
        citations, and the interface design. Where the rules differ from PGTune, the difference is
        deliberate:
      </p>
      <ul class="limits">
        <li>
          <code>work_mem</code> comes from <code>shared_buffers</code> divided by
          <code>max_connections</code>, not from a fixed fraction of RAM.
        </li>
        <li>
          The result shows a sustained memory budget next to an all-connections worst case, instead
          of one headline number.
        </li>
        <li>
          Defaults follow recent releases: asynchronous I/O and its worker scaling, an
          <code>effective_io_concurrency</code> default of 16, and JIT off in PostgreSQL 19.
        </li>
        <li>End-of-life versions carry a dated warning and the published support window.</li>
        <li>Every setting links to the documentation for the selected major version.</li>
      </ul>
    </section>

    <section class="method__section" aria-labelledby="method-sources">
      <h2 id="method-sources">Sources</h2>
      <ul class="sources">
        {#each Object.values(SOURCES) as source (source.url)}
          <li>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
            {#if source.note}
              <span>{source.note}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    <p class="method__back">
      <a href={pathFor('tune')} onclick={goTune}>Back to the tuner</a>
    </p>
  </div>

  <nav class="method__toc" aria-label="On this page">
    <p class="method__toc-title">On this page</p>
    <ol>
      <li><a href="#method-what">What the tool does</a></li>
      <li><a href="#method-inputs">Inputs</a></li>
      <li><a href="#method-rules">Rules</a></li>
      <li><a href="#method-memory">The memory model</a></li>
      <li><a href="#method-versions">Version support</a></li>
      <li><a href="#method-limits">What this does not do</a></li>
      <li><a href="#method-prior">Prior art</a></li>
      <li><a href="#method-sources">Sources</a></li>
    </ol>
  </nav>
</div>

<style>
  .method {
    display: grid;
    grid-template-columns: minmax(0, 78ch) 13rem;
    gap: var(--space-10);
    justify-content: center;
    align-items: start;
    padding-block: var(--space-8) var(--space-12);
  }

  .method__main {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-10);
    min-inline-size: 0;
  }

  .method__intro {
    display: grid;
    gap: var(--space-2);
    max-inline-size: 72ch;
  }

  .method h1 {
    font-size: clamp(2.25rem, 4.4vw, 3.25rem);
  }

  .method__lead {
    font-size: var(--text-lg);
    line-height: var(--leading-snug);
    color: var(--color-ink-soft);
  }

  .method__meta {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-faint);
  }

  .method__section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
    max-inline-size: 78ch;
    scroll-margin-block-start: 5rem;
  }

  .method__section h2 {
    font-size: var(--text-2xl);
    padding-block-end: var(--space-2);
    border-block-end: 1px solid var(--color-rule);
  }

  .method__section p,
  .method__section li {
    color: var(--color-ink-soft);
    line-height: var(--leading-body);
  }

  .method__section p code {
    color: var(--color-ink);
    font-size: 0.95em;
  }

  .method__section li code {
    color: var(--color-ink);
    font-size: 0.95em;
  }

  .inputs {
    display: grid;
    gap: var(--space-3);
    margin: 0;
  }

  .inputs > div {
    display: grid;
    gap: 2px;
  }

  .inputs dt {
    font-weight: 600;
    color: var(--color-ink);
  }

  .inputs dd {
    margin: 0;
    color: var(--color-ink-soft);
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--color-rule);
  }

  .table-wrap:focus-visible {
    outline-offset: 2px;
  }

  table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
    min-inline-size: 40rem;
  }

  caption {
    text-align: start;
    padding: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--color-ink-faint);
    border-block-end: 1px solid var(--color-rule);
  }

  th,
  td {
    padding: var(--space-2) var(--space-3);
    text-align: start;
    vertical-align: top;
    border-block-end: 1px solid var(--color-rule);
  }

  thead th {
    font-family: var(--font-body);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--color-ink);
    background: var(--color-surface-alt);
  }

  tbody th {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-ink);
    white-space: nowrap;
  }

  td {
    color: var(--color-ink-soft);
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-block-end: 0;
  }

  .method__note {
    font-size: var(--text-xs);
    color: var(--color-ink-faint);
  }

  .limits {
    display: grid;
    gap: var(--space-2);
    padding-inline-start: var(--space-5);
  }

  .limits li::marker {
    color: var(--color-rule-strong);
  }

  .sources {
    display: grid;
    gap: var(--space-3);
    padding-inline-start: 0;
    list-style: none;
    columns: 2;
    column-gap: var(--space-8);
  }

  .sources li {
    break-inside: avoid;
    margin-block-end: var(--space-3);
    font-size: var(--text-sm);
  }

  .sources a {
    display: block;
    color: var(--color-ink);
    font-weight: 500;
  }

  .sources span {
    display: block;
    font-size: var(--text-xs);
    color: var(--color-ink-soft);
  }

  .method__back {
    padding-block-start: var(--space-4);
    border-block-start: 1px solid var(--color-rule);
    font-size: var(--text-sm);
  }

  .method__toc {
    position: sticky;
    inset-block-start: 5rem;
    display: grid;
    gap: var(--space-2);
    padding-inline-start: var(--space-4);
    border-inline-start: 1px solid var(--color-rule);
  }

  .method__toc-title {
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    color: var(--color-ink-faint);
  }

  .method__toc ol {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .method__toc a {
    font-size: var(--text-sm);
    color: var(--color-ink-soft);
    text-decoration: none;
  }

  .method__toc a:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }

  @media (max-width: 72rem) {
    .method {
      grid-template-columns: minmax(0, 1fr);
    }

    .method__toc {
      display: none;
    }
  }

  @media (max-width: 60rem) {
    .sources {
      columns: 1;
    }
  }

  @media (max-width: 34rem) {
    .method,
    .method__main {
      gap: var(--space-8);
    }

    table {
      min-inline-size: 34rem;
    }
  }
</style>
