export interface PlaygroundField {
  name: string
  type: 'string' | 'number'
  required: boolean
  defaultValue?: string
  /**
   * When set, this field is collected into a nested array under `{ [group]: [{...}] }`
   * alongside the top-level (ungrouped) fields, instead of being emitted as a top-level
   * key itself. Used e.g. by the broker new-preapp page, whose documented request body
   * nests item fields under `items: [{ itemId, itemName, ... }]`.
   */
  group?: string
}

export type PlaygroundLang = 'ru' | 'en'

interface PlaygroundStrings {
  heading: string
  sendLabel: string
  sendingLabel: string
  resolvedUrlLabel: string
  errors: {
    cors: string
    unknown: string
  }
}

export const PLAYGROUND_STRINGS: Record<PlaygroundLang, PlaygroundStrings> = {
  ru: {
    heading: 'Попробовать запрос',
    sendLabel: 'Отправить',
    sendingLabel: 'Отправка...',
    resolvedUrlLabel: 'Запрос будет отправлен на:',
    errors: {
      cors: 'Запрос заблокирован браузером (вероятно, CORS). Используйте curl-команду ниже.',
      unknown: 'Неизвестная ошибка запроса.'
    }
  },
  en: {
    heading: 'Try the request',
    sendLabel: 'Send',
    sendingLabel: 'Sending...',
    resolvedUrlLabel: 'This request will be sent to:',
    errors: {
      cors: 'The request was blocked by the browser (likely CORS). Use the curl command below.',
      unknown: 'Unknown request error.'
    }
  }
}

/**
 * The change-status endpoint (accounting/v1/changeStatus/json) is the one API in this
 * portal whose request body is NOT "one flat object of the declared fields" — it is a
 * JSON array containing a single object: { merchantId, orders: [{ orderId, amount, status }] }.
 * Every change-status MDX page (delivery/cancel/return/part-return, RU+EN) declares its
 * <ApiPlayground> fields as exactly this set: merchantId, orderId, amount, status.
 *
 * Every other endpoint documented so far (the broker new-preapp/approve pages, whose
 * fields are partnerCode/billNumber/billAmount/expiresAt/... or id/code) sends a plain
 * flat JSON object matching its declared fields 1:1 — no nesting. Rather than hardcode
 * "broker" specifically (MDX authors and endpoints will keep changing), we detect the
 * one known nested shape by its field-name set and treat anything else generically as
 * flat key/value fields.
 */
const CHANGE_STATUS_FIELD_NAMES = new Set(['merchantId', 'orderId', 'amount', 'status'])

function isChangeStatusShape(fields: PlaygroundField[]): boolean {
  return (
    fields.length === CHANGE_STATUS_FIELD_NAMES.size &&
    fields.every(field => CHANGE_STATUS_FIELD_NAMES.has(field.name))
  )
}

function coerce(field: PlaygroundField, values: Record<string, string>): unknown {
  const raw = values[field.name] ?? field.defaultValue ?? ''
  return field.type === 'number' ? Number(raw) : raw
}

/**
 * Builds the JSON-serializable request body for a given field/value set.
 *
 * - change-status shape (fields === {merchantId, orderId, amount, status}) produces
 *   `[{ merchantId, orders: [{ orderId, amount, status }] }]` — an array wrapping one
 *   object, matching the documented curl examples for delivery/cancel/return/part-return.
 * - Every other field shape produces a flat object of `{ [field.name]: coercedValue }`
 *   in field declaration order, with one exception: fields that declare a `group` (e.g.
 *   broker new-preapp's itemId/itemName/.../itemSum, grouped under `items`) are collected
 *   into `{ [group]: [ { ...groupedFieldsInOrder } ] }` instead of being top-level keys,
 *   matching the documented nested `items: [{...}]` request body.
 */
export function buildRequestBody(fields: PlaygroundField[], values: Record<string, string>): unknown {
  if (isChangeStatusShape(fields)) {
    const merchantId = values.merchantId ?? ''
    const orderEntry: Record<string, unknown> = {}
    for (const field of fields) {
      if (field.name === 'merchantId') continue
      orderEntry[field.name] = coerce(field, values)
    }
    return [{ merchantId, orders: [orderEntry] }]
  }

  const flat: Record<string, unknown> = {}
  const groupEntries = new Map<string, Record<string, unknown>>()
  for (const field of fields) {
    if (field.group) {
      let entry = groupEntries.get(field.group)
      if (!entry) {
        entry = {}
        groupEntries.set(field.group, entry)
        flat[field.group] = [entry]
      }
      entry[field.name] = coerce(field, values)
    } else {
      flat[field.name] = coerce(field, values)
    }
  }
  return flat
}

export function classifyFetchError(
  err: unknown,
  lang: PlaygroundLang = 'ru'
): { kind: 'cors' | 'network' | 'http' | 'unknown'; message: string } {
  const strings = PLAYGROUND_STRINGS[lang]
  if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
    return { kind: 'cors', message: strings.errors.cors }
  }
  if (err instanceof Error) {
    return { kind: 'network', message: err.message }
  }
  return { kind: 'unknown', message: strings.errors.unknown }
}
