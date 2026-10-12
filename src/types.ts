export type InspectionStatus = '点検前' | '点検中' | '入力確認待ち' | '報告書確認待ち' | '完了'
export type InspectionResult = '正常' | '異常' | '判断不能' | null
export type Priority = 'high' | 'medium' | 'normal'

export interface Plant {
  plantId: string
  plantName: string
  address: string
  monitoringSystem: string
}

export interface Equipment {
  equipmentId: string
  plantId: string
  equipmentType: string
  manufacturer: string
  model: string
  serialNumber: string
}

export interface Inspection {
  inspectionId: string
  plantId: string
  scheduledAt: string
  assignedUser: string
  status: InspectionStatus
}

export interface Incident {
  incidentId: string
  plantId: string
  equipmentId: string
  alarmCode: string
  symptom: string
  cause: string
  action: string
  occurredAt: string
  resolvedAt: string
}

export interface MeasurementRequirement {
  label: string
  unit: string
  reference: string
}

export interface InspectionItem {
  inspectionItemId: string
  inspectionId: string
  equipmentId: string
  type: 'standard' | 'priority'
  title: string
  reason: string
  evidence: string[]
  priority: Priority
  checks: string[]
  requiredPhoto: boolean
  photoTargets: string[]
  requiredMeasurement: MeasurementRequirement | null
  result: InspectionResult
  comment: string
}

export interface InspectionPhoto {
  photoId: string
  inspectionItemId: string
  equipmentId: string
  photoType: string
  takenAt: string
  url?: string
}

export interface MonitoringSnapshot {
  capturedAt: string
  currentOutputKw: number
  dailyEnergyKwh: number
  activeAlarms: number
  pcs: { name: string; outputKw: number; status: string }[]
  strings: { name: string; currentA: number; deltaPercent: number }[]
  trend: number[]
}

export interface HistoryRecord {
  id: string
  date: string
  equipment: string
  symptom: string
  cause: string
  action: string
  matchLevel: '同一設備' | '同一発電所' | '同一症状' | '同型設備' | '他発電所類似'
}
