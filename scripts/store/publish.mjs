// Fills the Mac App Store version from listing.json and the screenshots, attaches the build and
// submits it: `npm run store -- <command>`. Commands, in the usual order:
//   status       shows the version in work, its localizations, screenshots and builds (read-only)
//   metadata     sets the version number (package.json), texts, URLs and review notes
//   screenshots  replaces the screenshots with dist/store-screenshots/<locale>-<n>.png
//   build        attaches the processed build of this version (no non-exempt encryption)
//   submit --yes submits the version for review
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { asc, resource } from './asc.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const listing = JSON.parse(readFileSync(join(here, 'listing.json'), 'utf8'))
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const APP = listing.appId
/** Versions that can still be edited. */
const EDITABLE = [
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED',
  'METADATA_REJECTED',
  'INVALID_BINARY'
]

async function editableVersion() {
  const states = EDITABLE.join(',')
  const { data } = await asc(
    'GET',
    `/v1/apps/${APP}/appStoreVersions?filter[platform]=MAC_OS&filter[appStoreState]=${states}`
  )
  return data[0] ?? null
}

/** Whether a version is in the store already, so this one is an update. */
async function isUpdate() {
  const states = 'READY_FOR_SALE,READY_FOR_DISTRIBUTION,REMOVED_FROM_SALE'
  const { data } = await asc(
    'GET',
    `/v1/apps/${APP}/appStoreVersions?filter[platform]=MAC_OS&filter[appStoreState]=${states}`
  )
  return data.length > 0
}

async function editableAppInfo() {
  const { data } = await asc('GET', `/v1/apps/${APP}/appInfos`)
  return data.find((info) => info.attributes.state !== 'READY_FOR_DISTRIBUTION') ?? data[0]
}

/** Localizations of an app info or version by locale, created where missing. */
async function localizations(kind, parent, owner) {
  const path = kind === 'appInfoLocalizations' ? 'appInfos' : 'appStoreVersions'
  const { data } = await asc('GET', `/v1/${path}/${parent}/${kind}`)
  const byLocale = Object.fromEntries(data.map((item) => [item.attributes.locale, item.id]))
  for (const locale of Object.keys(listing.locales)) {
    if (byLocale[locale]) continue
    const created = await asc(
      'POST',
      `/v1/${kind}`,
      resource(kind, { locale }, { [owner]: [path, parent] })
    )
    byLocale[locale] = created.data.id
  }
  return byLocale
}

async function status() {
  const current = await editableVersion()
  const { data: versions } = await asc(
    'GET',
    `/v1/apps/${APP}/appStoreVersions?filter[platform]=MAC_OS&limit=3`
  )
  for (const item of versions) {
    console.log(`version ${item.attributes.versionString}: ${item.attributes.appStoreState}`)
  }
  console.log(current ? `editable: ${current.attributes.versionString}` : 'editable: none')
  const shown = current ?? versions[0]
  if (shown) {
    const { data } = await asc(
      'GET',
      `/v1/appStoreVersions/${shown.id}/appStoreVersionLocalizations?include=appScreenshotSets`
    )
    for (const item of data) {
      const { locale, description } = item.attributes
      const sets = item.relationships.appScreenshotSets.data.length
      console.log(`  ${locale}: ${description?.length ?? 0} chars, ${sets} screenshot set(s)`)
    }
  }
  const { data: builds } = await asc(
    'GET',
    `/v1/builds?filter[app]=${APP}&sort=-uploadedDate&limit=3`
  )
  for (const build of builds) {
    console.log(`build ${build.attributes.version}: ${build.attributes.processingState}`)
  }
}

async function metadata() {
  let current = await editableVersion()
  if (!current) {
    const created = await asc(
      'POST',
      '/v1/appStoreVersions',
      resource(
        'appStoreVersions',
        { platform: 'MAC_OS', versionString: version },
        { app: ['apps', APP] }
      )
    )
    current = created.data
  } else if (current.attributes.versionString !== version) {
    await asc(
      'PATCH',
      `/v1/appStoreVersions/${current.id}`,
      resource('appStoreVersions', { versionString: version }, {}, current.id)
    )
  }
  const info = await editableAppInfo()
  const infoLocalizations = await localizations('appInfoLocalizations', info.id, 'appInfo')
  const versionLocalizations = await localizations(
    'appStoreVersionLocalizations',
    current.id,
    'appStoreVersion'
  )
  for (const [locale, texts] of Object.entries(listing.locales)) {
    await asc(
      'PATCH',
      `/v1/appInfoLocalizations/${infoLocalizations[locale]}`,
      resource(
        'appInfoLocalizations',
        { name: texts.name, subtitle: texts.subtitle, privacyPolicyUrl: listing.urls.privacy },
        {},
        infoLocalizations[locale]
      )
    )
    await asc(
      'PATCH',
      `/v1/appStoreVersionLocalizations/${versionLocalizations[locale]}`,
      resource(
        'appStoreVersionLocalizations',
        {
          description: texts.description,
          keywords: texts.keywords,
          promotionalText: texts.promotionalText,
          supportUrl: listing.urls.support,
          marketingUrl: listing.urls.marketing,
          // "What's New" exists only for updates, not for the first version in the store.
          ...(texts.whatsNew && (await isUpdate()) ? { whatsNew: texts.whatsNew } : {})
        },
        {},
        versionLocalizations[locale]
      )
    )
  }
  const review = await asc('GET', `/v1/appStoreVersions/${current.id}/appStoreReviewDetail`)
  await asc(
    'PATCH',
    `/v1/appStoreReviewDetails/${review.data.id}`,
    resource('appStoreReviewDetails', { notes: listing.reviewNotes }, {}, review.data.id)
  )
  console.log(`Version ${version}: texts, URLs and review notes set.`)
}

async function uploadScreenshot(setId, path) {
  const file = readFileSync(path)
  const reservation = await asc(
    'POST',
    '/v1/appScreenshots',
    resource(
      'appScreenshots',
      { fileName: basename(path), fileSize: file.length },
      { appScreenshotSet: ['appScreenshotSets', setId] }
    )
  )
  const { id, attributes } = reservation.data
  for (const part of attributes.uploadOperations) {
    const response = await fetch(part.url, {
      method: part.method,
      headers: Object.fromEntries(part.requestHeaders.map(({ name, value }) => [name, value])),
      body: file.subarray(part.offset, part.offset + part.length)
    })
    if (!response.ok) throw new Error(`Uploading ${path} failed: ${response.status}`)
  }
  const checksum = createHash('md5').update(file).digest('hex')
  await asc(
    'PATCH',
    `/v1/appScreenshots/${id}`,
    resource('appScreenshots', { uploaded: true, sourceFileChecksum: checksum }, {}, id)
  )
}

async function screenshots() {
  const current = await editableVersion()
  if (!current) throw new Error('No editable version; run `metadata` first.')
  const output = join(root, 'dist', 'store-screenshots')
  const versionLocalizations = await localizations(
    'appStoreVersionLocalizations',
    current.id,
    'appStoreVersion'
  )
  for (const [locale, texts] of Object.entries(listing.locales)) {
    const files = texts.screenshots.map((_, index) => join(output, `${locale}-${index + 1}.png`))
    const missing = files.find((file) => !existsSync(file))
    if (missing) throw new Error(`${missing} is missing; run \`npm run store:screenshots\`.`)
    const localization = versionLocalizations[locale]
    const { data: sets } = await asc(
      'GET',
      `/v1/appStoreVersionLocalizations/${localization}/appScreenshotSets`
    )
    let set = sets.find((item) => item.attributes.screenshotDisplayType === 'APP_DESKTOP')
    if (set) {
      const { data: old } = await asc('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`)
      for (const item of old) await asc('DELETE', `/v1/appScreenshots/${item.id}`)
    } else {
      set = (
        await asc(
          'POST',
          '/v1/appScreenshotSets',
          resource(
            'appScreenshotSets',
            { screenshotDisplayType: 'APP_DESKTOP' },
            { appStoreVersionLocalization: ['appStoreVersionLocalizations', localization] }
          )
        )
      ).data
    }
    for (const file of files) await uploadScreenshot(set.id, file)
    console.log(`${locale}: ${files.length} screenshots uploaded.`)
  }
}

async function build() {
  const current = await editableVersion()
  if (!current) throw new Error('No editable version; run `metadata` first.')
  const { data } = await asc(
    'GET',
    `/v1/builds?filter[app]=${APP}&filter[version]=${version}&sort=-uploadedDate&limit=1`
  )
  const found = data[0]
  if (!found) throw new Error(`No uploaded build ${version} yet (see docs/STORE.md).`)
  if (found.attributes.processingState !== 'VALID') {
    throw new Error(`Build ${version} is ${found.attributes.processingState}; try again later.`)
  }
  // The app has no network access and only uses encryption that is part of the system.
  await asc(
    'PATCH',
    `/v1/builds/${found.id}`,
    resource('builds', { usesNonExemptEncryption: false }, {}, found.id)
  )
  await asc('PATCH', `/v1/appStoreVersions/${current.id}/relationships/build`, {
    data: { type: 'builds', id: found.id }
  })
  console.log(`Build ${version} attached to version ${current.attributes.versionString}.`)
}

async function submit() {
  if (!process.argv.includes('--yes')) {
    throw new Error('This submits the version to App Review. Run it with --yes.')
  }
  const current = await editableVersion()
  if (!current) throw new Error('No editable version.')
  const submission = await asc(
    'POST',
    '/v1/reviewSubmissions',
    resource('reviewSubmissions', { platform: 'MAC_OS' }, { app: ['apps', APP] })
  )
  const id = submission.data.id
  await asc(
    'POST',
    '/v1/reviewSubmissionItems',
    resource(
      'reviewSubmissionItems',
      {},
      {
        reviewSubmission: ['reviewSubmissions', id],
        appStoreVersion: ['appStoreVersions', current.id]
      }
    )
  )
  await asc(
    'PATCH',
    `/v1/reviewSubmissions/${id}`,
    resource('reviewSubmissions', { submitted: true }, {}, id)
  )
  console.log(`Version ${current.attributes.versionString} submitted for review.`)
}

const commands = { status, metadata, screenshots, build, submit }
const command = commands[process.argv[2]]
if (!command) {
  console.error(`Usage: npm run store -- <${Object.keys(commands).join('|')}>`)
  process.exit(1)
}
await command()
