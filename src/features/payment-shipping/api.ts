import { createApiClient } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { SvcOrd, SvcPay, SvcShp } from '@/api/generated'

const ord = createApiClient<SvcOrd.paths>()
const pay = createApiClient<SvcPay.paths>()
const shp = createApiClient<SvcShp.paths>()

export type Shipment = SvcShp.components['schemas']['Shipment']
export type TrackingEvent = SvcShp.components['schemas']['TrackingEvent']
export type ShipmentLabel = SvcShp.components['schemas']['WaybillLabelOutput']

export function retryOrderPayment(orderId: string, previousPaymentId: string) {
  return unwrap(ord.POST('/v1/orders/{id}/payment/retry', {
    params: { path: { id: orderId } },
    body: { previousPaymentId },
  }))
}

export function getPayment(paymentId: string, signal?: AbortSignal) {
  return unwrap(pay.GET('/v1/payments/{id}', { params: { path: { id: paymentId } }, signal }))
}

export async function listShipments(sellerOrderId: string, scope: 'buyer' | 'seller') {
  const result = await unwrap(shp.GET('/v1/shipments', {
    params: { query: { sellerOrderId, scope, pageSize: 100 } },
  }))
  return result.shipments ?? []
}

export function getTracking(shipmentId: string, page = 1) {
  return unwrap(shp.GET('/v1/shipments/{id}/tracking', {
    params: { path: { id: shipmentId }, query: { page, pageSize: 100 } },
  }))
}

export async function getShipmentTimeline(shipmentId: string) {
  const tracking = await getTracking(shipmentId)
  const events = new Map((tracking.events ?? []).map((event) => [event.eventId, event]))
  for (let page = 2; page <= (tracking.pagination?.totalPages ?? 1); page += 1) {
    const next = await getTracking(shipmentId, page)
    for (const event of next.events ?? []) events.set(event.eventId, event)
  }
  return { ...tracking, events: [...events.values()] }
}

export function getShipmentLabel(shipmentId: string) {
  return unwrap(shp.GET('/v1/shipments/{id}/label', { params: { path: { id: shipmentId } } }))
}

export function retryShipment(shipmentId: string) {
  return unwrap(shp.POST('/v1/shipments/{id}/retry', { params: { path: { id: shipmentId } } }))
}

export function httpUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    return undefined
  }
}
