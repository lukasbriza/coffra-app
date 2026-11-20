---
name: deploy-k8s
description: Use when adding Kubernetes (k3s + Helm + ArgoCD) deployment to an app in a monorepo scaffolded from monorepo-template — creating apps/<name>/k8s/chart, a GHCR build-push or deploy-only GitHub workflow, Infisical secrets wiring, an Ingress/TLS host, an ArgoCD Application manifest for hand-off, keeping an app scaled to zero, or when asked to "deploy to k8s", "add helm chart", "release image", "scale to zero", "homeport".
---

# Deploy an app to a k3s cluster (Helm + ArgoCD)

Works in any repo scaffolded from monorepo-template. You only see this repo. The cluster
and the GitOps repo that holds the ArgoCD `Application` manifests are managed elsewhere
and are **not visible to you**. Do not search for them and do not guess their contents.
Everything you need is in this skill and in [references/templates.md](references/templates.md).

## Cluster facts

Defaults for the homeport cluster. When the project's `CLAUDE.md` states other values,
those win. Each placeholder in the templates maps to a row here.

| Fact | Placeholder | Default |
|---|---|---|
| Cluster | — | single-node k3s, Helm charts, GitOps via ArgoCD with app-of-apps: a new Application file in the GitOps repo is picked up on push, no `kubectl apply` |
| Ingress | — | Traefik, `ingressClassName: traefik` |
| Storage | — | StorageClass `local-path`, reclaim policy `Delete` |
| TLS | — | CronJob `cert-renewal` in namespace `cert-renewal` writes Secret `<name>-tls` |
| Registry | `<registry>` | `ghcr.io/lukasbriza`. No pull secret in the cluster, so packages must be Public |
| Secrets | `<infisical-auth>`, `<infisical-auth-ns>` | Infisical Kubernetes Operator, auth ref `homeport-infisical-auth` in `infisical-system` |
| Infisical | `<infisical-env>` | project "Homeport", environment `prod`, one folder per app: `/<name>` |
| ArgoCD | `<argocd-server>` | `argocd.lukasbriza.eu` (gRPC-web), token in GitHub secret `ARGOCD_AUTH_TOKEN` |
| Git | `<repo-url>`, `<branch>` | read from the repo: `git remote get-url origin`, default branch from `git symbolic-ref refs/remotes/origin/HEAD` |
| Namespace | — | `<name>`, created by ArgoCD (`CreateNamespace=true`) |
| Scale to zero | — | KEDA with the HTTP Add-on in namespace `keda`. Interceptor Service `keda-add-ons-http-interceptor-proxy:8080`, external scaler `keda-add-ons-http-external-scaler.keda:9090`. Traefik allows `ExternalName` Services. ConfigMap `coldstart-page` (key `index.html`) must exist in the app namespace: the user adds the namespace to the cold-start page chart in the cluster repo |

## App types

Pick one before writing anything. It decides the image and the workflow.

| Type | When | Image build | Workflow |
|---|---|---|---|
| Turbo app | source in `apps/<name>`, part of the pnpm workspace | context `.` (repo root, `turbo prune` needs the workspace), Dockerfile from `docker/` | `<name>-build-push.yml` |
| Local Dockerfile | upstream image extended or re-tagged, or a standalone package outside the workspace | context `apps/<name>`, `apps/<name>/Dockerfile` | `<name>-build-push.yml` |
| Upstream image | third-party image used unmodified | none, `values.yaml` points at the image | `<name>-deploy.yml` (sync only) |

Shared Dockerfiles for a turbo app:

| App | Dockerfile |
|---|---|
| Next.js | `docker/nextjs/Dockerfile` |
| NestJS / Node server | `docker/node/Dockerfile` |
| NestJS with Prisma 7 | `docker/node/prisma/Dockerfile` |
| Static SPA, Storybook, mobile | none shared — ask the user |

Read the chosen Dockerfile's header for its build args (`APP`, `PORT`, …) and its
default command before writing the workflow. Build the image locally once before the
first tag. Prisma migrations in the cluster (init container or Job) are not covered:
decide per app and record the choice in the project's `CLAUDE.md`.

## What lives where

| Place | Content | Who creates it |
|---|---|---|
| `apps/<name>/k8s/chart/` | Helm chart | you |
| `.github/workflows/<name>-build-push.yml` or `<name>-deploy.yml` | release on a `<name>-v*` tag, ends with ArgoCD sync | you |
| GitOps repo: `<name>.yaml` among the Application manifests | ArgoCD `Application` | **the user**, from the manifest you print |
| Infisical `<infisical-env>` `/<name>` | real secrets | **the user** |
| Cluster repo: cold-start page chart values | app namespace for `coldstart-page` (on-demand scale to zero only) | **the user** |

Never create ArgoCD or cluster resources in this repo.

## Procedure

1. **Gather inputs.** If missing, ask: app name, app type, container port, health
   endpoint path, hostname, stateful or not, env vars (split secret / non-secret), and
   whether the app starts scaled to zero (see "Scale to zero").
   Resolve the cluster facts: the project's `CLAUDE.md` first, then the defaults.
2. **Chart.** Create `apps/<name>/k8s/chart/` from the templates. Use `{{ .Release.Name }}`
   for resource names. Always set `enableServiceLinks: false`. Drop PVC files if stateless.
3. **Values.** `values.yaml` has safe defaults and no secrets. `values-prod.yaml` (hostname,
   Infisical `projectId`) is committed too. Ask the user for the Infisical project ID.
4. **Secrets.** Add `infisical-static-secret.yaml` behind `infisical.enabled`. Output the
   list of Infisical keys the user must create under `/<name>`.
5. **Workflow.** Build-push template for a turbo app or local Dockerfile, deploy template
   for an upstream image.
6. **Hand-off.** Print the ArgoCD `Application` manifest for the user to add to the GitOps
   repo. State plainly that this step is theirs and blocks the first deploy.
7. **First release (user runs):**
   ```bash
   git tag <name>-v0.1.0 && git push origin <name>-v0.1.0
   ```
   For a built image, set the new GHCR package to **Public**: the first push creates it
   private. Then trigger cert issuance and verify (default TLS setup):
   ```bash
   kubectl create job --from=cronjob/cert-renewal -n cert-renewal cert-renewal-manual
   kubectl get secret <name>-tls -n <name>
   curl -v https://<hostname>
   ```

## Releasing later

- **Built image:** `git tag <name>-v<version> && git push origin <name>-v<version>`. The
  workflow builds, pushes, writes the new tag into `values.yaml`, commits to `<branch>`
  and syncs ArgoCD.
- **Upstream image:** bump `image.tag` in `values.yaml` by hand and push it, then push a
  new `<name>-v*` tag. The tag is only the deploy signal.

## Scale to zero

Two modes. Ask the user which one. Never choose silently.

| Mode | Behaviour | Use when |
|---|---|---|
| Fixed zero | `replicas: 0` in git. Nothing wakes the app. | The app is deployed but must not run yet. |
| On demand (KEDA) | The first request starts the pod. It stops after an idle period. | Low-traffic app where a delay of several seconds on the first request is fine. |

### Fixed zero

- **Values.** Every workload the chart ships reads its replica count from values:
  `replicas` for the app, `<component>.replicas` for each database or cache
  (e.g. `postgres.replicas`). Never hardcode a replica count in a template.
- **Switch.** Set the values to `0` in `values-prod.yaml`. Keep `values.yaml` at `1`.
- **Not `kubectl scale`.** The next sync resets it, and automated sync with `selfHeal`
  reverts it at once. Change the value in git.
- **Wake up.** Set the values back to `1` in `values-prod.yaml`, push to `<branch>`, then
  sync: push a `<name>-v*` tag or run the workflow with `workflow_dispatch`.
- PVCs stay at zero replicas, so data survives. Init containers (e.g. migrations) run
  when a pod starts, so not at zero. Traefik answers 503 while no pod runs.

### On demand (KEDA HTTP Add-on)

Templates: [references/templates.md](references/templates.md), section "Scale to zero on demand".

How it works: the Ingress backend is an `ExternalName` Service in the app namespace. It
resolves to the interceptor proxy in `keda`. An `InterceptorRoute` names the host, the
target Service and the scaling metric. A `ScaledObject` scales the app's Deployment
between `minReplicas` (0) and `maxReplicas`. The interceptor holds the first request
while the pod starts and shows the cold-start page meanwhile.

1. Add the `scaleToZero` block to `values.yaml` with `enabled: false`.
2. Add `templates/keda-proxy.yaml`, `templates/scaletozero.yaml` and the
   `scaleToZero.enabled` branch in `templates/ingress.yaml`.
3. `ingress.enabled: true` and `ingress.host` are required: the `InterceptorRoute` matches
   on the host.
4. Hand-off, in addition to the Application manifest: the user adds the app namespace to
   the cold-start page chart in the cluster repo and upgrades that release. Without it
   the route falls back to KEDA's plain placeholder.
5. First sync with `enabled: false`. Set `scaleToZero.enabled: true` in `values-prod.yaml`
   only after the app works.
6. Verify (user runs): after the cooldown `kubectl get deploy -n <name>` shows `0/0`.
   A request to the hostname wakes it.

Rules:

- KEDA scales only the app's Deployment. A database, cache or any other workload in the
  chart keeps running. Do not set those to `0`, the app could not start.
- Init containers (migrations) run on every wake. The cold start is longer.
- Not a fit: apps that must open instantly, apps with long-lived connections (SSE,
  websockets) that never look idle, apps other apps depend on (an identity provider).
- Keep `replicas: 1` in values. KEDA overrides it at runtime. A sync sets it to `1` again
  until the cooldown passes, so every release wakes the app. Keep automated sync off.
- Use `InterceptorRoute` + `ScaledObject`. The older `HTTPScaledObject` is deprecated.
  This API changes fast: tell the user to recheck the HTTP Add-on docs when copying.

Record the chosen mode in the app's `CLAUDE.md`, with how to wake or test it.

## Gotchas

- **`enableServiceLinks: false`.** A Service named `foo` makes kubelet inject `FOO_PORT=tcp://…`.
  Apps that read `FOO_PORT` as a number crash. Fix this flag, do not rename the Service.
- **Hostname conflict.** Before cutover, another Ingress in any namespace may still serve
  the host. Two Ingresses for one host break TLS and routing. Ask the user to run
  `kubectl get ingress -A | grep <hostname>` and remove the old one.
- **Host header validation.** An HTTP probe sends the pod IP as `Host`. When the app
  allows only its public hostname, use a `tcpSocket` probe.
- **PVC.** Every standalone PVC needs `helm.sh/resource-policy: keep`.
- **Data migration.** When the app already runs elsewhere: files or SQLite → `rsync` into
  the PV host path; Postgres or MariaDB → dump and restore. Never copy a database data directory.
- **Replicas.** Keep `replicas: 1` for stateful apps on a `ReadWriteOnce` PVC. `0` is
  allowed only for scale to zero, never `2` or more.
- **YAML comments** are technical only. No migration phases, task numbers or process narrative.
- **Commits:** Conventional Commits, e.g. `feat(<name>): add helm chart`.

## Do not

- Look for or reference files in other repositories, or name another project's app as the example to copy.
- Put real credentials in `values*.yaml`.
- Add `syncPolicy.automated` to the hand-off manifest. The user enables it after one manual sync works.
- Edit this skill in a scaffolded copy. Edit it in the template, then run `sync-template`.