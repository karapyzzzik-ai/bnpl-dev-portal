import { describe, expect, it } from 'vitest'
import { buildRequestBody, classifyFetchError } from './apiPlaygroundLogic'

describe('buildRequestBody', () => {
  it('nests orderId/amount/status under orders[], keeps merchantId top-level (change-status shape)', () => {
    const fields = [
      { name: 'merchantId', type: 'string' as const, required: true },
      { name: 'orderId', type: 'string' as const, required: true },
      { name: 'amount', type: 'number' as const, required: true },
      { name: 'status', type: 'string' as const, required: true }
    ]
    const values = { merchantId: 'test.kz', orderId: '000000', amount: '80000', status: 'delivered' }

    const result = buildRequestBody(fields, values)

    expect(result).toEqual([
      {
        merchantId: 'test.kz',
        orders: [{ orderId: '000000', amount: 80000, status: 'delivered' }]
      }
    ])
  })

  it('builds a flat object for the broker new-preapp field shape (no orders[] nesting)', () => {
    // Real shape from content/ru/broker/new-preapp.mdx
    const fields = [
      { name: 'partnerCode', type: 'string' as const, required: true },
      { name: 'billNumber', type: 'string' as const, required: true },
      { name: 'billAmount', type: 'number' as const, required: true },
      { name: 'expiresAt', type: 'string' as const, required: false }
    ]
    const values = {
      partnerCode: 'test-merchant',
      billNumber: '000000',
      billAmount: '80000',
      expiresAt: '2023-09-07T10:49:10.156Z'
    }

    const result = buildRequestBody(fields, values)

    expect(result).toEqual({
      partnerCode: 'test-merchant',
      billNumber: '000000',
      billAmount: 80000,
      expiresAt: '2023-09-07T10:49:10.156Z'
    })
  })

  it('builds a flat object for the broker approve field shape', () => {
    // Real shape from content/ru/broker/approve.mdx
    const fields = [
      { name: 'id', type: 'string' as const, required: true },
      { name: 'code', type: 'string' as const, required: true, defaultValue: 'BNPL4' }
    ]
    const values = { id: 'uuid-value', code: 'BNPL4' }

    const result = buildRequestBody(fields, values)

    expect(result).toEqual({ id: 'uuid-value', code: 'BNPL4' })
  })

  it('falls back to defaultValue when a value is not provided', () => {
    const fields = [
      { name: 'id', type: 'string' as const, required: true },
      { name: 'code', type: 'string' as const, required: true, defaultValue: 'BNPL4' }
    ]
    const values = { id: 'uuid-value' } // code intentionally omitted

    const result = buildRequestBody(fields, values)

    expect(result).toEqual({ id: 'uuid-value', code: 'BNPL4' })
  })

  it('coerces number fields even in the flat (non-nested) shape', () => {
    const fields = [
      { name: 'billAmount', type: 'number' as const, required: true }
    ]
    const values = { billAmount: '150000' }

    const result = buildRequestBody(fields, values)

    expect(result).toEqual({ billAmount: 150000 })
  })

  it('does not treat a merchantId-only flat shape as the change-status shape', () => {
    const fields = [
      { name: 'merchantId', type: 'string' as const, required: true },
      { name: 'somethingElse', type: 'string' as const, required: true }
    ]
    const values = { merchantId: 'test.kz', somethingElse: 'x' }

    const result = buildRequestBody(fields, values)

    expect(result).toEqual({ merchantId: 'test.kz', somethingElse: 'x' })
  })
})

describe('classifyFetchError', () => {
  it('classifies a TypeError with "Failed to fetch" as a likely CORS failure', () => {
    const err = new TypeError('Failed to fetch')
    expect(classifyFetchError(err)).toEqual({
      kind: 'cors',
      message: 'Запрос заблокирован браузером (вероятно, CORS). Используйте curl-команду ниже.'
    })
  })

  it('classifies an unknown thrown value as unknown', () => {
    expect(classifyFetchError('boom').kind).toBe('unknown')
  })

  it('classifies a generic Error as network', () => {
    expect(classifyFetchError(new Error('socket hang up'))).toEqual({
      kind: 'network',
      message: 'socket hang up'
    })
  })
})
