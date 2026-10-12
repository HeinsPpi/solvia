import { historyRecords } from '../data/mockData'
import type { HistoryRecord } from '../types'

// MOCK ADAPTER: MISORA APIの有無・写真参照・書込可否は未確認。UIから直接API仕様を仮定しない。
export const misoraService = {
  async searchInspectionHistory(_plantId: string): Promise<HistoryRecord[]> {
    return Promise.resolve(structuredClone(historyRecords))
  },
  async saveReportDraft(_inspectionId: string): Promise<{ mockRecordId: string }> {
    return Promise.resolve({ mockRecordId: 'MISORA-MOCK-0909' })
  },
}
