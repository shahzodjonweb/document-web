# Independent web deployment

Customer URL: **https://docmaster.live/en/app**.

This repository deploys only Docker project `docmaster-web`, rooted at `~/docmaster/web`, with its own private Compose network and gateway at `127.0.0.1:8310`. It does not start, stop, migrate or roll back `docmaster-platform` or any other server project. The platform/admin runs independently at **https://api.docmaster.live/ops/login**.

The Nuxt `/api` proxy targets the platform's public HTTPS origin. There is no shared application Docker network or database volume. Backend API availability remains a functional dependency; independent deployment requires backward-compatible API changes. Platform restarts do not restart the web containers.

Read the [full operations runbook](https://github.com/shahzodjonweb/document-platform/blob/main/docs/cicd.md). Both repositories accept `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` from GitHub Actions Secrets or Variables. The verified SSH account is `orderdesk-deploy`; the target is `77.42.34.241`. Values are passed as masked inputs to the reusable deployment job. A key in Variables remains readable in variable settings. The matching public key is authorized for this deployment account; it is not authorized for root.

CI checks the API/catalog contract, types and production build, tests release isolation, then starts the actual web Compose stack and gateway. Passing main releases are delivered over pinned SSH and deployed independently. No platform release or checksum match is needed. First delivery creates only the web environment. Failed activation restores only the previous web image. No database commands or global Docker cleanup are issued.

Optional Actions Variables: `DEPLOY_PORT` (default 22), `DEPLOY_PLATFORM` (default `linux/amd64`, also supports `linux/arm64`). Use `scripts/deploy/configure_variables.py --storage secrets` from either repository to configure both from verified local credential files, or omit `--storage secrets` to use Variables.

HTTPS is DocMaster's own Caddy (compose project `docmaster-proxy`), set up and changed through the platform's server operations ([its runbook](https://github.com/shahzodjonweb/document-platform/blob/main/docs/cicd.md#https)). The server-owned `~/docmaster/web/compose.override.yaml` joins only this project's gateway to the `docmaster-proxy` network under the alias `docmaster-web-gateway`. Routine deployments never touch the proxy.

Rollback only this project:

```sh
python3 ~/docmaster/web/incoming/RELEASE_DIRECTORY/server.py rollback --component web
```

The protocol-v2 helpers and tests are shared in source between repositories, but runtime state, deployment locks and Compose commands are completely separate. A successful CI run with a missing-configuration notice does not mean the website was deployed.
