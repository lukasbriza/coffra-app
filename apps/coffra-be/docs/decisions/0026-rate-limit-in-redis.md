# 0026 – Rate limit counters in Redis, refused when Redis is away

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The rate limit (ADR 0025) kept its counters in the memory of the process. With more than one replica every replica
counts what it sees, so the limit is multiplied by the number of replicas, and a restart of a replica gives its
clients a fresh limit. The application is going to run in a cluster (k3s) after it runs in a container behind a proxy.

The limit has to stay what the application says it is: the strict routes (`@StrictRateLimit()`) and the exempt ones
(`@SkipRateLimit()`) are declared in the code, tested there, and have to behave the same in a container and in a cluster,
and with one replica as with several: one way of counting to run, test and reason about.

## Decision

**The counters are always in Redis; Redis is a required service, like the database.** `REDIS_URL` (`redis://` or
`rediss://`) is required; there is no mode that counts anywhere else. It may hold a password, so no message of
validation or log ever repeats it.

**`RedisModule` (`src/modules/redis/`) owns the connection,** as `PrismaModule` owns the database: `RedisService` is
the `ioredis` client, global, used by the rate limit and by the health probe. The connection is lazy (the first command
opens it, so a start does not wait for Redis and an application in a spec that sends nothing never connects), fails
fast (a command has 250 ms to be answered, a command that cannot be sent is given up after one failed attempt to
connect), reconnects by itself, and is closed after the HTTP server stops (a connection that was never opened is
dropped without opening it).

**Our own storage over `ioredis`, one Lua script.** The script counts a request in one step, so replicas that count at
the same moment lose no hit. A client has a sorted set of the moments of its hits (a sliding window: every hit leaves
the window `ttl` after it was made) and a block key that exists while the client is blocked. The request that goes over
the limit blocks the client for `blockDuration` and drops its hits; a blocked client is not counted; with a block of
zero a request over the limit is refused until the oldest hit leaves the window. These are the rules of the in-memory
store of `@nestjs/throttler`, and the same specification (`storage-contract.spec.ts`) is asked of both, which is how
the script is proven. The clock is the one of Redis (`TIME`): replicas whose clocks differ agree. Every key has an
expiry. The keys are `coffra:rate-limit:{<bucket>:<client>:<throttler>}:hits` and `…:block`; the braces put both in one
hash slot, so the script would also run on a cluster.

**Redis away means `503`, never a request let through or counted elsewhere** (`FailClosedThrottlerStorage`). Every
error of the storage (no connection, a timeout, an unexpected reply) refuses the request with `503 Service Unavailable`
and `Retry-After: 1` (the guard, `RateLimitGuard`, adds the header, so a client knows when to try again as after a `429`).
After a failure Redis is left alone for 1 s: the requests in between are refused at once, so a Redis that hangs does
not hold every request for its timeout; then it is asked again and, when it answers, used again. The first failure and
the return are logged once each, as the class and the code of the error, never its message or the URL. **The health
probe checks Redis** (`RedisHealthIndicator`, `PING`) next to the database, so `/api/health` answers `503` and the
`HEALTHCHECK` of the image turns unhealthy while Redis is away; `/api/health` itself is outside the limit and still
answers.

**Dev and tests.** `docker/docker-compose.yaml` has a `redis` service (`redis:8.2-alpine3.22`, port 6389, nothing
written to disk). The specs that count in Redis are the contract, the replicas (two applications on one Redis, a
restart, keys that expire, the connection closed at shutdown, Redis unreachable) and the image (a container counting in
Redis, and one whose Redis does not answer); `pretest:integration` and `pretest:image` check that Redis listens. The
specs of `pnpm test` need no Docker: the ones of the whole application get a fake `RedisService` (`PING` answers) and
replace the guard of the limit, the ones that prove the limit while moving `Date` count in memory (Redis has a clock of
its own).

## Alternatives considered

- **A limit at the ingress (Traefik, nginx) only** – cheap and needs no code, but the rule then lives in the configuration
  of the cluster: a new login route is covered only when someone adds its path there, a pod reached without the ingress
  has no limit, and the Docker and the k3s deployments each need their own. It stays a good first line in front of the
  application; it does not replace the limit that the application declares and tests.
- **Redis only for several replicas (`REDIS_URL` optional, memory otherwise)** – two ways of counting to run and test, and
  a restart of the one replica would still hand out fresh limits.
- **The memory of the process as a fallback while Redis is away** – keeps the API up and a limit per replica, but it is a
  second way of counting that runs only in an outage, exactly when nobody looks at it.
- **Letting every request through while Redis is away** – the login would have no limit exactly when an attacker could
  have caused the outage.
- **Refusing only the login routes while Redis is away** – two behaviours by route; a Redis that is away is a broken
  deployment either way, and the health probe says so.
- **`@nest-lab/throttler-storage-redis`** – works with the throttler and `ioredis` 5, but counts in a fixed window (an
  `INCR` and an `EXPIRE`) and keeps counting a blocked client, so it does not keep the rules of the in-memory store and
  the contract above could not be one. It was also built and tested against `ioredis` 5, not 6.
- **Counters in Postgres** – no new service, but a write per request into the database that also holds the money, a
  migration, and an upsert that has to be atomic; Redis does the same with a script and an expiry.
- **No queue of commands while the connection opens (`enableOfflineQueue: false`)** – the first requests after a start
  would fail at once; the replicas spec found it. A queue with a command timeout fails as fast when Redis is really away.
- **A limit divided by the number of replicas** – right only when the requests are spread evenly, and the number of
  replicas has to be configured and kept in step.
- **Redis Sentinel or Cluster support** – a connection string cannot describe them; the hash tags in the keys keep the
  script cluster-safe for the day it is needed.

## Consequences

- Every deployment, one replica included, runs a Redis next to the application, and the application needs `REDIS_URL`
  to start. Replicas share one limit, and a restart of a replica gives nobody a fresh one.
- **Redis away is an outage of the API:** every counted request is `503` (at most 250 ms to find out, then refused at once
  for 1 s at a time), `/api/health` is `503`, the image is unhealthy. In k3s that belongs in a readiness probe, not a
  liveness one: restarting the pods does not bring Redis back.
- Redis holds nothing worth keeping: losing it or restarting it resets all counters (everybody gets a fresh limit once);
  no volume, no backup.
- `ioredis` 6.0.0 is a production dependency (pinned, CommonJS, loaded from the compiled output; the image specs hold
  it). `maxRetriesPerRequest: 1` and the command timeout overlap: either alone makes a command fail fast.
- Which client address a request has is still decided by `TRUST_PROXY_HOPS` (ADR 0025): Redis shares the counters, it
  does not know who the client is. In a cluster the address the application sees depends on how the ingress and the
  service pass it on, and has to be checked on the cluster itself.
- A change of the script is a change of the contract that the in-memory store of the library defines. A client has at
  most `limit + 1` entries in Redis, and the hits are dropped when the client is blocked.
- The integration job and the image job of a CI need a Redis service next to Postgres.
