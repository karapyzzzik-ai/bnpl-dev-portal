'use client'

import { useState } from 'react'
import {
  buildRequestBody,
  classifyFetchError,
  PLAYGROUND_STRINGS,
  type PlaygroundField,
  type PlaygroundLang
} from './apiPlaygroundLogic'

/**
 * Always-visible "where will this actually go" banner. Some pages (e.g. the broker
 * new-preapp/approve docs) set `stageUrl` to a real production domain because that
 * section has no separate staging environment. Rather than special-case any one page,
 * every ApiPlayground shows the fully-resolved URL right above the Send button, so a
 * user always sees exactly where their click will send a request before they click it.
 */
function ResolvedUrlBanner({ url, label }: { url: string; label: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '0.85rem',
        wordBreak: 'break-all',
        background: 'rgba(127,127,127,0.14)',
        border: '1px solid rgba(127,127,127,0.3)',
        borderRadius: '0.375rem',
        padding: '0.5rem 0.625rem',
        margin: '0.5rem 0'
      }}
    >
      <strong>{label}</strong> {url}
    </div>
  )
}

export function ApiPlayground({
  method,
  devUrl,
  stageUrl,
  fields,
  lang = 'ru'
}: {
  method: string
  devUrl: string
  stageUrl: string
  fields: PlaygroundField[]
  lang?: PlaygroundLang
}) {
  const t = PLAYGROUND_STRINGS[lang]
  const [env, setEnv] = useState<'dev' | 'stage'>('dev')
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.name, f.defaultValue ?? '']))
  )
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const url = env === 'dev' ? devUrl : stageUrl
  const body = buildRequestBody(fields, values)

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setResponse(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const text = await res.text()
      setResponse(`HTTP ${res.status}\n${text}`)
    } catch (err) {
      setError(classifyFetchError(err, lang).message)
    } finally {
      setLoading(false)
    }
  }

  const curlCommand = `curl -X '${method}' \\\n  '${url}' \\\n  -H 'accept: application/json' \\\n  -H 'Content-Type: application/json' \\\n  -d '${JSON.stringify(body)}'`

  return (
    <div className="nextra-card" style={{ padding: '1rem', marginTop: '1rem' }}>
      <h4>{t.heading}</h4>
      <label>
        <input type="radio" checked={env === 'dev'} onChange={() => setEnv('dev')} /> DEV
      </label>{' '}
      <label>
        <input type="radio" checked={env === 'stage'} onChange={() => setEnv('stage')} /> STAGE
      </label>
      {fields.map(field => (
        <div key={field.name} style={{ marginTop: '0.5rem' }}>
          <label>
            {field.name}
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={values[field.name] ?? ''}
              onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        </div>
      ))}
      <ResolvedUrlBanner url={url} label={t.resolvedUrlLabel} />
      <button onClick={handleSubmit} disabled={loading} style={{ marginTop: '0.75rem' }}>
        {loading ? t.sendingLabel : t.sendLabel}
      </button>
      {response && <pre style={{ marginTop: '0.75rem' }}>{response}</pre>}
      {error && (
        <div style={{ marginTop: '0.75rem', color: '#b91c1c' }}>
          <p>{error}</p>
          <pre>{curlCommand}</pre>
        </div>
      )}
    </div>
  )
}
