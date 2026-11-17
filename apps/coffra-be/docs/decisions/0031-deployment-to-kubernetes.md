# 0031 – Deployment to Kubernetes: a closed Helm chart, migrations in an init container

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

The app runs on a single-node k3s cluster that hosts other apps of the same owner. Every app there is deployed the
same way: a Helm chart in the repository of the app, an image in GHCR built on a release tag, an ArgoCD `Application`
in a separate GitOps repository, secrets from Infisical through its operator, Traefik as the ingress and `local-path`
volumes. That pattern says nothing about databases or migrations.

The app needs a Postgres and a Redis (ADR 0026: the rate limit counters, a required service). The image applies the
migrations with a second command and never on start (ADR 0023). ArgoCD syncs only through the release workflow; the
`Application` has no automated sync.

## Decision

- **One closed chart per app** (`k8s/chart/`): the app, its own Postgres and its own Redis, built from the official
  images in templates of the chart, no subcharts and no service shared with other apps. Postgres and Redis have
  cluster-internal Services only, and a `NetworkPolicy` lets only the pods of the app connect to them.
- **Postgres is a `StatefulSet`** with a headless Service and one `local-path` volume from `volumeClaimTemplates`,
  retained when the StatefulSet or the release is deleted. **Redis is a Deployment without a volume**: losing the
  counters on a restart costs nothing.
- **Migrations run in an init container of the app's Deployment**, with the same image and the migration command of
  ADR 0023. The app container starts only after it succeeded; while Postgres is not ready it fails and is retried.
  One replica.
- **Secrets** (the database URL and password, the OIDC client secret, the three signing secrets) come from Infisical as
  one Secret; the non-secret configuration is in the values of the chart. The database URL is stored whole.
- **Readiness checks `/api/health`** (Postgres and Redis), **liveness only the TCP port**: an outage of a dependency
  takes the pod out of the Service without restarting it.
- **The image is published by a release workflow** on a tag `coffra-be-v<version>`, which also writes the tag into the
  values of the chart and syncs ArgoCD. The CI workflow still builds the image without publishing it (ADR 0030).
- **The API shares its host with the frontend:** its Ingress takes only the prefix `/api` (the global prefix of every
  route), the frontend the rest. One origin, so the browser needs no CORS between them.
- **The app scales to zero on demand** through the KEDA HTTP Add-on: the Ingress points to its interceptor (an
  `ExternalName` Service), an `InterceptorRoute` matches the host and a `ScaledObject` scales the app's Deployment
  between 0 and 1. The app stops after an idle period and the next request starts it, behind a cold-start page.
  Postgres and Redis keep running. It is switched on in the production values only after a sync without it works.

## Alternatives considered

- A shared Postgres or Redis of the cluster – couples the app to infrastructure it does not own and to the other apps
  that use it; the chart would no longer describe everything the app needs.
- A Postgres operator (CloudNativePG) or a third-party chart – more moving parts than one database of one user needs,
  and a dependency outside the repository.
- Postgres as a Deployment with a separate volume claim – works for one replica, but the StatefulSet gives the stable
  identity and the retained volume without extra resources.
- Migrations as a Job with an ArgoCD pre-sync hook – on the first sync it runs before the Postgres of the same chart
  exists. A Job in a later sync wave works only through ArgoCD, so `helm install` would not order it.
- Migrations on start of the app – rejected by ADR 0023.
- The database URL composed in the pod from the password (`$(POSTGRES_PASSWORD)`) – one secret less, but a URL that is
  not stored anywhere; the deployments of the cluster keep each variable as one Infisical key.
- Liveness on `/api/health` – a database outage would restart the app in a loop without fixing anything.
- Scale to zero by hand (`replicas: 0` in the production values) – nothing wakes the app; every use needs a change in
  git and a sync.
- Postgres and Redis scaled to zero with the app – KEDA scales only the app's Deployment, and the app cannot start
  without them.

## Consequences

- The release name must be `coffra-be`: the stored database URL names the Service `coffra-be-postgres`.
- The password is in Infisical twice (in the URL and alone) and must match. Postgres reads it only when it initialises
  an empty volume; changing it later needs `ALTER USER` in the database as well.
- More than one replica of the app needs another way to migrate first; the init container of each pod would run the
  migrations concurrently (Prisma holds a lock, but rolling updates then mix schema versions).
- The data lives on the disk of the one node. A backup has to leave the node; the chart does not do it.
- A `NetworkPolicy` is enforced only where the cluster enforces policies (k3s does by default).
- A new required variable of the app needs a value in the chart before the next release, or the pod does not start.
- With scale to zero every wake runs the migrations, so the first request after an idle period waits for the pod
  start, the migrations, the start of the app and its readiness. Meanwhile a client gets the cold-start page, not the
  JSON of the API.
- The interceptor is one more proxy between Traefik and the app: the number of trusted proxies of the rate limit
  (ADR 0025) has to match it.
- Every sync sets the replicas of the app back to 1, so every release wakes it until the cooldown passes.
