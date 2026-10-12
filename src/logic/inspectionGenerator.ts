import { priorityItems, standardTitles } from '../data/mockData'
import type { InspectionItem } from '../types'

// 3層生成のデモ。AIの実APIは使わず、説明可能な固定ルールで構成する。
export function generateInspectionPlan() {
  const standardRules = standardTitles.map((title, index): InspectionItem => ({
    inspectionItemId: `STD-${String(index + 1).padStart(2, '0')}`, inspectionId: 'INS-2026-0909-01', equipmentId: 'PLANT', type: 'standard', title,
    reason: '設備種別ごとの標準点検ルール', evidence: ['標準点検ルール'], priority: 'normal', checks: [title], requiredPhoto: false, photoTargets: [], requiredMeasurement: null, result: null, comment: '',
  }))
  const historyAdditions = structuredClone(priorityItems)
  const aiOrganized = historyAdditions.map(item => ({ ...item, evidence: [...item.evidence, 'AI整理（モック）：重複項目を統合'] }))
  return { standardRules, historyAdditions, aiOrganized }
}
