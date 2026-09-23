# Independent web deployment

Customer URL: **https://pdfmaster.orderdesk.live/en/app**.

This repository deploys only Docker project `pdfmaster-web`, rooted at `~/pdf-master/web`, with its own private Compose network and gateway at `127.0.0.1:8310`. It does not start, stop, migrate or roll back `pdfmaster-platform` or any other server project. The platform/admin runs independently at **https://pdfmaster-admin.orderdesk.live/ops/login**.

The Nuxt `/api` proxy targets the platform's public HTTPS origin. There is no shared application Docker network or database volume. Backend API availability remains a functional dependency; independent deployment requires backward-compatible API changes. Platform restarts do not restart the web containers.

Read the [full operations runbook](https://github.com/shahzodjonweb/document-platform/blob/main/docs/cicd.md). Both repositories accept `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` from GitHub Actions Secrets or Variables. The SSH account is `root`; the target is `77.42.34.241`. Values are passed as masked inputs to the reusable deployment job. A key in Variables remains readable in variable settings. The server must authorize the matching public key for root.

CI checks the API/catalog contract, types and production build, tests release isolation, then starts the actual web Compose stack and gateway. Passing main releases are delivered over pinned SSH and deployed independently. No platform release or checksum match is needed. First delivery creates only the web environment. Failed activation restores only the previous web image. No database commands or global Docker cleanup are issued.

Optional Actions Variables: `DEPLOY_PORT` (default 22), `DEPLOY_PLATFORM` (default `linux/amd64`, also supports `linux/arm64`). Use `scripts/deploy/configure_variables.py --storage secrets` from either repository to configure both from verified local credential files, or omit `--storage secrets` to use Variables.

`infra/production/Caddyfile` contains this site's host-proxy route. For containerized ingress, the optional `proxy-network.example.yaml` attaches only this project's gateway with alias `pdfmaster-web-gateway`; it is stored as `~/pdf-master/web/compose.override.yaml` on the server. Existing projects and TLS routes must be preserved. Routine deployments do not reload or edit the shared TLS proxy.

Rollback only this project:

```sh
python3 ~/pdf-master/web/incoming/RELEASE_DIRECTORY/server.py rollback --component web
```

The protocol-v2 helpers and tests are shared in source between repositories, but runtime state, deployment locks and Compose commands are completely separate. A successful CI run with a missing-configuration notice does not mean the website was deployed.
