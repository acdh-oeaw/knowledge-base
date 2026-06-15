#!/bin/sh

set -eu

echo "Creating pods..."

kubectl -n the-knowledge-base apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pg-proxy
  labels:
    app: pg-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pg-proxy
  template:
    metadata:
      labels:
        app: pg-proxy
    spec:
      containers:
      - name: socat
        image: alpine/socat
        command:
          - socat
          - TCP-LISTEN:5432,fork
          - TCP:acdh-ch-ha-postgres-cluster-pgbouncer.postgres-cluster.svc:5432
        ports:
          - containerPort: 5432
EOF

kubectl -n the-knowledge-base apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: s3-proxy
  labels:
    app: s3-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: s3-proxy
  template:
    metadata:
      labels:
        app: s3-proxy
    spec:
      containers:
      - name: socat
        image: alpine/socat
        command:
          - socat
          - TCP-LISTEN:8080,fork
          - TCP:s3-loadbalancer.s3-gateway.svc:8080
        ports:
          - containerPort: 8080
EOF

cleanup() {
  trap - EXIT INT TERM
  echo "Stopping port-forwards..."
  kill "$pid1" "$pid2" 2>/dev/null
}

interrupt() {
  cleanup
  exit 130
}

echo "Starting port-forwards..."

trap cleanup EXIT
trap interrupt INT TERM

kubectl -n the-knowledge-base port-forward deployment/pg-proxy 5432:5432 &
pid1=$!

kubectl -n the-knowledge-base port-forward deployment/s3-proxy 8080:8080 &
pid2=$!

wait
