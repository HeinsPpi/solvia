import type { InspectionItem, InspectionPhoto } from '../types'

export type SharedInspection = {
  token: string
  inspectionId: string
  status: 'requested' | 'in_progress' | 'submitted'
  items: InspectionItem[]
  measurements: Record<string, string>
  photos: InspectionPhoto[]
  standardDone: boolean
  requestedAt: string
  updatedAt: string
  submittedAt?: string
  plantName?: string
  address?: string
  requestTitle?: string
}

const endpoint = '/.netlify/functions/inspection'
async function api<T>(token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${endpoint}?token=${encodeURIComponent(token)}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '点検データを同期できませんでした')
  return data as T
}

export const sharedInspectionService = {
  create(token: string, inspectionId: string, items: InspectionItem[], context?: { plantName: string; address: string; requestTitle?: string }) {
    return api<SharedInspection>(token, { method: 'POST', body: JSON.stringify({ action: 'create', inspectionId, items, ...context }) })
  },
  get(token: string) { return api<SharedInspection>(token) },
  save(token: string, items: InspectionItem[], measurements: Record<string, string>, standardDone: boolean) {
    return api<SharedInspection>(token, { method: 'POST', body: JSON.stringify({ action: 'save', items, measurements, standardDone }) })
  },
  submit(token: string, items: InspectionItem[], measurements: Record<string, string>, standardDone: boolean) {
    return api<SharedInspection>(token, { method: 'POST', body: JSON.stringify({ action: 'submit', items, measurements, standardDone }) })
  },
  reset(token: string) {
    return api<SharedInspection>(token, { method: 'POST', body: JSON.stringify({ action: 'reset' }) })
  },
  async uploadPhoto(token: string, item: InspectionItem, photoType: string, file: File) {
    const dataUrl = await resizeImage(file)
    return api<InspectionPhoto>(token, { method: 'POST', body: JSON.stringify({ action: 'upload', inspectionItemId: item.inspectionItemId, equipmentId: item.equipmentId, photoType, dataUrl }) })
  },
}

async function resizeImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選択してください')
  const source = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = source })
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', .78)
  } finally { URL.revokeObjectURL(source) }
}
