import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, ClipboardCheck,
  Activity, CloudSun, Copy, Database, ExternalLink, FileText, History, Image, Info, LayoutDashboard, Link2, MapPin, Menu, Monitor, Pencil,
  GripVertical, RefreshCcw, Ruler, Search, Send, ShieldCheck, Smartphone, Sparkles, Sun, Upload, UserRound, X, Zap,
} from 'lucide-react'
import { equipment, initialPhotos, inspection, monitoringSnapshot, plant, priorityItems, standardTitles } from './data/mockData'
import { generateInspectionPlan } from './logic/inspectionGenerator'
import { fusionSolarService } from './services/fusionSolarService'
import { misoraService } from './services/misoraService'
import { IncidentCase, MonitoringDashboard } from './Operations'
import { sharedInspectionService, type SharedInspection } from './services/sharedInspectionService'
import type { HistoryRecord, InspectionItem, InspectionPhoto, InspectionResult, InspectionStatus, MonitoringSnapshot } from './types'

type View = 'monitoring' | 'incident' | 'list' | 'detail' | 'mobile-start' | 'field' | 'validation' | 'complete' | 'photo-review' | 'report'
type DetailTab = 'overview' | 'history' | 'priority' | 'standard'
type ReportZone = 'overview' | 'findings' | 'issues' | 'appendix'

const statusTone: Record<InspectionStatus, string> = { 点検前: 'neutral', 点検中: 'blue', 入力確認待ち: 'amber', 報告書確認待ち: 'purple', 完了: 'green' }

function App() {
  const fieldToken = useMemo(() => new URLSearchParams(window.location.search).get('field') || '', [])
  const [view, setView] = useState<View>(() => fieldToken ? 'mobile-start' : 'monitoring')
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [status, setStatus] = useState<InspectionStatus>('点検前')
  const [items, setItems] = useState<InspectionItem[]>(() => structuredClone(priorityItems))
  const [fieldIndex, setFieldIndex] = useState(0)
  const [measurements, setMeasurements] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<InspectionPhoto[]>(() => structuredClone(initialPhotos))
  const [reportPhotos, setReportPhotos] = useState<InspectionPhoto[]>([])
  const [includedPhotoIds, setIncludedPhotoIds] = useState<string[]>([])
  const [reportLayout, setReportLayout] = useState<{ photoId: string; zone: ReportZone | null }[]>([])
  const [standardDone, setStandardDone] = useState(false)
  const [editingReport, setEditingReport] = useState(false)
  const [reportRegistered, setReportRegistered] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [incidentPhase, setIncidentPhase] = useState(1)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState(() => localStorage.getItem('solvia_inspection_share_token') || '')
  const [sharedInspection, setSharedInspection] = useState<SharedInspection | null>(null)
  const [sharedLoaded, setSharedLoaded] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const plan = useMemo(() => generateInspectionPlan(), [])

  useEffect(() => {
    if (!fieldToken) return
    setSyncing(true)
    sharedInspectionService.get(fieldToken).then(shared => {
      setSharedInspection(shared)
      setItems(shared.items)
      setMeasurements(shared.measurements)
      setPhotos(shared.photos)
      setStandardDone(shared.standardDone)
      setStatus(shared.status === 'submitted' ? '入力確認待ち' : shared.status === 'in_progress' ? '点検中' : '点検前')
      setView(shared.status === 'submitted' ? 'complete' : 'mobile-start')
      setSharedLoaded(true)
    }).catch(error => setSyncError(error instanceof Error ? error.message : '点検依頼を読み込めませんでした')).finally(() => setSyncing(false))
  }, [fieldToken])

  useEffect(() => {
    if (!fieldToken || !sharedLoaded || view === 'complete') return
    const timer = window.setTimeout(() => {
      void sharedInspectionService.save(fieldToken, items, measurements, standardDone).catch(error => setSyncError(error instanceof Error ? error.message : '入力内容を同期できませんでした'))
    }, 700)
    return () => window.clearTimeout(timer)
  }, [fieldToken, sharedLoaded, items, measurements, standardDone, view])

  useEffect(() => {
    if (!shareOpen || !shareToken || fieldToken) return
    const timer = window.setInterval(() => {
      void sharedInspectionService.get(shareToken).then(setSharedInspection).catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [shareOpen, shareToken, fieldToken])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const openDetail = (tab: DetailTab = 'overview') => {
    setDetailTab(tab)
    setView('detail')
    window.scrollTo(0, 0)
  }

  const startField = () => {
    setStatus('点検中')
    setView('field')
    window.scrollTo(0, 0)
  }

  const updateItem = (id: string, patch: Partial<InspectionItem>) => {
    setItems(current => current.map(item => item.inspectionItemId === id ? { ...item, ...patch } : item))
  }

  const addPhoto = async (item: InspectionItem, target?: string, file?: File) => {
    const photoType = target || item.photoTargets[0] || item.title
    if (photos.some(photo => photo.inspectionItemId === item.inspectionItemId && photo.photoType === photoType)) return
    if (fieldToken && file) {
      setSyncing(true)
      setSyncError('')
      try {
        const photo = await sharedInspectionService.uploadPhoto(fieldToken, item, photoType, file)
        setPhotos(current => [...current.filter(entry => !(entry.inspectionItemId === item.inspectionItemId && entry.photoType === photoType)), photo])
        showToast(`${photoType}をアップロードしました`)
      } catch (error) { setSyncError(error instanceof Error ? error.message : '写真をアップロードできませんでした') }
      finally { setSyncing(false) }
      return
    }
    setPhotos(current => [...current, { photoId: `P-${Date.now()}`, inspectionItemId: item.inspectionItemId, equipmentId: item.equipmentId, photoType, takenAt: '2026-09-09T10:42:00+09:00' }])
    showToast(`${photoType}を撮影しました（モック）`)
  }

  const applyScenario = (leaveGaps = true) => {
    setItems(current => current.map((item, index) => ({
      ...item,
      result: (index === 1 || index === 3 ? '異常' : '正常') as InspectionResult,
      comment: index === 1 ? 'DCコネクタに変色あり' : index === 3 ? '北側パネル列に植生接近あり' : item.comment,
    })))
    setStandardDone(true)
    setMeasurements(leaveGaps ? {} : { 'PRI-03': '612' })
    const scenarioPhotos = priorityItems.flatMap(item => item.photoTargets.map((photoType, index) => ({
      photoId: `SC-${item.inspectionItemId}-${index}`, inspectionItemId: item.inspectionItemId, equipmentId: item.equipmentId, photoType, takenAt: '2026-09-09T10:42:00+09:00',
    }))).filter(photo => !leaveGaps || !(photo.inspectionItemId === 'PRI-02' && photo.photoType === 'DC端子部'))
    setPhotos(scenarioPhotos)
    showToast(leaveGaps ? 'シナリオ入力を反映しました（不足2件を残しています）' : '不足項目を入力しました')
  }

  const missingItems = useMemo(() => {
    const missing: { title: string; reason: string }[] = []
    if (!standardDone) missing.push({ title: '通常点検24件が未完了です', reason: '重点項目に加えて、法定・標準点検項目の完了が必要です。' })
    items.forEach(item => {
      if (!item.result) missing.push({ title: `${item.title}の判定が未入力です`, reason: item.reason })
      if (item.requiredMeasurement && !measurements[item.inspectionItemId]) missing.push({ title: `${item.requiredMeasurement.label}の測定値が未入力です`, reason: item.reason })
      item.photoTargets.forEach(target => {
        if (!photos.some(photo => photo.inspectionItemId === item.inspectionItemId && photo.photoType === target)) missing.push({ title: `${target}の写真がありません`, reason: item.reason })
      })
    })
    return missing
  }, [items, measurements, photos, standardDone])

  const finishField = () => {
    setStatus('入力確認待ち')
    setView('validation')
    window.scrollTo(0, 0)
  }

  const recheck = () => {
    if (missingItems.length) return
    const complete = async () => {
      if (fieldToken) {
        setSyncing(true)
        try {
          const shared = await sharedInspectionService.submit(fieldToken, items, measurements, standardDone)
          setSharedInspection(shared)
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : '点検結果を提出できませんでした')
          setSyncing(false)
          return
        }
        setSyncing(false)
      }
      setView('complete')
      window.scrollTo(0, 0)
    }
    void complete()
  }

  const requestFieldInspection = async () => {
    setShareOpen(true)
    setSyncing(true)
    setSyncError('')
    const token = shareToken || crypto.randomUUID().replaceAll('-', '')
    try {
      const shared = await sharedInspectionService.create(token, inspection.inspectionId, structuredClone(priorityItems).map(item => ({ ...item, result: null, comment: '' })), { plantName: plant.plantName, address: plant.address, requestTitle: '定期点検' })
      setShareToken(token)
      localStorage.setItem('solvia_inspection_share_token', token)
      setSharedInspection(shared)
    } catch (error) { setSyncError(error instanceof Error ? error.message : '点検依頼を作成できませんでした') }
    finally { setSyncing(false) }
  }

  const requestIncidentInspection = async () => {
    setShareOpen(true)
    setSyncing(true)
    setSyncError('')
    const token = crypto.randomUUID().replaceAll('-', '')
    const incidentItems = structuredClone(priorityItems).map((item, index) => ({
      ...item,
      equipmentId: index < 3 ? 'PCS-03' : 'PCS-03-AREA',
      title: ['PCS-03 本体', '冷却ファン・吸排気部', 'PCS-03 電気測定', 'PCS周辺・復旧確認'][index],
      reason: ['PCS内部異常 E-103で停止しているため、本体表示と内部状態を確認します。', '同一設備で冷却ファン故障の履歴があるため、ファン・吸排気部を重点確認します。', '日射量が十分な状態で出力0kWのため、DC入力・絶縁状態を測定します。', '現場作業後の安全状態と、PCS出力の復旧を確認します。'][index],
      result: null,
      comment: '',
    }))
    try {
      const shared = await sharedInspectionService.create(token, 'INS-INC-2026-0909-003', incidentItems, { plantName: '青森大間発電所', address: '青森県下北郡大間町', requestTitle: 'PCS-03停止 現地点検' })
      setShareToken(token)
      localStorage.setItem('solvia_inspection_share_token', token)
      setSharedInspection(shared)
      setItems(shared.items)
      setMeasurements({})
      setPhotos([])
      setStandardDone(false)
    } catch (error) { setSyncError(error instanceof Error ? error.message : '点検依頼を作成できませんでした') }
    finally { setSyncing(false) }
  }

  const refreshSharedInspection = async () => {
    if (!shareToken) return
    setSyncing(true)
    setSyncError('')
    try { setSharedInspection(await sharedInspectionService.get(shareToken)) }
    catch (error) { setSyncError(error instanceof Error ? error.message : '現場の入力結果を取得できませんでした') }
    finally { setSyncing(false) }
  }

  const resetSharedInspection = async () => {
    const token = fieldToken || shareToken
    if (!token || !window.confirm('入力済みの判定・測定値・写真を削除して、点検を最初からやり直しますか？')) return
    setSyncing(true)
    setSyncError('')
    try {
      const reset = await sharedInspectionService.reset(token)
      setSharedInspection(reset)
      setItems(reset.items)
      setMeasurements({})
      setPhotos([])
      setReportPhotos([])
      setIncludedPhotoIds([])
      setStandardDone(false)
      setFieldIndex(0)
      setStatus('点検前')
      if (fieldToken) setView('mobile-start')
      showToast('点検入力と写真をリセットしました')
    } catch (error) { setSyncError(error instanceof Error ? error.message : '点検をリセットできませんでした') }
    finally { setSyncing(false) }
  }

  const openPhotoReview = () => {
    const available = sharedInspection?.photos.length ? sharedInspection.photos : photos
    setReportPhotos(available)
    setIncludedPhotoIds(available.map(photo => photo.photoId))
    setShareOpen(false)
    setView('photo-review')
    window.scrollTo(0, 0)
  }

  const openReportEditor = () => {
    const selected = reportPhotos.filter(photo => includedPhotoIds.includes(photo.photoId))
    setReportLayout(current => selected.map(photo => current.find(entry => entry.photoId === photo.photoId) || { photoId: photo.photoId, zone: 'appendix' as ReportZone }))
    setView('report')
    window.scrollTo(0, 0)
  }

  const replaceReportPhoto = async (oldPhoto: InspectionPhoto, file: File) => {
    const item = items.find(entry => entry.inspectionItemId === oldPhoto.inspectionItemId)
    if (!item) return
    setSyncing(true)
    setSyncError('')
    try {
      const replacement = shareToken
        ? await sharedInspectionService.uploadPhoto(shareToken, item, oldPhoto.photoType, file)
        : { ...oldPhoto, photoId: `LOCAL-${Date.now()}`, url: URL.createObjectURL(file), takenAt: new Date().toISOString() }
      const swap = (entries: InspectionPhoto[]) => entries.map(photo => photo.photoId === oldPhoto.photoId ? replacement : photo)
      setPhotos(swap)
      setReportPhotos(swap)
      setIncludedPhotoIds(current => current.map(id => id === oldPhoto.photoId ? replacement.photoId : id))
      setSharedInspection(current => current ? { ...current, photos: swap(current.photos), updatedAt: new Date().toISOString() } : current)
      showToast(`${oldPhoto.photoType}を差し替えました`)
    } catch (error) { setSyncError(error instanceof Error ? error.message : '写真を差し替えられませんでした') }
    finally { setSyncing(false) }
  }

  const registerReport = async () => {
    await misoraService.saveReportDraft(inspection.inspectionId)
    setReportRegistered(true)
    setStatus('完了')
    showToast('MISORAへ登録しました（モック）')
  }

  const activePlantName = sharedInspection?.plantName || plant.plantName
  const activeAddress = sharedInspection?.address || plant.address

  if (view === 'mobile-start' || view === 'field' || view === 'validation' || view === 'complete') {
    return <FieldShell view={view} status={status} items={items} fieldIndex={fieldIndex} setFieldIndex={setFieldIndex} measurements={measurements} setMeasurements={setMeasurements} photos={photos} standardDone={standardDone} setStandardDone={setStandardDone} missingItems={missingItems} plantName={activePlantName} address={activeAddress} shared={Boolean(fieldToken)} syncing={syncing} syncError={syncError} onBack={() => fieldToken ? setView('mobile-start') : openDetail('priority')} onReturnToField={() => setView('field')} onStart={startField} onUpdateItem={updateItem} onAddPhoto={addPhoto} onApplyScenario={applyScenario} onFinish={finishField} onRecheck={recheck} onReset={resetSharedInspection} onComplete={() => { setStatus('報告書確認待ち'); openPhotoReview() }} />
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Sun size={21} /></span><div>SOLVIA<small>O&amp;M WORKSPACE</small></div></div>
      <nav><span className="nav-label">運用管理</span><button className={`nav-item ${view === 'monitoring' || view === 'incident' ? 'active' : ''}`} onClick={() => setView('monitoring')} data-testid="nav-monitoring"><Activity size={19} />統合監視</button><span className="nav-label nav-label-spaced">点検業務</span><button className={`nav-item ${['list', 'detail', 'photo-review', 'report'].includes(view) ? 'active' : ''}`} onClick={() => setView('list')} data-testid="nav-inspection"><ClipboardCheck size={19} />点検予定</button><div className="flow-guide"><span>業務が一つにつながる</span>{['監視・異常対応', '現地作業・復旧', '点検前の準備', '現場で入力・撮影', '報告書を生成'].map((text, index) => <div key={text}><i>{index + 1}</i>{text}</div>)}</div></nav>
      <div className="sidebar-bottom"><div className="source-state"><span><i />監視データ</span><strong>モック</strong></div><div className="source-state"><span><i />MISORA履歴</span><strong>モック</strong></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><button className="icon-button"><Menu size={19} /></button><span>O&amp;M統合管理</span><ChevronRight size={15} /><strong>{{ monitoring: '統合監視', incident: '異常案件', list: '点検予定', detail: '点検前確認', 'photo-review': '現場写真確認', report: '報告書ドラフト' }[view]}</strong></div><div><span className="demo-pill">デモデータ</span><span className="date"><CloudSun size={17} />2026年9月9日（水）</span><span className="user"><i>田</i>田中 誠</span></div></header>
      {view === 'monitoring' && <MonitoringDashboard phase={incidentPhase} onIncident={() => setView('incident')} />}
      {view === 'incident' && <IncidentCase phase={incidentPhase} onBack={() => setView('monitoring')} onInspectionRequest={requestIncidentInspection} onRestart={() => setIncidentPhase(2)} onWork={() => setIncidentPhase(5)} onClose={() => setIncidentPhase(6)} />}
      {view === 'list' && <InspectionList status={status} onOpen={() => openDetail()} />}
      {view === 'detail' && <InspectionDetail tab={detailTab} setTab={setDetailTab} plan={plan} onBack={() => setView('list')} onRequest={requestFieldInspection} requested={Boolean(shareToken)} />}
      {view === 'photo-review' && <PhotoReviewScreen photos={reportPhotos} includedIds={includedPhotoIds} syncing={syncing} error={syncError} onIncludedChange={setIncludedPhotoIds} onReplace={replaceReportPhoto} onBack={() => { setView('detail'); if (shareToken) setShareOpen(true) }} onConfirm={openReportEditor} />}
      {view === 'report' && <ReportScreen plantName={activePlantName} editing={editingReport} setEditing={setEditingReport} registered={reportRegistered} photos={reportPhotos.filter(photo => includedPhotoIds.includes(photo.photoId))} layout={reportLayout} setLayout={setReportLayout} onRegister={registerReport} onPdf={() => setPdfOpen(true)} onBack={() => setView('photo-review')} />}
    </main>
    {toast && <div className="toast"><CheckCircle2 size={19} />{toast}</div>}
    {pdfOpen && <PdfModal plantName={activePlantName} photos={reportPhotos.filter(photo => includedPhotoIds.includes(photo.photoId))} layout={reportLayout} onClose={() => setPdfOpen(false)} />}
    {shareOpen && <AssignmentModal token={shareToken} shared={sharedInspection} loading={syncing} error={syncError} onClose={() => setShareOpen(false)} onRefresh={refreshSharedInspection} onReset={resetSharedInspection} onReport={() => { if (sharedInspection) { setItems(sharedInspection.items); setMeasurements(sharedInspection.measurements); setPhotos(sharedInspection.photos) } openPhotoReview() }} />}
  </div>
}

function InspectionList({ status, onOpen }: { status: InspectionStatus; onOpen: () => void }) {
  return <div className="page list-page" data-testid="inspection-list">
    <div className="page-heading"><div><p className="eyebrow">INSPECTION SCHEDULE</p><h1>点検予定</h1><p>予定済みの定期点検と、事前準備の進捗を確認します。</p></div><div className="period-switch"><button className="active">今日</button><button>今週</button></div></div>
    <div className="status-guide"><span>ステータス</span>{(['点検前', '点検中', '入力確認待ち', '報告書確認待ち', '完了'] as InspectionStatus[]).map(item => <StatusBadge status={item} key={item} />)}</div>
    <div className="kpi-grid"><Kpi icon={<ClipboardCheck />} label="本日の点検" value="3" unit="件" color="blue" /><Kpi icon={<Sparkles />} label="重点点検" value="7" unit="件" color="purple" /><Kpi icon={<AlertCircle />} label="入力確認待ち" value="1" unit="件" color="amber" /></div>
    <section className="schedule-section"><div className="section-heading"><div><h2>本日の点検</h2><span>2026年9月9日（水）</span></div><span>3件</span></div>
      <article className="inspection-card featured" data-testid="primary-inspection"><div className="time-block"><strong>10:00</strong><span>予定</span></div><div className="inspection-main"><div className="card-top"><StatusBadge status={status} /><span className="inspection-id">INS-2026-0909-01</span></div><h3>{plant.plantName}</h3><p><MapPin size={14} />{plant.address}<span>・</span><UserRound size={14} />担当：田中 誠</p><div className="source-row"><span className="source-tag fusion"><Monitor size={14} />FusionSolar想定</span><span className="source-tag misora"><Database size={14} />MISORA履歴あり</span></div></div><div className="inspection-counts"><div><Sparkles size={18} /><span>今回の重点点検<strong>4件</strong></span></div><div><ClipboardCheck size={18} /><span>通常点検<strong>24件</strong></span></div></div><button className="primary-button" onClick={onOpen} data-testid="open-inspection">点検内容を見る<ArrowRight size={17} /></button></article>
      <article className="inspection-card muted-card"><div className="time-block"><strong>13:30</strong><span>予定</span></div><div className="inspection-main"><div className="card-top"><StatusBadge status="点検中" /></div><h3>S青森大間発電所1</h3><p><UserRound size={14} />担当：佐藤 健</p></div><div className="inspection-counts"><div><Sparkles size={18} /><span>重点点検<strong>2件</strong></span></div><div><ClipboardCheck size={18} /><span>通常点検<strong>22件</strong></span></div></div><button className="secondary-button" disabled>点検中</button></article>
    </section>
    <section className="schedule-section tomorrow"><div className="section-heading"><div><h2>明日の点検</h2><span>2026年9月10日（木）</span></div><span>1件</span></div><article className="compact-inspection"><span>09:00</span><div><StatusBadge status="入力確認待ち" /><strong>H熊本芦北宮崎発電所1</strong><small>担当：鈴木 翔</small></div><ChevronRight /></article></section>
  </div>
}

function Kpi({ icon, label, value, unit, color }: { icon: React.ReactNode; label: string; value: string; unit: string; color: string }) {
  return <div className="kpi"><span className={color}>{icon}</span><div><small>{label}</small><strong>{value}<em>{unit}</em></strong></div></div>
}

function StatusBadge({ status }: { status: InspectionStatus }) { return <span className={`status status-${statusTone[status]}`}><i />{status}</span> }

function InspectionDetail({ tab, setTab, plan, onBack, onRequest, requested }: { tab: DetailTab; setTab: (tab: DetailTab) => void; plan: ReturnType<typeof generateInspectionPlan>; onBack: () => void; onRequest: () => void; requested: boolean }) {
  return <div className="page detail-page" data-testid="inspection-detail"><button className="back-button" onClick={onBack}><ArrowLeft size={16} />点検予定へ戻る</button>
    <div className="detail-heading"><div><div className="heading-badges"><StatusBadge status="点検前" /><span className="inspection-id">INS-2026-0909-01</span></div><h1>{plant.plantName}</h1><p><MapPin size={14} />{plant.address}<span>・</span>9月9日 10:00<span>・</span>担当 田中 誠</p></div><button className="field-start" onClick={onRequest} data-testid="request-field"><Send size={18} />{requested ? '依頼状況・結果を見る' : '現場に依頼'}</button></div>
    <div className="data-disclaimer"><Info size={17} /><div><strong>デモ用モックデータ</strong><span>FusionSolar・MISORAの実API仕様や取得可能な粒度を保証するものではありません。</span></div></div>
    <div className="detail-tabs" role="tablist"><Tab active={tab === 'overview'} onClick={() => setTab('overview')} icon={<LayoutDashboard />} label="事前サマリー" /><Tab active={tab === 'history'} onClick={() => setTab('history')} icon={<History />} label="過去履歴" testId="history-tab" /><Tab active={tab === 'priority'} onClick={() => setTab('priority')} icon={<Sparkles />} label="今回の重点点検" count="4" testId="priority-tab" /><Tab active={tab === 'standard'} onClick={() => setTab('standard')} icon={<ClipboardCheck />} label="通常点検" count="24" /></div>
    {tab === 'overview' && <Overview onHistory={() => setTab('history')} onPriority={() => setTab('priority')} />}
    {tab === 'history' && <HistoryPanel />}
    {tab === 'priority' && <PriorityPanel items={plan.aiOrganized} onStart={onRequest} />}
    {tab === 'standard' && <StandardPanel />}
  </div>
}

function Tab({ active, onClick, icon, label, count, testId }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: string; testId?: string }) {
  return <button className={active ? 'active' : ''} onClick={onClick} role="tab" aria-selected={active} data-testid={testId}>{icon}{label}{count && <b>{count}</b>}</button>
}

function Overview({ onHistory, onPriority }: { onHistory: () => void; onPriority: () => void }) {
  const pcsEquipment = equipment[0]
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot>(monitoringSnapshot)
  useEffect(() => { void fusionSolarService.getPlantSnapshot(plant.plantId).then(setSnapshot) }, [])
  return <div className="overview-grid">
    <section className="panel basic-panel"><PanelTitle icon={<FileText />} title="発電所基本情報" subtitle="今回の点検対象" /><dl className="basic-grid"><InfoRow label="管理番号" value={plant.plantId} /><InfoRow label="点検日時" value="2026/09/09 10:00" /><InfoRow label="担当者" value="田中 誠" /><InfoRow label="前回点検日" value="2026/05/18" /><InfoRow label="PCS台数" value="9台" /><InfoRow label="設備" value={`${pcsEquipment.manufacturer} ${pcsEquipment.model}`} /></dl></section>
    <section className="panel focus-summary"><PanelTitle icon={<Sparkles />} title="今回、特に見るべき場所" subtitle="現在データ＋過去履歴から生成" /><div className="focus-numbers"><div><strong>24</strong><span>通常点検</span></div><ArrowRight /><div className="accent"><strong>+4</strong><span>今回の追加推奨</span></div></div><ul>{priorityItems.map((item, index) => <li key={item.inspectionItemId}><span>{index + 1}</span><div><strong>{item.title}</strong><small>{item.reason}</small></div></li>)}</ul><button className="text-button" onClick={onPriority}>重点点検の根拠を見る<ArrowRight size={15} /></button></section>
    <section className="panel monitoring-panel"><PanelTitle icon={<Monitor />} title="現在の監視データ" subtitle="FusionSolarから取得した想定（モック）" action={<span className="fresh">8:45取得</span>} /><div className="monitor-kpis"><div><small>現在出力</small><strong>{snapshot.currentOutputKw}<em>kW</em></strong></div><div><small>当日発電量</small><strong>{snapshot.dailyEnergyKwh.toLocaleString()}<em>kWh</em></strong></div><div><small>アクティブアラーム</small><strong className="green-text">{snapshot.activeAlarms}<em>件</em></strong></div></div><div className="monitor-layout"><div><h4>PCS出力比較</h4>{snapshot.pcs.map(pcs => <div className="bar-row" key={pcs.name}><span>{pcs.name}</span><i><b style={{ width: `${pcs.outputKw / .52}%` }} className={pcs.status === '要確認' ? 'warn' : ''} /></i><strong>{pcs.outputKw}kW</strong></div>)}</div><div><h4>ストリング電流</h4>{snapshot.strings.map(string => <div className="string-row" key={string.name}><span>{string.name}</span><strong className={string.deltaPercent < -10 ? 'warn-text' : ''}>{string.currentA}A</strong><small>{string.deltaPercent}%</small></div>)}</div></div><div className="trend-block"><div><h4>最近の発電推移</h4><span>直近7日・発電指数</span></div><div className="trend-bars">{snapshot.trend.map((value, index) => <i key={index} style={{ height: `${value}%` }} className={index > 4 ? 'soft' : ''}><small>{value}</small></i>)}</div></div></section>
    <section className="panel history-summary"><PanelTitle icon={<History />} title="MISORAの過去履歴" subtitle="関連度順（モック）" /><div className="history-mini"><span className="history-date">2026/05/18</span><div><strong>PCS COM1-4　設備異常</strong><p>原因：DCコネクタ接触不良</p><small>対応：コネクタ交換</small></div><span className="match">同一設備</span></div><div className="history-mini"><span className="history-date">2025/08/21</span><div><strong>北側パネル列　植生接近</strong><p>前回点検で確認</p><small>対応：草刈り</small></div><span className="match">同一発電所</span></div><button className="text-button" onClick={onHistory}>過去履歴をすべて見る<ArrowRight size={15} /></button></section>
    <section className="generation-strip"><div><span>1</span><strong>標準点検ルール</strong><small>設備種別の固定チェック</small></div><ChevronRight /><div><span>2</span><strong>過去履歴による追加</strong><small>同一設備・類似故障</small></div><ChevronRight /><div><span>3</span><strong>AIによる整理（モック）</strong><small>理由・撮影・測定を整理</small></div></section>
  </div>
}

function PanelTitle({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) { return <div className="panel-title"><span>{icon}</span><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div> }
function InfoRow({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function HistoryPanel() {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  useEffect(() => { void misoraService.searchInspectionHistory(plant.plantId).then(setRecords) }, [])
  return <div className="history-layout"><section className="panel search-order"><PanelTitle icon={<Search />} title="履歴の探索順" subtitle="広げすぎず、関連性の高い履歴から確認" /><div className="search-steps">{['同一発電所・同一設備', '同一発電所・同一症状', '同型設備・同一アラーム', '他発電所の類似故障'].map((text, index) => <div className={index < 2 ? 'found' : ''} key={text}><span>{index + 1}</span><strong>{text}</strong><small>{index === 0 ? '2件' : index === 1 ? '1件' : index === 2 ? '1件' : '参考0件'}</small></div>)}</div></section><section className="history-records">{records.map(record => <article className="panel history-record" key={record.id}><div><span className="match">{record.matchLevel}</span><time>{record.date}</time></div><h3>{record.equipment}</h3><strong>{record.symptom}</strong><dl><div><dt>原因</dt><dd>{record.cause}</dd></div><div><dt>対応</dt><dd>{record.action}</dd></div></dl><div className="record-assets"><button><FileText size={15} />点検報告書</button><button><Image size={15} />修繕前写真</button><button><Image size={15} />修繕後写真</button></div></article>)}</section></div>
}

function PriorityPanel({ items, onStart }: { items: InspectionItem[]; onStart: () => void }) {
  return <div className="priority-page"><div className="priority-intro"><div><Sparkles size={23} /><div><h2>今回の重点点検</h2><p>「なぜ見るのか」と、確認・測定・撮影内容をセットで提示します。</p></div></div><button className="field-start" onClick={onStart}><Send size={17} />現場に依頼</button></div>{items.map((item, index) => <article className="panel priority-card" key={item.inspectionItemId} data-testid={index === 0 ? 'priority-card' : undefined}><div className="priority-head"><span className={`priority-number p-${item.priority}`}>{index + 1}</span><div><div><h3>{item.title}</h3><span className={`priority-label ${item.priority}`}>重要度：{item.priority === 'high' ? '高' : '中'}</span></div><p><Zap size={14} />{item.reason}</p></div></div><div className="evidence-box"><strong>今回確認する根拠</strong>{item.evidence.map(evidence => <span key={evidence}><Check size={13} />{evidence}</span>)}</div><div className="task-columns"><div><h4><ClipboardCheck />確認すること</h4><ul>{item.checks.map(check => <li key={check}>{check}</li>)}</ul></div><div><h4><Ruler />測定</h4>{item.requiredMeasurement ? <p><strong>{item.requiredMeasurement.label}</strong><small>{item.requiredMeasurement.reference}</small></p> : <p className="none">指定測定なし</p>}</div><div><h4><Camera />撮影</h4>{item.photoTargets.length ? <ul>{item.photoTargets.map(photo => <li key={photo}>{photo}</li>)}</ul> : <p className="none">必須撮影なし</p>}</div></div>{index === 3 && <PhotoComparison />}</article>)}</div>
}

function PhotoComparison() { return <div className="photo-comparison"><div className="comparison-title"><Image size={17} /><strong>過去写真との比較</strong><span>画像解析は未実装</span></div><div className="photo-pair"><div><small>前回　2025/08/21</small><div className="mock-photo old"><span>北側パネル列</span><b>植生接近</b></div></div><ArrowRight /><div><small>今回　2026/09/09</small><div className="mock-photo empty"><Camera size={24} /><span>現場で撮影</span></div></div></div></div> }

function StandardPanel() { return <section className="panel standard-panel"><div className="standard-head"><PanelTitle icon={<ClipboardCheck />} title="通常点検 24件" subtitle="毎回必ず実施する設備種別ごとの固定チェックリスト" /><span>重点点検とは別に実施</span></div><div className="standard-grid">{standardTitles.map((title, index) => <label key={title}><span>{index + 1}</span><input type="checkbox" />{title}</label>)}</div></section> }

type FieldShellProps = {
  view: View; status: InspectionStatus; items: InspectionItem[]; fieldIndex: number; setFieldIndex: (index: number) => void
  measurements: Record<string, string>; setMeasurements: React.Dispatch<React.SetStateAction<Record<string, string>>>
  photos: InspectionPhoto[]; standardDone: boolean; setStandardDone: (value: boolean) => void; missingItems: { title: string; reason: string }[]
  plantName: string; address: string; shared: boolean; syncing: boolean; syncError: string
  onBack: () => void; onReturnToField: () => void; onStart: () => void; onUpdateItem: (id: string, patch: Partial<InspectionItem>) => void
  onAddPhoto: (item: InspectionItem, target?: string, file?: File) => void; onApplyScenario: (leaveGaps?: boolean) => void; onFinish: () => void; onRecheck: () => void; onReset: () => void; onComplete: () => void
}

function FieldShell(props: FieldShellProps) {
  const { view } = props
  return <div className="field-app"><header className="field-top"><div className="field-brand"><Sun size={19} />SOLVIA 現場点検</div><span>{props.shared ? (props.syncing ? '同期中' : 'オンライン') : 'デモ'}</span></header><main className="phone-stage">
    {props.syncError && <div className="field-sync-error"><AlertCircle />{props.syncError}</div>}
    {view === 'mobile-start' && <MobileStart plantName={props.plantName} address={props.address} onBack={props.onBack} onStart={props.onStart} shared={props.shared} syncing={props.syncing} />}
    {view === 'field' && <FieldItemV2 {...props} />}
    {view === 'validation' && <Validation missing={props.missingItems} standardDone={props.standardDone} shared={props.shared} syncing={props.syncing} onCompleteStandard={() => props.setStandardDone(true)} onFill={() => props.onApplyScenario(false)} onRecheck={props.onRecheck} onBack={props.onReturnToField} />}
    {view === 'complete' && <CompleteScreen plantName={props.plantName} photos={props.photos} shared={props.shared} onReset={props.onReset} onReport={props.onComplete} />}
  </main></div>
}

function MobileStart({ plantName, address, onBack, onStart, shared, syncing }: { plantName: string; address: string; onBack: () => void; onStart: () => void; shared: boolean; syncing: boolean }) { return <section className="mobile-card start-card" data-testid="mobile-start">{!shared && <button className="mobile-back" onClick={onBack}><ArrowLeft />事前確認へ</button>}<span className="today-label">現場への点検依頼</span><h1>{plantName}</h1><p><MapPin size={16} />{address}</p><div className="mobile-summary"><div className="priority"><Sparkles /><span>重点点検<strong>4件</strong></span></div><div><ClipboardCheck /><span>通常点検<strong>24件</strong></span></div></div><div className="field-notice"><ShieldCheck /><div><strong>現地到着後に開始してください</strong><span>{shared ? '入力・写真は管理側へ自動同期されます。' : '入力内容は画面を移動しても保持されます。'}</span></div></div><button className="mobile-primary" onClick={onStart} disabled={syncing} data-testid="start-inspection">点検を開始する<ArrowRight /></button></section> }

function FieldItem(props: FieldShellProps) {
  const item = props.items[props.fieldIndex]
  const completed = props.items.filter(current => current.result).length
  const itemPhotos = props.photos.filter(photo => photo.inspectionItemId === item.inspectionItemId)
  return <section className="mobile-card field-card" data-testid="field-item"><div className="mobile-nav"><button onClick={props.onBack}><X />中断</button><strong>重点点検</strong><span>{props.fieldIndex + 1} / {props.items.length}</span></div><div className="mobile-progress"><i style={{ width: `${((props.fieldIndex + 1) / props.items.length) * 100}%` }} /></div><div className="field-context"><span className={`priority-label ${item.priority}`}>重要度：{item.priority === 'high' ? '高' : '中'}</span><h1>{item.title}</h1><p><Info />{item.reason}</p></div><div className="field-section"><h2>確認項目</h2><div className="check-chips">{item.checks.map(check => <span key={check}><Check />{check}</span>)}</div></div><div className="field-section"><h2>判定</h2><div className="result-buttons">{(['正常', '異常', '判断不能'] as InspectionResult[]).map(result => <button key={result} className={item.result === result ? `selected ${result === '異常' ? 'abnormal' : ''}` : ''} onClick={() => props.onUpdateItem(item.inspectionItemId, { result })}>{result === '正常' ? '○' : result === '異常' ? '!' : '?'}<span>{result}</span></button>)}</div></div>{item.requiredMeasurement && <div className="field-section measurement"><h2>測定値</h2><label><span>{item.requiredMeasurement.label}</span><div><input type="number" inputMode="decimal" placeholder="数値" value={props.measurements[item.inspectionItemId] || ''} onChange={event => props.setMeasurements(current => ({ ...current, [item.inspectionItemId]: event.target.value }))} data-testid="measurement-input" /><b>{item.requiredMeasurement.unit}</b></div><small>{item.requiredMeasurement.reference}</small></label></div>}<div className="field-section"><h2>今回の必須写真 <span>{itemPhotos.length}/{item.photoTargets.length}</span></h2>{item.photoTargets.length ? <div className="photo-list">{item.photoTargets.map(target => { const taken = itemPhotos.some(photo => photo.photoType === target); return <button className={taken ? 'taken' : ''} key={target} onClick={() => props.onAddPhoto(item, target)}>{taken ? <CheckCircle2 /> : <Camera />}<span><strong>{target}</strong><small>{taken ? '撮影済み' : 'タップして撮影'}</small></span><ChevronRight /></button> })}</div> : <p className="no-requirement">この項目の必須写真はありません</p>}<div className="photo-reason"><Info />撮影理由：{item.reason}</div></div><div className="field-section"><h2>補足コメント</h2><textarea placeholder="気づいた点を入力" value={item.comment} onChange={event => props.onUpdateItem(item.inspectionItemId, { comment: event.target.value })} /></div><button className="scenario-button" onClick={() => props.onApplyScenario(true)} data-testid="apply-scenario"><Sparkles />デモシナリオ入力を反映</button><div className="field-footer"><button className="mobile-secondary" disabled={props.fieldIndex === 0} onClick={() => props.setFieldIndex(props.fieldIndex - 1)}>前へ</button>{props.fieldIndex < props.items.length - 1 ? <button className="mobile-primary" onClick={() => props.setFieldIndex(props.fieldIndex + 1)}>次の項目へ<ArrowRight /></button> : <button className="mobile-primary" onClick={props.onFinish} data-testid="finish-inspection">点検完了・入力確認</button>}</div><div className="standard-sticky"><ClipboardCheck /><span>通常点検</span><strong>{props.standardDone ? '24 / 24 完了' : '未完了'}</strong><em>{completed}/4 重点判定済み</em></div></section>
}

function FieldItemV2(props: FieldShellProps) {
  const item = props.items[props.fieldIndex]
  const completed = props.items.filter(current => current.result).length
  const itemPhotos = props.photos.filter(photo => photo.inspectionItemId === item.inspectionItemId)
  return <section className="mobile-card field-card" data-testid="field-item">
    <div className="mobile-nav"><button onClick={props.onBack}><X />中断</button><strong>重点点検</strong><span>{props.fieldIndex + 1} / {props.items.length}</span></div>
    <div className="mobile-progress"><i style={{ width: `${((props.fieldIndex + 1) / props.items.length) * 100}%` }} /></div>
    <div className="field-context"><span className={`priority-label ${item.priority}`}>重要度：{item.priority === 'high' ? '高' : '中'}</span><h1>{item.title}</h1><p><Info />{item.reason}</p></div>
    <div className="field-section"><h2>確認項目</h2><div className="check-chips">{item.checks.map(check => <span key={check}><Check />{check}</span>)}</div></div>
    <div className="field-section"><h2>判定</h2><div className="result-buttons">{(['正常', '異常', '判断不能'] as InspectionResult[]).map(result => <button key={result} className={item.result === result ? `selected ${result === '異常' ? 'abnormal' : ''}` : ''} onClick={() => props.onUpdateItem(item.inspectionItemId, { result })}>{result === '正常' ? '○' : result === '異常' ? '!' : '?'}<span>{result}</span></button>)}</div></div>
    {item.requiredMeasurement && <div className="field-section measurement"><h2>測定値</h2><label><span>{item.requiredMeasurement.label}</span><div><input type="number" inputMode="decimal" placeholder="数値" value={props.measurements[item.inspectionItemId] || ''} onChange={event => props.setMeasurements(current => ({ ...current, [item.inspectionItemId]: event.target.value }))} data-testid="measurement-input" /><b>{item.requiredMeasurement.unit}</b></div><small>{item.requiredMeasurement.reference}</small></label></div>}
    <div className="field-section"><h2>今回の必須写真 <span>{itemPhotos.length}/{item.photoTargets.length}</span></h2>{item.photoTargets.length ? <div className="photo-list">{item.photoTargets.map(target => { const taken = itemPhotos.some(photo => photo.photoType === target); return <label className={taken ? 'taken camera-input' : 'camera-input'} key={target}>{taken ? <CheckCircle2 /> : <Camera />}<span><strong>{target}</strong><small>{taken ? '撮り直す' : 'タップしてカメラを開く'}</small></span><ChevronRight /><input type="file" accept="image/*" capture="environment" onChange={event => { const file = event.target.files?.[0]; if (file) void props.onAddPhoto(item, target, file); event.target.value = '' }} /></label> })}</div> : <p className="no-requirement">この項目の必須写真はありません</p>}<div className="photo-reason"><Info />撮影理由：{item.reason}</div></div>
    <div className="field-section"><h2>補足コメント</h2><textarea placeholder="気づいた点を入力" value={item.comment} onChange={event => props.onUpdateItem(item.inspectionItemId, { comment: event.target.value })} /></div>
    {props.fieldIndex === props.items.length - 1 && <button className={props.standardDone ? 'standard-complete done' : 'standard-complete'} onClick={() => props.setStandardDone(!props.standardDone)}><ClipboardCheck />{props.standardDone ? '通常点検24件：完了済み（タップで取消）' : '通常点検24件を完了として記録'}</button>}
    {!props.shared && <button className="scenario-button" onClick={() => props.onApplyScenario(true)} data-testid="apply-scenario"><Sparkles />デモシナリオ入力を反映</button>}
    <div className="field-footer"><button className="mobile-secondary" disabled={props.fieldIndex === 0} onClick={() => props.setFieldIndex(props.fieldIndex - 1)}>前へ</button>{props.fieldIndex < props.items.length - 1 ? <button className="mobile-primary" onClick={() => props.setFieldIndex(props.fieldIndex + 1)}>次の項目へ<ArrowRight /></button> : <button className="mobile-primary" onClick={props.onFinish} disabled={props.syncing} data-testid="finish-inspection">点検完了・入力確認</button>}</div>
    <div className="standard-sticky"><ClipboardCheck /><span>通常点検</span><strong>{props.standardDone ? '24 / 24 完了' : '未完了'}</strong><em>{completed}/4 重点判定済み</em></div>
  </section>
}

function Validation({ missing, standardDone, shared, syncing, onCompleteStandard, onFill, onRecheck, onBack }: { missing: { title: string; reason: string }[]; standardDone: boolean; shared: boolean; syncing: boolean; onCompleteStandard: () => void; onFill: () => void; onRecheck: () => void; onBack: () => void }) {
  const ready = missing.length === 0
  return <section className="mobile-card validation-card" data-testid="validation-screen"><div className={ready ? 'validation-icon ready' : 'validation-icon'}>{ready ? <CheckCircle2 /> : <AlertCircle />}</div><span className="today-label">入力漏れチェック</span><h1>{ready ? '必要な入力が揃いました' : '入力内容を確認してください'}</h1><p>{ready ? '点検結果を管理側へ提出できます。' : `未完了 ${missing.length}件`}</p>{!ready && <div className="missing-list">{missing.slice(0, 4).map(entry => <div key={entry.title}><AlertCircle /><span><strong>{entry.title}</strong><small>{entry.reason}</small></span></div>)}</div>}{!standardDone && <div className="standard-validation-action"><ClipboardCheck /><span><strong>通常点検24件</strong><small>実施済みであれば、ここで完了として記録できます。</small></span><button onClick={onCompleteStandard} data-testid="complete-standard">24件を完了として記録</button></div>}{!ready && missing.length > 4 && <p className="more-missing">ほか {missing.length - 4}件</p>}<div className="reason-note"><Sparkles /><span><strong>履歴を踏まえた確認</strong>過去にDC系統の故障があるため、DC端子部の撮影とDC電圧の記録を推奨します。</span></div>{ready ? <button className="mobile-primary" disabled={syncing} onClick={onRecheck} data-testid="confirm-complete">{shared ? '管理側へ点検結果を提出' : '点検結果を確定する'}</button> : shared ? <button className="mobile-secondary validation-back" onClick={onBack}>重点点検の入力へ戻る</button> : <button className="mobile-primary" onClick={onFill} data-testid="fill-missing">不足項目をデモ入力</button>}</section>
}

function CompleteScreen({ plantName, photos, shared, onReset, onReport }: { plantName: string; photos: InspectionPhoto[]; shared: boolean; onReset: () => void; onReport: () => void }) { return <section className="mobile-card complete-card" data-testid="complete-screen"><div className="complete-mark"><CheckCircle2 /></div><span className="today-label">{shared ? '管理側へ提出済み' : '点検入力完了'}</span><h1>お疲れさまでした</h1><p>{plantName}</p><div className="result-summary"><div><small>通常点検</small><strong>24 / 24</strong><span>完了</span></div><div><small>重点点検</small><strong>4 / 4</strong><span>完了</span></div><div className="danger"><small>異常</small><strong>2</strong><span>件</span></div><div><small>撮影写真</small><strong>{photos.length}</strong><span>枚</span></div><div><small>測定</small><strong>1</strong><span>項目</span></div></div><div className="found-issues"><h2>今回確認された異常</h2><div><span>1</span><p><strong>PCS COM1-4</strong>DCコネクタ変色あり</p></div><div><span>2</span><p><strong>北側パネル列</strong>植生接近あり</p></div></div>{shared ? <><div className="submitted-notice"><CheckCircle2 />入力結果と写真を管理側へ送信しました</div><button className="redo-inspection" onClick={onReset} data-testid="redo-field-inspection"><RefreshCcw />入力・写真をリセットしてやり直す</button></> : <button className="mobile-primary" onClick={onReport} data-testid="generate-report"><FileText />報告書ドラフトを生成</button>}</section> }

function PhotoReviewScreen({ photos, includedIds, syncing, error, onIncludedChange, onReplace, onBack, onConfirm }: { photos: InspectionPhoto[]; includedIds: string[]; syncing: boolean; error: string; onIncludedChange: React.Dispatch<React.SetStateAction<string[]>>; onReplace: (photo: InspectionPhoto, file: File) => void; onBack: () => void; onConfirm: () => void }) {
  return <div className="page photo-review-page" data-testid="photo-review-screen">
    <button className="back-button" onClick={onBack}><ArrowLeft />現場結果へ戻る</button>
    <div className="photo-review-heading"><div><p className="eyebrow">PHOTO REVIEW</p><h1>現場写真の確認・差し替え</h1><p>写真の内容を確認し、報告書に使う写真を選択します。</p></div><div className="review-count"><strong>{includedIds.length}</strong><span>/ {photos.length}枚を掲載</span></div></div>
    <div className="report-flow"><span className="done"><Check />現場結果</span><ChevronRight /><span className="active">2　写真確認・差し替え</span><ChevronRight /><span>3　報告書編集</span></div>
    {error && <div className="assignment-error"><AlertCircle />{error}</div>}
    <div className="drag-guide"><Image /><div><strong>まず写真の内容を確認</strong><span>画像の配置は、次の報告書編集画面で本文へ直接ドラッグして決められます。</span></div></div>
    <div className="review-photo-grid">{photos.map(photo => {
      const included = includedIds.includes(photo.photoId)
      return <article key={photo.photoId} className={included ? '' : 'excluded'} data-testid="review-photo-card">
        <div className="review-photo-top"><span className="photo-use-status">{included ? <Check /> : <X />}{included ? '掲載候補' : '掲載しない'}</span></div>
        <div className="review-image">{photo.url ? <img src={photo.url} alt={photo.photoType} /> : <Image />}</div>
        <div className="review-photo-meta"><strong>{photo.photoType}</strong><small>{new Date(photo.takenAt).toLocaleString('ja-JP')}</small></div>
        <div className="review-photo-actions"><button className={included ? 'include active' : 'include'} onClick={() => onIncludedChange(current => included ? current.filter(id => id !== photo.photoId) : [...current, photo.photoId])}>{included ? <CheckCircle2 /> : <AlertCircle />}{included ? '報告書に掲載' : '掲載しない'}</button><label><RefreshCcw />写真を差し替え<input type="file" accept="image/*" data-testid="replace-photo" onChange={event => { const file = event.target.files?.[0]; if (file) void onReplace(photo, file); event.target.value = '' }} /></label></div>
      </article>
    })}</div>
    <div className="photo-review-footer"><div><strong>掲載候補：{includedIds.length}枚</strong><span>次の画面で、写真を報告書本文へドラッグして配置します。</span></div><button onClick={onConfirm} disabled={!includedIds.length || syncing} data-testid="confirm-photo-layout">{syncing ? '写真を更新中…' : '報告書の配置編集へ'}<ArrowRight /></button></div>
  </div>
}

function ReportScreen({ plantName, editing, setEditing, registered, photos, layout, setLayout, onRegister, onPdf, onBack }: { plantName: string; editing: boolean; setEditing: (value: boolean) => void; registered: boolean; photos: InspectionPhoto[]; layout: { photoId: string; zone: ReportZone | null }[]; setLayout: React.Dispatch<React.SetStateAction<{ photoId: string; zone: ReportZone | null }[]>>; onRegister: () => void; onPdf: () => void; onBack: () => void }) {
  const reportText = `2026年9月9日、${plantName}の点検を実施した。\n\nPCS設備について、過去履歴と現在の監視データを踏まえた重点確認を実施した。外観・端子部・設備表示を確認し、必要な測定と写真撮影を行った。\n\n通常点検24項目および重点点検4項目はすべて実施済みである。`
  const reportPhotos = photos.slice(0, 8)
  const zoneLabels: Record<ReportZone, string> = { overview: '点検概要の下', findings: '点検所見の下', issues: '異常一覧の下', appendix: '現場写真欄' }
  const movePhoto = (photoId: string, zone: ReportZone | null, beforeId?: string) => setLayout(current => {
    const next = current.filter(entry => entry.photoId !== photoId)
    const moved = { photoId, zone }
    if (beforeId) {
      const index = next.findIndex(entry => entry.photoId === beforeId)
      if (index >= 0) { next.splice(index, 0, moved); return next }
    }
    if (zone) {
      const lastInZone = next.reduce((last, entry, index) => entry.zone === zone ? index : last, -1)
      next.splice(lastInZone + 1, 0, moved)
    } else next.push(moved)
    return next
  })
  const renderZone = (zone: ReportZone) => {
    const entries = layout.filter(entry => entry.zone === zone)
    return <div className={`report-drop-zone ${entries.length ? 'has-photos' : ''}`} data-testid={`report-drop-${zone}`} onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add('drag-over') }} onDragLeave={event => event.currentTarget.classList.remove('drag-over')} onDrop={event => { event.preventDefault(); event.currentTarget.classList.remove('drag-over'); movePhoto(event.dataTransfer.getData('text/plain'), zone) }}>
      {!entries.length && <div className="drop-placeholder"><Image /><span>画像ブロックをここにドロップ</span><small>{zoneLabels[zone]}</small></div>}
      {entries.map(entry => {
        const photo = reportPhotos.find(item => item.photoId === entry.photoId)
        if (!photo) return null
        return <figure className="report-image-block" key={photo.photoId} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', photo.photoId) }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); movePhoto(event.dataTransfer.getData('text/plain'), zone, photo.photoId) }} data-testid="report-image-block"><span className="block-handle"><GripVertical />画像</span>{photo.url ? <img src={photo.url} alt={photo.photoType} /> : <div className="image-unavailable"><Image />画像を再取得してください</div>}<figcaption><strong>{photo.photoType}</strong><small>{photo.takenAt.slice(0, 16).replace('T', ' ')}</small><button onClick={() => movePhoto(photo.photoId, null)} aria-label={`${photo.photoType}を報告書から外す`}><X /></button></figcaption></figure>
      })}
    </div>
  }
  return <div className="page report-page" data-testid="report-screen">
    <button className="back-button" onClick={onBack}><ArrowLeft />写真確認へ戻る</button>
    <div className="report-heading"><div><p className="eyebrow">REPORT EDITOR</p><h1>点検報告書ドラフト</h1><p>右側の写真を、本文内の青い挿入位置へドラッグして配置できます。</p></div><span className={registered ? 'report-status done' : 'report-status'}>{registered ? <CheckCircle2 /> : <Sparkles />}{registered ? 'MISORA登録済み（モック）' : 'ブロック編集モード'}</span></div>
    <div className="report-layout report-editor-layout"><article className="report-document notion-document">
      <div className="report-cover"><span>SOLVIA INSPECTION REPORT</span><h2>太陽光発電所 点検報告書</h2><div><strong>{plantName}</strong><small>点検日 2026年9月9日　担当 田中 誠</small></div></div>
      <section><h3>1. 点検概要</h3><div className="report-info"><InfoRow label="天候" value="晴れ・気温28℃" /><InfoRow label="監視データ" value="現在出力444.08kW / アラーム0件" /><InfoRow label="点検項目" value="通常24件 / 重点4件" /><InfoRow label="測定" value="DC電圧 612V" /></div></section>{renderZone('overview')}
      <section><h3>2. 点検所見</h3>{editing ? <textarea defaultValue={reportText} /> : <p className="generated-copy">{reportText}</p>}</section>{renderZone('findings')}
      <section><h3>3. 確認された異常</h3><table><thead><tr><th>設備</th><th>確認内容</th><th>対応</th></tr></thead><tbody><tr><td>PCS COM1-4</td><td>DCコネクタ変色あり</td><td>交換を推奨</td></tr><tr><td>北側パネル列</td><td>植生接近あり</td><td>草刈りを推奨</td></tr></tbody></table></section>{renderZone('issues')}
      <section><h3>4. 現場写真</h3>{renderZone('appendix')}</section>
    </article><aside className="report-actions report-editor-tools panel"><div className="editor-help"><GripVertical /><span><strong>画像ブロック</strong>写真をつかみ、報告書の好きな挿入位置へ移動します。</span></div><div className="photo-block-palette">{reportPhotos.length ? reportPhotos.map(photo => { const placement = layout.find(entry => entry.photoId === photo.photoId)?.zone; return <div key={photo.photoId} draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/plain', photo.photoId) }} data-testid="report-photo-source">{photo.url ? <img src={photo.url} alt={photo.photoType} /> : <span className="palette-placeholder"><Image /></span>}<span><strong>{photo.photoType}</strong><small>{placement ? zoneLabels[placement] : '未配置'}</small></span><GripVertical /></div> }) : <div className="palette-empty"><Image />掲載対象の写真がありません</div>}</div><h2>報告書操作</h2><button onClick={() => setEditing(!editing)}><Pencil />{editing ? '編集を終了' : '文章を編集'}</button><button onClick={onPdf}><FileText />PDFプレビュー</button><button className="register" onClick={onRegister} disabled={registered} data-testid="register-misora"><Upload />{registered ? '登録済み' : 'MISORAへ登録'}</button><div className="api-note"><Info />実際のMISORAへの書き込み可否・API仕様は未確認です。現在はモック処理です。</div></aside></div>
  </div>
}

function AssignmentModal({ token, shared, loading, error, onClose, onRefresh, onReset, onReport }: { token: string; shared: SharedInspection | null; loading: boolean; error: string; onClose: () => void; onRefresh: () => void; onReset: () => void; onReport: () => void }) {
  const fieldUrl = token ? `${window.location.origin}/?field=${token}` : ''
  const completed = shared?.items.filter(item => item.result).length || 0
  const abnormal = shared?.items.filter(item => item.result === '異常') || []
  const statusLabel = shared?.status === 'submitted' ? '提出済み' : shared?.status === 'in_progress' ? '点検中' : '依頼済み'
  return <div className="modal-backdrop"><div className="assignment-modal" role="dialog" data-testid="assignment-modal"><header><div><span>FIELD INSPECTION REQUEST</span><h2>現場への点検依頼</h2>{shared?.plantName && <p>{shared.plantName}　{shared.requestTitle}</p>}</div><button onClick={onClose} aria-label="閉じる"><X /></button></header>
    {error && <div className="assignment-error"><AlertCircle />{error}</div>}
    {loading && !shared ? <div className="assignment-loading"><RefreshCcw />依頼を作成しています…</div> : shared && <><section className="share-box"><div><Link2 /><span><strong>現場用URL</strong><small>このURLをスマホへ送ると、現場画面だけが開きます。</small></span></div><code>{fieldUrl}</code><div><button onClick={() => { void navigator.clipboard.writeText(fieldUrl) }}><Copy />URLをコピー</button><a href={fieldUrl} target="_blank" rel="noreferrer"><ExternalLink />現場画面を開く</a></div><p><ShieldCheck />デモ用の共有URLです。URLを知っている人が点検内容を閲覧できます。</p></section>
      <section className="submission-head"><div><span className={`submission-status ${shared.status}`}>{statusLabel}</span><h3>現場の入力状況</h3><p>最終同期 {new Date(shared.updatedAt).toLocaleString('ja-JP')}</p></div><button onClick={onRefresh} disabled={loading}><RefreshCcw />{loading ? '更新中' : '最新状態に更新'}</button></section>
      <div className="submission-kpis"><div><small>重点点検</small><strong>{completed} / 4</strong></div><div><small>通常点検</small><strong>{shared.standardDone ? '24 / 24' : '未完了'}</strong></div><div><small>異常</small><strong className="red-text">{abnormal.length}件</strong></div><div><small>写真</small><strong>{shared.photos.length}枚</strong></div></div>
      <section className="submitted-results"><h3>点検結果</h3>{shared.items.map(item => <div key={item.inspectionItemId}><span><strong>{item.title}</strong><small>{item.comment || 'コメントなし'}</small></span><b className={item.result === '異常' ? 'abnormal' : ''}>{item.result || '未入力'}</b>{item.requiredMeasurement && <em>{shared.measurements[item.inspectionItemId] || '—'} {item.requiredMeasurement.unit}</em>}</div>)}</section>
      <section className="admin-photo-section"><div><h3>現場写真</h3><span>撮影箇所にひも付けて保存</span></div>{shared.photos.length ? <div className="admin-photo-grid">{shared.photos.map(photo => <figure key={photo.photoId}><img src={photo.url} alt={photo.photoType} /><figcaption><strong>{photo.photoType}</strong><small>{new Date(photo.takenAt).toLocaleString('ja-JP')}</small></figcaption></figure>)}</div> : <div className="photo-empty"><Camera />現場から写真が届くとここに表示されます</div>}</section>
      <footer><span>{shared.status === 'submitted' ? '現場から点検結果が提出されました。' : '現場での入力内容は自動同期されます。'}</span><div>{shared.status === 'submitted' && <button className="reset-request" onClick={onReset} disabled={loading} data-testid="reset-inspection"><RefreshCcw />点検をやり直す</button>}{shared.status === 'submitted' && <button onClick={onReport} data-testid="make-report-from-field"><Image />写真を確認して報告書へ</button>}</div></footer></>}
  </div></div>
}

function PdfModal({ plantName, photos, layout, onClose }: { plantName: string; photos: InspectionPhoto[]; layout: { photoId: string; zone: ReportZone | null }[]; onClose: () => void }) {
  const zonePhotos = (zone: ReportZone) => layout.filter(entry => entry.zone === zone).map(entry => photos.find(photo => photo.photoId === entry.photoId)).filter(Boolean) as InspectionPhoto[]
  const photoGroup = (zone: ReportZone) => {
    const entries = zonePhotos(zone)
    if (!entries.length) return null
    return <div className="pdf-photo-grid" data-testid={`pdf-photos-${zone}`}>{entries.map(photo => <figure key={photo.photoId}><img src={photo.url} alt={photo.photoType} /><figcaption>{photo.photoType}</figcaption></figure>)}</div>
  }
  return <div className="modal-backdrop"><div className="pdf-modal live-pdf-modal" role="dialog"><div><h2>PDFプレビュー</h2><button onClick={onClose} aria-label="閉じる"><X /></button></div><div className="pdf-preview-scroll"><div className="pdf-page live-pdf-page"><small>SOLVIA INSPECTION REPORT</small><h3>太陽光発電所 点検報告書</h3><h4>{plantName}</h4><p>点検日 2026年9月9日　担当 田中 誠</p><hr /><section><strong>1. 点検概要</strong><div className="pdf-summary"><span>天候　晴れ・気温28℃</span><span>現在出力　444.08kW</span><span>点検　通常24件 / 重点4件</span><span>測定　DC電圧 612V</span></div></section>{photoGroup('overview')}<section><strong>2. 点検所見</strong><p>2026年9月9日、{plantName}の点検を実施した。過去履歴と現在の監視データを踏まえて重点確認し、必要な測定と写真撮影を行った。</p></section>{photoGroup('findings')}<section><strong>3. 確認された異常</strong><table><tbody><tr><td>PCS設備</td><td>重点確認結果を記録</td></tr><tr><td>発電所構内</td><td>現場確認結果を記録</td></tr></tbody></table></section>{photoGroup('issues')}<section><strong>4. 現場写真</strong>{photoGroup('appendix') || <p>配置された写真はありません。</p>}</section></div></div><p>現在の文章・画像配置を反映したプレビューです（PDFファイル生成はモック）。</p></div></div>
}

export default App
