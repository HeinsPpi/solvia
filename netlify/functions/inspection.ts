import { getStore } from '@netlify/blobs'

type SharedPhoto = { photoId: string; inspectionItemId: string; equipmentId: string; photoType: string; takenAt: string; contentType: string }
type SharedState = {
  token: string
  inspectionId: string
  status: 'requested' | 'in_progress' | 'submitted'
  items: unknown[]
  measurements: Record<string, string>
  photos: SharedPhoto[]
  standardDone: boolean
  requestedAt: string
  updatedAt: string
  submittedAt?: string
  plantName?: string
  address?: string
  requestTitle?: string
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
const validToken = (value: string | null) => value && /^[a-zA-Z0-9-]{16,80}$/.test(value) ? value : null
const withPhotoUrls = (state: SharedState, token: string) => ({ ...state, photos: state.photos.map(photo => ({ ...photo, url: `/.netlify/functions/inspection?token=${token}&photo=${photo.photoId}` })) })

export default async (request: Request) => {
  const store = getStore({ name: 'inspection-field-demo', consistency: 'strong' })
  const url = new URL(request.url)
  const token = validToken(url.searchParams.get('token'))
  if (!token) return json({ error: '無効な点検URLです' }, 400)
  const stateKey = `inspection-${token}`

  if (request.method === 'GET') {
    const photoId = url.searchParams.get('photo')
    const state = await store.get(stateKey, { type: 'json', consistency: 'strong' }) as SharedState | null
    if (!state) return json({ error: '点検依頼が見つかりません' }, 404)
    if (photoId) {
      const photo = state.photos.find(entry => entry.photoId === photoId)
      if (!photo) return json({ error: '写真が見つかりません' }, 404)
      const image = await store.get(`photo-${token}-${photoId}`, { type: 'arrayBuffer', consistency: 'strong' })
      if (!image) return json({ error: '写真が見つかりません' }, 404)
      return new Response(image, { headers: { 'content-type': photo.contentType, 'cache-control': 'private, max-age=300' } })
    }
    return json(withPhotoUrls(state, token))
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const body = await request.json() as Record<string, unknown>
  const action = String(body.action || '')
  const now = new Date().toISOString()

  if (action === 'create') {
    const existing = await store.get(stateKey, { type: 'json', consistency: 'strong' }) as SharedState | null
    if (existing) return json(withPhotoUrls(existing, token))
    const state: SharedState = { token, inspectionId: String(body.inspectionId || ''), status: 'requested', items: Array.isArray(body.items) ? body.items : [], measurements: {}, photos: [], standardDone: false, requestedAt: now, updatedAt: now, plantName: String(body.plantName || ''), address: String(body.address || ''), requestTitle: String(body.requestTitle || '') }
    await store.setJSON(stateKey, state)
    return json(state, 201)
  }

  const state = await store.get(stateKey, { type: 'json', consistency: 'strong' }) as SharedState | null
  if (!state) return json({ error: '点検依頼が見つかりません' }, 404)

  if (action === 'reset') {
    await Promise.all(state.photos.map(photo => store.delete(`photo-${token}-${photo.photoId}`)))
    const resetItems = state.items.map(item => item && typeof item === 'object' ? { ...item as Record<string, unknown>, result: null, comment: '' } : item)
    const next: SharedState = { ...state, status: 'requested', items: resetItems, measurements: {}, photos: [], standardDone: false, requestedAt: now, updatedAt: now }
    delete next.submittedAt
    await store.setJSON(stateKey, next)
    return json(next)
  }

  if (action === 'save' || action === 'submit') {
    const next: SharedState = {
      ...state,
      status: action === 'submit' ? 'submitted' : state.status === 'requested' ? 'in_progress' : state.status,
      items: Array.isArray(body.items) ? body.items : state.items,
      measurements: body.measurements && typeof body.measurements === 'object' ? body.measurements as Record<string, string> : state.measurements,
      standardDone: typeof body.standardDone === 'boolean' ? body.standardDone : state.standardDone,
      updatedAt: now,
      ...(action === 'submit' ? { submittedAt: now } : {}),
    }
    await store.setJSON(stateKey, next)
    return json(withPhotoUrls(next, token))
  }

  if (action === 'upload') {
    const dataUrl = String(body.dataUrl || '')
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=]+)$/)
    if (!match) return json({ error: 'JPEG・PNG・WebP画像のみアップロードできます' }, 400)
    const bytes = Uint8Array.from(Buffer.from(match[2], 'base64'))
    if (bytes.byteLength > 3_500_000) return json({ error: '写真サイズが大きすぎます' }, 413)
    const photoId = crypto.randomUUID()
    const photo: SharedPhoto = { photoId, inspectionItemId: String(body.inspectionItemId || ''), equipmentId: String(body.equipmentId || ''), photoType: String(body.photoType || '点検写真'), takenAt: now, contentType: match[1] }
    await store.set(`photo-${token}-${photoId}`, bytes, { metadata: { contentType: photo.contentType } })
    const next = { ...state, status: 'in_progress' as const, photos: [...state.photos.filter(entry => !(entry.inspectionItemId === photo.inspectionItemId && entry.photoType === photo.photoType)), photo], updatedAt: now }
    await store.setJSON(stateKey, next)
    return json({ ...photo, url: `/.netlify/functions/inspection?token=${token}&photo=${photoId}` }, 201)
  }

  return json({ error: '不明な操作です' }, 400)
}
