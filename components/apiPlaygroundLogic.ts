export interface PlaygroundField {
  name: string
  type: 'string' | 'number'
  required: boolean
  defaultValue?: string
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
 * - Every other field shape (e.g. broker's new-preapp/approve) produces a flat object
 *   of `{ [field.name]: coercedValue }` in field declaration order, with no nesting.
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
  for (const field of fields) {
    flat[field.name] = coerce(field, values)
  }
  return flat
}

export function classifyFetchError(
  err: unknown
): { kind: 'cors' | 'network' | 'http' | 'unknown'; message: string } {
  if (err instanceof TypeError && /failed to fetch/i.test(err.message)) {
    return {
      kind: 'cors',
      message: 'Запрос заблокирован браузером (вероятно, CORS). Используйте curl-команду ниже.'
    }
  }
  if (err instanceof Error) {
    return { kind: 'network', message: err.message }
  }
  return { kind: 'unknown', message: 'Неизвестная ошибка запроса.' }
}
