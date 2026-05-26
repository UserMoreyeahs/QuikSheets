/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg')

const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-north-1',
  'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'sa-east-1', 'ca-central-1',
]

const projectRef = process.env.PG_PROJECT_REF
const password   = process.env.PG_PASSWORD

if (!projectRef || !password) {
  console.error('Set PG_PROJECT_REF and PG_PASSWORD')
  process.exit(1)
}

async function probe(prefix, region) {
  const host = `${prefix}-${region}.pooler.supabase.com`
  const client = new Client({
    host,
    port: 6543,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  })
  try {
    await client.connect()
    await client.query('select 1')
    await client.end()
    return { host, ok: true }
  } catch (err) {
    try { await client.end() } catch {}
    return { host, ok: false, msg: err.message }
  }
}

;(async () => {
  for (const prefix of ['aws-0', 'aws-1']) {
    for (const region of REGIONS) {
      process.stdout.write(`Trying ${prefix}-${region} … `)
      const r = await probe(prefix, region)
      if (r.ok) {
        console.log('✓ MATCH')
        console.log(`\nProject host: ${r.host}`)
        process.exit(0)
      } else {
        console.log(r.msg.split('\n')[0])
      }
    }
  }
  console.error('\nNo matching pooler host found.')
  console.error('Likely the project just provisioned and pooler routes are still warming up. Wait 30-60s and retry.')
  process.exit(2)
})()
