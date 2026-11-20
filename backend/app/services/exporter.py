"""
Export Engine — generates CSV, Excel (openpyxl), and PDF (ReportLab) reports.
"""
from __future__ import annotations
import io
import csv
from datetime import datetime
from typing import Optional


def export_csv(readings: list[dict], refill_events: list[dict], kpis: dict) -> bytes:
    """UTF-8 BOM CSV for Excel compatibility."""
    buf = io.StringIO()
    buf.write('﻿')  # BOM

    # KPI Summary section
    writer = csv.writer(buf)
    writer.writerow(["TankWise Export", datetime.utcnow().isoformat()])
    writer.writerow([])
    writer.writerow(["=== KPIs ==="])
    for k, v in kpis.items():
        writer.writerow([k.replace('_', ' ').title(), v])
    writer.writerow([])

    # Readings
    writer.writerow(["=== Readings ==="])
    writer.writerow(["Timestamp", "Level %", "Volume (L)", "Source", "Flags", "Note"])
    for r in readings:
        writer.writerow([
            r.get("timestamp", ""),
            r.get("level_pct", ""),
            r.get("volume_litres", ""),
            r.get("source", ""),
            "|".join(r.get("flags", [])),
            r.get("note", ""),
        ])
    writer.writerow([])

    # Refills
    writer.writerow(["=== Refill Events ==="])
    writer.writerow(["Start", "End", "Vol Before (L)", "Vol After (L)", "Added (L)", "Duration (min)", "Interval (hrs)"])
    for ev in refill_events:
        writer.writerow([
            ev.get("start_ts", ""), ev.get("end_ts", ""),
            ev.get("volume_before_litres", ""), ev.get("volume_after_litres", ""),
            ev.get("volume_added_litres", ""), ev.get("duration_minutes", ""),
            ev.get("interval_since_prev_hours", ""),
        ])

    return buf.getvalue().encode("utf-8-sig")


def export_excel(readings: list[dict], refill_events: list[dict], kpis: dict, daily_totals: dict) -> bytes:
    """Excel workbook with multiple sheets."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, numbers
        from openpyxl.utils import get_column_letter
    except ImportError:
        raise RuntimeError("openpyxl not installed")

    wb = Workbook()

    # -- Sheet 1: Summary --
    ws = wb.active
    ws.title = "Summary"
    header_fill = PatternFill(start_color="0E7490", end_color="0E7490", fill_type="solid")
    bold_white = Font(bold=True, color="FFFFFF")

    ws.append(["TankWise Report", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    ws.append(["Metric", "Value"])
    for cell in ws[3]:
        cell.font = bold_white
        cell.fill = header_fill
    for k, v in kpis.items():
        ws.append([k.replace("_", " ").title(), v])
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 20
    ws.freeze_panes = "A4"

    # -- Sheet 2: Readings --
    ws2 = wb.create_sheet("Readings")
    ws2.append(["Timestamp", "Level %", "Volume (L)", "Source", "Flags", "Note"])
    for cell in ws2[1]:
        cell.font = bold_white
        cell.fill = header_fill
    for r in readings:
        ws2.append([
            str(r.get("timestamp", "")),
            r.get("level_pct"),
            r.get("volume_litres"),
            r.get("source", ""),
            "|".join(r.get("flags", [])),
            r.get("note", ""),
        ])
    ws2.freeze_panes = "A2"
    for col in range(1, 7):
        ws2.column_dimensions[get_column_letter(col)].width = 20

    # -- Sheet 3: Refills --
    ws3 = wb.create_sheet("Refills")
    ws3.append(["Start", "End", "Vol Before (L)", "Vol After (L)", "Added (L)", "Duration (min)", "Interval (hrs)"])
    for cell in ws3[1]:
        cell.font = bold_white
        cell.fill = header_fill
    for ev in refill_events:
        ws3.append([
            str(ev.get("start_ts", "")), str(ev.get("end_ts", "")),
            ev.get("volume_before_litres"), ev.get("volume_after_litres"),
            ev.get("volume_added_litres"), ev.get("duration_minutes"),
            ev.get("interval_since_prev_hours"),
        ])
    ws3.freeze_panes = "A2"

    # -- Sheet 4: Daily Totals --
    ws4 = wb.create_sheet("Daily")
    ws4.append(["Date", "Consumption (L)"])
    for cell in ws4[1]:
        cell.font = bold_white
        cell.fill = header_fill
    for date_str, litres in sorted(daily_totals.items()):
        ws4.append([date_str, round(litres, 2)])
    ws4.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_pdf(
    tank_name: str,
    kpis: dict,
    readings: list[dict],
    refill_events: list[dict],
    anomalies: list[dict],
    daily_totals: dict,
) -> bytes:
    """PDF report using ReportLab Platypus."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                        TableStyle, PageBreak, HRFlowable)
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
    except ImportError:
        raise RuntimeError("reportlab not installed")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    elements = []

    # Cover
    title_style = ParagraphStyle("Title", parent=styles["Title"], textColor=colors.HexColor("#22d3ee"), spaceAfter=12)
    sub_style = ParagraphStyle("Sub", parent=styles["Normal"], textColor=colors.grey, spaceAfter=6)
    elements.append(Spacer(1, 2*cm))
    elements.append(Paragraph("TankWise Report", title_style))
    elements.append(Paragraph(f"Tank: {tank_name}", styles["Heading2"]))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", sub_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#22d3ee")))
    elements.append(Spacer(1, 0.5*cm))

    # KPI Table
    elements.append(Paragraph("Key Performance Indicators", styles["Heading2"]))
    kpi_data = [["Metric", "Value"]] + [[k.replace("_", " ").title(), str(v)] for k, v in kpis.items()]
    kpi_table = Table(kpi_data, colWidths=[10*cm, 6*cm])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0e7490")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0f9ff"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 0.5*cm))

    # Anomalies table
    if anomalies:
        elements.append(Paragraph("Anomalies", styles["Heading2"]))
        anom_data = [["Timestamp", "Type", "Severity", "Message"]]
        for a in anomalies[:20]:
            anom_data.append([
                str(a.get("timestamp", ""))[:19],
                a.get("type", ""),
                a.get("severity", ""),
                a.get("message", "")[:60],
            ])
        anom_table = Table(anom_data, colWidths=[4*cm, 3*cm, 2.5*cm, 7.5*cm])
        sev_colors = {"critical": colors.HexColor("#fee2e2"), "high": colors.HexColor("#ffedd5"),
                      "medium": colors.HexColor("#fef9c3"), "low": colors.HexColor("#f0fdf4")}
        anom_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0e7490")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]
        anom_table.setStyle(TableStyle(anom_style))
        elements.append(anom_table)
        elements.append(Spacer(1, 0.5*cm))

    # Readings summary (last 20)
    elements.append(Paragraph("Recent Readings (last 20)", styles["Heading2"]))
    r_data = [["Timestamp", "Level %", "Volume (L)", "Source"]]
    for r in readings[-20:]:
        r_data.append([
            str(r.get("timestamp", ""))[:19],
            f"{r.get('level_pct', 0):.1f}%",
            f"{r.get('volume_litres', 0):.0f}",
            r.get("source", ""),
        ])
    r_table = Table(r_data, colWidths=[5.5*cm, 3*cm, 3*cm, 2.5*cm])
    r_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0e7490")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f0f9ff"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(r_table)

    doc.build(elements)
    return buf.getvalue()
