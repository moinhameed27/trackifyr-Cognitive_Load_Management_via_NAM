'use client'

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

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

export function downloadDailyPdf(payload) {
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
  y += 10

  const rows = Array.isArray(payload.daily?.rows) ? payload.daily.rows : []
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

export function downloadWeeklyPdf(payload) {
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
  y += 10

  const rows = Array.isArray(payload.weekly?.rows) ? payload.weekly.rows : []
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
