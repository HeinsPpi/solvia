import type { Equipment, HistoryRecord, Incident, Inspection, InspectionItem, InspectionPhoto, MonitoringSnapshot, Plant } from '../types'

// DEMO MOCK DATA: MISORA / FusionSolarの実API仕様は未確認。取得可能項目を保証するものではありません。
export const plant: Plant = {
  plantId: 'F0655A',
  plantName: 'FE徳島川島山田発電所9',
  address: '徳島県吉野川市川島町山田',
  monitoringSystem: 'FusionSolar',
}

export const equipment: Equipment[] = [
  { equipmentId: 'PCS-COM1-4', plantId: plant.plantId, equipmentType: 'PCS', manufacturer: 'Huawei', model: 'SUN2000-50KTL', serialNumber: 'HV-PC-1048' },
  { equipmentId: 'STRING-03', plantId: plant.plantId, equipmentType: 'ストリング', manufacturer: '—', model: 'String 3', serialNumber: 'ST-003' },
  { equipmentId: 'ARRAY-NORTH', plantId: plant.plantId, equipmentType: 'パネル列', manufacturer: 'Jinko Solar', model: 'North Array', serialNumber: 'AR-NORTH' },
]

export const inspection: Inspection = {
  inspectionId: 'INS-2026-0909-01', plantId: plant.plantId, scheduledAt: '2026-09-09T10:00:00+09:00', assignedUser: '田中 誠', status: '点検前',
}

export const monitoringSnapshot: MonitoringSnapshot = {
  capturedAt: '2026-09-09T08:45:00+09:00', currentOutputKw: 444.08, dailyEnergyKwh: 1284.6, activeAlarms: 0,
  pcs: [
    { name: 'COM1-1', outputKw: 48.2, status: '正常' }, { name: 'COM1-2', outputKw: 47.9, status: '正常' },
    { name: 'COM1-3', outputKw: 48.5, status: '正常' }, { name: 'COM1-4', outputKw: 44.1, status: '要確認' },
  ],
  strings: [
    { name: 'String 1', currentA: 8.4, deltaPercent: 0 }, { name: 'String 2', currentA: 8.2, deltaPercent: -2 },
    { name: 'String 3', currentA: 7.1, deltaPercent: -14 }, { name: 'String 4', currentA: 8.3, deltaPercent: -1 },
  ],
  trend: [62, 71, 76, 73, 69, 65, 61],
}

export const incidents: Incident[] = [
  { incidentId: 'INC-2026-0518', plantId: plant.plantId, equipmentId: 'PCS-COM1-4', alarmCode: '2064', symptom: '設備異常', cause: 'DCコネクタ接触不良', action: 'コネクタ交換', occurredAt: '2026-05-18T09:14:00+09:00', resolvedAt: '2026-05-18T14:30:00+09:00' },
]

export const historyRecords: HistoryRecord[] = [
  { id: 'H-01', date: '2026/05/18', equipment: 'PCS COM1-4', symptom: '設備異常', cause: 'DCコネクタ接触不良', action: 'コネクタ交換', matchLevel: '同一設備' },
  { id: 'H-02', date: '2025/11/03', equipment: 'PCS COM1-4', symptom: '絶縁抵抗低下', cause: '端子周辺の汚損', action: '配線確認・清掃', matchLevel: '同一設備' },
  { id: 'H-03', date: '2025/08/21', equipment: '北側パネル列', symptom: '植生接近', cause: '夏季の植生伸長', action: '草刈り', matchLevel: '同一発電所' },
  { id: 'H-04', date: '2026/02/12', equipment: '同型PCS', symptom: 'DC入力低下', cause: 'DCコネクタ接触抵抗増大', action: '端子交換', matchLevel: '同型設備' },
]

export const priorityItems: InspectionItem[] = [
  { inspectionItemId: 'PRI-01', inspectionId: inspection.inspectionId, equipmentId: 'PCS-COM1-4', type: 'priority', title: 'PCS COM1-4', reason: '前回点検時に同一設備でDCコネクタ接触不良が発生しています。', evidence: ['過去の同一設備故障：2件', '現在出力が他PCS平均より約8%低い', 'アクティブアラーム：なし'], priority: 'high', checks: ['PCS外観', 'エラー表示', 'DC入力', 'DCコネクタ', 'ブレーカ'], requiredPhoto: true, photoTargets: ['PCS正面', '液晶表示'], requiredMeasurement: null, result: null, comment: '' },
  { inspectionItemId: 'PRI-02', inspectionId: inspection.inspectionId, equipmentId: 'PCS-COM1-4', type: 'priority', title: 'DCコネクタ', reason: '2026/05/18の故障原因がDCコネクタ接触不良でした。変色・緩み・発熱痕を確認します。', evidence: ['MISORA：コネクタ交換履歴', '同型設備の類似故障：1件'], priority: 'high', checks: ['変色', '緩み', '発熱痕'], requiredPhoto: true, photoTargets: ['DC端子部'], requiredMeasurement: null, result: null, comment: '' },
  { inspectionItemId: 'PRI-03', inspectionId: inspection.inspectionId, equipmentId: 'STRING-03', type: 'priority', title: 'DC入力・ストリング3', reason: '直近1か月、ストリング3の電流が他ストリング平均より14%低い傾向です。', evidence: ['現在の監視データ：7.1A', '発電量傾向：30日継続'], priority: 'high', checks: ['DC入力', '配線', '絶縁状態'], requiredPhoto: false, photoTargets: [], requiredMeasurement: { label: 'DC電圧', unit: 'V', reference: '基準 580〜640V' }, result: null, comment: '' },
  { inspectionItemId: 'PRI-04', inspectionId: inspection.inspectionId, equipmentId: 'ARRAY-NORTH', type: 'priority', title: '北側パネル列', reason: '前回点検時に植生接近を確認しています。日陰・ケーブル干渉も合わせて確認します。', evidence: ['前回点検結果：植生接近', '前回写真：2025/08/21'], priority: 'medium', checks: ['植生距離', '日陰', 'ケーブル干渉'], requiredPhoto: true, photoTargets: ['北側パネル列全景', 'PCS周辺'], requiredMeasurement: null, result: null, comment: '' },
]

export const standardTitles = ['パネル外観', 'パネル割れ', 'パネル汚損', '架台・ボルト', 'ケーブル外観', 'コネクタ', 'PCS外観', 'PCS表示', 'PCS異音', 'PCS換気口', 'AC端子', 'DC端子', 'ブレーカ', '集電盤', '接地', '絶縁抵抗', '電圧測定', '電流測定', 'フェンス', '門扉・施錠', '監視装置', '雑草・植生', '排水', '周辺安全']

export const initialPhotos: InspectionPhoto[] = [
  { photoId: 'P-01', inspectionItemId: 'PRI-01', equipmentId: 'PCS-COM1-4', photoType: 'PCS正面', takenAt: '2026-09-09T10:22:00+09:00' },
  { photoId: 'P-02', inspectionItemId: 'PRI-01', equipmentId: 'PCS-COM1-4', photoType: '液晶表示', takenAt: '2026-09-09T10:24:00+09:00' },
]

export const inspections: Inspection[] = [
  inspection,
  { inspectionId: 'INS-2026-0909-02', plantId: 'S0772A', scheduledAt: '2026-09-09T13:30:00+09:00', assignedUser: '佐藤 健', status: '点検中' },
  { inspectionId: 'INS-2026-0910-01', plantId: 'H0305A', scheduledAt: '2026-09-10T09:00:00+09:00', assignedUser: '鈴木 翔', status: '入力確認待ち' },
]
