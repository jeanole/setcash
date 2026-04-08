const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const db = require("../db");
const DATA_DIR = db.DATA_DIR;
const { ensureProjectAccess } = require("../middleware");
const { getSettings } = require("./helpers");

// PDF Report per user
router.get("/api/report/:email", ensureProjectAccess, async (req, res) => {
  const projectId = req.user.currentProjectId;
  const targetEmail = decodeURIComponent(req.params.email);

  // Only project-admins/owners/super-admins can view other users' reports
  const isAdmin =
    req.user.superAdmin ||
    req.user.currentProjectRole === "admin" ||
    req.user.currentProjectRole === "owner";
  if (!isAdmin && req.user.email.toLowerCase() !== targetEmail.toLowerCase()) {
    return res.status(403).json({ error: "Access denied" });
  }

  const userBills = db
    .prepare(
      "SELECT * FROM bills WHERE LOWER(email) = LOWER(?) AND project_id = ? ORDER BY date",
    )
    .all(targetEmail, projectId);
  const userVGeld = db
    .prepare(
      "SELECT * FROM vgeld WHERE LOWER(to_user) = LOWER(?) AND project_id = ? ORDER BY date",
    )
    .all(targetEmail, projectId);

  if (userBills.length === 0 && userVGeld.length === 0) {
    return res.status(404).json({ error: "No data found for this user" });
  }

  // Look up user's position in this project
  const memberRow = db
    .prepare(
      `
    SELECT COALESCE(pp.name, 'Misc') as position_name
    FROM project_members pm LEFT JOIN project_positions pp ON pp.id = pm.position_id
    WHERE pm.project_id = ? AND LOWER(pm.user_email) = LOWER(?)
  `,
    )
    .get(projectId, targetEmail);
  const userRole = memberRow ? memberRow.position_name : "Misc";

  const pdfSettings = getSettings(projectId);
  const pTitle = pdfSettings.projectTitle || "";
  const pSubtitle = pdfSettings.projectSubtitle || "";
  const pdfPrefix = pTitle ? pTitle + " - " : "vBudget - ";

  const doc = new PDFDocument({ margin: 50, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="report_${targetEmail.split("@")[0]}_${new Date().toISOString().split("T")[0]}.pdf"`,
  );

  doc.pipe(res);

  // Title
  doc
    .fontSize(20)
    .font("Helvetica-Bold")
    .text(`${pdfPrefix}Belegubersicht`, { align: "center" });
  if (pSubtitle) {
    doc.fontSize(12).font("Helvetica").text(pSubtitle, { align: "center" });
  }
  doc.moveDown(0.5);
  doc
    .fontSize(14)
    .font("Helvetica")
    .text(`Benutzer: ${targetEmail} (${userRole})`, { align: "center" });
  doc.fontSize(10).text(`Erstellt: ${new Date().toLocaleDateString("de-DE")}`, {
    align: "center",
  });
  doc.moveDown(1);

  // V-Geld section
  const totalVGeld = userVGeld.reduce((sum, v) => sum + (v.amount || 0), 0);
  doc.fontSize(12).font("Helvetica-Bold").text("V-Geld Zahlungen");
  doc.fontSize(10).font("Helvetica");

  if (userVGeld.length === 0) {
    doc.text("Keine V-Geld Zahlungen vorhanden.");
  } else {
    for (const v of userVGeld) {
      doc.text(
        `${new Date(v.date).toLocaleDateString("de-DE")} - ${(v.amount || 0).toFixed(2)} EUR von ${v.from_user || "Extern"}`,
      );
    }
    doc.moveDown(0.3);
    doc
      .font("Helvetica-Bold")
      .text(`V-Geld Gesamt: ${totalVGeld.toFixed(2)} EUR`);
  }
  doc.moveDown(1);

  // Line separator
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // Bills table
  if (userBills.length > 0) {
    doc.fontSize(12).font("Helvetica-Bold").text("Belegubersicht");
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colX = [50, 75, 125, 190, 250, 295, 340, 385, 430, 475, 515];

    // Table header
    doc.font("Helvetica-Bold").fontSize(6);
    doc.text("Nr.", colX[0], tableTop);
    doc.text("Datum", colX[1], tableTop);
    doc.text("Handler", colX[2], tableTop);
    doc.text("Artikel", colX[3], tableTop);
    doc.text("Br. 19%", colX[4], tableTop);
    doc.text("Br. 7%", colX[5], tableTop);
    doc.text("Br. 0%", colX[6], tableTop);
    doc.text("Brutto", colX[7], tableTop);
    doc.text("Nt. 19%", colX[8], tableTop);
    doc.text("Nt. 7%", colX[9], tableTop);
    doc.text("Netto", colX[10], tableTop);

    // Header underline
    doc
      .moveTo(50, tableTop + 10)
      .lineTo(545, tableTop + 10)
      .stroke();

    // Table rows
    doc.font("Helvetica").fontSize(6);
    let rowY = tableTop + 14;
    for (let i = 0; i < userBills.length; i++) {
      const bill = userBills[i];
      if (rowY > 750) {
        doc.addPage();
        rowY = 50;
      }
      const b19 = bill.brutto19 || 0;
      const b7 = bill.brutto7 || 0;
      const b0 = bill.brutto0 || 0;
      const n19 = b19 / 1.19;
      const n7 = b7 / 1.07;
      const netto = n19 + n7 + b0;
      doc.text(bill.bill_number || String(i + 1), colX[0], rowY, { width: 23 });
      doc.text(new Date(bill.date).toLocaleDateString("de-DE"), colX[1], rowY, {
        width: 48,
      });
      doc.text((bill.vendor || "-").substring(0, 11), colX[2], rowY, {
        width: 63,
      });
      doc.text((bill.item || "-").substring(0, 10), colX[3], rowY, {
        width: 58,
      });
      doc.text(b19.toFixed(2), colX[4], rowY, { width: 43 });
      doc.text(b7.toFixed(2), colX[5], rowY, { width: 43 });
      doc.text(b0.toFixed(2), colX[6], rowY, { width: 43 });
      doc
        .font("Helvetica-Bold")
        .text((b19 + b7 + b0).toFixed(2), colX[7], rowY, { width: 43 });
      doc.font("Helvetica").text(n19.toFixed(2), colX[8], rowY, { width: 43 });
      doc.text(n7.toFixed(2), colX[9], rowY, { width: 38 });
      doc
        .font("Helvetica-Bold")
        .text(netto.toFixed(2), colX[10], rowY, { width: 38 });
      doc.font("Helvetica");
      rowY += 11;
    }
    doc.y = rowY;
    doc.moveDown(1);
  }

  // Line separator
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // Bills Summary
  const totalAmount = userBills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const total19 = userBills.reduce((sum, b) => sum + (b.brutto19 || 0), 0);
  const total7 = userBills.reduce((sum, b) => sum + (b.brutto7 || 0), 0);
  const total0 = userBills.reduce((sum, b) => sum + (b.brutto0 || 0), 0);
  const totalNetto19 = total19 / 1.19;
  const totalNetto7 = total7 / 1.07;
  const totalNetto = totalNetto19 + totalNetto7 + total0;

  const summaryX = 50;
  const bruttoX = 200;
  const nettoX = 320;
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Ausgaben Zusammenfassung", summaryX);
  doc.moveDown(0.5);
  let summaryY = doc.y;

  // Column headers
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("", summaryX, summaryY);
  doc.text("Brutto", bruttoX, summaryY);
  doc.text("Netto", nettoX, summaryY);
  summaryY += 14;

  doc.fontSize(10).font("Helvetica");
  doc.text("Anzahl Belege:", summaryX, summaryY);
  doc.text(String(userBills.length), bruttoX, summaryY);
  summaryY += 14;

  doc.text("Gesamt 19%:", summaryX, summaryY);
  doc.text(`${total19.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.text(`${totalNetto19.toFixed(2)} EUR`, nettoX, summaryY);
  summaryY += 14;

  doc.text("Gesamt 7%:", summaryX, summaryY);
  doc.text(`${total7.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.text(`${totalNetto7.toFixed(2)} EUR`, nettoX, summaryY);
  summaryY += 14;

  doc.text("Gesamt 0%:", summaryX, summaryY);
  doc.text(`${total0.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.text(`${total0.toFixed(2)} EUR`, nettoX, summaryY);
  summaryY += 14;

  doc.moveTo(summaryX, summaryY).lineTo(420, summaryY).stroke();
  summaryY += 6;

  doc.font("Helvetica-Bold");
  doc.text("Ausgaben Gesamt:", summaryX, summaryY);
  doc.text(`${totalAmount.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.text(`${totalNetto.toFixed(2)} EUR`, nettoX, summaryY);
  summaryY += 14;

  doc.text("V-Geld Gesamt:", summaryX, summaryY);
  doc.text(`${totalVGeld.toFixed(2)} EUR`, bruttoX, summaryY);
  summaryY += 14;

  // Balance (brutto)
  const balance = totalVGeld - totalAmount;
  doc.fillColor(balance >= 0 ? "green" : "red");
  doc.text("Saldo (brutto):", summaryX, summaryY);
  doc.text(`${balance.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.fillColor("black");

  doc.y = summaryY + 20;

  // New page for bills
  if (userBills.length > 0) {
    doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").text("Belege", 50);
    doc.moveDown(1);
  }

  // Bulk-fetch allocations for all user bills
  const billIds = userBills.map((b) => b.id);
  const pdfMotiveAllocs = {};
  const pdfCategoryAllocs = {};
  if (billIds.length > 0) {
    const ph = billIds.map(() => "?").join(",");
    const ma = db
      .prepare(
        `SELECT bm.bill_id, m.name, bm.percentage FROM bill_motives bm JOIN motives m ON m.id = bm.motive_id WHERE bm.bill_id IN (${ph})`,
      )
      .all(...billIds);
    for (const a of ma) {
      if (!pdfMotiveAllocs[a.bill_id]) pdfMotiveAllocs[a.bill_id] = [];
      pdfMotiveAllocs[a.bill_id].push(a);
    }
    const ca = db
      .prepare(
        `SELECT bc.bill_id, c.name, bc.percentage FROM bill_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.bill_id IN (${ph})`,
      )
      .all(...billIds);
    for (const a of ca) {
      if (!pdfCategoryAllocs[a.bill_id]) pdfCategoryAllocs[a.bill_id] = [];
      pdfCategoryAllocs[a.bill_id].push(a);
    }
  }

  // Each bill
  for (let i = 0; i < userBills.length; i++) {
    const bill = userBills[i];

    // Bill header
    doc.fontSize(12).font("Helvetica-Bold");
    doc.text(`Beleg ${bill.bill_number || i + 1}`, { continued: true });
    doc
      .font("Helvetica")
      .text(` - ${new Date(bill.date).toLocaleDateString("de-DE")}`);

    // Motive allocations display
    const billMotives = pdfMotiveAllocs[bill.id] || [];
    let motiveStr = bill.motive || "-";
    if (billMotives.length > 0) {
      motiveStr =
        billMotives.length === 1 && billMotives[0].percentage === 100
          ? billMotives[0].name
          : billMotives.map((a) => `${a.name} (${a.percentage}%)`).join(", ");
    }

    // Category allocations display
    const billCategories = pdfCategoryAllocs[bill.id] || [];
    let categoryStr = "";
    if (billCategories.length > 0) {
      categoryStr =
        billCategories.length === 1 && billCategories[0].percentage === 100
          ? billCategories[0].name
          : billCategories
              .map((a) => `${a.name} (${a.percentage}%)`)
              .join(", ");
    }

    doc.fontSize(10).font("Helvetica");
    doc.text(`Typ: ${bill.type || "Kauf"} | Motiv: ${motiveStr}`);
    if (categoryStr) {
      doc.text(`Kategorie: ${categoryStr}`);
    }
    doc.text(`Handler: ${bill.vendor || "-"} | Artikel: ${bill.item || "-"}`);

    // Amounts (brutto + netto)
    const b19 = bill.brutto19 || 0;
    const b7 = bill.brutto7 || 0;
    const b0 = bill.brutto0 || 0;
    const n19 = b19 / 1.19;
    const n7 = b7 / 1.07;
    const billNetto = n19 + n7 + b0;
    const bruttoAmounts = [];
    if (b19) bruttoAmounts.push(`19%: ${b19.toFixed(2)}`);
    if (b7) bruttoAmounts.push(`7%: ${b7.toFixed(2)}`);
    if (b0) bruttoAmounts.push(`0%: ${b0.toFixed(2)}`);
    doc.text(
      `Brutto: ${bruttoAmounts.join(" | ") || "-"} | Gesamt: ${(b19 + b7 + b0).toFixed(2)} EUR`,
    );
    const nettoAmounts = [];
    if (b19) nettoAmounts.push(`19%: ${n19.toFixed(2)}`);
    if (b7) nettoAmounts.push(`7%: ${n7.toFixed(2)}`);
    if (b0) nettoAmounts.push(`0%: ${b0.toFixed(2)}`);
    doc.text(
      `Netto:  ${nettoAmounts.join(" | ") || "-"} | Gesamt: ${billNetto.toFixed(2)} EUR`,
    );

    if (bill.comment) {
      doc.text(`Notiz: ${bill.comment}`);
    }
    doc.moveDown(0.5);

    // Images from bill_images table
    const billImages = db
      .prepare(
        "SELECT * FROM bill_images WHERE bill_id = ? ORDER BY sort_order, id",
      )
      .all(bill.id);
    if (billImages.length > 0) {
      for (let imgIdx = 0; imgIdx < billImages.length; imgIdx++) {
        const img = billImages[imgIdx];
        if (!img.file) continue;
        const imagePath = path.join(DATA_DIR, "uploads", img.file);
        if (fs.existsSync(imagePath)) {
          try {
            const ext = path.extname(imagePath).toLowerCase();
            if ([".jpg", ".jpeg", ".png"].includes(ext)) {
              if (doc.y > 450) {
                doc.addPage();
              }
              if (billImages.length > 1) {
                doc
                  .fontSize(8)
                  .fillColor("gray")
                  .text(`Bild ${imgIdx + 1} / ${billImages.length}`);
                doc.fillColor("black");
              }
              const maxWidth = 400;
              const maxHeight = 300;
              doc.image(imagePath, {
                fit: [maxWidth, maxHeight],
                align: "center",
              });
              doc.moveDown(0.5);
            } else {
              doc
                .fontSize(9)
                .fillColor("gray")
                .text(`[Bild: ${img.file} - Format nicht unterstutzt]`);
              doc.fillColor("black");
            }
          } catch (imgErr) {
            console.error("PDF image error:", imgErr.message);
            doc
              .fontSize(9)
              .fillColor("gray")
              .text(`[Bild konnte nicht geladen werden: ${img.file}]`);
            doc.fillColor("black");
          }
        } else {
          doc
            .fontSize(9)
            .fillColor("gray")
            .text(`[Bild nicht gefunden: ${img.file}]`);
          doc.fillColor("black");
        }
      }
    } else if (bill.file) {
      // Fallback to legacy column
      const imagePath = path.join(DATA_DIR, "uploads", bill.file);
      if (fs.existsSync(imagePath)) {
        try {
          const ext = path.extname(imagePath).toLowerCase();
          if ([".jpg", ".jpeg", ".png"].includes(ext)) {
            if (doc.y > 450) {
              doc.addPage();
            }
            doc.image(imagePath, { fit: [400, 300], align: "center" });
            doc.moveDown(0.5);
          }
        } catch (imgErr) {
          console.error("PDF image error:", imgErr.message);
        }
      }
    }

    // New page after each bill (except the last)
    if (i < userBills.length - 1) {
      doc.addPage();
    }
  }

  doc.end();
});

// List users for report dropdown (project-admins/super-admins see all, users see only themselves)
router.get("/api/report-users", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const isAdmin =
    req.user.superAdmin ||
    req.user.currentProjectRole === "admin" ||
    req.user.currentProjectRole === "owner";
  if (isAdmin) {
    // Admins see all project members who have bills
    const usersWithBills = db
      .prepare(
        `
      SELECT DISTINCT b.email, COALESCE(pp.name, 'Misc') as role_name
      FROM bills b
      LEFT JOIN project_members pm ON LOWER(pm.user_email) = LOWER(b.email) AND pm.project_id = b.project_id
      LEFT JOIN project_positions pp ON pp.id = pm.position_id
      WHERE b.project_id = ?
      ORDER BY b.email
    `,
      )
      .all(projectId);
    res.json(
      usersWithBills.map((u) => ({ email: u.email, roleName: u.role_name })),
    );
  } else {
    // Look up position name for current user
    const pm = db
      .prepare(
        `SELECT COALESCE(pp.name, 'Misc') as position_name
         FROM project_members pm
         LEFT JOIN project_positions pp ON pp.id = pm.position_id
         WHERE pm.project_id = ? AND LOWER(pm.user_email) = LOWER(?)`,
      )
      .get(projectId, req.user.email);
    res.json([
      { email: req.user.email, roleName: pm ? pm.position_name : "Misc" },
    ]);
  }
});

// Budget Matrix PDF Report
router.get("/api/budget-report", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const motives = db
    .prepare(
      "SELECT id, name FROM motives WHERE project_id = ? ORDER BY CASE WHEN name = 'Default' THEN 1 ELSE 0 END, id",
    )
    .all(projectId);
  const categories = db
    .prepare(
      "SELECT id, name FROM categories WHERE project_id = ? ORDER BY CASE WHEN name = 'Uncategorized' THEN 1 ELSE 0 END, id",
    )
    .all(projectId);
  const rows = db
    .prepare(
      "SELECT motive_id, category_id, amount FROM budget_matrix WHERE project_id = ?",
    )
    .all(projectId);

  const matrix = {};
  let grandTotal = 0;
  for (const r of rows) {
    matrix[r.category_id + "_" + r.motive_id] = r.amount;
    grandTotal += r.amount || 0;
  }

  const motiveSpending = {};
  db.prepare(
    `
    SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
    FROM bill_motives bm JOIN bills b ON b.id = bm.bill_id
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    GROUP BY bm.motive_id
  `,
  )
    .all(projectId)
    .forEach((r) => {
      motiveSpending[r.motive_id] = r.spent || 0;
    });

  const categorySpending = {};
  db.prepare(
    `
    SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
    FROM bill_categories bc JOIN bills b ON b.id = bc.bill_id
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    GROUP BY bc.category_id
  `,
  )
    .all(projectId)
    .forEach((r) => {
      categorySpending[r.category_id] = r.spent || 0;
    });

  const eur = (v) => (v || 0).toFixed(2).replace(".", ",") + " €";

  const bmSettings = getSettings(projectId);
  const bmTitle = bmSettings.projectTitle || "";
  const bmSubtitle = bmSettings.projectSubtitle || "";
  const bmPrefix = bmTitle ? bmTitle + " - " : "vBudget - ";

  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="budget_matrix_${new Date().toISOString().split("T")[0]}.pdf"`,
  );
  doc.pipe(res);

  // Title
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .text(`${bmPrefix}Budget Matrix (netto)`, { align: "center" });
  if (bmSubtitle) {
    doc.fontSize(10).font("Helvetica").text(bmSubtitle, { align: "center" });
  }
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Erstellt: ${new Date().toLocaleDateString("de-DE")}`, {
      align: "center",
    });
  doc.moveDown(1);

  // Table layout
  const leftMargin = 40;
  const rowHeaderWidth = 110;
  const cellWidth =
    motives.length > 0
      ? Math.min(
          100,
          (doc.page.width - 80 - rowHeaderWidth - 100 - 100) / motives.length,
        )
      : 80;
  const totalColWidth = 80;
  const spentColWidth = 80;
  const rowHeight = 18;
  const headerHeight = 22;

  let x = leftMargin;
  let y = doc.y;

  // --- Header row ---
  doc.fontSize(7).font("Helvetica-Bold");

  // Corner cell
  doc.rect(x, y, rowHeaderWidth, headerHeight).fillAndStroke("#2c3e50", "#999");
  doc
    .fillColor("#fff")
    .text("Kategorie \\ Motiv", x + 4, y + 6, { width: rowHeaderWidth - 8 });
  x += rowHeaderWidth;

  // Motive column headers
  for (const m of motives) {
    doc.rect(x, y, cellWidth, headerHeight).fillAndStroke("#34495e", "#999");
    doc
      .fillColor("#fff")
      .text(m.name, x + 3, y + 6, { width: cellWidth - 6, ellipsis: true });
    x += cellWidth;
  }

  // Budget total header
  doc.rect(x, y, totalColWidth, headerHeight).fillAndStroke("#ecf0f1", "#999");
  doc
    .fillColor("#2c3e50")
    .text("Budget (netto)", x + 3, y + 6, { width: totalColWidth - 6 });
  x += totalColWidth;

  // Spent total header
  doc.rect(x, y, spentColWidth, headerHeight).fillAndStroke("#ecf0f1", "#999");
  doc
    .fillColor("#5b6b7a")
    .text("Ausgaben (netto)", x + 3, y + 6, { width: spentColWidth - 6 });

  y += headerHeight;

  // --- Data rows ---
  doc.font("Helvetica").fontSize(7);

  for (const cat of categories) {
    x = leftMargin;

    // Row header
    doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke("#f0f3f6", "#ccc");
    doc
      .fillColor("#2c3e50")
      .font("Helvetica-Bold")
      .text(cat.name, x + 4, y + 5, {
        width: rowHeaderWidth - 8,
        ellipsis: true,
      });
    x += rowHeaderWidth;

    // Cell values
    let rowBudget = 0;
    doc.font("Helvetica");
    for (const m of motives) {
      const val = matrix[cat.id + "_" + m.id] || 0;
      rowBudget += val;

      // Cell background color based on value
      let bgColor = "#fff";
      if (val > 0) bgColor = "#f9fff9";

      doc.rect(x, y, cellWidth, rowHeight).fillAndStroke(bgColor, "#ddd");
      doc
        .fillColor("#333")
        .text(eur(val), x + 2, y + 5, { width: cellWidth - 4, align: "right" });
      x += cellWidth;
    }

    // Row budget total
    doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke("#f7f9fb", "#ccc");
    doc
      .fillColor("#2c3e50")
      .font("Helvetica-Bold")
      .text(eur(rowBudget), x + 2, y + 5, {
        width: totalColWidth - 4,
        align: "right",
      });
    x += totalColWidth;

    // Row spent
    const catSpent = categorySpending[cat.id] || 0;
    const spentPct = rowBudget > 0 ? catSpent / rowBudget : 0;
    let spentBg = "#f7f9fb";
    let spentColor = "#27ae60";
    if (spentPct >= 1) {
      spentBg = "#fdedec";
      spentColor = "#e74c3c";
    } else if (spentPct >= 0.8) {
      spentBg = "#fef9e7";
      spentColor = "#e67e22";
    }

    doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke(spentBg, "#ccc");
    doc
      .fillColor(spentColor)
      .font("Helvetica-Bold")
      .text(eur(catSpent), x + 2, y + 5, {
        width: spentColWidth - 4,
        align: "right",
      });

    y += rowHeight;

    // Page break if needed
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 40;
    }
  }

  // --- Footer: Budget totals ---
  x = leftMargin;
  doc.font("Helvetica-Bold").fontSize(7);

  doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke("#ecf0f1", "#999");
  doc
    .fillColor("#2c3e50")
    .text("Budget (netto)", x + 4, y + 5, { width: rowHeaderWidth - 8 });
  x += rowHeaderWidth;

  let footerGrand = 0;
  for (const m of motives) {
    let colTotal = 0;
    for (const cat of categories) {
      colTotal += matrix[cat.id + "_" + m.id] || 0;
    }
    footerGrand += colTotal;

    doc.rect(x, y, cellWidth, rowHeight).fillAndStroke("#ecf0f1", "#999");
    doc.fillColor("#2c3e50").text(eur(colTotal), x + 2, y + 5, {
      width: cellWidth - 4,
      align: "right",
    });
    x += cellWidth;
  }

  // Grand total cell
  doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke("#dce3ea", "#999");
  doc.fillColor("#2c3e50").text(eur(footerGrand), x + 2, y + 5, {
    width: totalColWidth - 4,
    align: "right",
  });
  x += totalColWidth;

  // Empty spent cell in budget footer
  doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke("#ecf0f1", "#999");

  y += rowHeight;

  // --- Footer: Spent totals ---
  x = leftMargin;

  doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke("#ecf0f1", "#999");
  doc
    .fillColor("#5b6b7a")
    .text("Ausgaben (netto)", x + 4, y + 5, { width: rowHeaderWidth - 8 });
  x += rowHeaderWidth;

  let footerSpentGrand = 0;
  for (const m of motives) {
    const motSpent = motiveSpending[m.id] || 0;
    footerSpentGrand += motSpent;

    let colBudget = 0;
    for (const cat of categories) {
      colBudget += matrix[cat.id + "_" + m.id] || 0;
    }

    const pct = colBudget > 0 ? motSpent / colBudget : 0;
    let bg = "#ecf0f1";
    let clr = "#27ae60";
    if (pct >= 1) {
      bg = "#fdedec";
      clr = "#e74c3c";
    } else if (pct >= 0.8) {
      bg = "#fef9e7";
      clr = "#e67e22";
    }

    doc.rect(x, y, cellWidth, rowHeight).fillAndStroke(bg, "#999");
    doc.fillColor(clr).text(eur(motSpent), x + 2, y + 5, {
      width: cellWidth - 4,
      align: "right",
    });
    x += cellWidth;
  }

  // Empty budget cell in spent footer
  doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke("#ecf0f1", "#999");
  x += totalColWidth;

  // Grand spent total
  const grandPct = footerGrand > 0 ? footerSpentGrand / footerGrand : 0;
  let grandBg = "#dce3ea";
  let grandClr = "#27ae60";
  if (grandPct >= 1) {
    grandBg = "#fdedec";
    grandClr = "#e74c3c";
  } else if (grandPct >= 0.8) {
    grandBg = "#fef9e7";
    grandClr = "#e67e22";
  }

  doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke(grandBg, "#999");
  doc.fillColor(grandClr).text(eur(footerSpentGrand), x + 2, y + 5, {
    width: spentColWidth - 4,
    align: "right",
  });

  y += rowHeight + 20;

  // Summary section
  doc.fillColor("#000");
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Zusammenfassung", leftMargin, y);
  y += 18;
  doc.fontSize(10).font("Helvetica");
  doc.text(`Total Budget (netto): ${eur(footerGrand)}`, leftMargin, y);
  y += 15;
  doc.text(`Total Ausgaben (netto): ${eur(footerSpentGrand)}`, leftMargin, y);
  y += 15;
  const remaining = footerGrand - footerSpentGrand;
  doc.fillColor(remaining >= 0 ? "#27ae60" : "#e74c3c");
  doc
    .font("Helvetica-Bold")
    .text(`Verbleibend: ${eur(remaining)}`, leftMargin, y);
  y += 15;
  const usedPct =
    footerGrand > 0
      ? ((footerSpentGrand / footerGrand) * 100).toFixed(1)
      : "0.0";
  doc.text(`Verbraucht: ${usedPct}%`, leftMargin, y);

  doc.end();
});

module.exports = router;
