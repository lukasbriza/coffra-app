# Templates

Replace `<name>`, `<port>`, `<health-path>`, `<domain>`, `<infisical-project-id>` (ask the
user), and the cluster placeholders
(`<registry>`, `<infisical-auth>`, `<infisical-auth-ns>`, `<infisical-env>`,
`<argocd-server>`, `<repo-url>`, `<branch>`) with values from the Cluster facts table in
`SKILL.md`. Adapt to the app, do not paste blindly. Chart paths are relative to
`apps/<name>/k8s/chart/`.

## Chart.yaml

```yaml
apiVersion: v2
name: <name>
description: <one-line description of the app>
type: application
version: 0.1.0
appVersion: "latest"
```

## values.yaml

```yaml
image:
  repository: <registry>/<name>
  # Bumped by .github/workflows/<name>-build-push.yml on every <name>-v* tag.
  tag: <name>-v0.1.0

replicas: 1

resources:
  requests: { cpu: 50m, memory: 128Mi }
  limits: { cpu: 500m, memory: 512Mi }

# Remove this block and pvc.yaml for a stateless app.
persistence:
  size: 1Gi
  storageClassName: local-path

service:
  port: <port>

ingress:
  enabled: false
  host: ""

# Non-secret env vars.
env: {}

infisical:
  enabled: false
  authRef:
    name: <infisical-auth>
    namespace: <infisical-auth-ns>
  projectId: ""
  environmentSlug: <infisical-env>
  secretPath: /<name>
  # Kubernetes env var name -> Infisical secret key.
  secrets: {}
```

For an upstream image, pin the upstream version instead (never `latest`, a sync must
be reproducible):

```yaml
image:
  repository: <upstream image, e.g. docker.io/vendor/app>
  # Bumped by hand; .github/workflows/<name>-deploy.yml only syncs.
  tag: "<upstream version>"
```

## values-prod.example.yaml (copy to values-prod.yaml, committed, no secrets)

```yaml
ingress:
  enabled: true
  host: "<domain>"
infisical:
  enabled: true
  projectId: "<infisical-project-id>"
# Scale to zero (see SKILL.md): uncomment to keep every workload stopped. PVCs remain.
# replicas: 0
# <component>.replicas: 0 for each database or cache the chart ships, e.g. postgres.replicas: 0
```

## templates/deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  replicas: {{ .Values.replicas }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
    spec:
      enableServiceLinks: false
      containers:
        - name: <name>
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: {{ .Values.service.port }}
          {{- with .Values.env }}
          env:
            {{- range $k, $v := . }}
            - name: {{ $k }}
              value: {{ $v | quote }}
            {{- end }}
          {{- end }}
          {{- if .Values.infisical.enabled }}
          envFrom:
            - secretRef:
                name: {{ .Release.Name }}-secrets
          {{- end }}
          readinessProbe:
            httpGet: { path: <health-path>, port: {{ .Values.service.port }} }
            initialDelaySeconds: 5
          livenessProbe:
            httpGet: { path: <health-path>, port: {{ .Values.service.port }} }
            initialDelaySeconds: 15
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          {{- if .Values.persistence }}
          volumeMounts:
            - name: data
              mountPath: /data
          {{- end }}
      {{- if .Values.persistence }}
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: {{ .Release.Name }}-data
      {{- end }}
```

Set `mountPath` to the directory the app writes to. If `env` is also set via `envFrom`
and `env`, make sure no key appears in both. Without an HTTP health endpoint, or when the
app rejects the pod IP as `Host`, use `tcpSocket: { port: ... }` probes.

## templates/service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  selector:
    app: {{ .Release.Name }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.port }}
```

## templates/ingress.yaml

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Release.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  ingressClassName: traefik
  tls:
    - hosts: [{{ .Values.ingress.host | quote }}]
      secretName: {{ .Release.Name }}-tls
  rules:
    - host: {{ .Values.ingress.host | quote }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Release.Name }}
                port:
                  number: {{ .Values.service.port }}
{{- end }}
```

## templates/pvc.yaml (stateful apps only)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ .Release.Name }}-data
  namespace: {{ .Release.Namespace }}
  annotations:
    # local-path reclaims with Delete, so without this `helm uninstall` wipes the data.
    helm.sh/resource-policy: keep
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: {{ .Values.persistence.storageClassName }}
  resources:
    requests:
      storage: {{ .Values.persistence.size }}
```

## templates/infisical-static-secret.yaml

```yaml
{{- if .Values.infisical.enabled }}
apiVersion: secrets.infisical.com/v1beta1
kind: InfisicalStaticSecret
metadata:
  name: {{ .Release.Name }}-secrets-sync
  namespace: {{ .Release.Namespace }}
spec:
  infisicalAuthRef:
    name: {{ .Values.infisical.authRef.name }}
    namespace: {{ .Values.infisical.authRef.namespace }}
  syncOptions:
    refreshInterval: 60s
  sources:
    - projectId: {{ .Values.infisical.projectId | quote }}
      environmentSlug: {{ .Values.infisical.environmentSlug }}
      secretPath: {{ .Values.infisical.secretPath | quote }}
  targets:
    - name: {{ .Release.Name }}-secrets
      namespace: {{ .Release.Namespace }}
      kind: Secret
      creationPolicy: Owner
      template:
        engineVersion: v1
        data:
          {{- range $envName, $infisicalKey := .Values.infisical.secrets }}
          # Not evaluated by Helm: printf emits literal text, the Infisical operator fills it in.
          {{ $envName }}: {{ printf "{{ .%s.Value }}" $infisicalKey | quote }}
          {{- end }}
{{- end }}
```

Fill `infisical.secrets` in `values.yaml`, e.g. `DATABASE_URL: DATABASE_URL`.

## Scale to zero on demand (KEDA HTTP Add-on)

Only when the user chose on-demand scale to zero (see SKILL.md). Requires `ingress.enabled`
and `ingress.host`. Resource names use `{{ .Release.Name }}`.

### values.yaml (append)

```yaml
# Needs KEDA and the HTTP Add-on on the cluster. Keep false for the first sync,
# set true in values-prod.yaml once the app works.
scaleToZero:
  enabled: false
  minReplicas: 0
  maxReplicas: 1
  # Seconds without matching requests before scaling back down to 0.
  cooldownPeriod: 300
  # Requests per second, averaged over `window`, that justify scaling up.
  targetRequestRate: 5
  window: 1m
```

### templates/ingress.yaml (backend branch)

Replace the `backend.service` block of the Ingress template with:

```yaml
              service:
                {{- if .Values.scaleToZero.enabled }}
                name: {{ .Release.Name }}-keda-proxy
                port:
                  number: 8080
                {{- else }}
                name: {{ .Release.Name }}
                port:
                  number: {{ .Values.service.port }}
                {{- end }}
```

### templates/keda-proxy.yaml

```yaml
{{- if .Values.scaleToZero.enabled }}
# An Ingress backend cannot reference a Service in another namespace. This ExternalName
# Service resolves to the KEDA HTTP Add-on interceptor proxy.
apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}-keda-proxy
  namespace: {{ .Release.Namespace }}
spec:
  type: ExternalName
  externalName: keda-add-ons-http-interceptor-proxy.keda.svc.cluster.local
  ports:
    - port: 8080
{{- end }}
```

### templates/scaletozero.yaml

```yaml
{{- if .Values.scaleToZero.enabled }}
# Tells the interceptor which requests belong to this app and which metric to report.
apiVersion: http.keda.sh/v1beta1
kind: InterceptorRoute
metadata:
  name: {{ .Release.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  target:
    service: {{ .Release.Name }}
    port: {{ .Values.service.port }}
  # A rule without `paths` matches only the literal root. The explicit "/" prefix
  # covers every path.
  rules:
    - hosts: [{{ .Values.ingress.host | quote }}]
      paths:
        - value: /
  scalingMetric:
    requestRate:
      targetValue: {{ .Values.scaleToZero.targetRequestRate }}
      window: {{ .Values.scaleToZero.window }}
      granularity: 1s
  # Shown while the pod starts. The ConfigMap must exist in this namespace.
  coldStart:
    placeholder:
      response:
        bodyFromConfigMap:
          name: coldstart-page
          key: index.html
        headers:
          Refresh: "3"
---
# Scales the app's Deployment (same name as the release) between 0 and maxReplicas
# by the request rate the interceptor reports.
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: {{ .Release.Name }}
  namespace: {{ .Release.Namespace }}
spec:
  scaleTargetRef:
    name: {{ .Release.Name }}
  minReplicaCount: {{ .Values.scaleToZero.minReplicas }}
  maxReplicaCount: {{ .Values.scaleToZero.maxReplicas }}
  cooldownPeriod: {{ .Values.scaleToZero.cooldownPeriod }}
  triggers:
    - type: external-push
      metadata:
        scalerAddress: keda-add-ons-http-external-scaler.keda:9090
        interceptorRoute: {{ .Release.Name }}
{{- end }}
```

### values-prod.yaml (after the first sync works)

```yaml
scaleToZero:
  enabled: true
```

## .github/workflows/<name>-build-push.yml (turbo app or local Dockerfile)

The block below is for a turbo app: context `.`, a Dockerfile from `docker/`, build args
from that Dockerfile's header. For a local Dockerfile use `context: apps/<name>`,
`file: apps/<name>/Dockerfile` and drop `build-args`.

```yaml
# Builds and pushes the <name> image, bumps the tag in the chart values, commits to
# <branch>, then syncs ArgoCD. The ArgoCD Application has no automated sync, so nothing
# deploys except through this workflow's sync step.
name: Build and push <name> image

on:
  push:
    tags:
      - '<name>-v*'
  workflow_dispatch: {}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Get version from tag
        id: vars
        run: echo "version=${GITHUB_REF_NAME#<name>-v}" >> "$GITHUB_OUTPUT"

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/<node|nextjs|node/prisma>/Dockerfile
          build-args: |
            APP=<name>
            PORT=<port>
          push: true
          tags: <registry>/<name>:<name>-v${{ steps.vars.outputs.version }}
          labels: org.opencontainers.image.source=https://github.com/${{ github.repository }}

      - name: Bump image tag in Helm values
        run: |
          sed -i "s/tag: <name>-v.*/tag: <name>-v${{ steps.vars.outputs.version }}/" apps/<name>/k8s/chart/values.yaml

      - name: Commit and push updated values
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          # A tag checkout is a detached HEAD. Switch to the branch ArgoCD tracks.
          git fetch origin <branch>
          git checkout <branch>
          git add apps/<name>/k8s/chart/values.yaml
          git diff --cached --quiet && echo "No changes to commit" || git commit -m "chore: bump <name> image to v${{ steps.vars.outputs.version }}"
          for i in 1 2 3; do
            git push origin <branch> && break
            echo "push rejected, rebasing and retrying ($i/3)"
            git fetch origin <branch>
            git rebase origin/<branch>
            sleep 2
          done

      - name: Install argocd CLI
        run: |
          curl -sSL -o /usr/local/bin/argocd \
            https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
          chmod +x /usr/local/bin/argocd

      - name: Sync via ArgoCD
        env:
          ARGOCD_AUTH_TOKEN: ${{ secrets.ARGOCD_AUTH_TOKEN }}
        run: |
          argocd app sync <name> --server <argocd-server> --grpc-web
          argocd app wait <name> --server <argocd-server> --grpc-web --health
```

## .github/workflows/<name>-deploy.yml (upstream image)

```yaml
# Syncs <name> through ArgoCD on a <name>-v* tag. The chart runs an upstream image
# unmodified, so there is no build and the tag carries no version: it is only the
# deploy signal. The ArgoCD Application has no automated sync.
name: Deploy <name>

on:
  push:
    tags:
      - '<name>-v*'
  workflow_dispatch: {}

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Install argocd CLI
        run: |
          curl -sSL -o /usr/local/bin/argocd \
            https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
          chmod +x /usr/local/bin/argocd

      - name: Sync via ArgoCD
        env:
          ARGOCD_AUTH_TOKEN: ${{ secrets.ARGOCD_AUTH_TOKEN }}
        run: |
          argocd app sync <name> --server <argocd-server> --grpc-web
          argocd app wait <name> --server <argocd-server> --grpc-web --health
```

## ArgoCD Application (print for the user; they add it to the GitOps repo)

File: `<name>.yaml` next to the other Application manifests in the GitOps repo.

```yaml
# ArgoCD Application for <name>. Deploys only through the <name>-v* tag, whose workflow
# ends with `argocd app sync`; automated sync stays off.
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: <name>
  namespace: argocd
spec:
  project: default
  source:
    repoURL: <repo-url>
    targetRevision: <branch>
    path: apps/<name>/k8s/chart
    helm:
      valueFiles:
        - values.yaml
        - values-prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: <name>
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
```

With app-of-apps (see Cluster facts), pushing the file is enough. No `kubectl apply`.