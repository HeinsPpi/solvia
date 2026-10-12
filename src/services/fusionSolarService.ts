import { monitoringSnapshot } from '../data/mockData'
import type { MonitoringSnapshot } from '../types'

// MOCK ADAPTER: FusionSolar APIの認証・取得粒度は未確認。実API導入時はこの実装だけを差し替える想定。
export const fusionSolarService = {
  async getPlantSnapshot(_plantId: string): Promise<MonitoringSnapshot> {
    return Promise.resolve(structuredClone(monitoringSnapshot))
  },
}
