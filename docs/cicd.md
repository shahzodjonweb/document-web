# Web CI/CD

This repository deploys the customer application into the same isolated `pdfmaster` Docker Compose project as the API, admin panel, workers and Telegram bot. The platform repository owns the stack configuration. Follow the complete [server setup and deployment runbook](https://github.com/shahzodjonweb/document-platform/blob/main/docs/cicd.md).

Add these repository Actions variables to **both** private repositories:

- `DEPLOY_HOST`: server hostname or IP.
- `DEPLOY_USER`: SSH deployment account with Docker access.
- `DEPLOY_SSH_KEY`: complete private deployment key usable without an interactive passphrase.
- `DEPLOY_KNOWN_HOSTS`: verified OpenSSH host-key entry for the target host and port.

Use [web variables settings](https://github.com/shahzodjonweb/document-web/settings/variables/actions) and [platform variables settings](https://github.com/shahzodjonweb/document-platform/settings/variables/actions), or the helper from either repository:

Choose **Settings → Secrets and variables → Actions → Variables → New repository variable**. `ci.yml` reads `vars.DEPLOY_*` and passes them into `deploy.yml` as masked reusable-workflow secret inputs; these names do not need repository Secrets entries. This protects deployment logs, while people with access to GitHub variable settings can still read the stored values, including the SSH key.

```sh
python3 scripts/deploy/configure_variables.py \
  --host your-server.example --user deploy \
  --key-file /absolute/path/deployment-key \
  --known-hosts-file /absolute/path/verified-known-hosts
```

The helper reads key files without printing their contents and verifies the four variable names in both private repositories. Confirm host fingerprints through a trusted server console or existing trusted record. Do not commit private keys. `--port` sets the optional `DEPLOY_PORT` variable for a nonstandard port. The optional `DEPLOY_PLATFORM` variable supports `linux/amd64` (default) or `linux/arm64`; set it consistently in both repositories.

Pull requests check the catalog/API contract, TypeScript and production build, test release transactions, then build and smoke-test the Docker image. Successful `main` workflows package the tested image and send it over strict host-pinned SSH. No private registry token is needed. Missing variables produce an explicit **Deployment not configured** summary, with no server connection. A green build alone does not mean deployment succeeded.

The first component waits for its partner. A public API checksum change waits for a matching platform/web pair; a server-side lock serializes both repositories. An older delayed workflow cannot replace a newer release. Deployment backs up the database, migrates, updates services and checks health. Failed activation restores previous images when available; database migrations are not reversed.

Prepare the server environment, domain and TLS using the platform runbook before configuring deployment access. Trigger both workflows for the initial activation:

```sh
gh workflow run ci.yml --repo shahzodjonweb/document-platform --ref main
gh workflow run ci.yml --repo shahzodjonweb/document-web --ref main
```

Check the deployment job's final server result. A staged release is waiting and has not activated a new stack. The shared files in `scripts/deploy/` implement release protocol version 1; keep matching helpers and tests synchronized between repositories. The production stack uses its own volumes, network and loopback gateway port so another Docker application can remain on the server.
