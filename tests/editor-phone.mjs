/**
 * The editor's new frame on phones, behind `editor_v2`.
 *
 * Every API call is a fixture and Telegram is a stub with spies, so this says what
 * the app asks of Telegram, not what Telegram does with it. A real client has the
 * last word. The screenshots are for reading: checks here have passed on broken
 * layouts before.
 */
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const origin = process.env.EDITOR_WEB_ORIGIN || 'http://127.0.0.1:3002'
assert.ok(
  ['127.0.0.1', 'localhost'].includes(new URL(origin).hostname),
  'Use the local web server for this fixture test',
)
const output = path.resolve(process.env.EDITOR_ARTIFACT_DIR || '../editor-review/workspace', 'phone')
await fs.mkdir(output, { recursive: true })

const pdfBytes = await fs.readFile('tests/fixtures/research-notes.pdf')
// Four made-up pages, each with its number large, so turned and moved pages can be told apart.
const numberedBytes = await fs.readFile('tests/fixtures/numbered-pages.pdf')
// Two made-up scanned pages: a picture each, with no words of their own.
const scannedBytes = await fs.readFile('tests/fixtures/scanned-pages.pdf')
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
// A signature's worth of ink on nothing, 60 by 20.
const inkPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAADwAAAAUCAYAAADRA14pAAAAoElEQVR42u2W0Q2AIAxEuSn8dgH3n4MF+GYK/TIhRgHbK5HYlxAjCfXu2qghOI7zS5Z128vrLEBjtiSnCHaYzJpiw6XZnCKu9yyzVoFCY7a1rzHKrv/acOuhGlG9Z2uhUA1LBPWI0RiQBgy2IKtwWBpNBNXOMsZSoxlW6d/VYL/RJV2H1aiN+MT0ang0bNGBUV0VCTuX9Yh97v/YcZxpOACt25HOtPgTGgAAAABJRU5ErkJggg==',
  'base64',
)
const DOC = '00000000-0000-4000-8000-000000000001'
const FILE = '00000000-0000-4000-8000-0000000000f1'
// What a send makes: its artifact row and the file it stores, which Edit under it opens.
const RESULT = '00000000-0000-4000-8000-0000000000e1'
const ARTIFACT = '00000000-0000-4000-8000-0000000000e2'
const COST = { kind: 'file_task', left: 11, limit: 15 }
const PAGE = { width: 595.276, height: 841.89 }
const MARKS = () => [
  { type: 'add_text', page: 1, x: 80, y: 320, text: 'Fixture words', font_size: 16, color: '#17212E' },
  { type: 'highlight', page: 1, x: 80, y: 420, width: 220, height: 40, color: '#FFFF00' },
]

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const checks = []
const passed = (name) => checks.push(name)

/** Telegram's object as the app sees it, refusing anything the claimed version would not have. */
function telegramStub({ inside, scheme, version, platform, stable, safeBottom, kept }) {
  const atLeast = (wanted) => {
    const a = String(version).split('.').map(Number)
    const b = String(wanted).split('.').map(Number)
    return (a[0] ?? 0) > (b[0] ?? 0) || ((a[0] ?? 0) === (b[0] ?? 0) && (a[1] ?? 0) >= (b[1] ?? 0))
  }
  const log = []
  const violations = []
  const gated =
    (name, minimum, run = () => {}) =>
    (...args) => {
      log.push([name, ...args])
      if (!atLeast(minimum)) violations.push(`${name} below ${minimum}`)
      return run(...args)
    }
  const button = (prefix, minimum) => {
    const clicks = new Set()
    const self = {
      isVisible: false,
      text: '',
      isActive: true,
      progress: false,
      setParams(params) {
        log.push([`${prefix}.setParams`, params])
        if (params.text !== undefined) self.text = params.text
        if (params.is_active !== undefined) self.isActive = params.is_active
        if (params.is_visible !== undefined) self.isVisible = params.is_visible
      },
      show: gated(`${prefix}.show`, minimum, () => (self.isVisible = true)),
      hide: gated(`${prefix}.hide`, minimum, () => (self.isVisible = false)),
      showProgress: gated(`${prefix}.showProgress`, minimum, () => (self.progress = true)),
      hideProgress: gated(`${prefix}.hideProgress`, minimum, () => (self.progress = false)),
      onClick: gated(`${prefix}.onClick`, minimum, (run) => clicks.add(run)),
      offClick: gated(`${prefix}.offClick`, minimum, (run) => clicks.delete(run)),
      press: () => [...clicks].forEach((run) => run()),
      handlers: () => clicks.size,
    }
    return self
  }
  const events = new Map()
  const app = {
    initData: inside ? 'fixture' : '',
    version,
    platform,
    colorScheme: scheme,
    viewportStableHeight: stable ?? window.innerHeight,
    safeAreaInset: { top: 0, bottom: safeBottom, left: 0, right: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    isFullscreen: false,
    isVersionAtLeast: atLeast,
    ready: () => log.push(['ready']),
    expand: () => log.push(['expand']),
    close: () => log.push(['close']),
    onEvent(name, run) {
      if (!events.has(name)) events.set(name, new Set())
      events.get(name).add(run)
    },
    offEvent: (name, run) => events.get(name)?.delete(run),
    MainButton: button('MainButton', '6.0'),
    BackButton: button('BackButton', '6.1'),
    HapticFeedback: {
      notificationOccurred: gated('haptic', '6.1'),
      impactOccurred: gated('haptic', '6.1'),
      selectionChanged: gated('haptic', '6.1'),
    },
    enableClosingConfirmation: gated('enableClosingConfirmation', '6.2'),
    disableClosingConfirmation: gated('disableClosingConfirmation', '6.2'),
    disableVerticalSwipes: gated('disableVerticalSwipes', '7.7'),
    enableVerticalSwipes: gated('enableVerticalSwipes', '7.7'),
    requestFullscreen: gated('requestFullscreen', '8.0'),
    exitFullscreen: gated('exitFullscreen', '8.0'),
    hideKeyboard: gated('hideKeyboard', '9.1'),
  }
  // The phone's own storage, from 9.0: what it holds is Telegram's, not the web view's.
  const stored = new Map(kept ? [['pdf-master-signatures', kept]] : [])
  app.DeviceStorage = {
    setItem: gated('DeviceStorage.setItem', '9.0', (key, value, done) => {
      stored.set(key, value)
      setTimeout(() => done?.(null, true))
    }),
    getItem: gated('DeviceStorage.getItem', '9.0', (key, done) =>
      setTimeout(() => done?.(null, stored.get(key) ?? '')),
    ),
    removeItem: gated('DeviceStorage.removeItem', '9.0', (key, done) => {
      stored.delete(key)
      setTimeout(() => done?.(null, true))
    }),
  }
  window.Telegram = { WebApp: app }
  // A keyboard shows only in the visual viewport on iOS Telegram.
  const view = new EventTarget()
  Object.assign(view, {
    width: window.innerWidth,
    height: window.innerHeight,
    offsetTop: 0,
    offsetLeft: 0,
    scale: 1,
  })
  Object.defineProperty(window, 'visualViewport', { value: view, configurable: true })
  window.__tg = {
    app,
    log,
    violations,
    stored,
    emit: (name, argument) => events.get(name)?.forEach((run) => run(argument)),
    keyboard(height) {
      view.height = window.innerHeight - height
      view.dispatchEvent(new Event('resize'))
    },
  }
}

/** A context with the app's API answered from `server`. */
async function openContext({
  width,
  height,
  theme = 'light',
  locale = 'en',
  inside = true,
  version = '9.1',
  platform = 'android',
  stable,
  safeBottom = 0,
  editor = { editor_v2: true },
  clock = false,
  marks = MARKS(),
  preview,
  download,
  configFails = false,
  catalog = [],
  expiresIn = 86400000,
  refuseSaves = null,
  configDelay = 0,
  remembered = false,
  formFields = [],
  kept = null,
  pageCount = 2,
  pdf = pageCount === 4 ? numberedBytes : pdfBytes,
  imageCounts = Array.from({ length: pageCount }, () => 0),
  ranges = false,
  // A ranged read that fails, by its count: 'abort' or a status; and the whole file's status when that fails too.
  rangeFails = null,
  wholeFails = 0,
  // How long a picture placed on a page takes to go up, or that by its count.
  uploadDelay = 0,
  // A picture's upload that fails, by its count: the status it meets.
  uploadFails = null,
  // How many looks at a job find it still waiting for its turn, or that by the job's number.
  queued = 1,
  // A look at a job that fails, by the job's number and the look's count: [status, how long it takes].
  pollFails = null,
  // The same draft sent again while its job is still on its way is answered with that job, as the server does.
  reuse = false,
  // The send: what the quote costs, a refusal for the nth quote, how long a quote lasts,
  // what the nth job request meets, how the job ends and what it says of each change.
  cost = COST,
  quoteRefusal = null,
  quoteTtl = 600000,
  jobAnswer = null,
  jobOutcome = 'succeeded',
  perCommand = [],
  // Opening the bot's link: the refusal POST /editor/documents answers with, if any.
  openRefusal = null,
  downloadDelay = 0,
  scale = 1,
  // Jobs already made, as the task page reads them.
  presetJobs = [],
}) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    colorScheme: theme,
    hasTouch: width < 980,
    deviceScaleFactor: scale,
    locale,
  })
  await context.addInitScript(telegramStub, {
    inside,
    scheme: theme,
    version,
    platform,
    stable: stable ?? null,
    safeBottom,
    kept,
  })
  await context.addInitScript((value) => {
    try {
      if (!localStorage.getItem('pdf-master-theme')) localStorage.setItem('pdf-master-theme', value)
    } catch {}
  }, theme)
  if (remembered) await context.addInitScript(() => localStorage.setItem('pdf-master-editor-v2', '1'))
  const server = {
    requests: [],
    version: 1,
    commands: marks.map((mark) => ({ ...mark })),
    inputIds: [FILE],
    uploads: [],
    previews: 0,
    unexpected: [],
    quotes: [],
    jobPosts: [],
    jobs: [],
  }
  /** A job as GET /jobs/{id} answers it: waiting, then running, then as it ends. */
  const jobBody = (job) => {
    const waits = typeof queued === 'function' ? queued(server.jobs.indexOf(job) + 1) : queued
    const status =
      job.polls < waits
        ? 'queued'
        : job.polls < waits + 1
          ? 'running'
          : Array.isArray(jobOutcome)
            ? 'failed'
            : jobOutcome
    return {
      id: job.id,
      feature_id: 'editor.visual',
      status,
      created_at: new Date().toISOString(),
      input_files: [],
      warnings: [],
      parameters: { editor_document_id: DOC, version: job.version, deliver: job.deliver },
      origin_channel: job.toChat ? 'mini_app' : 'web',
      error:
        status === 'failed'
          ? { code: jobOutcome[0], message: `Fixture ${jobOutcome[0]}`, message_params: jobOutcome[1] ?? {} }
          : null,
      artifacts:
        status === 'succeeded'
          ? [
              {
                id: ARTIFACT,
                file_id: RESULT,
                name: 'Fixture_edited.pdf',
                mime_type: 'application/pdf',
                size_bytes: 120000,
                download_url: `/api/v1/artifacts/${ARTIFACT}/download`,
              },
            ]
          : [],
      ...(status === 'succeeded' ? { per_command: perCommand } : {}),
    }
  }
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue()
    if (url.hostname === 'telegram.org')
      return route.fulfill({ contentType: 'application/javascript', body: '' })
    return route.abort('blockedbyclient')
  })
  await context.route(`${origin}/api/v1/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const endpoint = url.pathname.replace('/api/v1', '')
    const method = request.method()
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    server.requests.push({
      endpoint,
      method,
      body: /json/.test(request.headers()['content-type'] ?? '') ? request.postDataJSON() : null,
    })
    const documentBody = () => ({
      id: DOC,
      version: server.version,
      file: {
        id: FILE,
        name: 'Fixture_shartnoma_2026_yakuniy_nusxa.pdf',
        page_count: pageCount,
        mime_type: 'application/pdf',
        state: 'ready',
        expires_at: new Date(Date.now() + expiresIn).toISOString(),
      },
      pages: Array.from({ length: pageCount }, () => PAGE),
      form_fields: formFields,
      image_counts: imageCounts,
      commands: server.commands,
      input_ids: server.inputIds,
      limits: { commands: 100, bytes: 100000 },
    })
    if (endpoint === '/auth/session')
      return json({
        user: { id: 'u1', email: 'fixture@example.test', display_name: 'Fixture', plan: 'free', locale },
        csrf_token: 'x',
        development_login_enabled: false,
      })
    if (endpoint === '/me') return json({ id: 'u1', display_name: 'Fixture', plan: 'free', locale })
    if (endpoint === '/catalog') return json({ features: catalog, draft: true })
    if (endpoint === '/plans') {
      server.plansBeforeConfig ??= !server.configAnswered
      return json({ plans: [{ id: 'free', name: 'free', limits: {} }], draft: true })
    }
    if (endpoint === '/usage')
      return json({
        plan: 'free',
        week: {
          starts_at: '2026-10-11T19:00:00Z',
          resets_at: '2026-10-18T19:00:00Z',
          time_zone: 'Asia/Tashkent',
        },
        resets_at: '2026-10-18T19:00:00Z',
        ai_documents: { limit: 5, used: 0, remaining: 5 },
        file_jobs: { limit: 15, used: 4, remaining: 11 },
        edits_per_file: 3,
      })
    if (endpoint === '/jobs' && method === 'GET') return json({ results: [], count: 0 })
    if (endpoint === '/jobs' && method === 'POST') {
      const key = request.headers()['idempotency-key']
      const body = request.postDataJSON()
      server.jobPosts.push({ key, body })
      const answer = jobAnswer?.(server.jobPosts.length) ?? 'ok'
      if (answer === 'drop') return route.abort('connectionreset')
      if (answer === 'slow') await new Promise((resolve) => setTimeout(resolve, 1500))
      if (Array.isArray(answer))
        return json(
          { error: { code: answer[0], message: `Fixture ${answer[0]}`, message_params: answer[2] ?? {} } },
          answer[1],
        )
      const known = server.jobs.find((job) => job.key === key)
      if (known) return json(jobBody(known), 200)
      const quote = server.quotes.find((item) => item.id === body.quote_id)
      const same =
        reuse &&
        server.jobs.find(
          (job) => job.version === quote?.body.version && ['queued', 'running'].includes(jobBody(job).status),
        )
      if (same) return json(jobBody(same), 200)
      const job = {
        id: `00000000-0000-4000-8000-0000000000c${server.jobs.length + 1}`,
        key,
        quote: body.quote_id,
        toChat: body.deliver_to_chat === true,
        version: quote?.body.version,
        deliver: quote?.body.deliver,
        polls: 0,
      }
      server.jobs.push(job)
      return json(jobBody(job), 201)
    }
    if (/^\/jobs\/[^/]+$/.test(endpoint) && method === 'GET') {
      const preset = presetJobs.find((item) => item.id === endpoint.split('/')[2])
      if (preset) return json(preset)
      const job = server.jobs.find((item) => item.id === endpoint.split('/')[2])
      if (!job) return json({ error: { code: 'not_found' } }, 404)
      job.polls += 1
      const failure = pollFails?.(server.jobs.indexOf(job) + 1, job.polls)
      if (failure) {
        await new Promise((resolve) => setTimeout(resolve, failure[1] ?? 0))
        return json({ error: { code: 'upstream_unavailable', message: 'Fixture' } }, failure[0])
      }
      return json(jobBody(job))
    }
    if (endpoint === '/studio/config') {
      if (configFails) return json({ error: { code: 'upstream_unavailable' } }, 503)
      if (configDelay) await new Promise((resolve) => setTimeout(resolve, configDelay))
      server.configAnswered = true
      return json({ features: [], provider: {}, limits: editor ? { editor } : {} })
    }
    if (endpoint === '/editor/form-templates') return json({ results: [], limit: 30 })
    if (endpoint === '/editor/documents' && method === 'GET') return json({ results: [] })
    if (endpoint === '/editor/documents' && method === 'POST') {
      if (openRefusal)
        return json(
          {
            error: {
              code: openRefusal[0],
              message: `Fixture ${openRefusal[0]}`,
              message_params: openRefusal[2] ?? {},
            },
          },
          openRefusal[1],
        )
      return json({ id: DOC }, 201)
    }
    if (endpoint === `/editor/documents/${DOC}` && method === 'GET') return json(documentBody())
    if (endpoint === `/editor/documents/${DOC}` && method === 'PATCH') {
      const body = request.postDataJSON()
      if (refuseSaves)
        return json({ error: { code: refuseSaves[0], message: 'Fixture refusal' } }, refuseSaves[1])
      if (body.version !== server.version)
        return json({ error: { code: 'version_conflict', message: 'Fixture' } }, 409)
      server.commands = body.commands
      server.inputIds = body.input_ids
      server.version += 1
      return json(documentBody())
    }
    if (endpoint === `/editor/documents/${DOC}/quote` && method === 'POST') {
      const body = request.postDataJSON()
      // Today's editor: the marks travel with its quote, and it gets no summary.
      if (!body.deliver)
        return json(
          {
            id: '00000000-0000-4000-8000-0000000000a1',
            feature_id: 'editor.visual',
            affordable: true,
            usage: { file_jobs: { limit: 15, used: 4, remaining: 11 }, resets_at: '2026-10-18T19:00:00Z' },
            expires_at: new Date(Date.now() + 600000).toISOString(),
          },
          201,
        )
      // A send of the stored draft, refused as the server refuses it.
      if (body.version !== server.version)
        return json({ error: { code: 'version_conflict', message: 'Fixture', message_params: {} } }, 409)
      const refusal = quoteRefusal?.(server.quotes.length + 1, body)
      if (refusal) {
        server.quotes.push({ id: null, body })
        return json(
          { error: { code: refusal[0], message: `Fixture ${refusal[0]}`, message_params: refusal[2] ?? {} } },
          refusal[1],
        )
      }
      const deleted = server.commands.filter((item) => item.type === 'delete_page').map((item) => item.page)
      const raster = [
        ...new Set(
          server.commands
            .filter((item) => item.type === 'redact' && !deleted.includes(item.page))
            .map((item) => item.page),
        ),
      ].sort()
      if (raster.length && !body.accept_rasterization) {
        server.quotes.push({ id: null, body })
        return json(
          {
            error: {
              code: 'rasterization_consent_required',
              message: 'Fixture',
              message_params: { pages: raster },
            },
          },
          400,
        )
      }
      const changes = {}
      for (const item of server.commands)
        if ('page' in item) changes[item.page] = (changes[item.page] ?? 0) + 1
      const id = `00000000-0000-4000-8000-0000000000${(0xa0 + server.quotes.length).toString(16)}`
      server.quotes.push({ id, body })
      return json(
        {
          id,
          feature_id: 'editor.visual',
          affordable: true,
          expires_at: new Date(Date.now() + quoteTtl).toISOString(),
          summary: {
            changes_by_page: changes,
            pages_before: pageCount,
            pages_after: pageCount - deleted.length,
            raster_pages: raster,
            size_estimate: 1_288_490,
            kept_until: new Date(Date.now() + 86400000).toISOString(),
            cost: typeof cost === 'function' ? cost(server.quotes.length) : cost,
          },
        },
        201,
      )
    }
    if (endpoint === '/telegram/local/messages')
      return json({
        messages: [
          {
            id: 'm1',
            direction: 'in',
            text: 'Fixture file',
            asset: {
              id: 'a1',
              name: 'fixture.pdf',
              size_bytes: 2048,
              download_url: '/api/v1/files/a1/download',
              preview_url: '/api/v1/files/a1/preview',
            },
          },
        ],
      })
    const part = /Content-Type: (image\/\w+)/i.exec(method === 'POST' ? (request.postData() ?? '') : '')
    if (endpoint === '/files/uploads' && part) {
      // A picture placed on a page: an ordinary 24-hour input, of the kind it was sent as.
      const kind = part[1]
      server.uploadTries = (server.uploadTries ?? 0) + 1
      const delay = typeof uploadDelay === 'function' ? uploadDelay(server.uploadTries) : uploadDelay
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      const fails = uploadFails?.(server.uploadTries)
      if (fails) return json({ error: { code: 'upstream_unavailable', message: 'Fixture' } }, fails)
      const id = `00000000-0000-4000-8000-0000000001${String(server.uploads.length + 1).padStart(2, '0')}`
      server.uploads.push({ id, kind, bytes: request.postDataBuffer()?.length ?? 0 })
      return json({ id, name: 'picture', size_bytes: 1000, mime_type: kind, state: 'ready' }, 201)
    }
    if (/^\/files\/0{8}-0000-4000-8000-0{9}1\d\d$/.test(endpoint) && method === 'GET')
      return json({ id: endpoint.split('/')[2], name: 'picture', mime_type: 'image/png', state: 'ready' })
    if (/^\/files\/0{8}-0000-4000-8000-0{9}1\d\d\/download$/.test(endpoint))
      return route.fulfill({ status: 200, contentType: 'image/png', body: inkPng })
    if (endpoint === '/files/uploads' && method === 'POST')
      return json(
        {
          id: 'a2',
          name: 'fixture.pdf',
          size_bytes: 1000,
          page_count: 3,
          mime_type: 'application/pdf',
          state: 'ready',
          preview_url: '/api/v1/files/a2/preview',
        },
        201,
      )
    if (/^\/files\/[^/]+\/download$/.test(endpoint)) {
      if (download) return json({ error: { code: 'upstream_unavailable' } }, download)
      if (downloadDelay) await new Promise((resolve) => setTimeout(resolve, downloadDelay))
      // As the platform answers since this step: one bytes range is a 206, anything else the whole file.
      const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers().range ?? '')
      server.downloads = [...(server.downloads ?? []), request.headers().range ?? '']
      if (ranges && range) {
        server.ranged = (server.ranged ?? 0) + 1
        const failure = rangeFails?.(server.ranged)
        if (failure === 'abort') return route.abort('connectionreset')
        if (failure) return json({ error: { code: 'upstream_unavailable' } }, failure)
        const start = Number(range[1])
        const end = Math.min(range[2] ? Number(range[2]) : pdf.length - 1, pdf.length - 1)
        return route.fulfill({
          status: 206,
          headers: {
            'content-type': 'application/pdf',
            'accept-ranges': 'bytes',
            'content-range': `bytes ${start}-${end}/${pdf.length}`,
            'content-length': String(end - start + 1),
          },
          body: pdf.subarray(start, end + 1),
        })
      }
      if (wholeFails) return json({ error: { code: 'upstream_unavailable' } }, wholeFails)
      return route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-length': String(pdf.length),
          ...(ranges ? { 'accept-ranges': 'bytes' } : {}),
        },
        body: pdf,
      })
    }
    if (/^\/files\/[^/]+\/preview$/.test(endpoint)) {
      server.previews += 1
      const answer = preview?.(server.previews)
      if (answer === 'drawing') return json({ task_id: '00000000-0000-4000-8000-0000000000b1' }, 202)
      if (answer === 'busy')
        return json({ error: { code: 'lane_busy', message: 'Fixture', retryable: true } }, 429)
      if (answer === 'gone') return json({ error: { code: 'not_found' } }, 404)
      return route.fulfill({ status: 200, contentType: 'image/png', body: onePixelPng })
    }
    server.unexpected.push(`${method} ${endpoint}`)
    return json({ error: { code: 'unexpected_fixture_request' } }, 404)
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  if (clock) await page.clock.install()
  return { context, page, server, errors, locale }
}

const goToDocument = async ({ page, locale }) => {
  await page.goto(`${origin}/${locale}/app/editor/${DOC}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('editor-page-1').waitFor()
  await page.waitForFunction(() => !document.querySelector('[data-testid="editor-opening"]'))
}
const spy = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__tg.log)))
const spied = async (page, name) => (await spy(page)).filter((call) => call[0] === name)
const mainButton = (page) =>
  page.evaluate(() => {
    const { isVisible, text, isActive } = window.__tg.app.MainButton
    return { isVisible, text, isActive, handlers: window.__tg.app.MainButton.handlers() }
  })
const backButton = (page) =>
  page.evaluate(() => ({
    isVisible: window.__tg.app.BackButton.isVisible,
    handlers: window.__tg.app.BackButton.handlers(),
  }))
const pressBack = (page) => page.evaluate(() => window.__tg.app.BackButton.press())
const pressMain = (page) => page.evaluate(() => window.__tg.app.MainButton.press())
const closeSheet = (page) => page.locator('dialog[open] [data-testid="editor-sheet-close"]').click()
const selectMark = async (page, kind = 'highlight') => {
  await page.locator(`.editor-mark.${kind}`).first().click()
  await page.getByTestId('editor-object-sheet').waitFor()
}
/** Chromium has no Uzbek months and writes "2026 M11 7"; nothing on screen may read that way. */
const noPlaceholderMonth = async (page, label) => {
  const text = await page.evaluate(() => document.body.innerText)
  assert.doesNotMatch(text, /\bM\d{1,2}\b/, `${label}: a month with no name`)
}
const noSidewaysScroll = async (page, label) => {
  const { scrollWidth, width } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }))
  assert.ok(scrollWidth <= width, `${label}: the page scrolls sideways (${scrollWidth} over ${width})`)
}
/** Every control a thumb can reach, in the frame and its sheets. Marks on the paper have their own rules. */
const smallTargets = (page, frame = '[data-testid="editor-frame"]') =>
  page.evaluate((frame) => {
    const seen = []
    const visible = (node) => {
      const box = node.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden'
    }
    const open = document.querySelector('dialog.editor-sheet:modal')
    const root = open ?? document.querySelector(frame)
    for (const node of root.querySelectorAll('button, a[href], select, summary, input:not([type=file])')) {
      if (!visible(node) || node.closest('.editor-layer')) continue
      if (node.matches('input[type=checkbox], input[type=color]')) continue
      if (node.closest('.visually-hidden')) continue
      const box = node.getBoundingClientRect()
      if (box.height < 43.5 || box.width < 43.5)
        seen.push(
          `${node.tagName} ${node.getAttribute('data-testid') || node.textContent.trim().slice(0, 24) || node.getAttribute('aria-label')}: ${Math.round(box.width)}x${Math.round(box.height)}`,
        )
    }
    return seen
  }, frame)
const axe = async (page, label) => {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const found = result.violations.map((item) => `${item.id}: ${item.nodes[0]?.target}`)
  assert.deepEqual(found, [], `${label}: axe`)
}
/** What Android's text size does: every line grows and the boxes are left to cope. */
const scaleText = (page, factor = 1.3) =>
  page.evaluate((scale) => {
    // Read first: a parent's new size would count again in the child that inherits it.
    const nodes = [...document.querySelectorAll('body *')].filter((node) => !node.closest('.editor-page'))
    const sizes = nodes.map((node) => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, index) => (node.style.fontSize = `${sizes[index] * scale}px`))
  }, factor)

/* ------------------------------------------------------------------ the switch */

for (const [label, options] of [
  ['switched off', { editor: { editor_v2: false } }],
  ['not stated', { editor: null }],
  ['a config that failed', { configFails: true }],
]) {
  const opened = await openContext({ width: 390, height: 844, ...options })
  const { page, server } = opened
  await goToDocument(opened)
  await page.locator('.editor-shell').waitFor()
  assert.equal(await page.getByTestId('editor-frame').count(), 0, `${label}: no new frame`)
  assert.ok(await page.locator('.mobile-nav').isVisible(), `${label}: the app's phone bar stays`)
  assert.ok(await page.locator('.app-topbar').isVisible(), `${label}: the app's top bar stays`)
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('editor-bare')), false)
  assert.equal(
    await page.evaluate(() => document.documentElement.style.getPropertyValue('--tg-stable-h')),
    '',
  )
  assert.ok(await page.getByTestId('editor-actionbar').isVisible(), `${label}: today's bar is there`)
  const calls = (await spy(page)).filter((call) =>
    /^(MainButton|BackButton)\.|Swipes|ClosingConfirmation/.test(call[0]),
  )
  assert.deepEqual(calls, [], `${label}: nothing of Telegram's is touched`)
  await page.waitForTimeout(100)
  assert.ok(
    server.requests.some((item) => item.endpoint === '/plans'),
    `${label}: plans still load`,
  )
  await opened.context.close()
}
passed('Off, absent or failed: today’s editor, with nothing of Telegram’s touched')

{
  // A device that last saw the frame expects it, so the plans wait.
  const opened = await openContext({ width: 390, height: 656, remembered: true })
  const { page, server } = opened
  await goToDocument(opened)
  assert.ok(await page.getByTestId('editor-frame').isVisible())
  assert.equal(await page.locator('.editor-shell').count(), 0)
  assert.equal(
    await page.locator('.mobile-nav, .app-topbar, .sidebar').count(),
    0,
    'no app menus around the frame',
  )
  assert.equal(
    server.requests.filter((item) => item.endpoint === '/plans').length,
    0,
    'a deep link skips the plans',
  )
  assert.equal(
    server.requests.filter((item) => item.endpoint === '/studio/config').length,
    1,
    'the switch is read once',
  )
  const box = await page.getByTestId('editor-topbar').boundingBox()
  assert.equal(Math.round(box.height), 52, 'the top bar is 52 px')
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden')
  await opened.context.close()
  passed('On: the frame alone on screen, one config read, no plans')
}
{
  // Leaving the frame brings the menus, and the plans they read, back.
  const opened = await openContext({ width: 390, height: 844, inside: false, remembered: true })
  await goToDocument(opened)
  assert.equal(opened.server.requests.filter((item) => item.endpoint === '/plans').length, 0)
  await opened.page.getByTestId('editor-back-link').click()
  await opened.page.locator('.mobile-nav').waitFor()
  await opened.page.waitForTimeout(100)
  assert.equal(opened.server.requests.filter((item) => item.endpoint === '/plans').length, 1)
  await opened.context.close()
  passed('Leaving the frame loads the plans the menus read')
}
{
  // The list of documents is not a document: it keeps the app's menus to leave by.
  const opened = await openContext({ width: 390, height: 844 })
  await opened.page.goto(`${origin}/en/app/editor`, { waitUntil: 'domcontentloaded' })
  await opened.page.locator('.mobile-nav').waitFor()
  assert.equal(await opened.page.getByTestId('editor-frame').count(), 0)
  await opened.context.close()
  passed('The list of documents keeps the app’s menus')
}

{
  // Until the switch answers, the last answer on this device decides, and a stranger gets today's frame.
  const fresh = await openContext({ width: 390, height: 656, configDelay: 800 })
  await fresh.page.goto(`${origin}/en/app/editor/${DOC}`, { waitUntil: 'domcontentloaded' })
  await fresh.page.locator('.mobile-nav').waitFor()
  await fresh.page.locator('.editor-shell').waitFor()
  assert.equal(await fresh.page.getByTestId('editor-opening').count(), 0, 'today’s editor, not a wait')
  await fresh.page.getByTestId('editor-frame').waitFor()
  assert.equal(await fresh.page.locator('.mobile-nav').count(), 0)
  assert.equal(
    await fresh.page.evaluate(() => localStorage.getItem('pdf-master-editor-v2')),
    '1',
    'and it is kept',
  )
  await fresh.context.close()
  const back = await openContext({ width: 390, height: 656, configDelay: 800, remembered: true })
  await back.page.goto(`${origin}/en/app/editor/${DOC}`, { waitUntil: 'domcontentloaded' })
  await back.page.getByTestId('editor-opening').waitFor()
  assert.equal(await back.page.locator('.mobile-nav, .app-topbar').count(), 0, 'no old menus flash')
  await back.page.getByTestId('editor-frame').waitFor()
  await back.context.close()
  const offNow = await openContext({
    width: 390,
    height: 656,
    remembered: true,
    editor: { editor_v2: false },
  })
  await goToDocument(offNow)
  await offNow.page.locator('.mobile-nav').waitFor()
  assert.equal(await offNow.page.getByTestId('editor-frame').count(), 0, 'the server has the last word')
  assert.equal(await offNow.page.evaluate(() => localStorage.getItem('pdf-master-editor-v2')), null)
  await offNow.context.close()
  passed('The last answer on this device stands in until the switch answers')
}
{
  // Switched off, a deep link opens as it did before the switch: today's editor at once, the file
  // read at once, and the plans asked for alongside the rest rather than after the switch.
  const opened = await openContext({
    width: 390,
    height: 844,
    configDelay: 1500,
    editor: { editor_v2: false },
  })
  const { page, server } = opened
  await page.goto(`${origin}/en/app/editor/${DOC}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.editor-shell').waitFor()
  assert.equal(await page.getByTestId('editor-opening').count(), 0)
  await page.waitForFunction(() => document.querySelector('[data-testid="editor-page-1"] canvas'))
  assert.ok(!server.configAnswered, 'the file was read before the switch answered')
  // The page may show the file before this side has logged its request: on a busy machine the
  // route's handler runs a moment after the browser sent it.
  for (let tries = 0; tries < 50 && !(server.downloads ?? []).length; tries += 1) await page.waitForTimeout(100)
  assert.ok((server.downloads ?? []).length > 0)
  assert.equal(server.plansBeforeConfig, true, 'the plans did not wait for the switch')
  await page.waitForFunction(() => document.querySelector('.mobile-nav'))
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Off: a deep link opens today’s editor and reads the file before the switch answers')
}

/* -------------------------------------------------------------- every combination */

const devices = [
  { name: '390', width: 390, height: 844, webView: 656 },
  { name: '320', width: 320, height: 568, webView: 426 },
]
// The wireframe's ＋ is the tab's icon, not a word of its label.
const tabLabels = {
  en: ['Sign', 'Add', 'Black out', 'Pages'],
  uz: ['Imzo', 'Qo‘shish', 'Bo‘yab yopish', 'Sahifalar'],
  ru: ['Подпись', 'Добавить', 'Закрасить', 'Страницы'],
}
for (const device of devices) {
  for (const locale of ['en', 'uz', 'ru']) {
    for (const theme of ['light', 'dark']) {
      for (const inside of [true, false]) {
        const label = `${device.name}-${locale}-${theme}-${inside ? 'telegram' : 'browser'}`
        if (process.env.EDITOR_PHONE_ONLY && !label.includes(process.env.EDITOR_PHONE_ONLY)) continue
        const height = inside ? device.webView : device.height
        const opened = await openContext({ width: device.width, height, theme, locale, inside })
        const { page, errors } = opened
        await goToDocument(opened)
        await page.waitForTimeout(300)
        const shot = (state) => page.screenshot({ path: path.join(output, `${label}-${state}.png`) })
        const look = async (state) => {
          await noSidewaysScroll(page, `${label} ${state}`)
          assert.deepEqual(await smallTargets(page), [], `${label} ${state}: tap targets`)
          await axe(page, `${label} ${state}`)
          await shot(state)
        }

        await look('root')
        // A4 fills the phone's width with 4 px a side.
        const paper = await page.getByTestId('editor-page-1').boundingBox()
        assert.ok(Math.abs(paper.width - (device.width - 8)) < 1.5, `${label}: page fits (${paper.width})`)

        await page.getByTestId('editor-more').click()
        await page.getByTestId('editor-more-sheet').waitFor()
        await look('more')
        await page.getByTestId('editor-more-changes').click()
        await page.getByTestId('editor-command-list').waitFor()
        await look('changes')
        await closeSheet(page)

        await selectMark(page)
        // 3:1 on white paper in both themes.
        const ring = await page
          .locator('.editor-mark.selected')
          .evaluate((node) => getComputedStyle(node).outlineColor)
        assert.equal(ring, 'rgb(14, 23, 38)', `${label}: the ring does not follow the theme`)
        const sheet = await page.getByTestId('editor-object-sheet').boundingBox()
        assert.ok(
          sheet.height <= height * 0.45 + 1,
          `${label}: a compact sheet is at most 45 % (${sheet.height})`,
        )
        const stageBox = await page.locator('.editor-stage').boundingBox()
        assert.ok(stageBox.height > 100, `${label}: the page stays in sight behind the sheet`)
        await page.waitForTimeout(100)
        const markBox = await page.locator('.editor-mark.highlight').boundingBox()
        assert.ok(
          markBox.y >= stageBox.y && markBox.y + markBox.height <= stageBox.y + stageBox.height + 1,
          `${label}: the selected mark is not under its own sheet`,
        )
        await look('object')
        await closeSheet(page)

        await page.getByTestId('editor-tab-pages').click()
        await page.getByTestId('editor-pages-board').waitFor()
        await page.waitForTimeout(200)
        await look('pages')
        await page.getByTestId('editor-tab-pages').click()

        if (inside) await pressMain(page)
        else await page.getByTestId('editor-primary').click()
        await page.getByTestId('editor-review-sheet').waitFor()
        await page.getByTestId('editor-review-cost').waitFor()
        await look('review')
        await closeSheet(page)

        await page.getByTestId('editor-more').click()
        await page.getByTestId('editor-more-start-over').click()
        await page.getByTestId('editor-snackbar').waitFor()
        await look('snackbar')
        await page.getByTestId('editor-snackbar-action').click()
        assert.equal(
          await page.locator('.editor-mark.highlight').count(),
          1,
          `${label}: Undo brings the marks back`,
        )

        // Labels at 320 px, in Russian and Uzbek, at Android's largest usual text size (open decision 4).
        if (device.name === '320' && locale !== 'en' && inside && theme === 'light') {
          const shown = await page.locator('[data-testid="editor-tabbar"] button span').allTextContents()
          assert.deepEqual(shown, tabLabels[locale], `${label}: the bar's four tabs`)
          await scaleText(page)
          const overflow = await page.evaluate(() =>
            [...document.querySelectorAll('[data-testid="editor-tabbar"] button')].map((button) => {
              const label = button.querySelector('span')
              return {
                text: label.textContent,
                over: label.scrollWidth > button.clientWidth,
                width: button.clientWidth,
                word: label.scrollWidth,
              }
            }),
          )
          assert.deepEqual(
            overflow.filter((item) => item.over),
            [],
            `${label}: four labels fit at 1.3`,
          )
          await noSidewaysScroll(page, `${label} at 1.3`)
          await shot('tabs-at-1.3')
          // The rest of what the frame says, at the same size.
          await page.getByTestId('editor-more').click()
          await page.getByTestId('editor-more-sheet').waitFor()
          await scaleText(page)
          await noSidewaysScroll(page, `${label} More at 1.3`)
          await shot('more-at-1.3')
          await closeSheet(page)
          await selectMark(page)
          await scaleText(page)
          await noSidewaysScroll(page, `${label} form at 1.3`)
          await shot('object-at-1.3')
        }
        assert.deepEqual(errors, [], `${label}: page errors`)
        assert.deepEqual(opened.server.unexpected, [], `${label}: requests with no fixture`)
        await opened.context.close()
      }
    }
  }
}
passed('390x844 and 320x568, en uz ru, light and dark, Telegram and browser: axe, 44 px, no sideways scroll')

/* ------------------------------------------------------------------ Telegram's buttons */

{
  const opened = await openContext({ width: 390, height: 656 })
  const { page } = opened
  await goToDocument(opened)
  await page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  let main = await mainButton(page)
  assert.equal(main.text, 'Send to chat')
  assert.equal(main.isActive, true)
  assert.equal(main.handlers, 1, 'one press handler, however often the button changes')
  assert.deepEqual(
    await backButton(page),
    { isVisible: false, handlers: 0 },
    'at the root Telegram shows Close',
  )

  // A press opens Review, whose Confirm is the same button, inactive until the cost is in.
  await pressMain(page)
  await page.getByTestId('editor-review-sheet').waitFor()
  await page.getByTestId('editor-review-cost').waitFor()
  await page.waitForFunction(() => window.__tg.app.MainButton.text === 'Confirm · 1 file task')
  assert.equal((await mainButton(page)).isActive, true)
  assert.equal((await mainButton(page)).handlers, 1, 'still one handler')
  assert.deepEqual(await backButton(page), { isVisible: true, handlers: 1 })
  await pressBack(page)
  await page.getByTestId('editor-review-sheet').waitFor({ state: 'hidden' })
  await page.waitForFunction(() => window.__tg.app.MainButton.text === 'Send to chat')
  assert.deepEqual(await backButton(page), { isVisible: false, handlers: 0 })

  // Any other modal sheet takes the button away until it closes.
  await page.getByTestId('editor-more').click()
  await page.getByTestId('editor-more-sheet').waitFor()
  await page.waitForFunction(() => !window.__tg.app.MainButton.isVisible)
  assert.equal((await mainButton(page)).handlers, 0, 'a hidden button keeps no handler')
  await pressBack(page)
  await page.waitForFunction(() => window.__tg.app.MainButton.isVisible)

  // Back pops the newest first: the list, then the sheet.
  await page.getByTestId('editor-more').click()
  await page.getByTestId('editor-more-changes').click()
  await page.getByTestId('editor-command-list').waitFor()
  await pressBack(page)
  await page.getByTestId('editor-more-changes').waitFor()
  await pressBack(page)
  await page.getByTestId('editor-more-sheet').waitFor({ state: 'hidden' })

  // A mark's form, then Pages, then the root.
  await selectMark(page)
  await pressBack(page)
  await page.getByTestId('editor-object-sheet').waitFor({ state: 'detached' })
  assert.equal(await page.locator('.editor-mark.selected').count(), 0, 'Back lets the mark go')
  await page.getByTestId('editor-page-chip').click()
  await page.getByTestId('editor-pages-board').waitFor()
  // Pages are changes of the draft too: Send to chat stays one press away.
  assert.equal((await mainButton(page)).text, 'Send to chat')
  assert.equal((await backButton(page)).isVisible, true)
  await pressBack(page)
  await page.getByTestId('editor-page-1').waitFor()
  assert.deepEqual(await backButton(page), { isVisible: false, handlers: 0 })
  passed('MainButton has one handler and goes under a modal sheet; Back pops list, sheet, form, Pages')

  // Nothing to review, nothing to press.
  await page.getByTestId('editor-more').click()
  await page.getByTestId('editor-more-start-over').click()
  await page.getByTestId('editor-snackbar').waitFor()
  await page.waitForFunction(() => !window.__tg.app.MainButton.isActive)
  await pressMain(page)
  assert.equal(
    await page.getByTestId('editor-review-sheet').isVisible(),
    false,
    'an inactive button does nothing',
  )
  await page.getByTestId('editor-snackbar-action').click()
  passed('MainButton is inactive until there is a change')

  // Closing confirmation follows the save state, and autosave reaches the server as it always has.
  const before = opened.server.version
  await page.getByTestId('editor-undo').waitFor()
  await selectMark(page)
  await page.getByTestId('editor-object-delete').click()
  await page.getByTestId('editor-save-words').filter({ hasText: 'Saving' }).waitFor()
  assert.ok((await spied(page, 'enableClosingConfirmation')).length > 0, 'unsaved work asks before closing')
  await page.waitForFunction(
    () => document.querySelector('[data-testid="editor-save-icon"]').dataset.state === 'saved',
  )
  assert.ok((await spied(page, 'disableClosingConfirmation')).length > 0, 'saved work closes quietly')
  assert.ok(opened.server.version > before, 'autosave reached the server')
  const patch = opened.server.requests
    .filter((item) => item.method === 'PATCH' && item.endpoint.startsWith('/editor/'))
    .at(-1)
  assert.deepEqual(Object.keys(patch.body).sort(), ['commands', 'input_ids', 'version'])
  assert.deepEqual(patch.body.input_ids, [FILE])
  assert.equal(patch.body.commands.length, 1)
  passed('Closing confirmation follows the save state; autosave sends what it always sent')

  // Undo is one history, from the top bar, and saves again.
  await page.getByTestId('editor-undo').click()
  await page.locator('.editor-mark.highlight').waitFor()
  await page.waitForFunction(
    () => document.querySelector('[data-testid="editor-save-icon"]').dataset.state === 'saved',
  )
  assert.equal(opened.server.commands.length, 2, 'Undo reached the server too')
  assert.deepEqual(await page.evaluate(() => window.__tg.violations), [])
  await opened.context.close()
  passed('Undo in the top bar undoes and saves')
}

{
  // Swipes: a sheet holds them as long as it is up, a drag for at most 10 s.
  const opened = await openContext({ width: 390, height: 656, clock: true })
  const { page } = opened
  await goToDocument(opened)
  await page.waitForTimeout(200)
  await selectMark(page)
  assert.equal((await spied(page, 'disableVerticalSwipes')).length, 1, 'a sheet holds the swipe')
  await page.clock.fastForward(15000)
  assert.equal((await spied(page, 'enableVerticalSwipes')).length, 0, 'however long the sheet stays up')
  // A drag on top of it is counted, not a second call.
  const mark = await page.locator('.editor-mark.highlight').boundingBox()
  await page.mouse.move(mark.x + 10, mark.y + 10)
  await page.mouse.down()
  await page.mouse.move(mark.x + 30, mark.y + 30)
  assert.equal((await spied(page, 'disableVerticalSwipes')).length, 1, 'holds are counted')
  await page.mouse.up()
  assert.equal((await spied(page, 'enableVerticalSwipes')).length, 0)
  await closeSheet(page)
  await page.getByTestId('editor-object-sheet').waitFor({ state: 'detached' })
  assert.equal((await spied(page, 'enableVerticalSwipes')).length, 1, 'closing the sheet lets go')

  // A drag whose pointerup never comes. Only a chosen mark drags, so it is chosen first.
  await selectMark(page)
  assert.equal((await spied(page, 'disableVerticalSwipes')).length, 2)
  const again = await page.locator('.editor-mark.highlight').boundingBox()
  await page.mouse.move(again.x + 10, again.y + 10)
  await page.mouse.down()
  await page.mouse.move(again.x + 40, again.y + 30)
  assert.equal((await spied(page, 'disableVerticalSwipes')).length, 2, 'the drag joins the sheet’s hold')
  // The sheet's own hold would hide the release, so it goes.
  await page.evaluate(() => document.querySelector('[data-testid="editor-sheet-close"]').click())
  await page.getByTestId('editor-object-sheet').waitFor({ state: 'detached' })
  await page.clock.fastForward(9000)
  assert.equal((await spied(page, 'enableVerticalSwipes')).length, 1, 'still held at 9 s')
  await page.clock.fastForward(1500)
  await page.waitForFunction(
    () => window.__tg.log.filter((call) => call[0] === 'enableVerticalSwipes').length === 2,
  )
  await opened.context.close()
  passed('Swipes: counted holds; a sheet’s lasts, a drag’s lets go at 10 s')
}

{
  // The oldest client: no BackButton, no haptics, no confirmation, no swipe lock.
  const opened = await openContext({ width: 390, height: 656, version: '6.0' })
  const { page } = opened
  await goToDocument(opened)
  await selectMark(page)
  assert.ok(await page.getByTestId('editor-back').isVisible(), 'below 6.1 the top bar draws Back')
  await page.getByTestId('editor-back').click()
  await page.getByTestId('editor-object-sheet').waitFor({ state: 'detached' })
  assert.ok(await page.getByTestId('editor-back-link').isVisible(), 'at the root it leads to the documents')
  assert.deepEqual(await page.evaluate(() => window.__tg.violations), [], 'nothing past 6.0 is called')
  await page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  await opened.context.close()
  passed('At 6.0 nothing newer is called, and Back is in the top bar')
}
{
  const opened = await openContext({ width: 390, height: 656, version: '7.0' })
  await goToDocument(opened)
  await selectMark(opened.page)
  assert.equal((await spied(opened.page, 'disableVerticalSwipes')).length, 0, 'below 7.7 no swipe lock')
  assert.deepEqual(await opened.page.evaluate(() => window.__tg.violations), [])
  assert.equal(await opened.page.getByTestId('editor-back').count(), 0, 'from 6.1 Telegram draws Back')
  await opened.context.close()
}

{
  // Heights come from Telegram, and the safe area goes while the MainButton is up.
  const opened = await openContext({ width: 390, height: 700, stable: 640, safeBottom: 34, version: '8.0' })
  const { page } = opened
  await goToDocument(opened)
  const root = (name) => page.evaluate((item) => document.documentElement.style.getPropertyValue(item), name)
  assert.equal(await root('--tg-stable-h'), '640px')
  const box = await page.getByTestId('editor-frame').boundingBox()
  assert.equal(Math.round(box.height), 640, 'the frame is the stable height')
  await page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  assert.equal(await root('--editor-safe-bottom'), '0px', 'the MainButton clears the home bar itself')
  await page.getByTestId('editor-more').click()
  await page.waitForFunction(() => !window.__tg.app.MainButton.isVisible)
  assert.equal(await root('--editor-safe-bottom'), '34px')
  await closeSheet(page)

  // Mid-drag values are left alone; a settled one is taken.
  await page.evaluate(() => {
    window.__tg.app.viewportStableHeight = 600
    window.__tg.emit('viewportChanged', { isStateStable: false })
  })
  assert.equal(await root('--tg-stable-h'), '640px')
  await page.evaluate(() => window.__tg.emit('viewportChanged', { isStateStable: true }))
  assert.equal(await root('--tg-stable-h'), '600px')

  // The keyboard: above 600 px the MainButton stays.
  await page.evaluate(() => {
    window.__tg.app.viewportStableHeight = 656
    window.__tg.emit('viewportChanged', { isStateStable: true })
  })
  await page.evaluate(() => window.__tg.keyboard(300))
  assert.equal(await root('--editor-keyboard'), '256px')
  assert.equal((await mainButton(page)).isVisible, true, 'tall screens keep the button above the keyboard')
  await page.evaluate(() => window.__tg.keyboard(0))
  assert.equal(await root('--editor-keyboard'), '0px')
  await opened.context.close()

  const short = await openContext({ width: 320, height: 426 })
  await goToDocument(short)
  await short.page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  await short.page.evaluate(() => window.__tg.keyboard(253))
  await short.page.waitForFunction(() => !window.__tg.app.MainButton.isVisible)
  await short.page.evaluate(() => window.__tg.keyboard(0))
  await short.page.waitForFunction(() => window.__tg.app.MainButton.isVisible)
  await short.context.close()
  passed(
    'Stable height, safe area and the keyboard reach the frame; a short screen hides MainButton while typing',
  )
}

{
  // Expand is for Telegram Desktop, from 8.0.
  const desktop = await openContext({ width: 1280, height: 800, platform: 'tdesktop', version: '8.0' })
  await goToDocument(desktop)
  assert.equal(
    await desktop.page.locator('.sidebar, .app-topbar, .mobile-nav').count(),
    0,
    'inside Telegram no menus',
  )
  assert.ok(await desktop.page.getByTestId('editor-object-sheet').isVisible(), 'the panel is on the right')
  await desktop.page.screenshot({ path: path.join(output, 'tdesktop-1280.png') })
  await desktop.page.getByTestId('editor-more').click()
  await desktop.page.getByTestId('editor-more-expand').click()
  assert.equal((await spied(desktop.page, 'requestFullscreen')).length, 1)
  await desktop.context.close()

  const phone = await openContext({ width: 390, height: 656, platform: 'android', version: '9.1' })
  await goToDocument(phone)
  await phone.page.getByTestId('editor-more').click()
  assert.equal(await phone.page.getByTestId('editor-more-expand').count(), 0, 'a phone has no Expand')
  await phone.context.close()
  passed('Expand only on Telegram Desktop from 8.0')
}

{
  // The same tools with more room, inside the app's own menus.
  const opened = await openContext({ width: 1440, height: 900, inside: false })
  const { page } = opened
  await goToDocument(opened)
  assert.ok(await page.locator('.sidebar').isVisible(), 'a wide browser keeps the sidebar')
  assert.ok(await page.locator('.app-topbar').isVisible())
  assert.ok(await page.getByTestId('editor-rail').isVisible(), 'and gets the page rail')
  assert.ok(await page.getByTestId('editor-command-list').isVisible(), 'and the changes in the panel')
  assert.ok(await page.getByTestId('editor-tab-pages').isVisible())
  const panel = await page.getByTestId('editor-object-sheet').boundingBox()
  assert.equal(Math.round(panel.width), 320)
  await noSidewaysScroll(page, 'wide')
  await axe(page, 'wide')
  await page.screenshot({ path: path.join(output, 'browser-1440.png') })
  await page.getByTestId('editor-primary').click()
  await page.getByTestId('editor-review-sheet').waitFor()
  await page.screenshot({ path: path.join(output, 'browser-1440-review.png') })
  await opened.context.close()
  passed('At 1440 the same frame has the rail and the panel, inside the app’s menus')
}

/* ------------------------------------------------------------------ what can go wrong around the page */

for (const [name, width, height, locale, theme] of [
  ['390-en', 390, 656, 'en', 'light'],
  ['320-ru', 320, 426, 'ru', 'dark'],
  ['320-uz', 320, 426, 'uz', 'light'],
]) {
  // Pictures of pages, a file close to its end, and a save the network refused.
  const opened = await openContext({
    width,
    height,
    locale,
    theme,
    download: 500,
    expiresIn: 3600000,
    refuseSaves: ['upstream_unavailable', 503],
  })
  const { page } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-expiring').waitFor()
  await page.locator('.editor-frame-notices .info-banner').waitFor()
  await noPlaceholderMonth(page, `${name} notices`)
  await noSidewaysScroll(page, `${name} notices`)
  await axe(page, `${name} notices`)
  await page.screenshot({ path: path.join(output, `${name}-notices.png`) })
  await selectMark(page)
  await page.getByTestId('editor-object-delete').click()
  await page.getByTestId('editor-save-failed').waitFor()
  assert.equal(await page.getByTestId('editor-save-icon').getAttribute('data-state'), 'failed')
  assert.deepEqual(await smallTargets(page), [], `${name} save failed: tap targets`)
  await axe(page, `${name} save failed`)
  await page.screenshot({ path: path.join(output, `${name}-save-failed.png`) })
  await opened.context.close()

  // Someone else changed it: autosave waits for a choice.
  const conflict = await openContext({ width, height, locale, theme, refuseSaves: ['version_conflict', 409] })
  await goToDocument(conflict)
  await selectMark(conflict.page)
  await conflict.page.getByTestId('editor-object-delete').click()
  await conflict.page.locator('.editor-conflict').waitFor()
  await noSidewaysScroll(conflict.page, `${name} conflict`)
  assert.deepEqual(await smallTargets(conflict.page), [], `${name} conflict: tap targets`)
  await axe(conflict.page, `${name} conflict`)
  await conflict.page.screenshot({ path: path.join(output, `${name}-conflict.png`) })
  await conflict.context.close()

  // A mark that cannot go yet says so, and Show goes to it: a signature whose picture has gone.
  const held = await openContext({
    width,
    height,
    locale,
    theme,
    marks: [{ type: 'signature', page: 1, x: 80, y: 200, width: 120, height: 40, input_index: 1 }],
  })
  await goToDocument(held)
  await held.page.getByTestId('editor-frame-issue').waitFor()
  await held.page.getByTestId('editor-frame-issue-show').click()
  await held.page.getByTestId('editor-object-sheet').waitFor()
  await noSidewaysScroll(held.page, `${name} held`)
  await axe(held.page, `${name} held`)
  await held.page.screenshot({ path: path.join(output, `${name}-held.png`) })
  assert.equal(
    held.server.requests.filter((item) => item.method === 'PATCH' && item.endpoint.startsWith('/editor/'))
      .length,
    0,
    'a held mark is not sent',
  )
  await held.context.close()
}
passed('Notices, a refused save, a conflict and a held mark fit the frame at 390 and 320')

/* ------------------------------------------------------------------ previews that take a while */

{
  // Not behind the switch: with the deck lane on, this is every customer's preview.
  const answers = ['drawing', 'drawing', 'image']
  const opened = await openContext({
    width: 390,
    height: 844,
    editor: { editor_v2: false, deck_editor: true },
    download: 500,
    preview: (attempt) => answers[attempt - 1] ?? 'image',
  })
  const { page, server } = opened
  await goToDocument(opened)
  await page.locator('.editor-page .preview-wait').first().waitFor()
  await page.locator('.editor-page img.editor-page-canvas').first().waitFor()
  assert.ok(server.previews >= 3, 'it asked again until the picture was drawn')
  await opened.context.close()
  passed('The editor’s page picture asks again on 202')
}
{
  // Too much waiting: calm words, then the picture, and no broken image on the way.
  const answers = ['busy', 'drawing', 'image']
  const opened = await openContext({
    width: 390,
    height: 844,
    editor: { editor_v2: true, deck_editor: true },
    download: 500,
    clock: true,
    preview: (attempt) => answers[attempt - 1] ?? 'image',
  })
  const { page } = opened
  await goToDocument(opened)
  const wait = page.locator('.editor-page .preview-wait').first()
  await wait.filter({ hasText: 'A lot is waiting' }).waitFor()
  await page.screenshot({ path: path.join(output, 'preview-lane-busy-390.png') })
  await page.clock.fastForward(16000)
  await page.waitForTimeout(100)
  await page.clock.fastForward(2000)
  await page.locator('.editor-page img.editor-page-canvas').first().waitFor()
  await opened.context.close()
  passed('lane_busy says so calmly and tries again')
}
{
  // A preview that is simply not there still says so, as it did.
  const opened = await openContext({
    width: 390,
    height: 844,
    editor: { editor_v2: true },
    download: 500,
    preview: () => 'gone',
  })
  await goToDocument(opened)
  await opened.page.locator('.editor-page-fallback').first().waitFor()
  await opened.context.close()
  passed('A preview that fails falls back as before')
}
{
  // Tasks chat and the tool page load the same answer.
  const answers = ['drawing', 'image']
  const opened = await openContext({
    width: 390,
    height: 844,
    editor: { deck_editor: true },
    preview: (attempt) => answers[attempt - 1] ?? 'image',
  })
  const { page, server } = opened
  await page.goto(`${origin}/en/app/bot`, { waitUntil: 'domcontentloaded' })
  // While it is drawn, the wait holds the picture's place and the name keeps the row.
  await page.locator('.bot-asset > .preview-wait').waitFor()
  const waiting = await page.locator('.bot-asset > .preview-wait').boundingBox()
  assert.ok(Math.round(waiting.width) === 38 && Math.round(waiting.height) === 49, 'the picture’s place')
  await page.locator('.bot-asset img').waitFor()
  assert.ok(server.previews >= 2, 'the bot view asked again')
  await opened.context.close()
  passed('BotView asks again on 202')
}

{
  const answers = ['drawing', 'image']
  const opened = await openContext({
    width: 390,
    height: 844,
    editor: { deck_editor: true },
    catalog: [
      {
        id: 'pdf.compress',
        name: 'Compress PDF',
        category: 'pdf',
        surface: 'file',
        eligible: true,
        min_files: 1,
        max_files: 1,
        accepted_mime_types: ['application/pdf'],
        parameter_schema: { type: 'object', properties: {} },
      },
    ],
    preview: (attempt) => answers[attempt - 1] ?? 'image',
  })
  const { page, server } = opened
  await page.goto(`${origin}/en/app/tools/pdf.compress`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type=file]').first().setInputFiles('tests/fixtures/research-notes.pdf')
  await page.locator('.file-preview-button img').waitFor()
  assert.ok(server.previews >= 2, 'the thumbnail asked again')
  await page.locator('.file-preview-button').click()
  await page.locator('.document-preview img').waitFor()
  await opened.context.close()
  passed('ToolWorkspace’s thumbnail and page preview ask again on 202')
}

/* ------------------------------------------------------------------ the tools */

const keptSignature = JSON.stringify([
  { id: 'k1', src: `data:image/png;base64,${inkPng.toString('base64')}`, width: 60, height: 20 },
])
const today = () => {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`
}
/** The last draft the server was sent, once autosave has had its moment. */
const saved = async (page, server) => {
  await page.waitForFunction(() =>
    ['saved', 'clean'].includes(document.querySelector('[data-testid="editor-save-icon"]')?.dataset.state),
  )
  return server.commands
}
/** Replace on the chosen mark: the chooser, which hands its file over when the test says. */
const chooseReplacement = async (page) => {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-object-replace').click(),
  ])
  return chooser
}
const inkFile = { name: 'fixture.png', mimeType: 'image/png', buffer: inkPng }
/** How long a send waits at most for a photo still being handed over. */
const PICK_LONGEST = 120_000
/** The next picture the phone reads, from a file just chosen, takes `ms` to be read. */
const slowNextPicture = (page, ms) =>
  page.evaluate((ms) => {
    const source = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get: source.get,
      set(value) {
        if (!String(value).startsWith('blob:')) return source.set.call(this, value)
        Object.defineProperty(HTMLImageElement.prototype, 'src', source)
        setTimeout(() => source.set.call(this, value), ms)
      },
    })
  }, ms)
/** The pages drawn and nothing above them still to go, so a spot measured now stays put. */
const settle = (page) =>
  page.waitForFunction(() => !document.querySelector('.editor-stage .editor-stage-status'))
/** Page points for a spot on page 1, in its own CSS pixels. */
const zoomOf = (page) =>
  page.evaluate(
    () => document.querySelector('[data-testid="editor-page-1"]').getBoundingClientRect().width / 595.276,
  )
/** What a person counts: each tap or press is one, typing and scrolling none. */
function counter(page) {
  let taps = 1 // ✏️ Edit under the file in the chat.
  return {
    get taps() {
      return taps
    },
    async tap(locator) {
      taps += 1
      await locator.click()
    },
    async paper(x, y) {
      taps += 1
      await page.getByTestId('editor-page-1').click({ position: { x, y } })
    },
    async main() {
      taps += 1
      await pressMain(page)
    },
  }
}

{
  // F2, sign and date: Edit, Sign, the kept signature, the line, the date blank, Today's
  // date, Send to chat, Confirm.
  const opened = await openContext({ width: 390, height: 656, marks: [], kept: keptSignature })
  const { page, server } = opened
  await goToDocument(opened)
  const flow = counter(page)
  await flow.tap(page.getByTestId('editor-tab-sign'))
  await flow.tap(page.getByTestId('editor-kept-1'))
  await page.getByTestId('editor-armed').waitFor()
  await flow.paper(250, 380)
  await page.getByTestId('editor-snackbar').filter({ hasText: 'Signature added' }).waitFor()
  await page.locator('.editor-mark.signature img.editor-mark-picture').waitFor()
  await flow.paper(120, 450)
  await page.getByTestId('editor-add-sheet').waitFor()
  assert.ok(await page.getByTestId('editor-pin').isVisible(), 'Add here shows where it will land')
  await flow.tap(page.getByTestId('editor-add-date'))
  await page.getByTestId('editor-add-sheet').waitFor({ state: 'detached' })
  await flow.main()
  await page.getByTestId('editor-review-sheet').waitFor()
  await page.getByTestId('editor-review-cost').waitFor()
  await flow.main()
  await page.getByTestId('editor-accepted').waitFor()
  assert.ok(flow.taps <= 8, `sign and date in 8 taps (${flow.taps})`)
  await page.waitForFunction(() => window.__tg.log.some((call) => call[0] === 'close'))
  assert.equal(server.jobPosts.length, 1, 'one job')

  const zoom = await zoomOf(page)
  const commands = await saved(page, server)
  const signature = commands.find((command) => command.type === 'signature')
  const date = commands.find((command) => command.type === 'add_text')
  assert.equal(signature.input_index, 1, 'the signature points at its uploaded picture')
  assert.ok(Math.abs(signature.x + signature.width / 2 - 250 / zoom) < 2, 'centred where the finger lifted')
  assert.ok(Math.abs(signature.y + signature.height / 2 - 380 / zoom) < 2)
  assert.ok(Math.abs(signature.width / signature.height - 3) < 0.05, 'as the signature stands')
  assert.equal(date.text, today(), 'today on this device')
  assert.equal(server.uploads.length, 1, 'the signature went up once, at once')
  assert.equal(server.uploads[0].kind, 'image/png')
  assert.deepEqual(server.inputIds, [FILE, server.uploads[0].id])
  assert.deepEqual(await page.evaluate(() => window.__tg.violations), [])
  assert.ok(
    (await spied(page, 'DeviceStorage.getItem')).length > 0,
    'kept signatures come from Telegram’s storage on 9.0+',
  )
  assert.deepEqual(opened.errors, [])
  assert.deepEqual(server.unexpected, [])
  await opened.context.close()
  passed(`Sign and date: ${flow.taps} taps to the chat; the signature uploads once and shows itself`)
}

{
  // F5 as this release has it: Edit, Black out, the number, Send to chat, I understand, Confirm.
  const opened = await openContext({ width: 390, height: 656, marks: [] })
  const { page, server } = opened
  await goToDocument(opened)
  const flow = counter(page)
  await flow.tap(page.getByTestId('editor-tab-blackout'))
  await page.getByTestId('editor-blackout-sheet').waitFor()
  await flow.paper(200, 300)
  await page.getByTestId('editor-blackout-count').waitFor()
  assert.ok(await page.locator('.editor-mark.redact.pending').isVisible(), 'a waiting box is hatched')
  await flow.main()
  await page.getByTestId('editor-review-sheet').waitFor()
  await flow.tap(page.getByTestId('editor-consent'))
  await page.getByTestId('editor-review-cost').waitFor()
  await flow.main()
  await page.getByTestId('editor-accepted').waitFor()
  assert.ok(flow.taps <= 6, `black out a number in 6 taps (${flow.taps})`)
  assert.deepEqual(
    server.quotes.map((quote) => quote.body.accept_rasterization),
    [false, true],
    'the tick is the second quote’s',
  )
  const zoom = await zoomOf(page)
  const [box] = await saved(page, server)
  assert.equal(box.type, 'redact')
  assert.ok(
    Math.abs(box.x + box.width / 2 - 200 / zoom) < 2 && Math.abs(box.y + box.height / 2 - 300 / zoom) < 2,
  )
  await opened.context.close()
  passed(`Black out a number: ${flow.taps} taps with I understand and Confirm`)
}

{
  // A first signature, drawn: kept only when asked, on the phone, and forgettable.
  for (const version of ['9.1', '8.0']) {
    const opened = await openContext({ width: 390, height: 656, marks: [], version })
    const { page, server } = opened
    await goToDocument(opened)
    await page.getByTestId('editor-tab-sign').click()
    await page.getByTestId('editor-sign-draw').click()
    await page.getByTestId('editor-pad-sheet').waitFor()
    assert.equal(await page.getByTestId('editor-pad-keep').isChecked(), false, 'keeping is off unless ticked')
    const pad = await page.locator('.editor-signature-canvas').boundingBox()
    await page.mouse.move(pad.x + 40, pad.y + pad.height * 0.7)
    await page.mouse.down()
    for (const [x, y] of [
      [0.3, 0.3],
      [0.45, 0.65],
      [0.6, 0.35],
      [0.8, 0.6],
    ])
      await page.mouse.move(pad.x + pad.width * x, pad.y + pad.height * y, { steps: 4 })
    await page.mouse.up()
    await page.getByTestId('editor-pad-keep').check()
    await page.getByTestId('editor-signature-save').click()
    await page.getByTestId('editor-armed').waitFor()
    await page.getByTestId('editor-page-1').click({ position: { x: 200, y: 400 } })
    await page.locator('.editor-mark.signature img').waitFor()
    const commands = await saved(page, server)
    assert.equal(commands[0].type, 'signature')
    // Cut to its ink: wider than tall, as drawn.
    assert.ok(commands[0].width > commands[0].height * 1.5, 'the box is the ink’s, not the pad’s')
    const kept = await page.evaluate(
      (telegram) =>
        telegram
          ? window.__tg.stored.get('pdf-master-signatures')
          : localStorage.getItem('pdf-master-signatures'),
      version === '9.1',
    )
    assert.equal(JSON.parse(kept).length, 1, `${version}: kept on the phone`)
    if (version === '8.0')
      assert.equal((await spied(page, 'DeviceStorage.setItem')).length, 0, 'below 9.0 the browser’s storage')
    else assert.equal(await page.evaluate(() => localStorage.getItem('pdf-master-signatures')), null)
    // Forget is right there, a little apart from the signature, and Undo puts it back.
    await page.getByTestId('editor-tab-sign').click()
    const thumb = await page.getByTestId('editor-kept-1').boundingBox()
    const link = await page.getByTestId('editor-forget-1').boundingBox()
    assert.ok(link.y - (thumb.y + thumb.height) >= 7, 'room between the signature and Forget')
    const stored = () =>
      page.evaluate(
        (telegram) =>
          telegram
            ? (window.__tg.stored.get('pdf-master-signatures') ?? null)
            : localStorage.getItem('pdf-master-signatures'),
        version === '9.1',
      )
    await page.getByTestId('editor-forget-1').click()
    await page.getByTestId('editor-kept-1').waitFor({ state: 'detached' })
    assert.equal(await stored(), null, `${version}: forgotten`)
    await page.getByTestId('editor-snackbar').filter({ hasText: 'Signature forgotten' }).waitFor()
    await page.getByTestId('editor-snackbar-action').click()
    await page.getByTestId('editor-kept-1').waitFor()
    assert.equal(JSON.parse(await stored()).length, 1, `${version}: Undo keeps it again`)
    await page.getByTestId('editor-forget-1').click()
    await page.getByTestId('editor-kept-1').waitFor({ state: 'detached' })
    const after = await stored()
    assert.equal(after, null, `${version}: forgotten`)
    assert.deepEqual(await page.evaluate(() => window.__tg.violations), [])
    await opened.context.close()
  }
  {
    // Untucked, it is used once and not kept.
    const opened = await openContext({ width: 390, height: 656, marks: [] })
    const { page } = opened
    await goToDocument(opened)
    await page.getByTestId('editor-tab-sign').click()
    await page.getByTestId('editor-sign-draw').click()
    const pad = await page.locator('.editor-signature-canvas').boundingBox()
    await page.mouse.move(pad.x + 30, pad.y + 60)
    await page.mouse.down()
    await page.mouse.move(pad.x + 200, pad.y + 90, { steps: 6 })
    await page.mouse.up()
    await page.getByTestId('editor-signature-save').click()
    await page.getByTestId('editor-page-1').click({ position: { x: 200, y: 400 } })
    await page.locator('.editor-mark.signature').waitFor()
    assert.equal(await page.evaluate(() => window.__tg.stored.size), 0, 'nothing kept')
    await opened.context.close()
  }
  passed(
    'A drawn signature is kept only when ticked, in DeviceStorage from 9.0 or the browser below, and can be forgotten',
  )
}

{
  // Marks land on finger lift: a scroll or a long press places nothing.
  const opened = await openContext({ width: 390, height: 656, marks: [] })
  const { page } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-tab-add').click()
  await page.getByTestId('editor-add-tick').click()
  await page.getByTestId('editor-armed').waitFor()
  const paper = await page.getByTestId('editor-page-1').boundingBox()
  await page.mouse.move(paper.x + 150, paper.y + 300)
  await page.mouse.down()
  await page.mouse.move(paper.x + 150, paper.y + 340, { steps: 4 })
  await page.mouse.up()
  assert.equal(await page.locator('.editor-mark').count(), 0, 'a finger that moved was scrolling')
  await page.mouse.down()
  await page.waitForTimeout(450)
  await page.mouse.up()
  assert.equal(await page.locator('.editor-mark').count(), 0, 'a finger held was not a tap')
  assert.ok(await page.getByTestId('editor-armed').isVisible(), 'and the tick is still waiting')
  await page.mouse.down()
  await page.mouse.up()
  await page.locator('.editor-mark.stroke').waitFor()
  assert.equal(await page.getByTestId('editor-armed').count(), 0)

  // Draw keeps the finger for itself until Done, and a line opens no form under it.
  await page.getByTestId('editor-tab-add').click()
  await page.getByTestId('editor-add-draw').click()
  assert.equal(
    await page
      .locator('.editor-layer')
      .first()
      .evaluate((node) => getComputedStyle(node).touchAction),
    'none',
  )
  await page.mouse.move(paper.x + 60, paper.y + 200)
  await page.mouse.down()
  await page.mouse.move(paper.x + 200, paper.y + 230, { steps: 8 })
  await page.mouse.up()
  assert.equal(await page.locator('.editor-mark.stroke').count(), 2, 'a line drawn')
  assert.equal(await page.getByTestId('editor-object-sheet').count(), 0, 'no form opened mid-drawing')
  await page.getByTestId('editor-armed-cancel').click()
  assert.notEqual(
    await page
      .locator('.editor-layer')
      .first()
      .evaluate((node) => getComputedStyle(node).touchAction),
    'none',
  )

  // A finger that rests on the chosen mark before moving still drags it.
  await page.locator('.editor-mark.stroke').nth(1).click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.waitForTimeout(200)
  const line = await page.locator('.editor-mark.stroke.selected').boundingBox()
  const before = (await saved(page, opened.server))[1].points[0][0]
  await page.mouse.move(line.x + line.width / 2, line.y + line.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(650)
  await page.mouse.move(line.x + line.width / 2 + 30, line.y + line.height / 2, { steps: 4 })
  await page.mouse.up()
  const after = (await saved(page, opened.server))[1].points[0][0]
  assert.ok(after - before > 20 / (await zoomOf(page)) - 2, 'rested, then dragged')
  await opened.context.close()
  passed(
    'Marks land on lift within 10 px and 350 ms; scrolling and holding place nothing; Draw draws until Done',
  )
}

{
  // The docked field: in the top bar's place, 16 px, above the keyboard, and committed before any send.
  const opened = await openContext({ width: 320, height: 426, marks: [] })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-page-1').click({ position: { x: 60, y: 150 } })
  await page.getByTestId('editor-add-sheet').waitFor()
  await page.getByTestId('editor-add-text').click()
  await page.getByTestId('editor-text-form').waitFor()
  assert.equal(await page.getByTestId('editor-topbar').count(), 0, 'the field replaces the top bar')
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.testid), 'editor-text-input')
  assert.equal(
    await page.getByTestId('editor-text-input').evaluate((node) => getComputedStyle(node).fontSize),
    '16px',
  )
  await page.evaluate(() => window.__tg.keyboard(253))
  await page.keyboard.type('Fixture Name')
  const mark = page.locator('.editor-mark.add_text')
  assert.equal(await mark.textContent(), 'Fixture Name', 'the page shows the words as they are typed')
  await page.waitForTimeout(300)
  const markBox = await mark.boundingBox()
  const dock = await page.getByTestId('editor-text-form').boundingBox()
  assert.ok(
    markBox.y >= dock.y + dock.height - 1 && markBox.y + markBox.height <= 426 - 253,
    'between the field and the keyboard',
  )
  await page.screenshot({ path: path.join(output, '320-en-light-telegram-dock.png') })
  await noSidewaysScroll(page, 'dock')
  assert.deepEqual(await smallTargets(page), [], 'dock: tap targets')
  await axe(page, 'dock')
  await page.getByTestId('editor-text-done').click()
  await page.evaluate(() => window.__tg.keyboard(0))
  await page.getByTestId('editor-topbar').waitFor()
  assert.ok((await spied(page, 'hideKeyboard')).length > 0, 'Done puts the keyboard away')
  let commands = await saved(page, server)
  assert.equal(commands[0].text, 'Fixture Name')

  // Words still in the field go with a send.
  await page.getByTestId('editor-page-1').click({ position: { x: 60, y: 260 } })
  await page.getByTestId('editor-add-text').click()
  await page.getByTestId('editor-text-form').waitFor()
  await page.keyboard.type('Second line')
  await pressMain(page)
  await page.getByTestId('editor-review-sheet').waitFor()
  assert.equal(await page.getByTestId('editor-text-form').count(), 0, 'the field was committed first')
  commands = await saved(page, server)
  assert.deepEqual(
    commands.map((command) => command.text),
    ['Fixture Name', 'Second line'],
  )
  await closeSheet(page)

  // Cancel takes a new mark away; words too long for the page say so under the field.
  await page.getByTestId('editor-page-1').click({ position: { x: 200, y: 330 } })
  await page.getByTestId('editor-add-text').click()
  await page.keyboard.type('A line far too long to fit on what is left of this page')
  await page.getByTestId('editor-text-fit').waitFor()
  await page.getByTestId('editor-text-cancel').click()
  assert.equal(await page.locator('.editor-mark.add_text').count(), 2, 'Cancel took the new mark away')
  // Back keeps the words, as Done does.
  await page.locator('.editor-mark.add_text').first().click()
  await page.getByTestId('editor-object-words').click()
  await page.getByTestId('editor-text-input').press('End')
  await page.keyboard.type(' Jr')
  await pressBack(page)
  await page.getByTestId('editor-topbar').waitFor()
  commands = await saved(page, server)
  assert.equal(commands[0].text, 'Fixture Name Jr')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed(
    'The docked field: top bar’s place, 16 px, above the keyboard, Done and Back keep, Cancel drops, a send commits it',
  )
}

{
  // Choosing and changing: own marks first, long press goes down the stack, drags only from the chosen one.
  const stacked = [
    { type: 'highlight', page: 1, x: 80, y: 420, width: 220, height: 40, color: '#FFFF00' },
    { type: 'highlight', page: 1, x: 100, y: 425, width: 150, height: 30, color: '#FF7AB6' },
    { type: 'add_text', page: 1, x: 80, y: 320, text: 'Fixture words', font_size: 16, color: '#17212E' },
  ]
  const opened = await openContext({ width: 390, height: 656, marks: stacked })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  const zoom = await zoomOf(page)
  const paper = await page.getByTestId('editor-page-1').boundingBox()
  const at = (x, y) => ({ x: paper.x + x * zoom, y: paper.y + y * zoom })

  // A finger dragging across a mark that is not chosen scrolls; it does not move it.
  const text = at(100, 328)
  await page.mouse.move(text.x, text.y)
  await page.mouse.down()
  await page.mouse.move(text.x + 60, text.y + 40, { steps: 5 })
  await page.mouse.up()
  assert.equal((await saved(page, server))[2].x, 80, 'an unchosen mark stays put')
  assert.equal(await page.locator('.editor-mark.selected').count(), 0)

  // The tap takes the newest; a long press, the one beneath.
  const middle = at(150, 440)
  await page.mouse.click(middle.x, middle.y)
  await page.getByTestId('editor-object-sheet').waitFor()
  let selected = await page.locator('.editor-mark.selected').getAttribute('style')
  assert.match(selected, /background: rgb\(255, 122, 182\)/, 'the top one first')
  // Choosing it scrolled it clear of the sheet, grip and all.
  await page.waitForTimeout(200)
  const top = await page.locator('.editor-mark.selected').boundingBox()
  await page.mouse.move(top.x + top.width / 2, top.y + top.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(650)
  await page.mouse.up()
  selected = await page.locator('.editor-mark.selected').getAttribute('style')
  assert.match(selected, /background: rgb\(255, 255, 0\)/, 'a long press, the one under it')

  // The form: size, move, exact position, layering, delete.
  assert.equal(await page.getByTestId('editor-object-size').textContent(), '100%')
  await page.getByTestId('editor-object-larger').click()
  assert.equal(await page.getByTestId('editor-object-size').textContent(), '110%')
  let commands = await saved(page, server)
  assert.ok(
    Math.abs(commands[0].width - 242) < 0.1 && Math.abs(commands[0].height - 44) < 0.1,
    'larger about its middle',
  )
  const before = commands[0].x
  await page.getByTestId('editor-object-right').click()
  commands = await saved(page, server)
  assert.ok(Math.abs(commands[0].x - before - 5.67) < 0.05, 'a step is 2 mm')
  await page.getByTestId('editor-object-exact').locator('summary').click()
  await page.getByTestId('editor-object-x').fill('40')
  await page.getByTestId('editor-object-x').press('Enter')
  commands = await saved(page, server)
  assert.ok(Math.abs(commands[0].x - (40 * 72) / 25.4) < 0.05, 'exact position in millimetres')
  await page.getByTestId('editor-object-forward').click()
  commands = await saved(page, server)
  assert.equal(commands[1].color, '#FFFF00', 'brought forward above the other')

  // The grip moves it; the one corner fits a highlight's sides apart, to a line of words.
  const grip = await page.getByTestId('editor-grip').boundingBox()
  const x0 = commands[1].x
  await page.mouse.move(grip.x + 22, grip.y + 22)
  await page.mouse.down()
  await page.mouse.move(grip.x + 62, grip.y + 22, { steps: 5 })
  await page.mouse.up()
  commands = await saved(page, server)
  assert.ok(Math.abs(commands[1].x - x0 - 40 / zoom) < 1, 'the grip drags it')
  const corner = await page.getByTestId('editor-scale').boundingBox()
  const [w0, h0] = [commands[1].width, commands[1].height]
  await page.mouse.move(corner.x + 22, corner.y + 22)
  await page.mouse.down()
  await page.mouse.move(corner.x - 18, corner.y + 12, { steps: 5 })
  await page.mouse.up()
  commands = await saved(page, server)
  assert.ok(
    Math.abs(commands[1].width - (w0 - 40 / zoom)) < 1,
    `narrower by the corner (${commands[1].width})`,
  )
  assert.ok(Math.abs(commands[1].height - (h0 - 10 / zoom)) < 1, `and lower, apart (${commands[1].height})`)

  await page.getByTestId('editor-object-delete').click()
  await page.getByTestId('editor-snackbar').filter({ hasText: 'Deleted' }).waitFor()
  assert.equal(await page.locator('.editor-mark.highlight').count(), 1)
  await page.getByTestId('editor-snackbar-action').click()
  assert.equal(await page.locator('.editor-mark.highlight').count(), 2, 'Undo brings it back')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed(
    'Own mark first, long press goes down the stack; size, move, exact mm, layer, grip, corner, delete and Undo',
  )
}

{
  // Below Bot API 7.7 nothing drags: the form's buttons move marks.
  const opened = await openContext({ width: 390, height: 656, version: '7.0' })
  const { page, server } = opened
  await goToDocument(opened)
  await selectMark(page)
  assert.equal(await page.getByTestId('editor-grip').count(), 0, 'no grip')
  const box = await page.locator('.editor-mark.selected').boundingBox()
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 5 })
  await page.mouse.up()
  assert.equal(
    server.requests.filter((item) => item.method === 'PATCH' && item.endpoint.startsWith('/editor/')).length,
    0,
    'the chosen mark did not move',
  )
  await page.getByTestId('editor-object-down').click()
  const commands = await saved(page, server)
  assert.ok(commands[1].y > 420, 'the buttons still move it')
  assert.deepEqual(await page.evaluate(() => window.__tg.violations), [])
  await opened.context.close()
  passed('Below 7.7 marks never drag, and the form moves them')
}

{
  // A picture from the phone lands at the spot Add here opened on; a signature photographed on
  // paper loses its paper, and a photo with no signature in it is refused where it was chosen.
  const opened = await openContext({ width: 390, height: 656, marks: [] })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  const zoom = await zoomOf(page)
  await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 220 } })
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-add-picture').click(),
  ])
  await chooser.setFiles('tests/fixtures/brand-logo.png')
  await page.locator('.editor-mark.insert_image img').waitFor()
  let commands = await saved(page, server)
  assert.equal(commands[0].type, 'insert_image')
  assert.ok(Math.abs(commands[0].x + commands[0].width / 2 - 190 / zoom) < 2, 'where Add here was opened')
  assert.equal(server.uploads.at(-1).kind, 'image/png')

  await page.getByTestId('editor-tab-sign').click()
  const [blank] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-sign-photo').click(),
  ])
  await blank.setFiles('tests/fixtures/blank-photo.jpg')
  await page.getByTestId('editor-sign-refusal').waitFor()
  assert.equal(
    await page.getByTestId('editor-sign-refusal').evaluate((node) => getComputedStyle(node).fontSize),
    '13px',
    'a refusal is read at 13 px',
  )
  const [photo] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-sign-photo').click(),
  ])
  await photo.setFiles('tests/fixtures/signature-photo.jpg')
  await page.getByTestId('editor-armed').waitFor()
  await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 120 } })
  await page.locator('.editor-mark.signature img').waitFor()
  commands = await saved(page, server)
  const signature = commands.find((command) => command.type === 'signature')
  // The ink only: the photo is 320 by 140, the strokes inside it nearer 250 by 70.
  assert.ok(signature.width / signature.height > 2.9, 'cut to the ink, not the photo')
  assert.equal(server.uploads.at(-1).kind, 'image/png', 'ink on nothing, as a PNG')
  // Its paper is see-through: the corner of the picture sent has no colour in it.
  const corner = await page.locator('.editor-mark.signature img').evaluate(async (image) => {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return context.getImageData(1, 1, 1, 1).data[3]
  })
  assert.equal(corner, 0, 'the paper went')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed(
    'A picture lands at Add here’s spot; a photographed signature loses its paper, a blank photo is refused',
  )
}

{
  // A picture of the file's own: Turn is a new picture turned about its middle; Replace keeps its width.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({ width: 390, height: 656, marks: [picture] })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-turn').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="editor-object-turn"]')?.disabled)
  let commands = await saved(page, server)
  assert.equal(server.uploads.length, 1, 'the turned picture went up')
  assert.equal(commands[0].input_index, 2)
  assert.deepEqual([commands[0].width, commands[0].height], [50, 150], 'its box turned too')
  assert.deepEqual([commands[0].x, commands[0].y], [150, 50], 'about its middle')
  await (await chooseReplacement(page)).setFiles(inkFile)
  await page.waitForFunction(() => document.querySelectorAll('.editor-mark.insert_image').length === 1)
  await page.waitForFunction(() => !document.querySelector('[data-testid="editor-object-replace"]')?.disabled)
  commands = await saved(page, server)
  assert.equal(server.uploads.length, 2)
  assert.equal(commands[0].input_index, 3, 'replaced')
  assert.ok(
    Math.abs(commands[0].height - commands[0].width / 3) < 0.1,
    'as wide as it was, as tall as the new one stands',
  )
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Turn and Replace on a placed picture')
}

{
  // Fill in the form: the file's text fields as a list; other kinds are counted, not offered.
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [],
    formFields: [
      { name: 'full_name', type: '/Tx' },
      { name: 'agree', type: '/Btn' },
    ],
  })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-tab-add').click()
  await page.getByTestId('editor-add-fields').click()
  await page.getByTestId('editor-fields-sheet').waitFor()
  await page.getByTestId('editor-field-full_name').fill('Fixture Person')
  await page.screenshot({ path: path.join(output, '390-en-light-telegram-fields.png') })
  assert.deepEqual(await smallTargets(page), [], 'fields: tap targets')
  await axe(page, 'fields')
  await closeSheet(page)
  const commands = await saved(page, server)
  assert.deepEqual(commands, [{ type: 'fill_form', field: 'full_name', value: 'Fixture Person' }])
  await opened.context.close()
  passed('Fill in the form lists the text fields and saves their values')
}

{
  // First-use hints: one line, gone after the first success, back from More.
  const opened = await openContext({ width: 390, height: 656, marks: [] })
  const { page } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-hint').waitFor()
  await page.getByTestId('editor-page-1').click({ position: { x: 150, y: 200 } })
  await page.getByTestId('editor-add-tick').click()
  await page.getByTestId('editor-snackbar').waitFor()
  await page.getByTestId('editor-snackbar').locator('.icon-button').click()
  assert.equal(await page.getByTestId('editor-hint').count(), 0, 'retired once it worked')
  await page.getByTestId('editor-tab-blackout').click()
  assert.match(await page.getByTestId('editor-blackout-sheet').textContent(), /Tap a place to cover it/)
  // Above the sheet, which has just taken the bottom of the stage.
  await page.getByTestId('editor-page-1').click({ position: { x: 150, y: 120 } })
  assert.match(await page.getByTestId('editor-blackout-sheet').textContent(), /Tap another place/)
  await page.getByTestId('editor-blackout-done').click()
  await page.getByTestId('editor-more').click()
  await page.getByTestId('editor-more-tips').click()
  await page.getByTestId('editor-snackbar').locator('.icon-button').click()
  await page.getByTestId('editor-hint').waitFor()
  assert.deepEqual(
    JSON.parse(await page.evaluate(() => localStorage.getItem('pdf-master-editor-tips') ?? '[]')),
    [],
  )
  // The bot's link can name a tool, which opens its own place.
  await page.goto(`${origin}/en/app/editor/${DOC}?feature=editor.signature`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByTestId('editor-sign-sheet').waitFor()
  await opened.context.close()
  passed('Hints retire after their task works and come back from More; a deep link opens Sign')
}

{
  // At 1440 the same tools, with the sheet as the right-hand panel.
  const opened = await openContext({
    width: 1440,
    height: 900,
    inside: false,
    kept: keptSignature,
    marks: [],
  })
  const { page } = opened
  await goToDocument(opened)
  await settle(page)
  await page.getByTestId('editor-page-1').click({ position: { x: 300, y: 300 } })
  await page.getByTestId('editor-add-sheet').waitFor()
  const panel = await page.getByTestId('editor-add-sheet').boundingBox()
  assert.equal(Math.round(panel.width), 320, 'Add here is the panel')
  await noSidewaysScroll(page, 'wide add')
  await axe(page, 'wide add')
  await page.screenshot({ path: path.join(output, 'browser-1440-add-here.png') })
  await page.getByTestId('editor-add-tick').click()
  await page.getByTestId('editor-snackbar-action').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  assert.ok(await page.getByTestId('editor-object-larger').isVisible(), 'the form in the panel')
  await page.screenshot({ path: path.join(output, 'browser-1440-object.png') })
  await page.getByTestId('editor-tab-sign').click()
  await page.getByTestId('editor-sign-sheet').waitFor()
  await page.getByTestId('editor-sign-sheet').getByTestId('editor-sheet-close').click()
  await page.getByTestId('editor-command-list').waitFor()
  await opened.context.close()
  passed('At 1440 Add, Sign and the object form are the right-hand panel')
}

/* ------------------------------------------------------------------ the tools, seen */

for (const [name, width, height, locale, theme] of [
  ['390-en-light', 390, 656, 'en', 'light'],
  ['320-ru-dark', 320, 426, 'ru', 'dark'],
  ['320-uz-light', 320, 426, 'uz', 'light'],
  ['390-uz-dark', 390, 656, 'uz', 'dark'],
]) {
  const opened = await openContext({ width, height, locale, theme, kept: keptSignature })
  const { page, errors } = opened
  await goToDocument(opened)
  await page.waitForTimeout(200)
  const look = async (state) => {
    await noPlaceholderMonth(page, `${name} ${state}`)
    await noSidewaysScroll(page, `${name} ${state}`)
    assert.deepEqual(await smallTargets(page), [], `${name} ${state}: tap targets`)
    await axe(page, `${name} ${state}`)
    await page.screenshot({ path: path.join(output, `${name}-telegram-${state}.png`) })
  }
  await look('hint')
  await page.getByTestId('editor-page-1').click({ position: { x: width / 2, y: 180 } })
  await page.getByTestId('editor-add-sheet').waitFor()
  await page.waitForTimeout(150)
  const sheet = await page.getByTestId('editor-add-sheet').boundingBox()
  assert.ok(sheet.height <= height * 0.45 + 1, `${name}: Add here is compact (${sheet.height})`)
  await look('add-here')
  await page.getByTestId('editor-tab-sign').click()
  await page.getByTestId('editor-sign-sheet').waitFor()
  await look('sign')
  await page.getByTestId('editor-sign-draw').click()
  await page.getByTestId('editor-pad-sheet').waitFor()
  await look('pad')
  await page.getByTestId('editor-pad-sheet').getByTestId('editor-sheet-close').click()
  await page.getByTestId('editor-pad-sheet').waitFor({ state: 'hidden' })
  await page.getByTestId('editor-kept-1').click()
  await page.getByTestId('editor-armed').waitFor()
  await look('armed')
  await page.getByTestId('editor-page-1').click({ position: { x: width / 2, y: 200 } })
  await page.getByTestId('editor-snackbar').waitFor()
  await look('placed')
  await page.getByTestId('editor-snackbar-action').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.waitForTimeout(150)
  await look('object-signature')
  await closeSheet(page)
  await page.getByTestId('editor-tab-blackout').click()
  await page.getByTestId('editor-page-1').click({ position: { x: width / 2, y: 120 } })
  await page.getByTestId('editor-blackout-count').waitFor()
  await look('blackout')
  await page.getByTestId('editor-blackout-done').click()
  await page.getByTestId('editor-tab-add').click()
  await page.getByTestId('editor-add-text').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 30, y: 250 } })
  await page.getByTestId('editor-text-form').waitFor()
  await page.evaluate(() => window.__tg.keyboard(253))
  await page.keyboard.type(locale === 'ru' ? 'Фикстура' : 'Fixture')
  await page.waitForTimeout(200)
  await look('dock')
  await page.getByTestId('editor-text-done').click()
  await page.evaluate(() => window.__tg.keyboard(0))
  assert.deepEqual(errors, [], `${name}: page errors`)
  assert.deepEqual(opened.server.unexpected, [], `${name}: requests with no fixture`)
  await opened.context.close()
}
passed('The tools at 390 and 320, en uz ru, light and dark: axe, 44 px, no sideways scroll, compact sheets')

/* ------------------------------------------------------------------ pages, review and send */

const reviewReady = async (page) => {
  await page.getByTestId('editor-review-sheet').waitFor()
  await page.getByTestId('editor-review-cost').waitFor()
}
const closedApp = (page) => page.waitForFunction(() => window.__tg.log.some((call) => call[0] === 'close'))
const closes = async (page) => (await spied(page, 'close')).length
const slotOrder = (page) =>
  page.locator('[data-page-slot]').evaluateAll((nodes) => nodes.map((node) => Number(node.dataset.pageSlot)))
const lastQuote = (server) => server.quotes.filter((quote) => quote.id).at(-1)

{
  // F6, delete a page among edits: Edit, Pages, the page, Delete page, Send to chat, Confirm.
  const opened = await openContext({ width: 390, height: 656, pageCount: 4 })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  const flow = counter(page)
  await flow.tap(page.getByTestId('editor-tab-pages'))
  await page.getByTestId('editor-pages-board').waitFor()
  assert.equal(await page.locator('.editor-pages-panel .info-banner').count(), 0, 'never locked by the marks')
  await flow.tap(page.getByTestId('editor-grid-page-3'))
  await page.getByTestId('editor-page-sheet').waitFor()
  await flow.tap(page.getByTestId('editor-page-delete'))
  await page.getByTestId('editor-restore-3').waitFor()
  assert.equal((await mainButton(page)).text, 'Send to chat', 'Send to chat from Pages')
  await flow.main()
  await reviewReady(page)
  assert.match(await page.getByTestId('editor-review-facts').textContent(), /Pages: 4 → 3/)
  assert.equal(
    (await page.getByTestId('editor-review-removed').textContent()).trim(),
    'Removed: page 3 of the original',
  )
  assert.match(await page.getByTestId('editor-review-cost').textContent(), /Uses 1 file task; 11 of 15 left/)
  await flow.main()
  await page.getByTestId('editor-accepted').waitFor()
  assert.ok(flow.taps <= 6, `delete a page among edits in 6 taps (${flow.taps})`)
  await closedApp(page)
  const commands = await saved(page, server)
  assert.deepEqual(
    commands.filter((command) => command.type === 'delete_page'),
    [{ type: 'delete_page', page: 3 }],
  )
  assert.equal(commands.length, 3, 'the marks stay, with the page change after them')
  assert.equal(server.jobPosts.length, 1, 'one job')
  assert.equal(
    server.requests.filter((item) => item.endpoint === '/quotes').length,
    0,
    'no page job of its own',
  )
  assert.deepEqual(opened.errors, [])
  assert.deepEqual(server.unexpected, [])
  await opened.context.close()
  passed(`Delete a page among edits: ${flow.taps} taps, in the same job as the marks`)
}

{
  // A page with changes asks first; Undo brings it back; the last page stays.
  const opened = await openContext({ width: 390, height: 656 })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-tab-pages').click()
  // The count of changes on a card is told apart from its number, and said to a screen reader.
  assert.equal(
    await page.getByTestId('editor-grid-page-1').getAttribute('aria-label'),
    'Page 1 of 2, 2 changes',
  )
  assert.equal(await page.locator('.editor-pages-marks svg').count(), 1, 'a pencil beside the count')
  await page.getByTestId('editor-grid-page-1').click()
  await page.getByTestId('editor-page-delete').click()
  const ask = page.locator('.editor-page-ask')
  await ask.waitFor()
  assert.equal(await ask.locator('p').textContent(), 'Delete page 1 and its 2 changes?')
  await page.getByTestId('editor-page-delete-confirm').click()
  await page.getByTestId('editor-restore-1').waitFor()
  await page.getByTestId('editor-snackbar-action').click()
  await page.getByTestId('editor-restore-1').waitFor({ state: 'detached' })
  // The other page goes; then the last one is asked for and stays.
  await page.getByTestId('editor-grid-page-2').click()
  await page.getByTestId('editor-page-delete').click()
  await page.getByTestId('editor-restore-2').waitFor()
  await page.getByTestId('editor-grid-page-1').click()
  await page.getByTestId('editor-page-delete').click()
  await page.getByTestId('editor-page-delete-confirm').click()
  await page.getByTestId('editor-snackbar').filter({ hasText: 'Keep at least one page.' }).waitFor()
  assert.equal(await page.getByTestId('editor-restore-1').count(), 0)
  await page.getByTestId('editor-restore-2').click()
  await page.getByTestId('editor-restore-2').waitFor({ state: 'detached' })
  const commands = await saved(page, server)
  assert.equal(commands.filter((command) => command.type === 'delete_page').length, 0)
  await opened.context.close()
  passed('Removing a page with changes asks first; Undo and Restore bring it back; one page always stays')
}

{
  // Turn, move and drag: commands of the draft, shown as the file will be, with marks put in the page as uploaded.
  const opened = await openContext({ width: 390, height: 656, pageCount: 4, marks: [] })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-grid-page-2').click()
  await page.getByTestId('editor-page-turn-right').click()
  await page.getByTestId('editor-page-later').click()
  await page.screenshot({ path: path.join(output, 'pages-390-en-sheet.png') })
  await pressBack(page)
  await page.getByTestId('editor-page-sheet').waitFor({ state: 'hidden' })
  let commands = await saved(page, server)
  assert.deepEqual(commands, [
    { type: 'rotate_page', page: 2, angle: 90 },
    { type: 'reorder', order: [1, 3, 2, 4] },
  ])
  // Move: Put page here, between the others.
  await page.getByTestId('editor-grid-page-4').click()
  await page.getByTestId('editor-page-move').click()
  await page.getByTestId('editor-pages-moving').waitFor()
  await page.screenshot({ path: path.join(output, 'pages-390-en-move.png') })
  assert.equal(await page.getByTestId('editor-put-last').count(), 0, 'no target where it already is')
  await page.getByTestId('editor-put-before-1').click()
  commands = await saved(page, server)
  assert.deepEqual(commands.at(-1), { type: 'reorder', order: [4, 1, 3, 2] })
  // The grip drags a page past the others, as a shortcut.
  const grip = await page.getByTestId('editor-grip-1').boundingBox()
  const target = await page.getByTestId('editor-grid-page-2').boundingBox()
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width * 0.8, target.y + target.height / 2, { steps: 6 })
  await page.mouse.up()
  commands = await saved(page, server)
  assert.deepEqual(commands.at(-1), { type: 'reorder', order: [4, 3, 2, 1] })
  await page.getByTestId('editor-undo').click()
  commands = await saved(page, server)
  assert.deepEqual(commands.at(-1), { type: 'reorder', order: [4, 1, 3, 2] }, 'one Undo, one move')
  // The stage shows the file as it will be made.
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-page-2').waitFor()
  assert.deepEqual(await slotOrder(page), [4, 1, 3, 2])
  assert.equal(await page.getByTestId('editor-page-chip').textContent(), '1 / 4')
  const slot = await page.locator('[data-page-slot="2"]').boundingBox()
  assert.ok(slot.width > slot.height, 'the turned page lies on its side')
  assert.ok(slot.width <= 390, 'and still fits the phone')
  // A tick on the turned page lands where the finger was, in the page as uploaded.
  await page.locator('[data-page-slot="2"]').scrollIntoViewIfNeeded()
  const box = await page.locator('[data-page-slot="2"]').boundingBox()
  const zoom = box.height / PAGE.width
  const [vx, vy] = [box.width * 0.3, box.height * 0.6]
  await page.mouse.click(box.x + vx, box.y + vy)
  await page.getByTestId('editor-add-sheet').waitFor()
  await page.getByTestId('editor-add-tick').click()
  commands = await saved(page, server)
  const tick = commands.find((command) => command.type === 'draw')
  assert.equal(tick.page, 2)
  const xs = tick.points.map(([x]) => x)
  const ys = tick.points.map(([, y]) => y)
  const middle = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
  assert.ok(Math.abs(middle[0] - vy / zoom) < 3, `x in the page as uploaded (${middle[0]} vs ${vy / zoom})`)
  assert.ok(Math.abs(middle[1] - (PAGE.height - vx / zoom)) < 3, `y too (${middle[1]})`)
  await page.screenshot({ path: path.join(output, 'stage-390-en-turned.png') })
  assert.deepEqual(opened.errors, [])
  assert.deepEqual(server.unexpected, [])
  await opened.context.close()
  passed(
    'Turn, Later, Move and the grip write one page command each; the stage shows them; a tap on a turned page lands true',
  )
}

{
  // The whole of it: open, sign, date, delete a page, black out, tick, Send to chat.
  const opened = await openContext({ width: 390, height: 656, pageCount: 4, marks: [], kept: keptSignature })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  await page.getByTestId('editor-tab-sign').click()
  await page.getByTestId('editor-kept-1').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 250, y: 380 } })
  await page.locator('.editor-mark.signature img.editor-mark-picture').waitFor()
  await page.getByTestId('editor-page-1').click({ position: { x: 120, y: 450 } })
  await page.getByTestId('editor-add-date').click()
  await page.getByTestId('editor-add-sheet').waitFor({ state: 'detached' })
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-grid-page-4').click()
  await page.getByTestId('editor-page-delete').click()
  await page.getByTestId('editor-restore-4').waitFor()
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-tab-blackout').click()
  await page.getByTestId('editor-page-2').click({ position: { x: 200, y: 200 } })
  await page.getByTestId('editor-blackout-count').waitFor()
  await page.getByTestId('editor-blackout-done').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 300, y: 300 } })
  await page.getByTestId('editor-add-tick').click()
  await page.getByTestId('editor-add-sheet').waitFor({ state: 'detached' })
  await pressMain(page)
  await page.getByTestId('editor-review-consent').waitFor()
  assert.match(await page.getByTestId('editor-review-consent').textContent(), /Pages that become pictures: 2/)
  assert.equal((await mainButton(page)).isActive, false, 'Confirm waits for I understand and the cost')
  await page.getByTestId('editor-consent').check()
  await page.getByTestId('editor-review-cost').waitFor()
  await page.screenshot({ path: path.join(output, 'review-390-en-consent.png') })
  await page.waitForFunction(() => window.__tg.app.MainButton.isActive)
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  await page.screenshot({ path: path.join(output, 'review-390-en-accepted.png') })
  assert.ok(
    (await spied(page, 'haptic')).some((call) => call[1] === 'success'),
    'a haptic on acceptance',
  )
  await closedApp(page)
  const commands = server.commands
  // Order among them is free: the engine applies page changes after every mark whatever their place.
  assert.deepEqual(commands.map((command) => command.type).sort(), [
    'add_text',
    'delete_page',
    'draw',
    'redact',
    'signature',
  ])
  assert.equal(commands.find((command) => command.type === 'add_text').text, today())
  assert.deepEqual(
    commands.find((command) => command.type === 'delete_page'),
    { type: 'delete_page', page: 4 },
  )
  assert.equal(commands.find((command) => command.type === 'redact').page, 2)
  const quote = lastQuote(server)
  assert.deepEqual(quote.body, { version: server.version, deliver: 'chat', accept_rasterization: true })
  assert.equal(server.jobPosts.length, 1, 'one job')
  assert.deepEqual(server.jobPosts[0].body, { quote_id: quote.id, deliver_to_chat: true })
  assert.match(server.jobPosts[0].key, /^[0-9a-f-]{36}$/)
  assert.deepEqual(opened.errors, [])
  assert.deepEqual(server.unexpected, [])
  await opened.context.close()
  passed(
    'Open, sign, date, delete a page, black out, tick, Send to chat: one quote with consent, one job, and the app closes',
  )
}

{
  // A quote that ran out is asked for again before the send, in the foreground.
  const same = await openContext({ width: 390, height: 656, quoteTtl: 1000 })
  await goToDocument(same)
  await pressMain(same.page)
  await reviewReady(same.page)
  await pressMain(same.page)
  await same.page.getByTestId('editor-accepted').waitFor()
  assert.equal(same.server.quotes.length, 2, 'asked again')
  assert.equal(same.server.jobPosts[0].body.quote_id, lastQuote(same.server).id, 'and sent on the new one')
  await same.context.close()
  // If what it uses changed meanwhile, the new cost is shown and confirmed again.
  const changed = await openContext({
    width: 390,
    height: 656,
    quoteTtl: 1000,
    cost: (n) => (n === 1 ? COST : { kind: 'file_task', left: 10, limit: 15 }),
  })
  await goToDocument(changed)
  await pressMain(changed.page)
  await reviewReady(changed.page)
  await pressMain(changed.page)
  await changed.page.getByTestId('editor-cost-changed').waitFor()
  assert.equal(changed.server.jobPosts.length, 0, 'nothing sent on a cost not seen')
  assert.match(await changed.page.getByTestId('editor-review-cost').textContent(), /10 of 15 left/)
  await changed.page.screenshot({ path: path.join(output, 'review-390-en-cost-changed.png') })
  await pressMain(changed.page)
  await changed.page.getByTestId('editor-accepted').waitFor()
  assert.equal(changed.server.jobPosts.length, 1)
  await changed.context.close()
  passed('An expired quote is asked for again at Confirm; a changed cost is shown and confirmed again')
}

{
  // No answer: Try again sends the same quote under the same key, so the server settles it once.
  const opened = await openContext({ width: 390, height: 656, jobAnswer: (n) => (n === 1 ? 'drop' : 'slow') })
  const { page, server } = opened
  await goToDocument(opened)
  await pressMain(page)
  await reviewReady(page)
  await pressMain(page)
  await page.getByTestId('editor-send-failed').waitFor()
  assert.equal(await page.getByTestId('editor-send-failed').textContent(), 'Couldn’t send. Nothing was used.')
  await page.waitForFunction(() => window.__tg.app.MainButton.text === 'Try again')
  await page.screenshot({ path: path.join(output, 'review-390-en-send-failed.png') })
  await pressMain(page)
  // While it goes, Telegram's button shows its own progress and takes no second press.
  await page.getByTestId('editor-sending').waitFor()
  assert.deepEqual(
    await page.evaluate(() => {
      const button = window.__tg.app.MainButton
      return { text: button.text, progress: button.progress }
    }),
    { text: 'Sending…', progress: true },
  )
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(await page.evaluate(() => window.__tg.app.MainButton.progress), false, 'progress ends')
  assert.equal(server.jobPosts.length, 2)
  assert.equal(server.jobPosts[0].key, server.jobPosts[1].key, 'the same Idempotency-Key')
  assert.equal(server.jobPosts[0].body.quote_id, server.jobPosts[1].body.quote_id, 'the same quote')
  assert.equal(server.quotes.length, 1, 'no new quote')
  await opened.context.close()
  passed(
    'Couldn’t send: Try again reuses the quote and the Idempotency-Key; sending shows progress and takes one press',
  )
}

{
  // Each refusal has its state: the server's code, said as section 9 says it.
  const cases = [
    {
      name: 'send-limit',
      options: { jobAnswer: () => ['send_limit', 429, { limit: 10, per: 'day' }] },
      confirm: true,
      text: 'This file has been sent 10 times today. You can send it again tomorrow.',
    },
    {
      name: 'week-used',
      options: { quoteRefusal: () => ['weekly_file_limit', 429] },
      text: /^Sending opens Monday 00:00 \(Tashkent\); this file is deleted at .+\./,
    },
    {
      name: 'no-chat',
      options: { quoteRefusal: () => ['telegram_link_required', 409] },
      text: 'This account has no Telegram chat to send to.',
    },
    {
      name: 'too-large',
      options: { quoteRefusal: () => ['payload_too_large', 413] },
      text: 'Too many changes for one file. Remove some, then send.',
    },
  ]
  for (const item of cases) {
    const opened = await openContext({ width: 390, height: 656, ...item.options })
    const { page, server } = opened
    await goToDocument(opened)
    await pressMain(page)
    if (item.confirm) {
      await reviewReady(page)
      await pressMain(page)
    }
    const refused = page.getByTestId('editor-refused')
    await refused.waitFor()
    const words = (await refused.locator('p').first().textContent()).trim()
    if (item.text instanceof RegExp) assert.match(words, item.text, item.name)
    else assert.equal(words, item.text, item.name)
    await page.waitForFunction(() => !window.__tg.app.MainButton.isVisible)
    await page.screenshot({ path: path.join(output, `review-390-en-${item.name}.png`) })
    assert.deepEqual(opened.errors, [])
    assert.deepEqual(server.unexpected, [])
    await opened.context.close()
  }
  // One change the server will not take: Show it goes to it, Send without it takes it out and asks again.
  const opened = await openContext({
    width: 390,
    height: 656,
    quoteRefusal: (n) =>
      n <= 2 ? ['invalid_editor_command', 400, { index: 1, code: 'invalid_editor_command' }] : null,
  })
  const { page, server } = opened
  await goToDocument(opened)
  await pressMain(page)
  await page.getByTestId('editor-refused').waitFor()
  assert.equal(
    (await page.getByTestId('editor-refused').locator('p').first().textContent()).trim(),
    'One change can’t go into the file: 2. Highlight, Page 1',
  )
  await page.screenshot({ path: path.join(output, 'review-390-en-change-refused.png') })
  await page.getByTestId('editor-review-show').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  assert.equal(await page.locator('.editor-mark.highlight.selected').count(), 1, 'Show it chose the change')
  await closeSheet(page)
  await pressMain(page)
  await page.getByTestId('editor-send-without').waitFor()
  await page.getByTestId('editor-send-without').click()
  await reviewReady(page)
  assert.deepEqual(
    server.commands.map((command) => command.type),
    ['add_text'],
    'sent without it',
  )
  await opened.context.close()
  passed(
    'send_limit, weekly_file_limit, telegram_link_required, payload_too_large and a refused change each say so',
  )
}

{
  // In a browser: Download, then the file is followed until made and offered, with what was left out.
  const opened = await openContext({
    width: 390,
    height: 844,
    inside: false,
    perCommand: [
      { index: 0, status: 'skipped', engine: 'pypdf' },
      { index: 1, status: 'applied', engine: 'pypdf' },
    ],
  })
  const { page, server } = opened
  await goToDocument(opened)
  assert.equal(await page.getByTestId('editor-primary').textContent(), 'Download')
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  assert.equal(await page.getByTestId('editor-confirm').textContent(), 'Confirm · 1 file task')
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('editor-download').waitFor()
  assert.equal(
    await page.getByTestId('editor-download').getAttribute('href'),
    `/api/v1/artifacts/${ARTIFACT}/download`,
  )
  assert.equal(
    await page.getByTestId('editor-skipped').textContent(),
    '1 change was on a removed page and was left out.',
  )
  assert.equal(server.jobPosts[0].body.deliver_to_chat, undefined, 'a browser asks for no chat')
  assert.equal(lastQuote(server).body.deliver, 'download')
  assert.equal(await closes(page), 0)
  await noSidewaysScroll(page, 'browser made')
  assert.deepEqual(await smallTargets(page), [], 'browser made: tap targets')
  await axe(page, 'browser made')
  await page.screenshot({ path: path.join(output, 'review-390-en-browser-made.png') })
  await page.getByTestId('editor-keep-editing').click()
  await page.waitForFunction(() =>
    location.pathname.endsWith('/app/editor/00000000-0000-4000-8000-000000000001'),
  )
  const reopened = server.requests.filter(
    (item) => item.endpoint === '/editor/documents' && item.method === 'POST',
  )
  assert.deepEqual(reopened.at(-1).body, { file_id: RESULT }, 'Keep editing opens the sent file')
  assert.deepEqual(opened.errors, [])
  assert.deepEqual(server.unexpected, [])
  await opened.context.close()

  // A change that did not come out right: nothing was sent or used, Show it, Send without it.
  const failed = await openContext({
    width: 390,
    height: 844,
    inside: false,
    jobOutcome: ['editor_check_failed', { index: 1 }],
  })
  await goToDocument(failed)
  await failed.page.getByTestId('editor-primary').click()
  await reviewReady(failed.page)
  await failed.page.getByTestId('editor-confirm').click()
  const refused = failed.page.getByTestId('editor-refused')
  await refused.waitFor()
  assert.equal(
    (await refused.locator('p').first().textContent()).trim(),
    'One change didn’t come out right; nothing was sent or used.',
  )
  await failed.page.screenshot({ path: path.join(output, 'review-390-en-check-failed.png') })
  await failed.page.getByTestId('editor-send-without').click()
  await reviewReady(failed.page)
  assert.equal(failed.server.commands.length, 1, 'the change is out')
  await failed.context.close()
  passed(
    'Outside Telegram: Download, the file followed and offered, skipped changes said, a failed check says Show it and Send without it',
  )
}

{
  // At 80 % of the week used the app stays, with Keep editing the sent file; otherwise it closes.
  const opened = await openContext({
    width: 390,
    height: 656,
    cost: { kind: 'file_task', left: 3, limit: 15 },
  })
  const { page, server } = opened
  await goToDocument(opened)
  await pressMain(page)
  await reviewReady(page)
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  await page.waitForTimeout(1200)
  assert.equal(await closes(page), 0, 'stays open')
  const keep = page.getByTestId('editor-keep-editing')
  await page.waitForFunction(() => !document.querySelector('[data-testid="editor-keep-editing"]')?.disabled)
  await page.screenshot({ path: path.join(output, 'review-390-en-stay-open.png') })
  await keep.click()
  await page.waitForFunction(() =>
    location.pathname.endsWith('/app/editor/00000000-0000-4000-8000-000000000001'),
  )
  assert.deepEqual(
    server.requests.filter((item) => item.endpoint === '/editor/documents' && item.method === 'POST').at(-1)
      .body,
    { file_id: RESULT },
  )
  await opened.context.close()
  for (const [cost, line, button] of [
    [{ kind: 'included', left: null, limit: null }, 'Included in your plan', 'Confirm'],
    [{ kind: 'none', left: 11, limit: 15 }, 'No task used: already counted this week', 'Confirm'],
  ]) {
    const other = await openContext({ width: 390, height: 656, cost })
    await goToDocument(other)
    await pressMain(other.page)
    await reviewReady(other.page)
    assert.equal((await other.page.getByTestId('editor-review-cost').textContent()).trim(), line)
    await other.page.waitForFunction((text) => window.__tg.app.MainButton.text === text, button)
    await other.page.screenshot({ path: path.join(output, `review-390-en-${cost.kind}.png`) })
    await pressMain(other.page)
    await other.page.getByTestId('editor-accepted').waitFor()
    await closedApp(other.page)
    await other.context.close()
  }
  passed(
    '80 % of the week used keeps the app open with Keep editing the sent file; Included and No task used say so',
  )
}

{
  // Saved but not sent: a dot in the top bar, gone once sent, back with the next change.
  const opened = await openContext({ width: 390, height: 844, inside: false })
  const { page } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-unsent').waitFor()
  assert.match(await page.getByTestId('editor-save-words').textContent(), /Not sent yet/)
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  await page.getByTestId('editor-confirm').click()
  // While the job waits for its turn the draft is held: a change now would fail it.
  await closeSheet(page)
  await page.getByTestId('editor-held').waitFor()
  assert.equal(await page.getByTestId('editor-primary').isDisabled(), true, 'no second send meanwhile')
  await page.getByTestId('editor-held').waitFor({ state: 'detached' })
  assert.equal(await page.getByTestId('editor-unsent').count(), 0, 'sent')
  await selectMark(page)
  await page.getByTestId('editor-object-delete').click()
  await page.getByTestId('editor-unsent').waitFor()
  await opened.context.close()
  passed('Not sent yet shows while saved changes are unsent; a send holds the draft until its job starts')
}

{
  // The other device changed it: Review steps aside for the choice.
  const opened = await openContext({ width: 390, height: 656 })
  const { page, server } = opened
  await goToDocument(opened)
  server.version += 1
  await pressMain(page)
  await page.getByTestId('editor-review-sheet').waitFor({ state: 'hidden' })
  await page.locator('.editor-conflict').first().waitFor()
  await opened.context.close()
  passed('A conflict at Review closes it and asks which version stays')
}

{
  // The bot's link to a file the editor cannot open says why, with the way on.
  for (const [reason, testid] of [
    ['password', 'editor-refusal-unlock'],
    ['signed', null],
  ]) {
    const opened = await openContext({
      width: 390,
      height: 656,
      openRefusal: ['unsupported_file', 400, { reason }],
    })
    await opened.page.goto(`${origin}/en/app/editor?file_id=${FILE}`, { waitUntil: 'domcontentloaded' })
    const state = opened.page.getByTestId('editor-refusal')
    await state.waitFor()
    assert.equal(await state.getAttribute('data-reason'), reason)
    if (testid) assert.ok(await opened.page.getByTestId(testid).isVisible())
    await noSidewaysScroll(opened.page, reason)
    assert.deepEqual(
      await smallTargets(opened.page, '[data-testid="editor-refusal"]'),
      [],
      `${reason}: tap targets`,
    )
    await axe(opened.page, reason)
    await opened.page.screenshot({ path: path.join(output, `open-390-en-${reason}.png`) })
    await opened.context.close()
  }
  // Switched off, the launcher as before.
  const off = await openContext({
    width: 390,
    height: 844,
    editor: { editor_v2: false },
    openRefusal: ['unsupported_file', 400, { reason: 'password' }],
  })
  await off.page.goto(`${origin}/en/app/editor?file_id=${FILE}`, { waitUntil: 'domcontentloaded' })
  await off.page.locator('.editor-launcher').waitFor()
  assert.equal(await off.page.getByTestId('editor-refusal').count(), 0)
  await off.context.close()
  passed(
    'Open-time refusals: password offers Unlock PDF, signed asks for an unsigned copy; off, the launcher',
  )
}

{
  // A scan opens like any file and says what works; Make text editable opens the text task with this file.
  const ocr = {
    id: 'ocr.searchable_pdf',
    name: 'Searchable PDF',
    category: 'ocr',
    surface: 'file',
    eligible: true,
    min_files: 1,
    max_files: 1,
    accepted_mime_types: ['application/pdf'],
    parameter_schema: { type: 'object', properties: {} },
  }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [],
    pdf: scannedBytes,
    imageCounts: [1, 1],
    catalog: [ocr],
  })
  const { page, server } = opened
  await goToDocument(opened)
  const banner = page.getByTestId('editor-scan')
  await banner.waitFor()
  assert.equal(
    (await banner.locator('span').first().textContent()).trim(),
    'Scan: you can sign and add text.',
  )
  await noSidewaysScroll(page, 'scan')
  assert.deepEqual(await smallTargets(page), [], 'scan: tap targets')
  await axe(page, 'scan')
  await page.screenshot({ path: path.join(output, 'open-390-en-scan.png') })
  // Marks still go on it: Sign is there as on any file.
  assert.ok(await page.getByTestId('editor-tab-sign').isVisible())
  await page.getByTestId('editor-scan-ocr').click()
  await page.waitForURL(/\/en\/app\/tools\/ocr\.searchable_pdf$/)
  const carried = await page.evaluate(() => JSON.parse(sessionStorage.getItem('pdf-master-draft') || 'null'))
  assert.equal(carried?.tool, 'ocr.searchable_pdf')
  assert.deepEqual(
    carried?.files.map((file) => file.id),
    [FILE],
    'the task opens with this file in it',
  )
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  // The longest words, at 320 and Android's larger text.
  for (const [locale, theme] of [
    ['ru', 'dark'],
    ['uz', 'light'],
  ]) {
    const small = await openContext({
      width: 320,
      height: 426,
      locale,
      theme,
      marks: [],
      pdf: scannedBytes,
      imageCounts: [1, 1],
    })
    await goToDocument(small)
    await small.page.getByTestId('editor-scan').waitFor()
    await scaleText(small.page)
    await noSidewaysScroll(small.page, `scan ${locale}`)
    assert.deepEqual(await smallTargets(small.page), [], `scan ${locale}: tap targets`)
    await axe(small.page, `scan ${locale}`)
    await small.page.screenshot({ path: path.join(output, `open-320-${locale}-${theme}-scan.png`) })
    await small.context.close()
  }
  // A file with words, pictures or not, is no scan; nor is one shown as server pictures.
  for (const options of [
    { imageCounts: [1, 1] },
    { pdf: scannedBytes, imageCounts: [1, 1], download: 503 },
  ]) {
    const other = await openContext({ width: 390, height: 656, marks: [], ...options })
    await goToDocument(other)
    await other.page.locator('[data-testid="editor-page-1"]').waitFor()
    await other.page.waitForTimeout(1200)
    assert.equal(await other.page.getByTestId('editor-scan').count(), 0, 'no scan state')
    await other.context.close()
  }
  assert.deepEqual(server.unexpected, [])
  passed('A scan says it can be signed and written on, and Make text editable opens the text task with it')
}

{
  // ✏️ Edit under a PDF: a send reopens its draft; another file opens as a new draft. Off: nothing new.
  const job = (id, feature, parameters, fileId) => ({
    id,
    feature_id: feature,
    status: 'succeeded',
    created_at: new Date().toISOString(),
    input_files: [],
    warnings: [],
    error: null,
    parameters,
    artifacts: [
      {
        id: ARTIFACT,
        file_id: fileId,
        name: 'Fixture_result.pdf',
        mime_type: 'application/pdf',
        size_bytes: 120000,
        download_url: `/api/v1/artifacts/${ARTIFACT}/download`,
      },
    ],
  })
  const sentJob = '00000000-0000-4000-8000-0000000000d1'
  const mergeJob = '00000000-0000-4000-8000-0000000000d2'
  const presetJobs = [
    job(sentJob, 'editor.visual', { editor_document_id: DOC, version: 3, deliver: 'chat' }, RESULT),
    job(mergeJob, 'pdf.merge', {}, RESULT),
  ]
  const opened = await openContext({ width: 390, height: 844, presetJobs })
  const { page, server } = opened
  await page.goto(`${origin}/en/app/jobs/${sentJob}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('artifact-edit').waitFor()
  assert.equal(await page.getByTestId('artifact-edit').getAttribute('href'), `/en/app/editor/${DOC}`)
  assert.ok(
    await page.getByText('Send to chat').isVisible(),
    'Send to my bot reads Send to chat in the Mini App',
  )
  await page.screenshot({ path: path.join(output, 'job-390-en-edit.png') })
  await page.goto(`${origin}/en/app/jobs/${mergeJob}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('artifact-edit').waitFor()
  await page.getByTestId('artifact-edit').click()
  await page.getByTestId('editor-frame').waitFor()
  assert.deepEqual(
    server.requests.filter((item) => item.endpoint === '/editor/documents' && item.method === 'POST').at(-1)
      .body,
    { file_id: RESULT },
  )
  await opened.context.close()
  const off = await openContext({ width: 390, height: 844, presetJobs, editor: { editor_v2: false } })
  await off.page.goto(`${origin}/en/app/jobs/${sentJob}`, { waitUntil: 'domcontentloaded' })
  await off.page.locator('.artifact-row').waitFor()
  assert.equal(await off.page.getByTestId('artifact-edit').count(), 0, 'off: no Edit')
  assert.ok(await off.page.getByText('Send to my bot').isVisible())
  await off.context.close()
  passed('Edit under a PDF reopens the draft a send came from, or opens the file; off, nothing changes')
}

{
  // pdf.js reads by ranges where the server answers 206, and the first page's picture shows meanwhile.
  const opened = await openContext({
    width: 390,
    height: 656,
    pageCount: 4,
    marks: [],
    ranges: true,
    downloadDelay: 400,
    scale: 3,
  })
  const { page, server } = opened
  await page.goto(`${origin}/en/app/editor/${DOC}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('editor-page-early').waitFor()
  await settle(page)
  await page.waitForFunction(() => !document.querySelector('[data-testid="editor-page-early"]'))
  const read = server.downloads.filter((range) => range.startsWith('bytes='))
  assert.ok(read.length >= 2, `pdf.js asked for parts as it needed them (${read.join(' ')})`)
  assert.ok(!server.downloads.includes(''), 'and never for the whole file')
  const canvas = await page
    .locator('[data-testid="editor-page-1"] canvas')
    .evaluate((node) => ({ width: node.width, css: node.getBoundingClientRect().width }))
  assert.ok(
    canvas.width <= canvas.css * 1.5 + 2,
    `a 3x screen draws at 1.5 (${canvas.width} for ${canvas.css})`,
  )
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  // A server without ranges answers the first ask with the whole file, read as before; switched off, as before too.
  for (const [editor, ranged] of [
    [{ editor_v2: true }, 1],
    [{ editor_v2: false }, 0],
  ]) {
    const plain = await openContext({ width: 390, height: 844, editor })
    await goToDocument(plain)
    await settle(plain.page)
    await plain.page.locator('[data-testid="editor-page-1"] canvas').waitFor()
    assert.equal(plain.server.downloads.length, 1, 'one request for the file')
    assert.equal(plain.server.downloads.filter((range) => range).length, ranged)
    assert.deepEqual(plain.errors, [])
    await plain.context.close()
  }
  passed(
    'Range loading where the server has it, page 1’s picture first, 1.5 on a 3x screen; without ranges as before',
  )
}

/* ------------------------------------------------------------------ what review found */

{
  // Review cannot be closed while its send is being asked for: its answer would close the app on
  // whatever came next. Back, Escape and the dimmed page wait for it, and there is no ✕.
  const opened = await openContext({ width: 390, height: 656, jobAnswer: () => 'slow' })
  const { page, server } = opened
  await goToDocument(opened)
  await pressMain(page)
  await reviewReady(page)
  await pressMain(page)
  await page.getByTestId('editor-sending').waitFor()
  // A browser that closes it all the same, as one without `closedby` does on Escape after Escape: it goes back up.
  await page.getByTestId('editor-review-sheet').evaluate((dialog) => dialog.close())
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="editor-review-sheet"]')?.matches(':modal'),
  )
  assert.equal(
    await page.locator('[data-testid="editor-review-sheet"] [data-testid="editor-sheet-close"]').count(),
    0,
    'no ✕ while sending',
  )
  assert.equal((await backButton(page)).isVisible, true, 'Back stays Back, not Close')
  await pressBack(page)
  // Escape again and again: Chrome stops letting a dialog refuse it and closes the dialog itself.
  for (let n = 0; n < 3; n += 1) await page.keyboard.press('Escape')
  await page.mouse.click(5, 5)
  assert.ok(await page.getByTestId('editor-review-sheet').isVisible(), 'Review stays')
  assert.ok(
    await page.getByTestId('editor-review-sheet').evaluate((dialog) => dialog.matches(':modal')),
    'still over the page',
  )
  assert.ok(await page.getByTestId('editor-sending').isVisible(), 'and still says Sending')
  await page.getByTestId('editor-accepted').waitFor()
  await closedApp(page)
  assert.equal(server.jobPosts.length, 1)
  assert.equal(await closes(page), 1)
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Review holds while its send is asked for: no ✕, and Back, Escape and the page above wait')
}

{
  // Closed and opened again before the browser says it closed: that word, come late, closes nothing.
  const opened = await openContext({ width: 390, height: 656 })
  const { page, server } = opened
  await goToDocument(opened)
  await pressMain(page)
  await reviewReady(page)
  await page.evaluate(async () => {
    document.querySelector('dialog[open] [data-testid="editor-sheet-close"]').click()
    // The sheet has closed, and its `close` event waits for a task of its own.
    for (let n = 0; n < 10; n += 1) await Promise.resolve()
    window.__tg.app.MainButton.press()
  })
  await page.waitForTimeout(300)
  await reviewReady(page)
  assert.ok(
    await page.getByTestId('editor-review-sheet').evaluate((dialog) => dialog.matches(':modal')),
    'Review is up',
  )
  assert.equal(server.quotes.length, 2, 'and asked again')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Review closed and opened again at once stays open')
}

{
  // Placing is a step of its own: Back lets go of it as Cancel does, rather than quitting the app.
  const opened = await openContext({ width: 390, height: 656, marks: [], kept: keptSignature })
  const { page } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-tab-sign').click()
  await page.getByTestId('editor-kept-1').click()
  await page.getByTestId('editor-armed').waitFor()
  assert.deepEqual(await backButton(page), { isVisible: true, handlers: 1 }, 'Back, not Close, while placing')
  await pressBack(page)
  await page.getByTestId('editor-armed').waitFor({ state: 'detached' })
  assert.deepEqual(await backButton(page), { isVisible: false, handlers: 0 })
  assert.equal(await closes(page), 0, 'the app stays')
  await opened.context.close()
  // In a browser the top bar's arrow does the same, rather than leaving for the list.
  const plain = await openContext({ width: 390, height: 656, marks: [], inside: false })
  await plain.context.addInitScript((value) => localStorage.setItem('pdf-master-signatures', value), keptSignature)
  await goToDocument(plain)
  await plain.page.getByTestId('editor-tab-sign').click()
  await plain.page.getByTestId('editor-kept-1').click()
  await plain.page.getByTestId('editor-armed').waitFor()
  await plain.page.getByTestId('editor-back').click()
  await plain.page.getByTestId('editor-armed').waitFor({ state: 'detached' })
  assert.match(plain.page.url(), new RegExp(`/app/editor/${DOC}$`), 'still on the document')
  await plain.context.close()
  passed('Back while placing lets go of the signature, in Telegram and in a browser')
}

{
  // Pages removed: a mark's form, Black out's count and Review name a page by its new place.
  const opened = await openContext({
    width: 390,
    height: 656,
    pageCount: 4,
    marks: [
      { type: 'highlight', page: 2, x: 80, y: 420, width: 220, height: 40, color: '#FFFF00' },
      { type: 'redact', page: 2, x: 80, y: 200, width: 120, height: 20 },
    ],
    quoteRefusal: (n) => (n === 1 ? ['invalid_editor_command', 400, { index: 0 }] : null),
  })
  const { page } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-grid-page-1').click()
  await page.getByTestId('editor-page-delete').click()
  await page.getByTestId('editor-restore-1').waitFor()
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-page-chip').waitFor()
  assert.equal((await page.getByTestId('editor-page-chip').textContent()).trim(), '1 / 3')
  await selectMark(page)
  assert.equal(
    (await page.locator('[data-testid="editor-object-sheet"] .sheet-head strong').textContent()).trim(),
    'Highlight, page 1',
  )
  await closeSheet(page)
  await page.getByTestId('editor-tab-blackout').click()
  await page.getByTestId('editor-blackout-count').waitFor()
  assert.match(await page.getByTestId('editor-blackout-count').textContent(), /· page 1$/)
  await page.getByTestId('editor-blackout-done').click()
  await pressMain(page)
  await page.getByTestId('editor-refused').waitFor()
  assert.match(await page.getByTestId('editor-refused').textContent(), /1\. Highlight, Page 1/)
  await opened.context.close()
  passed('After a page goes, the form, Black out and Review name pages as the chip does')
}

{
  // Undo in a snackbar takes back the step it names, or goes once another step follows.
  const opened = await openContext({ width: 390, height: 656 })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  await selectMark(page)
  await page.getByTestId('editor-object-delete').click()
  await page.getByTestId('editor-snackbar').filter({ hasText: 'Deleted' }).waitFor()
  await page.getByTestId('editor-tab-blackout').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 200, y: 120 } })
  await page.getByTestId('editor-blackout-count').waitFor()
  assert.equal(await page.getByTestId('editor-snackbar').count(), 0, 'Deleted · Undo went with the next step')
  assert.equal(await page.locator('.editor-mark.highlight').count(), 0)
  assert.equal(await page.locator('.editor-mark.redact').count(), 1)
  await page.getByTestId('editor-blackout-done').click()
  // In Pages: a page removed, then another turned.
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-grid-page-2').click()
  await page.getByTestId('editor-page-delete').click()
  await page.getByTestId('editor-snackbar').filter({ hasText: 'Page 2 removed' }).waitFor()
  await page.getByTestId('editor-grid-page-1').click()
  await page.getByTestId('editor-page-turn-right').click()
  await page.waitForTimeout(100)
  assert.equal(await page.getByTestId('editor-snackbar').count(), 0, 'Page removed · Undo went with the turn')
  const commands = await saved(page, server)
  assert.deepEqual(
    commands.filter((command) => ['rotate_page', 'delete_page'].includes(command.type)).map((c) => c.type),
    ['rotate_page', 'delete_page'],
  )
  await opened.context.close()
  passed('A snackbar’s Undo goes once another step follows, so it never takes back the wrong one')
}

{
  // While a send holds the draft nothing changes, and nothing says it did.
  const opened = await openContext({ width: 390, height: 844, inside: false, queued: 4 })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('editor-accepted').waitFor()
  await closeSheet(page)
  await page.getByTestId('editor-held').waitFor()
  const version = server.version
  await selectMark(page)
  await page.getByTestId('editor-object-delete').click()
  await page.waitForTimeout(150)
  assert.equal(await page.getByTestId('editor-snackbar').count(), 0, 'no Deleted for a mark still there')
  assert.equal(await page.locator('.editor-mark.highlight').count(), 1)
  await closeSheet(page)
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-grid-page-2').click()
  await page.getByTestId('editor-page-delete').click()
  await page.waitForTimeout(150)
  assert.equal(await page.getByTestId('editor-snackbar').count(), 0, 'no Page removed for a page still there')
  assert.equal(await page.getByTestId('editor-restore-2').count(), 0)
  assert.ok(await page.getByTestId('editor-held').isVisible(), 'still held meanwhile')
  assert.equal(server.version, version, 'nothing saved while held')
  await page.getByTestId('editor-held').waitFor({ state: 'detached', timeout: 20000 })
  await opened.context.close()
  passed('While a send holds the draft, deleting a mark or a page says nothing, as nothing changed')
}

{
  // A picture still on its way after a minute: the send waits for it rather than going without it.
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [],
    kept: keptSignature,
    uploadDelay: 4000,
    clock: true,
  })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-tab-sign').click()
  await page.getByTestId('editor-kept-1').click()
  await page.getByTestId('editor-armed').waitFor()
  await page.getByTestId('editor-page-1').click({ position: { x: 200, y: 300 } })
  await page.locator('.editor-mark.signature img').waitFor()
  await pressMain(page)
  await page.getByTestId('editor-review-sheet').waitFor()
  await page.clock.fastForward(61000)
  const refused = page.locator('[data-testid="editor-refused"][data-code="picture_uploading"]')
  await refused.waitFor()
  assert.equal(
    (await refused.locator('p').textContent()).trim(),
    'A picture is still on its way. Wait a moment, then try again.',
  )
  assert.equal(server.quotes.length, 0, 'not quoted without it')
  // Nothing pressed: Review watches on, and asks again by itself once it lands.
  await page.getByTestId('editor-review-cost').waitFor()
  assert.equal(server.uploads.length, 1)
  const quoted = server.quotes.at(-1)
  assert.ok(quoted.id, 'quoted once it landed')
  const commands = await saved(page, server)
  assert.equal(commands[0].type, 'signature')
  assert.equal(commands[0].input_index, 1, 'with its picture')
  assert.equal(quoted.body.version, server.version, 'the draft as it is')
  await opened.context.close()
  passed('A picture still uploading after a minute holds the send back, and Review sends it with it once in')
}

for (const [label, options] of [
  ['while Review waits', { uploadDelay: 1500 }],
  ['on Try again after a minute', { uploadDelay: 4000, clock: true }],
]) {
  // A picture that never goes up while Review waits for it is taken off the page. Review says so
  // above Confirm, as it covers the snackbar that does: the file goes without it only once said.
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [{ type: 'add_text', page: 1, x: 80, y: 320, text: 'Fixture words', font_size: 16, color: '#17212E' }],
    kept: keptSignature,
    uploadFails: () => 503,
    ...options,
  })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-tab-sign').click()
  await page.getByTestId('editor-kept-1').click()
  await page.getByTestId('editor-armed').waitFor()
  await page.getByTestId('editor-page-1').click({ position: { x: 200, y: 300 } })
  await page.locator('.editor-mark.signature img').waitFor()
  await pressMain(page)
  await page.getByTestId('editor-review-sheet').waitFor()
  if (options.clock) {
    await page.clock.fastForward(61000)
    await page.locator('[data-testid="editor-refused"][data-code="picture_uploading"]').waitFor()
    await page.getByTestId('editor-review-again').click()
  }
  const notices = page.getByTestId('editor-review-notices')
  await notices.waitFor()
  assert.equal(
    (await notices.locator('p').first().textContent()).trim(),
    'A picture didn’t upload, so it was taken off the page.',
    label,
  )
  await reviewReady(page)
  assert.equal(server.uploads.length, 0)
  assert.ok(!server.commands.some((command) => command.type === 'signature'), `${label}: quoted without it`)
  assert.equal(server.jobPosts.length, 0, `${label}: nothing sent before Confirm`)
  await closeSheet(page)
  assert.equal(await page.locator('.editor-mark.signature').count(), 0, `${label}: the mark went`)
  // Said once: Review opened again goes on without a word of it.
  await pressMain(page)
  await reviewReady(page)
  assert.equal(await page.getByTestId('editor-review-notices').count(), 0, `${label}: said once`)
  assert.deepEqual(opened.errors, [], label)
  await opened.context.close()
}
passed('A picture that fails to go up while Review waits is said above Confirm, once')

{
  // A picture turned on a slow line and sent at once: Review waits for the turned one, so the
  // draft quoted is the draft as it is, and the send neither meets a change of its own nor drops it.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({ width: 390, height: 656, marks: [picture], uploadDelay: 2500 })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-turn').click()
  await pressMain(page)
  await reviewReady(page)
  assert.equal(server.uploads.length, 1, 'quoted once the turned picture was up')
  assert.equal(server.commands[0].input_index, 2, 'with the turned picture')
  assert.deepEqual([server.commands[0].width, server.commands[0].height], [50, 150])
  assert.equal(lastQuote(server).body.version, server.version, 'the draft as it is')
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobs.at(-1).version, server.version, 'nothing changed after the send')
  assert.equal(await page.locator('.editor-conflict').count(), 0, 'no change from another device')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Turn on a slow line then Send: Review waits for the turned picture and sends it')
}

for (const way of ['Replace', 'Turn', 'Sign']) {
  // A picture replaced or turned and sent at once, whose new picture never goes up: the old one
  // stays on the page. Review says so above Confirm, as it covers the snackbar that does.
  const kind = way === 'Sign' ? 'signature' : 'insert_image'
  const mark = { type: kind, page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [mark],
    kept: keptSignature,
    uploadDelay: 1500,
    uploadFails: () => 503,
  })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator(`.editor-mark.${kind} img`).waitFor()
  await page.locator(`.editor-mark.${kind}`).click()
  await page.getByTestId('editor-object-sheet').waitFor()
  if (way === 'Turn') await page.getByTestId('editor-object-turn').click()
  else if (way === 'Sign') {
    await page.getByTestId('editor-object-replace').click()
    await page.getByTestId('editor-kept-1').click()
  } else await (await chooseReplacement(page)).setFiles(inkFile)
  await pressMain(page)
  const review = page.getByTestId('editor-review-sheet')
  await review.waitFor()
  const notices = page.getByTestId('editor-review-notices')
  await notices.waitFor()
  assert.equal(
    (await notices.locator('p').first().textContent()).trim(),
    'A new picture wasn’t added, so the old one stayed on the page.',
    way,
  )
  await reviewReady(page)
  assert.equal(server.commands[0].input_index, 1, `${way}: quoted with the old picture, now said`)
  assert.equal(server.uploads.length, 0)
  assert.equal(server.jobPosts.length, 0)
  await review.getByTestId('editor-sheet-close').click()
  await review.waitFor({ state: 'hidden' })
  assert.equal(await page.locator(`.editor-mark.${kind}`).count(), 1, `${way}: the mark stays`)
  // Said once: Review opened again goes on without a word of it, with the old picture.
  await pressMain(page)
  await reviewReady(page)
  assert.equal(await page.getByTestId('editor-review-notices').count(), 0, `${way}: said once`)
  assert.equal(server.commands[0].input_index, 1, `${way}: the old picture`)
  assert.deepEqual(opened.errors, [], way)
  await opened.context.close()
}
passed('A new picture that fails to go up while Review waits is said above Confirm: the old one stayed')

{
  // A Turn on a line so slow that Review stops waiting after a minute, and which then fails: Review
  // watches on and, as soon as it fails, says the old picture stayed. It does not leave that to a
  // snackbar under it.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [picture],
    uploadDelay: 4000,
    uploadFails: () => 503,
    clock: true,
  })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-turn').click()
  await pressMain(page)
  const review = page.getByTestId('editor-review-sheet')
  await review.waitFor()
  await page.clock.fastForward(61000)
  await page.locator('[data-testid="editor-refused"][data-code="picture_uploading"]').waitFor()
  // Nothing pressed: the upload fails while that is shown.
  const notices = page.getByTestId('editor-review-notices')
  await notices.waitFor()
  assert.equal(
    (await notices.locator('p').first().textContent()).trim(),
    'A new picture wasn’t added, so the old one stayed on the page.',
  )
  await reviewReady(page)
  assert.equal(server.commands[0].input_index, 1, 'quoted with the old picture, now said')
  assert.equal(server.jobPosts.length, 0)
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A Replace or Turn that fails after Review stopped waiting is said in Review as it fails')
}

{
  // A Turn that fails with Review shut says so in a snackbar. Review opened over that snackbar
  // covers it, so Review says it too, rather than quote the old picture as if all were well.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [picture],
    uploadDelay: 600,
    uploadFails: () => 503,
  })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-turn').click()
  await page.getByTestId('editor-snackbar').filter({ hasText: 'The picture wasn’t added' }).waitFor()
  await pressMain(page)
  const review = page.getByTestId('editor-review-sheet')
  await review.waitFor()
  await page.getByTestId('editor-review-notices').waitFor()
  await reviewReady(page)
  assert.equal(server.commands[0].input_index, 1, 'quoted with the old picture, now said')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Review opened over the snackbar of a Replace or Turn that just failed says so itself')
}

{
  // Replace on a signature, From photo. While the photo is read, the sheet's other choices wait: a
  // kept or drawn one now would race that change unwatched. And the photo goes to the mark it was
  // chosen for even with the sheet put away meanwhile, rather than wait for a tap as a new one.
  const mark = { type: 'signature', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({ width: 390, height: 656, marks: [mark], kept: keptSignature })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.signature img').waitFor()
  await page.locator('.editor-mark.signature').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-replace').click()
  await page.getByTestId('editor-kept-1').waitFor()
  await slowNextPicture(page, 2500)
  const [photo] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-sign-photo').click(),
  ])
  await photo.setFiles('tests/fixtures/signature-photo.jpg')
  await page.waitForFunction(() => document.querySelector('[data-testid="editor-sign-photo"]')?.disabled)
  assert.ok(await page.getByTestId('editor-kept-1').isDisabled(), 'a kept one waits for the photo')
  assert.ok(await page.getByTestId('editor-sign-draw').isDisabled(), 'a drawn one waits for the photo')
  // Put away while the photo is read: the paper only closes the sheet.
  await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 400 } })
  await page.getByTestId('editor-sign-sheet').waitFor({ state: 'detached' })
  while (server.uploads.length < 1) await page.waitForTimeout(100)
  // Counted as it reaches the server: the mark takes it, and is saved, a moment after the answer.
  for (let tries = 0; tries < 50 && server.commands[0]?.input_index !== 2; tries += 1) await page.waitForTimeout(100)
  const commands = await saved(page, server)
  assert.equal(commands.length, 1, 'no new signature')
  assert.equal(commands[0].input_index, 2, 'the photo went to the mark it was chosen for')
  assert.equal(await page.getByTestId('editor-armed').count(), 0, 'nothing waits for a tap')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A photo replacing a signature keeps the other choices waiting, and goes to its mark')
}

{
  // Replace on a picture, then the mark put away before the phone hands the photo over: the photo
  // still goes to the mark it was chosen for, not to nothing, nor to another mark chosen since.
  const marks = [
    { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 },
    { type: 'insert_image', page: 1, x: 100, y: 400, width: 150, height: 50, input_index: 1 },
  ]
  const opened = await openContext({ width: 390, height: 656, marks })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').first().waitFor()
  await page.locator('.editor-mark.insert_image').first().click()
  await page.getByTestId('editor-object-sheet').waitFor()
  const chooser = await chooseReplacement(page)
  await page.locator('.editor-mark.insert_image').nth(1).click()
  await chooser.setFiles(inkFile)
  while (server.uploads.length < 1) await page.waitForTimeout(100)
  for (let tries = 0; tries < 50 && server.commands[0]?.input_index !== 2; tries += 1) await page.waitForTimeout(100)
  const commands = await saved(page, server)
  assert.equal(commands[0].input_index, 2, 'the photo went to the mark it was chosen for')
  assert.equal(commands[1].input_index, 1, 'and not to the one chosen since')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A Replace photo handed over late goes to the mark it was chosen for')
}

{
  // Two marks showing one picture, a Replace on the first that fails, and that mark deleted: no mark
  // waits on a change, so Review says nothing of the old picture, though the second still shows it.
  const marks = [
    { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 },
    { type: 'insert_image', page: 1, x: 100, y: 400, width: 150, height: 50, input_index: 1 },
  ]
  const opened = await openContext({ width: 390, height: 656, marks, uploadFails: () => 503 })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').first().waitFor()
  await page.locator('.editor-mark.insert_image').first().click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await (await chooseReplacement(page)).setFiles(inkFile)
  await page.getByTestId('editor-snackbar').filter({ hasText: 'The picture wasn’t added' }).waitFor()
  await page.waitForFunction(() => !document.querySelector('[data-testid="editor-object-delete"]')?.disabled)
  await page.getByTestId('editor-object-delete').click()
  await page.waitForFunction(() => document.querySelectorAll('.editor-mark.insert_image').length === 1)
  await pressMain(page)
  await reviewReady(page)
  assert.equal(await page.getByTestId('editor-review-notices').count(), 0, 'nothing said of a mark no longer there')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A failed Replace on a mark since deleted is not said through another mark with the same picture')
}

{
  // A picture chosen to replace another is made ready on the phone before it goes up, which
  // takes a large photo a while. Send pressed meanwhile waits for both, so the draft quoted is
  // the one with the new picture, and Confirm sends that rather than meeting a change of its own.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({ width: 390, height: 656, marks: [picture] })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await slowNextPicture(page, 2500)
  await (await chooseReplacement(page)).setFiles(inkFile)
  await pressMain(page)
  await reviewReady(page)
  assert.equal(server.uploads.length, 1, 'quoted once the new picture was made ready and up')
  assert.equal(server.commands[0].input_index, 2, 'with the new picture')
  assert.equal(lastQuote(server).body.version, server.version, 'the draft as it is')
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobs.at(-1).version, server.version, 'nothing changed after the send')
  assert.equal(await page.locator('.editor-conflict').count(), 0, 'no change from another device')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Replace with a picture still being made ready, then Send: Review waits for it and sends it')
}

{
  // A Turn still going up when a picture is added with Add here: that picture being made ready and
  // placed does not end the Turn's wait. Replace and Turn on the turning picture stay unavailable
  // until it is in, so no second change of it starts while the first is on its way.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [picture],
    uploadDelay: (n) => (n === 1 ? 5000 : 0),
  })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await settle(page)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-turn').click()
  // Paper once lets go of the picture, twice opens Add here.
  await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 300 } })
  await page.getByTestId('editor-object-sheet').waitFor({ state: 'detached' })
  await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 300 } })
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-add-picture').click(),
  ])
  await chooser.setFiles('tests/fixtures/brand-logo.png')
  await page.waitForFunction(() => document.querySelectorAll('.editor-mark.insert_image img').length === 2)
  while (server.uploads.length < 1) await page.waitForTimeout(50)
  assert.equal(server.uploads.length, 1, 'the turned picture is still going up')
  await page.locator('.editor-mark.insert_image').first().click()
  await page.getByTestId('editor-object-sheet').waitFor()
  assert.ok(await page.getByTestId('editor-object-replace').isDisabled(), 'Replace waits for the Turn')
  assert.ok(await page.getByTestId('editor-object-turn').isDisabled(), 'Turn waits for the Turn')
  await page.waitForFunction(() => !document.querySelector('[data-testid="editor-object-turn"]')?.disabled)
  const commands = await saved(page, server)
  assert.equal(server.uploads.length, 2)
  assert.deepEqual([commands[0].width, commands[0].height], [50, 150], 'the Turn landed')
  assert.ok(commands[0].input_index > 1 && commands[1].input_index > 1, 'each with its new picture')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A picture added while a Turn goes up leaves Replace and Turn waiting for that Turn')
}

{
  // A picture from Add here still being made ready when a Turn lands: Send then waits for that
  // picture too, so the draft quoted and sent has it, rather than being sent without it.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [picture],
    uploadDelay: (n) => (n === 1 ? 1500 : 0),
  })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await settle(page)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-turn').click()
  await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 300 } })
  await page.getByTestId('editor-object-sheet').waitFor({ state: 'detached' })
  await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 300 } })
  await slowNextPicture(page, 4000)
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-add-picture').click(),
  ])
  await chooser.setFiles('tests/fixtures/brand-logo.png')
  // The Turn lands while the added picture is still being made ready.
  while (server.uploads.length < 1) await page.waitForTimeout(50)
  await page.waitForTimeout(300)
  assert.equal(await page.locator('.editor-mark.insert_image').count(), 1, 'still being made ready')
  await pressMain(page)
  await reviewReady(page)
  assert.equal(server.uploads.length, 2, 'quoted once the added picture was made ready and up')
  assert.equal(server.commands.length, 2, 'with the added picture')
  assert.ok(server.commands[1].input_index > 1, 'and its picture')
  assert.equal(lastQuote(server).body.version, server.version, 'the draft as it is')
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobs.at(-1).version, server.version, 'sent as it is')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Send while Add here’s picture is made ready and a Turn lands: Review waits for the picture')
}

{
  // A picture from Add here that cannot be used, refused while Review waits for it: the sheet's line
  // saying so is under Review, so Review says it, rather than sending the file without it unsaid.
  const opened = await openContext({ width: 390, height: 656 })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 220 } })
  await page.getByTestId('editor-add-sheet').waitFor()
  await slowNextPicture(page, 2000)
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-add-picture').click(),
  ])
  await chooser.setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') })
  await pressMain(page)
  const review = page.getByTestId('editor-review-sheet')
  await review.waitFor()
  const notices = page.getByTestId('editor-review-notices')
  await notices.waitFor()
  assert.equal(
    (await notices.locator('p').first().textContent()).trim(),
    'A picture you chose couldn’t be used, so it wasn’t added.',
  )
  await reviewReady(page)
  assert.equal(server.jobPosts.length, 0)
  await review.getByTestId('editor-sheet-close').click()
  await page.getByTestId('editor-add-refusal').waitFor()
  // Said once: Review opened again goes on without a word of it.
  await pressMain(page)
  await reviewReady(page)
  assert.equal(await page.getByTestId('editor-review-notices').count(), 0, 'said once')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A picture refused while Review waits for it is said above Confirm, once')
}

{
  // A Turn that fails under the More sheet: its snackbar goes by unseen, under that sheet. Review,
  // opened long after, still says the old picture stayed, as nothing on screen has.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [picture],
    uploadDelay: 600,
    uploadFails: () => 503,
    clock: true,
  })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-turn').click()
  await page.getByTestId('editor-more').click()
  await page.getByTestId('editor-more-sheet').waitFor()
  await page.getByTestId('editor-snackbar').filter({ hasText: 'The picture wasn’t added' }).waitFor()
  await page.clock.fastForward(30000)
  await page.getByTestId('editor-snackbar').waitFor({ state: 'detached' })
  await page.getByTestId('editor-more-sheet').getByTestId('editor-sheet-close').click()
  await page.getByTestId('editor-more-sheet').waitFor({ state: 'hidden' })
  await pressMain(page)
  await page.getByTestId('editor-review-notices').waitFor()
  await reviewReady(page)
  assert.equal(server.commands[0].input_index, 1, 'quoted with the old picture, now said')
  assert.equal(server.jobPosts.length, 0)
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A picture that failed under another sheet long before is still said in Review')
}

{
  // A Turn that fails, then the document left and opened again: its marks are read anew, under new
  // ids. Review still says the old picture stayed, as it finds the mark by that picture.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [picture],
    uploadDelay: 300,
    uploadFails: () => 503,
    inside: false,
  })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  await page.getByTestId('editor-object-turn').click()
  await page.getByTestId('editor-snackbar').filter({ hasText: 'The picture wasn’t added' }).waitFor()
  await page.getByTestId('editor-back').click()
  await page.getByTestId('editor-object-sheet').waitFor({ state: 'detached' })
  await page.getByTestId('editor-back-link').click()
  await page.waitForURL((url) => !url.pathname.endsWith(DOC))
  await page.goBack()
  await page.getByTestId('editor-page-1').waitFor()
  await page.waitForFunction(() => !document.querySelector('[data-testid="editor-opening"]'))
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.getByTestId('editor-primary').click()
  const notices = page.getByTestId('editor-review-notices')
  await notices.waitFor()
  assert.equal(
    (await notices.locator('p').first().textContent()).trim(),
    'A new picture wasn’t added, so the old one stayed on the page.',
  )
  await reviewReady(page)
  assert.equal(server.commands[0].input_index, 1, 'quoted with the old picture, now said')
  assert.equal(server.jobPosts.length, 0)
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('An old picture that stayed is still said in Review after the document is left and opened again')
}

for (const sheet of ['Sign', 'Add']) {
  // A refusal a sheet showed, and then something else chosen in it: that refusal is done with, and
  // Review says nothing of it, rather than stand between the person and a draft that is fine.
  const opened = await openContext({ width: 390, height: 656, marks: [], kept: keptSignature })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  if (sheet === 'Add') {
    await page.getByTestId('editor-page-1').click({ position: { x: 190, y: 420 } })
    await page.getByTestId('editor-add-sheet').waitFor()
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('editor-add-picture').click(),
    ])
    await chooser.setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from('not a picture') })
    await page.getByTestId('editor-add-refusal').waitFor()
    await page.getByTestId('editor-add-date').click()
    await page.locator('.editor-mark.add_text').first().waitFor()
  } else {
    await page.getByTestId('editor-tab-sign').click()
    const [blank] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('editor-sign-photo').click(),
    ])
    await blank.setFiles('tests/fixtures/blank-photo.jpg')
    await page.getByTestId('editor-sign-refusal').waitFor()
    await page.getByTestId('editor-kept-1').click()
    await page.getByTestId('editor-armed').waitFor()
    await page.getByTestId('editor-page-1').click({ position: { x: 200, y: 300 } })
    await page.locator('.editor-mark.signature img').waitFor()
  }
  await pressMain(page)
  await reviewReady(page)
  const notices = await page.getByTestId('editor-review-notices').count()
  assert.equal(notices, 0, `${sheet}: nothing said of the refused one`)
  assert.equal(server.jobPosts.length, 0)
  assert.deepEqual(opened.errors, [], sheet)
  await opened.context.close()
}
passed('A refused picture followed by another choice in its sheet leaves Review with nothing to say of it')

{
  // Replace, and Send pressed while the phone is still handing the photo over, as iOS does once it
  // has converted it: Review waits for it, rather than quote and send the draft without it.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({ width: 390, height: 656, marks: [picture], uploadDelay: 1500 })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  const chooser = await chooseReplacement(page)
  await pressMain(page)
  await page.getByTestId('editor-review-sheet').waitFor()
  await page.waitForTimeout(1500)
  assert.equal(server.quotes.length, 0, 'not quoted while the photo is on its way')
  await chooser.setFiles(inkFile)
  await reviewReady(page)
  assert.equal(server.commands[0].input_index, 2, 'quoted with the new picture')
  assert.equal(lastQuote(server).body.version, server.version, 'the draft as it is')
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobs.at(-1).version, server.version, 'sent with it')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A photo still being handed over when Send is pressed: Review waits for it and sends it')
}

{
  // The same photo, so slow that Review stopped waiting, landing between the quote and Confirm:
  // Confirm waits for it and asks again, rather than send the draft without it.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({ width: 390, height: 656, marks: [picture], uploadDelay: 1500, clock: true })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  const chooser = await chooseReplacement(page)
  await page.clock.fastForward(PICK_LONGEST + 1000)
  await pressMain(page)
  await reviewReady(page)
  assert.equal(lastQuote(server).body.version, server.version)
  const quoted = server.quotes.length
  await chooser.setFiles(inkFile)
  await pressMain(page)
  for (let tries = 0; tries < 100 && server.quotes.length <= quoted; tries += 1) await page.waitForTimeout(100)
  await page.waitForFunction(
    () => document.querySelector('[data-testid="editor-review-body"]')?.dataset.stage === 'ready',
  )
  assert.equal(server.jobPosts.length, 0, 'not sent without the new picture')
  assert.ok(server.quotes.length > quoted, 'asked again')
  assert.equal(server.commands[0].input_index, 2, 'with the new picture')
  assert.equal(lastQuote(server).body.version, server.version, 'the draft as it is')
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobs.at(-1).version, server.version, 'sent with it')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A picture that lands between the quote and Confirm: Confirm waits for it and asks again')
}

{
  // The same photo landing only after Confirm: it is not in the file sent, so the app stays open
  // to say so, rather than close on a file the person thinks has it.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({ width: 390, height: 656, marks: [picture], uploadDelay: 1500, clock: true })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  const chooser = await chooseReplacement(page)
  await page.clock.fastForward(PICK_LONGEST + 1000)
  await pressMain(page)
  await reviewReady(page)
  const sentVersion = server.version
  await pressMain(page)
  await chooser.setFiles(inkFile)
  await page.getByTestId('editor-accepted').waitFor()
  const late = page.getByTestId('editor-late')
  await late.waitFor()
  assert.equal(
    (await late.textContent()).trim(),
    'The picture you chose after sending isn’t in this file. Look at the page: if it isn’t there, add it, then send again.',
  )
  await page.waitForTimeout(1500)
  assert.equal(await closes(page), 0, 'the app stays open to say so')
  assert.equal(server.jobs.at(-1).version, sentVersion, 'the file sent is the draft as quoted, old picture and all')
  await axe(page, 'late')
  await page.screenshot({ path: path.join(output, 'review-390-en-late.png') })
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('A picture that lands after Confirm keeps the app open to say it is not in the file')
}

{
  // The send meets no answer, and a photo lands meanwhile. Try again repeats that same send, which
  // has the old picture: the photo is still said to be not in it, and the app stays to say so.
  const picture = { type: 'insert_image', page: 1, x: 100, y: 100, width: 150, height: 50, input_index: 1 }
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [picture],
    uploadDelay: 1500,
    jobAnswer: (n) => (n === 1 ? 'drop' : 'ok'),
    clock: true,
  })
  const { page, server } = opened
  server.inputIds = [FILE, '00000000-0000-4000-8000-000000000150']
  await goToDocument(opened)
  await page.locator('.editor-mark.insert_image img').waitFor()
  await page.locator('.editor-mark.insert_image').click()
  await page.getByTestId('editor-object-sheet').waitFor()
  const chooser = await chooseReplacement(page)
  await page.clock.fastForward(PICK_LONGEST + 1000)
  await pressMain(page)
  await reviewReady(page)
  const sentVersion = server.version
  await pressMain(page)
  await chooser.setFiles(inkFile)
  await page.getByTestId('editor-send-failed').waitFor()
  await page.getByTestId('editor-late').waitFor()
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  await page.getByTestId('editor-late').waitFor()
  await page.waitForTimeout(1500)
  assert.equal(await closes(page), 0, 'the app stays open to say so')
  assert.equal(server.jobPosts[0].key, server.jobPosts[1].key, 'the same send')
  assert.equal(server.jobs.at(-1).version, sentVersion, 'with the old picture')
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Try again after no answer still says a photo landed meanwhile is not in the file')
}

for (const [width, locale, theme] of [
  [390, 'en', 'light'],
  [320, 'uz', 'light'],
  [320, 'ru', 'dark'],
  [320, 'uz', 'dark'],
]) {
  // A picture chosen from the bar waits for a tap on the page. Send pressed first: Review says it
  // is not in the file, rather than send without it unsaid. Its note, read at each size and theme.
  const label = `${width} ${locale} ${theme}`
  const opened = await openContext({ width, height: width === 320 ? 568 : 656, locale, theme })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  await page.getByTestId('editor-tab-add').click()
  await page.getByTestId('editor-add-sheet').waitFor()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('editor-add-picture').click(),
  ])
  await chooser.setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: inkPng })
  await page.getByTestId('editor-armed').waitFor()
  await pressMain(page)
  const notices = page.getByTestId('editor-review-notices')
  await notices.waitFor()
  if (locale === 'en')
    assert.deepEqual(
      (await notices.locator('p').allTextContents()).map((line) => line.trim()),
      ['A picture you chose is waiting for a tap on the page, so it isn’t in this file.', 'Check the page before you send.'],
    )
  await reviewReady(page)
  assert.equal(server.jobPosts.length, 0, label)
  await axe(page, label)
  await noSidewaysScroll(page, label)
  await page.screenshot({ path: path.join(output, `review-${width}-${locale}-${theme}-notes.png`) })
  assert.deepEqual(opened.errors, [], label)
  await opened.context.close()
}
passed('A picture still waiting for a tap is said in Review as not in the file: 390 and 320, en uz ru, light and dark')

{
  // Under Review the draft stays as quoted: Ctrl+Z waits until it closes. A change that lands all
  // the same between the quote and Confirm (here, Undo pressed from outside the sheet) is not in
  // that quote, so Confirm asks again and shows the draft as it is, rather than sending what it was.
  const opened = await openContext({ width: 1440, height: 900, inside: false })
  const { page, server } = opened
  await goToDocument(opened)
  await settle(page)
  // A tick placed with nothing chosen: undoing it chooses nothing, which would close Review.
  await page.getByTestId('editor-page-1').click({ position: { x: 150, y: 200 } })
  await page.getByTestId('editor-add-tick').click()
  await page.locator('.editor-mark.draw').waitFor()
  await saved(page, server)
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  const version = server.version
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(1500)
  assert.equal(await page.locator('.editor-mark.draw').count(), 1, 'not undone under Review')
  assert.equal(server.version, version, 'nothing saved under Review')
  const quoted = server.quotes.length
  await page.evaluate(() => document.querySelector('[data-testid="editor-undo"]').click())
  await page.locator('.editor-mark.draw').waitFor({ state: 'detached' })
  await page.getByTestId('editor-confirm').click()
  const deadline = Date.now() + 10000
  while (server.quotes.length === quoted) {
    assert.ok(Date.now() < deadline && !server.jobPosts.length, 'Confirm asks again for the draft as it is')
    await page.waitForTimeout(50)
  }
  await page.locator('[data-testid="editor-review-body"][data-stage="ready"]').waitFor()
  assert.equal(server.jobPosts.length, 0, 'not sent on the quote of the draft as it was')
  assert.equal(lastQuote(server).body.version, server.version, 'quoted as it is')
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobs.at(-1).version, server.version, 'sent as it is')
  await closeSheet(page)
  await page.getByTestId('editor-held').waitFor({ state: 'detached' })
  // Closed, the keys work again.
  await page.keyboard.press('Control+Shift+z')
  await page.locator('.editor-mark.draw').waitFor()
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('Ctrl+Z waits while Review is up; a change after the quote has Confirm ask again first')
}

{
  // A send followed after Review closed, its looks failing on a bad line, and Review opened again
  // while one of them is on its way: that one's failure ends the old send's following. It neither
  // looks again nor lets go of the hold on the next send's draft before that job has read it.
  const opened = await openContext({
    width: 390,
    height: 844,
    inside: false,
    queued: (job) => (job === 1 ? 1 : 8),
    pollFails: (job, look) => (job === 1 && look >= 2 ? [503, look <= 3 ? 1200 : 0] : null),
  })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('editor-accepted').waitFor()
  await closeSheet(page)
  await page.getByTestId('editor-held').waitFor({ state: 'detached' })
  while (server.jobs[0].polls < 2) await page.waitForTimeout(50)
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobs.length, 2)
  await closeSheet(page)
  await page.getByTestId('editor-held').waitFor()
  // The look on its way fails, and so does its one retry; after that the old send is let be.
  await page.waitForTimeout(3000)
  const looks = server.jobs[0].polls
  await page.waitForTimeout(4500)
  assert.equal(server.jobs[0].polls, looks, 'the old send is no longer looked at')
  assert.ok(server.jobs[1].polls < 8, 'the next job is still waiting for its turn')
  assert.ok(await page.getByTestId('editor-held').isVisible(), 'so its draft is still held')
  await page.getByTestId('editor-held').waitFor({ state: 'detached', timeout: 20000 })
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed(
    'A look at an old send that fails after Review opens again ends its following, and keeps the new hold',
  )
}

{
  // The same, when the draft is sent again unchanged while its job still waits: the server answers
  // with that same job. The old following, its look failing after Review opened again, still ends:
  // it neither lets go of the hold the new send took nor follows the job alongside the new one.
  const opened = await openContext({
    width: 390,
    height: 844,
    inside: false,
    queued: 18,
    reuse: true,
    // Three looks missed, so the hold goes; the fourth slow, still on its way when Send is pressed.
    pollFails: (job, look) => (look <= 6 ? [503, 0] : look <= 8 ? [503, 1500] : null),
  })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('editor-accepted').waitFor()
  await closeSheet(page)
  await page.getByTestId('editor-held').waitFor({ state: 'detached' })
  while (server.jobs[0].polls < 7) await page.waitForTimeout(50)
  await page.getByTestId('editor-primary').click()
  await reviewReady(page)
  await page.getByTestId('editor-confirm').click()
  await page.getByTestId('editor-accepted').waitFor()
  assert.equal(server.jobs.length, 1, 'answered with the job already on its way')
  await closeSheet(page)
  await page.getByTestId('editor-held').waitFor()
  const before = server.jobs[0].polls
  await page.waitForTimeout(6000)
  assert.ok(server.jobs[0].polls < 18, 'the job is still waiting for its turn')
  assert.ok(await page.getByTestId('editor-held').isVisible(), 'so its draft is still held')
  assert.ok(server.jobs[0].polls - before <= 6, `followed once (${server.jobs[0].polls - before} looks)`)
  await page.getByTestId('editor-held').waitFor({ state: 'detached', timeout: 25000 })
  assert.deepEqual(opened.errors, [])
  await opened.context.close()
  passed('An old send’s failing look ends its following even when the next send gets the same job')
}

{
  // Undone while its picture uploads and then redone, a signature comes back with its picture.
  const opened = await openContext({
    width: 390,
    height: 656,
    marks: [],
    kept: keptSignature,
    uploadDelay: 1500,
  })
  const { page, server } = opened
  await goToDocument(opened)
  await page.getByTestId('editor-tab-sign').click()
  await page.getByTestId('editor-kept-1').click()
  await page.getByTestId('editor-armed').waitFor()
  await page.getByTestId('editor-page-1').click({ position: { x: 200, y: 300 } })
  await page.locator('.editor-mark.signature').waitFor()
  await page.getByTestId('editor-undo').click()
  await page.locator('.editor-mark.signature').waitFor({ state: 'detached' })
  while (server.uploads.length < 1) await page.waitForTimeout(100)
  await page.waitForTimeout(300)
  await page.getByTestId('editor-redo').click()
  await page.locator('.editor-mark.signature img').waitFor()
  assert.equal(await page.getByTestId('editor-frame-issue').count(), 0, 'nothing needs fixing')
  const commands = await saved(page, server)
  assert.equal(commands[0].input_index, 1, 'its picture, from the upload that landed meanwhile')
  assert.equal(server.uploads.length, 1)
  await opened.context.close()
  passed('Undo and Redo while a picture uploads bring the mark back with its picture')
}

{
  // A part of the file that does not come: pdf.js gets it cut from the whole file, at the place it
  // asked for; when that fails too, the pages are the server's pictures rather than a wait for good.
  const cases = [
    ['a part that drops', { rangeFails: (n) => (n === 2 ? 'abort' : null) }, 'pdfjs'],
    [
      'a part and the whole file refused',
      { rangeFails: (n) => (n === 2 ? 500 : null), wholeFails: 500 },
      'server',
    ],
    ['every later part refused', { rangeFails: (n) => (n >= 3 ? 500 : null), wholeFails: 500 }, 'server'],
  ]
  for (const [label, options, mode] of cases) {
    const opened = await openContext({
      width: 390,
      height: 656,
      pageCount: 4,
      marks: [],
      ranges: true,
      ...options,
    })
    const { page, server } = opened
    await page.goto(`${origin}/en/app/editor/${DOC}`, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('editor-page-1').waitFor()
    await page.waitForFunction(() => !document.querySelector('[data-testid="editor-opening"]'))
    await settle(page)
    if (mode === 'pdfjs') {
      for (const number of [1, 2])
        await page.waitForFunction((n) => {
          const canvas = document.querySelector(`[data-testid="editor-page-${n}"] canvas`)
          return canvas && canvas.width > 1
        }, number)
      assert.equal(server.downloads.filter((range) => !range).length, 1, `${label}: the whole file, once`)
    } else {
      // A page further on asks for its own part, opened or not.
      await page.getByTestId('editor-page-4').scrollIntoViewIfNeeded()
      await page.locator('[data-testid="editor-page-4"] img').waitFor()
      await page.getByTestId('editor-page-1').scrollIntoViewIfNeeded()
      await page.locator('[data-testid="editor-page-1"] img').waitFor()
      assert.ok(server.previews >= 1, `${label}: the server's pictures`)
    }
    assert.deepEqual(opened.errors, [], label)
    await opened.context.close()
  }
  passed('A range read that fails is answered from the whole file, or the server draws the pages')
}

/* ------------------------------------------------------------------ the send, seen */

for (const [name, width, height, locale, theme] of [
  ['390-en-light', 390, 656, 'en', 'light'],
  ['320-ru-dark', 320, 426, 'ru', 'dark'],
  ['320-uz-light', 320, 426, 'uz', 'light'],
  ['390-uz-dark', 390, 656, 'uz', 'dark'],
]) {
  const opened = await openContext({
    width,
    height,
    locale,
    theme,
    pageCount: 4,
    marks: [...MARKS(), { type: 'redact', page: 2, x: 80, y: 200, width: 120, height: 20 }],
    jobAnswer: (n) => (n === 1 ? ['send_limit', 429, { limit: 20, per: 'hour' }] : 'ok'),
  })
  const { page, errors } = opened
  await goToDocument(opened)
  await settle(page)
  await page.waitForTimeout(200)
  const look = async (state) => {
    await noPlaceholderMonth(page, `${name} ${state}`)
    await noSidewaysScroll(page, `${name} ${state}`)
    assert.deepEqual(await smallTargets(page), [], `${name} ${state}: tap targets`)
    await axe(page, `${name} ${state}`)
    await page.screenshot({ path: path.join(output, `${name}-send-${state}.png`) })
  }
  await page.getByTestId('editor-unsent').waitFor()
  await look('root')
  await page.getByTestId('editor-tab-pages').click()
  await page.getByTestId('editor-pages-board').waitFor()
  await page.waitForTimeout(300)
  await look('pages')
  await page.getByTestId('editor-grid-page-1').click()
  await page.getByTestId('editor-page-sheet').waitFor()
  await page.waitForTimeout(150)
  const sheet = await page.getByTestId('editor-page-sheet').boundingBox()
  assert.ok(sheet.height <= height * 0.45 + 1, `${name}: the page sheet is compact (${sheet.height})`)
  await look('page-sheet')
  await page.getByTestId('editor-page-turn-right').click()
  await page.getByTestId('editor-page-delete').click()
  await page.locator('.editor-page-ask').waitFor()
  await look('delete-ask')
  await page.getByTestId('editor-page-delete-cancel').click()
  await page.getByTestId('editor-page-move').click()
  await page.getByTestId('editor-pages-moving').waitFor()
  await look('move')
  await page.getByTestId('editor-put-last').click()
  await page.getByTestId('editor-grid-page-3').click()
  await page.getByTestId('editor-page-delete').click()
  await page.getByTestId('editor-restore-3').waitFor()
  await look('removed')
  await page.getByTestId('editor-tab-pages').click()
  await page.waitForTimeout(300)
  await look('stage-turned')
  await pressMain(page)
  await page.getByTestId('editor-review-consent').waitFor()
  // The server names the uploaded page 2; it is the first page of the file being made.
  if (locale === 'en')
    assert.equal(
      await page.getByTestId('editor-review-consent').locator('strong').textContent(),
      'Pages that become pictures: 1',
    )
  await look('review-consent')
  await page.getByTestId('editor-consent').check()
  await page.getByTestId('editor-review-cost').waitFor()
  // However long the list of changes, the cost is in sight just above Confirm.
  const cost = await page.getByTestId('editor-review-cost').boundingBox()
  assert.ok(cost.y >= 0 && cost.y + cost.height <= height, `${name}: the cost is in sight (${cost.y})`)
  // Pages are named by their place in the file being made; the removed one by its number in the original.
  if (locale === 'en')
    assert.deepEqual(
      await page
        .locator('[data-testid="editor-review-pages"] > li')
        .evaluateAll((rows) =>
          rows.map((row) => [...row.children].map((part) => part.textContent.trim()).join(' ')),
        ),
      ['Page 1 1 change Show', 'Page 3 3 changes Show', 'Removed: page 3 of the original'],
    )
  await look('review')
  await pressMain(page)
  await page.getByTestId('editor-refused').waitFor()
  await look('review-send-limit')
  await closeSheet(page)
  await pressMain(page)
  await page.getByTestId('editor-review-consent').waitFor()
  await page.getByTestId('editor-consent').check()
  await page.getByTestId('editor-review-cost').waitFor()
  await pressMain(page)
  await page.getByTestId('editor-accepted').waitFor()
  await look('accepted')
  assert.deepEqual(errors, [], `${name}: page errors`)
  assert.deepEqual(opened.server.unexpected, [], `${name}: requests with no fixture`)
  await opened.context.close()
}
passed(
  'Pages, Review and its states at 390 and 320, en uz ru, light and dark: axe, 44 px, no sideways scroll, compact sheets',
)

await browser.close()
console.log(`Pass: ${checks.length} groups of checks`)
for (const check of checks) console.log(`  ${check}`)
