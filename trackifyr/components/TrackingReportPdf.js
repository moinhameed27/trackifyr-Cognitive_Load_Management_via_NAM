'use client'

export async function fetchReportPayload(period) {
  const res = await fetch(`/api/tracking/report?period=${period}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Could not load report data')
  }
  return data
}

async function loadPdfLibs() {
  const [jspdfMod, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const jsPDF = jspdfMod.jsPDF || jspdfMod.default
  const autoTable = autoTableMod.default || autoTableMod
  return { jsPDF, autoTable }
}

function countCognitiveLoads(rows) {
  const c = { High: 0, Medium: 0, Low: 0 }
  for (const r of rows || []) {
    const k = String(r.cognitiveLoad || '')
    if (k === 'High' || k === 'Medium' || k === 'Low') c[k] += 1
  }
  return c
}

/** @param {import('jspdf').jsPDF} doc */
function drawActivitySparkline(doc, x, y, w, h, chartPoints) {
  const loads = (chartPoints || []).map((p) => (typeof p.load === 'number' ? p.load : 0))
  if (loads.length < 2) return
  doc.setDrawColor(99, 102, 241)
  doc.setLineWidth(0.35)
  const n = loads.length
  for (let i = 0; i < n - 1; i++) {
    const x1 = x + (i / (n - 1)) * w
    const x2 = x + ((i + 1) / (n - 1)) * w
    const y1 = y + h - (loads[i] / 100) * h
    const y2 = y + h - (loads[i + 1] / 100) * h
    doc.line(x1, y1, x2, y2)
  }
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.2)
  doc.line(x, y + h, x + w, y + h)
}

/** @param {import('jspdf').jsPDF} doc */
function drawCognitiveMixBars(doc, x, y, w, h, counts) {
  const order = ['Low', 'Medium', 'High']
  const colors = [
    [22, 163, 74],
    [202, 138, 4],
    [220, 38, 38],
  ]
  const vals = order.map((k) => counts[k] || 0)
  const max = Math.max(...vals, 1)
  const gap = 2
  const barW = (w - gap * (order.length - 1)) / order.length
  order.forEach((label, i) => {
    const v = vals[i]
    const bh = (v / max) * h
    const bx = x + i * (barW + gap)
    const [r, g, b] = colors[i]
    doc.setFillColor(r, g, b)
    doc.rect(bx, y + h - bh, barW, bh, 'F')
    doc.setFontSize(7)
    doc.setTextColor(60, 60, 60)
    doc.text(`${label}: ${v}`, bx + barW / 2, y + h + 4, { align: 'center' })
  })
}

/** @param {import('jspdf').jsPDF} doc */
function drawWeeklyBars(doc, x, y, w, h, weeklyRows) {
  const rows = Array.isArray(weeklyRows) ? weeklyRows : []
  if (!rows.length) return
  const maxA = Math.max(...rows.map((r) => Number(r.avgActivity) || 0), 1)
  const maxW = Math.max(...rows.map((r) => Number(r.sessions) || 0), 1)
  const n = rows.length
  const gap = 1.5
  const barW = (w - gap * (n - 1)) / n
  rows.forEach((r, i) => {
    const bx = x + i * (barW + gap)
    const a = Number(r.avgActivity) || 0
    const win = Number(r.sessions) || 0
    const ah = (a / maxA) * (h * 0.55)
    const wh = (win / maxW) * (h * 0.4)
    doc.setFillColor(99, 102, 241)
    doc.rect(bx, y + h * 0.45 - ah, barW * 0.45, ah, 'F')
    doc.setFillColor(16, 185, 129)
    doc.rect(bx + barW * 0.5, y + h - wh, barW * 0.45, wh, 'F')
  })
  doc.setFontSize(6)
  doc.setTextColor(80, 80, 80)
  rows.forEach((r, i) => {
    const bx = x + i * (barW + gap) + barW / 2
    const label = String(r.day || '').slice(0, 6)
    doc.text(label, bx, y + h + 3, { align: 'center', maxWidth: barW })
  })
}

function addFooter(doc, pageCount) {
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `Page ${i} of ${pageCount} · All times Pakistan (PKT)`,
      14,
      doc.internal.pageSize.getHeight() - 10,
    )
  }
}

export async function downloadDailyPdf(payload) {
  const { jsPDF, autoTable } = await loadPdfLibs()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 30, 30)
  doc.text('Trackifyr — Daily tracking report', margin, y)
  y += 9
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`User: ${payload.user?.fullName || '—'} · ${payload.user?.email || '—'}`, margin, y)
  y += 6
  doc.text(`PKT date: ${payload.pktDateLabel || '—'}`, margin, y)
  y += 6
  const summary = payload.daily?.summary
  const avgLine =
    typeof summary?.dailyAvgActivityPct === 'number' && !Number.isNaN(summary.dailyAvgActivityPct)
      ? `Day average activity (all samples): ${summary.dailyAvgActivityPct}%`
      : 'Day average activity: —'
  doc.text(avgLine, margin, y)
  y += 6
  doc.text(`5-minute windows in report: ${summary?.bucketCount ?? 0}`, margin, y)
  y += 6
  doc.text(`Generated: ${payload.generatedAtPkt || '—'}`, margin, y)
  y += 8

  const rows = Array.isArray(payload.daily?.rows) ? payload.daily.rows : []
  const chartPts = Array.isArray(payload.daily?.chartPoints) ? payload.daily.chartPoints : []
  const pageW = doc.internal.pageSize.getWidth() - 2 * margin

  if (chartPts.length >= 2) {
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    doc.text('Activity % over the PKT day (line)', margin, y)
    y += 5
    drawActivitySparkline(doc, margin, y, pageW, 22, chartPts)
    y += 28
  }

  const cogN = countCognitiveLoads(rows)
  if (cogN.High + cogN.Medium + cogN.Low > 0) {
    doc.setFontSize(9)
    doc.text('Cognitive load mix (5-minute windows)', margin, y)
    y += 5
    drawCognitiveMixBars(doc, margin, y, pageW, 16, cogN)
    y += 24
  }

  y += 4

  const body = rows.map((r) => [
    r.time || '—',
    r.avgActivity || '—',
    r.cognitiveLoad || '—',
    r.engagement || '—',
    r.duration || '—',
  ])

  autoTable(doc, {
    startY: y,
    head: [['Time window (PKT)', 'Avg activity', 'Cognitive load', 'Engagement', 'Duration']],
    body: body.length ? body : [['No data for this PKT day', '—', '—', '—', '—']],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [67, 56, 202], textColor: 255 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: margin, right: margin },
  })

  const finalY = doc.lastAutoTable?.finalY ?? y + 40
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text(
    'Each row is one 5-minute window. Values are averages of samples ingested in that window only.',
    margin,
    Math.min(finalY + 10, doc.internal.pageSize.getHeight() - 20),
  )

  addFooter(doc, doc.getNumberOfPages())
  doc.save(`trackifyr-daily-report-${payload.pktDateLabel || 'pkt'}.pdf`)
}

export async function downloadWeeklyPdf(payload) {
  const { jsPDF, autoTable } = await loadPdfLibs()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  let y = 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Trackifyr — Weekly aggregate report', margin, y)
  y += 9
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`User: ${payload.user?.fullName || '—'} · ${payload.user?.email || '—'}`, margin, y)
  y += 6
  doc.text(`Rolling 7 PKT calendar days ending ${payload.pktDateLabel || '—'}`, margin, y)
  y += 6
  doc.text(`Generated: ${payload.generatedAtPkt || '—'}`, margin, y)
  y += 8

  const rows = Array.isArray(payload.weekly?.rows) ? payload.weekly.rows : []
  const pageW = doc.internal.pageSize.getWidth() - 2 * margin
  if (rows.length) {
    doc.setFontSize(9)
    doc.setTextColor(50, 50, 50)
    doc.text('Per PKT day: purple = avg activity %, green = 5-minute windows with data', margin, y)
    y += 5
    drawWeeklyBars(doc, margin, y, pageW, 26, rows)
    y += 34
  }

  const body = rows.map((r) => [
    r.day || '—',
    typeof r.avgActivity === 'number' ? `${r.avgActivity}%` : '—',
    String(r.sessions ?? 0),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Day (PKT)', 'Average activity %', '5-minute windows with data']],
    body: body.length ? body : [['No data in this window', '—', '0']],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [67, 56, 202], textColor: 255 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: margin, right: margin },
  })

  const finalY = doc.lastAutoTable?.finalY ?? y + 50
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text(
    'Average activity is the mean of all ingest samples that fell on that PKT calendar day.',
    margin,
    Math.min(finalY + 10, doc.internal.pageSize.getHeight() - 20),
  )

  addFooter(doc, doc.getNumberOfPages())
  doc.save(`trackifyr-weekly-report-${payload.pktDateLabel || 'pkt'}.pdf`)
}
