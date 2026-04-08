const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const archiver = require("archiver");
const db = require("../db");
const DATA_DIR = db.DATA_DIR;
const { ensureProjectAdmin } = require("../middleware");
const { getSettings } = require("./helpers");

// Excel export: bills, vgeld, budget matrix
router.get("/api/admin/export/excel", ensureProjectAdmin, async (req, res) => {
  const projectId = req.user.currentProjectId;
  try {
    const workbook = new ExcelJS.Workbook();
    const settings = getSettings(projectId);
    const projectName = settings.projectTitle || "vBudget";

    // --- Bills sheet ---
    const billsSheet = workbook.addWorksheet("Bills");
    const bills = db
      .prepare("SELECT * FROM bills WHERE project_id = ? ORDER BY id")
      .all(projectId);
    const allMotiveAllocs = db
      .prepare(
        `
      SELECT bm.bill_id, m.name, bm.percentage
      FROM bill_motives bm JOIN motives m ON m.id = bm.motive_id
      JOIN bills b ON b.id = bm.bill_id WHERE b.project_id = ?
      ORDER BY bm.bill_id, bm.id
    `,
      )
      .all(projectId);
    const allCategoryAllocs = db
      .prepare(
        `
      SELECT bc.bill_id, c.name, bc.percentage
      FROM bill_categories bc JOIN categories c ON c.id = bc.category_id
      JOIN bills b ON b.id = bc.bill_id WHERE b.project_id = ?
      ORDER BY bc.bill_id, bc.id
    `,
      )
      .all(projectId);

    const motivesByBill = {};
    for (const a of allMotiveAllocs) {
      if (!motivesByBill[a.bill_id]) motivesByBill[a.bill_id] = [];
      motivesByBill[a.bill_id].push(a);
    }
    const categoriesByBill = {};
    for (const a of allCategoryAllocs) {
      if (!categoriesByBill[a.bill_id]) categoriesByBill[a.bill_id] = [];
      categoriesByBill[a.bill_id].push(a);
    }

    billsSheet.columns = [
      { header: "ID", key: "id", width: 6 },
      { header: "Nr.", key: "bill_number", width: 10 },
      { header: "Date", key: "date", width: 18 },
      { header: "Email", key: "email", width: 24 },
      { header: "Type", key: "type", width: 10 },
      { header: "Vendor", key: "vendor", width: 20 },
      { header: "Item", key: "item", width: 24 },
      { header: "Comment", key: "comment", width: 24 },
      { header: "Brutto 19%", key: "brutto19", width: 14 },
      { header: "Brutto 7%", key: "brutto7", width: 14 },
      { header: "Brutto 0%", key: "brutto0", width: 14 },
      { header: "Brutto Total", key: "brutto_total", width: 14 },
      { header: "Netto", key: "netto", width: 14 },
      { header: "Motives", key: "motives", width: 30 },
      { header: "Categories", key: "categories", width: 30 },
    ];

    // Style header row
    billsSheet.getRow(1).font = { bold: true };
    billsSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2C3E50" },
    };
    billsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    for (const bill of bills) {
      const b19 = bill.brutto19 || 0;
      const b7 = bill.brutto7 || 0;
      const b0 = bill.brutto0 || 0;
      const total = b19 + b7 + b0 || bill.amount || 0;
      const netto = bill.netto_amount || b19 / 1.19 + b7 / 1.07 + b0;

      const motiveAllocs = motivesByBill[bill.id] || [];
      const motiveStr =
        motiveAllocs
          .map((a) =>
            motiveAllocs.length === 1 && a.percentage === 100
              ? a.name
              : `${a.name} (${Math.round(a.percentage)}%)`,
          )
          .join(", ") ||
        bill.motive ||
        "";
      const categoryAllocs = categoriesByBill[bill.id] || [];
      const categoryStr = categoryAllocs
        .map((a) =>
          categoryAllocs.length === 1 && a.percentage === 100
            ? a.name
            : `${a.name} (${Math.round(a.percentage)}%)`,
        )
        .join(", ");

      billsSheet.addRow({
        id: bill.id,
        bill_number: bill.bill_number || "",
        date: bill.date ? new Date(bill.date) : "",
        email: bill.email,
        type: bill.type || "Kauf",
        vendor: bill.vendor || "",
        item: bill.item || "",
        comment: bill.comment || "",
        brutto19: b19,
        brutto7: b7,
        brutto0: b0,
        brutto_total: total,
        netto: netto,
        motives: motiveStr,
        categories: categoryStr,
      });
    }

    // Format currency columns
    ["brutto19", "brutto7", "brutto0", "brutto_total", "netto"].forEach(
      (key) => {
        const col = billsSheet.getColumn(key);
        col.numFmt = "#,##0.00 €";
      },
    );
    // Format date column
    billsSheet.getColumn("date").numFmt = "DD.MM.YYYY HH:MM";

    // --- VGeld sheet ---
    const vgeldSheet = workbook.addWorksheet("V-Geld");
    const vgeld = db
      .prepare("SELECT * FROM vgeld WHERE project_id = ? ORDER BY id")
      .all(projectId);

    vgeldSheet.columns = [
      { header: "ID", key: "id", width: 6 },
      { header: "Date", key: "date", width: 18 },
      { header: "Amount", key: "amount", width: 14 },
      { header: "From", key: "from_user", width: 24 },
      { header: "To", key: "to_user", width: 24 },
      { header: "Created By", key: "created_by", width: 24 },
    ];

    vgeldSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2C3E50" },
    };
    vgeldSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    for (const v of vgeld) {
      vgeldSheet.addRow({
        id: v.id,
        date: v.date ? new Date(v.date) : "",
        amount: v.amount || 0,
        from_user: v.from_user || "",
        to_user: v.to_user,
        created_by: v.created_by || "",
      });
    }
    vgeldSheet.getColumn("amount").numFmt = "#,##0.00 €";
    vgeldSheet.getColumn("date").numFmt = "DD.MM.YYYY HH:MM";

    // --- Budget Matrix sheet ---
    const bmSheet = workbook.addWorksheet("Budget Matrix");
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
    const matrixRows = db
      .prepare(
        "SELECT motive_id, category_id, amount FROM budget_matrix WHERE project_id = ?",
      )
      .all(projectId);
    const matrix = {};
    for (const r of matrixRows) {
      matrix[r.category_id + "_" + r.motive_id] = r.amount;
    }

    // Spending data (exclude drafts)
    const motiveSpending = {};
    db.prepare(
      `SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
       FROM bill_motives bm
       JOIN bills b ON b.id = bm.bill_id
       WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
       GROUP BY bm.motive_id`,
    )
      .all(projectId)
      .forEach((r) => {
        motiveSpending[r.motive_id] = r.spent || 0;
      });
    const categorySpending = {};
    db.prepare(
      `SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
       FROM bill_categories bc
       JOIN bills b ON b.id = bc.bill_id
       WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
       GROUP BY bc.category_id`,
    )
      .all(projectId)
      .forEach((r) => {
        categorySpending[r.category_id] = r.spent || 0;
      });

    // Header row: corner + motive names + Total Budget + Spent
    const bmHeaders = [
      "Category \\ Motive",
      ...motives.map((m) => m.name),
      "Total Budget",
      "Spent",
    ];
    bmSheet.addRow(bmHeaders);
    const bmHeaderRow = bmSheet.getRow(1);
    bmHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2C3E50" },
    };
    bmHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

    // Data rows per category
    for (const cat of categories) {
      const rowData = [cat.name];
      let rowTotal = 0;
      for (const mot of motives) {
        const val = matrix[cat.id + "_" + mot.id] || 0;
        rowData.push(val);
        rowTotal += val;
      }
      rowData.push(rowTotal);
      rowData.push(categorySpending[cat.id] || 0);
      bmSheet.addRow(rowData);
    }

    // Totals row
    const totalRowData = ["Total"];
    let grandTotal = 0;
    let grandSpent = 0;
    for (const mot of motives) {
      let colTotal = 0;
      for (const cat of categories) {
        colTotal += matrix[cat.id + "_" + mot.id] || 0;
      }
      totalRowData.push(colTotal);
      grandTotal += colTotal;
    }
    totalRowData.push(grandTotal);
    for (const cat of categories) grandSpent += categorySpending[cat.id] || 0;
    totalRowData.push(grandSpent);
    bmSheet.addRow(totalRowData);

    // Spent row (per motive)
    const spentRowData = ["Spent"];
    for (const mot of motives) {
      spentRowData.push(motiveSpending[mot.id] || 0);
    }
    spentRowData.push(grandSpent);
    spentRowData.push("");
    bmSheet.addRow(spentRowData);

    // Style totals/spent rows
    const totalRow = bmSheet.getRow(categories.length + 2);
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFECF0F1" },
    };
    const spentRow = bmSheet.getRow(categories.length + 3);
    spentRow.font = { bold: true };

    // Format number columns as currency
    for (let c = 2; c <= motives.length + 3; c++) {
      bmSheet.getColumn(c).numFmt = "#,##0.00 €";
      bmSheet.getColumn(c).width = 14;
    }
    bmSheet.getColumn(1).width = 20;

    // Write response
    const dateStr = new Date().toISOString().split("T")[0];
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_export_${dateStr}.xlsx"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

// Images backup: zip of all bill images in folder structure
router.get("/api/admin/export/images", ensureProjectAdmin, (req, res) => {
  try {
    const projectId = req.user.currentProjectId;
    const images = db
      .prepare(
        `
      SELECT bi.bill_id, bi.filename, bi.file, bi.sort_order,
             b.bill_number, b.vendor, b.email, b.date, b.project_id
      FROM bill_images bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE b.project_id = ?
      ORDER BY b.email, bi.bill_id, bi.sort_order, bi.id
    `,
      )
      .all(projectId);

    if (images.length === 0) {
      return res.status(404).json({ error: "No images to export" });
    }

    const settings = getSettings(projectId);
    const projectName = settings.projectTitle || "vBudget";
    const dateStr = new Date().toISOString().split("T")[0];
    const zipName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_images_${dateStr}.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);

    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", (err) => {
      throw err;
    });
    archive.pipe(res);

    // Count images per bill to know when to append _nn suffixes
    const billImageCounts = {};
    for (const img of images) {
      billImageCounts[img.bill_id] = (billImageCounts[img.bill_id] || 0) + 1;
    }

    const billImageIndex = {};
    for (const img of images) {
      const filePath = path.join(DATA_DIR, "uploads", img.file);
      if (fs.existsSync(filePath)) {
        const username = (img.email || "unknown")
          .split("@")[0]
          .replace(/[^a-zA-Z0-9_\-]/g, "");
        const billNum = img.bill_number || String(img.bill_id);
        const d = new Date(img.date || 0);
        const date =
          String(d.getFullYear()).slice(2) +
          String(d.getMonth() + 1).padStart(2, "0") +
          String(d.getDate()).padStart(2, "0");
        const vendor = (img.vendor || "unknown")
          .replace(/[^a-zA-Z0-9_\- ]/g, "")
          .trim()
          .replace(/ /g, "-");
        const ext = path.extname(img.filename || img.file) || ".jpg";
        let fileName = `${username}_${billNum}_${date}_${vendor}`;
        if (billImageCounts[img.bill_id] > 1) {
          billImageIndex[img.bill_id] = (billImageIndex[img.bill_id] || 0) + 1;
          fileName += `_${String(billImageIndex[img.bill_id]).padStart(2, "0")}`;
        }
        fileName += ext;
        archive.file(filePath, { name: `${username}/${fileName}` });
      }
    }

    archive.finalize();
  } catch (err) {
    console.error("Image export error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

// Google Sheet export (create or update persistent sheet)
router.post(
  "/api/admin/export/google-sheet",
  ensureProjectAdmin,
  async (req, res) => {
    const projectId = req.user.currentProjectId;
    const { getSheets } = require("../google");
    const sheets = getSheets();

    if (!sheets) {
      return res.status(400).json({
        error:
          "Google services not configured. Please add service account credentials first.",
      });
    }
    try {
      const settings = getSettings(projectId);

      // --- Gather data (same as Excel export) ---
      const bills = db
        .prepare("SELECT * FROM bills WHERE project_id = ? ORDER BY id")
        .all(projectId);
      const allMotiveAllocs = db
        .prepare(
          `
      SELECT bm.bill_id, m.name, bm.percentage
      FROM bill_motives bm JOIN motives m ON m.id = bm.motive_id
      JOIN bills b ON b.id = bm.bill_id WHERE b.project_id = ?
      ORDER BY bm.bill_id, bm.id
    `,
        )
        .all(projectId);
      const allCategoryAllocs = db
        .prepare(
          `
      SELECT bc.bill_id, c.name, bc.percentage
      FROM bill_categories bc JOIN categories c ON c.id = bc.category_id
      JOIN bills b ON b.id = bc.bill_id WHERE b.project_id = ?
      ORDER BY bc.bill_id, bc.id
    `,
        )
        .all(projectId);

      const motivesByBill = {};
      for (const a of allMotiveAllocs) {
        if (!motivesByBill[a.bill_id]) motivesByBill[a.bill_id] = [];
        motivesByBill[a.bill_id].push(a);
      }
      const categoriesByBill = {};
      for (const a of allCategoryAllocs) {
        if (!categoriesByBill[a.bill_id]) categoriesByBill[a.bill_id] = [];
        categoriesByBill[a.bill_id].push(a);
      }

      const vgeld = db
        .prepare("SELECT * FROM vgeld WHERE project_id = ? ORDER BY id")
        .all(projectId);

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
      const matrixRows = db
        .prepare(
          "SELECT motive_id, category_id, amount FROM budget_matrix WHERE project_id = ?",
        )
        .all(projectId);
      const matrix = {};
      for (const r of matrixRows) {
        matrix[r.category_id + "_" + r.motive_id] = r.amount;
      }
      const motiveSpending = {};
      db.prepare(
        `SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
         FROM bill_motives bm
         JOIN bills b ON b.id = bm.bill_id
         WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
         GROUP BY bm.motive_id`,
      )
        .all(projectId)
        .forEach((r) => {
          motiveSpending[r.motive_id] = r.spent || 0;
        });
      const categorySpending = {};
      db.prepare(
        `SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
         FROM bill_categories bc
         JOIN bills b ON b.id = bc.bill_id
         WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
         GROUP BY bc.category_id`,
      )
        .all(projectId)
        .forEach((r) => {
          categorySpending[r.category_id] = r.spent || 0;
        });

      // --- Build sheet data arrays ---
      // Bills
      const billsHeaders = [
        "ID",
        "Nr.",
        "Date",
        "Email",
        "Type",
        "Vendor",
        "Item",
        "Comment",
        "Brutto 19%",
        "Brutto 7%",
        "Brutto 0%",
        "Brutto Total",
        "Netto",
        "Motives",
        "Categories",
      ];
      const billsData = [billsHeaders];
      for (const bill of bills) {
        const b19 = bill.brutto19 || 0;
        const b7 = bill.brutto7 || 0;
        const b0 = bill.brutto0 || 0;
        const total = b19 + b7 + b0 || bill.amount || 0;
        const netto = bill.netto_amount || b19 / 1.19 + b7 / 1.07 + b0;
        const motiveAllocs = motivesByBill[bill.id] || [];
        const motiveStr =
          motiveAllocs
            .map((a) =>
              motiveAllocs.length === 1 && a.percentage === 100
                ? a.name
                : `${a.name} (${Math.round(a.percentage)}%)`,
            )
            .join(", ") ||
          bill.motive ||
          "";
        const categoryAllocs = categoriesByBill[bill.id] || [];
        const categoryStr = categoryAllocs
          .map((a) =>
            categoryAllocs.length === 1 && a.percentage === 100
              ? a.name
              : `${a.name} (${Math.round(a.percentage)}%)`,
          )
          .join(", ");
        const dateStr = bill.date
          ? new Date(bill.date).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        billsData.push([
          bill.id,
          bill.bill_number || "",
          dateStr,
          bill.email,
          bill.type || "Kauf",
          bill.vendor || "",
          bill.item || "",
          bill.comment || "",
          b19,
          b7,
          b0,
          total,
          netto,
          motiveStr,
          categoryStr,
        ]);
      }

      // V-Geld
      const vgeldHeaders = ["ID", "Date", "Amount", "From", "To", "Created By"];
      const vgeldData = [vgeldHeaders];
      for (const v of vgeld) {
        const dateStr = v.date
          ? new Date(v.date).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        vgeldData.push([
          v.id,
          dateStr,
          v.amount || 0,
          v.from_user || "",
          v.to_user,
          v.created_by || "",
        ]);
      }

      // Budget Matrix
      const bmHeaders = [
        "Category \\ Motive",
        ...motives.map((m) => m.name),
        "Total Budget",
        "Spent",
      ];
      const bmData = [bmHeaders];
      for (const cat of categories) {
        const rowData = [cat.name];
        let rowTotal = 0;
        for (const mot of motives) {
          const val = matrix[cat.id + "_" + mot.id] || 0;
          rowData.push(val);
          rowTotal += val;
        }
        rowData.push(rowTotal);
        rowData.push(categorySpending[cat.id] || 0);
        bmData.push(rowData);
      }
      // Totals row
      const totalRowData = ["Total"];
      let grandTotal = 0;
      let grandSpent = 0;
      for (const mot of motives) {
        let colTotal = 0;
        for (const cat of categories)
          colTotal += matrix[cat.id + "_" + mot.id] || 0;
        totalRowData.push(colTotal);
        grandTotal += colTotal;
      }
      totalRowData.push(grandTotal);
      for (const cat of categories) grandSpent += categorySpending[cat.id] || 0;
      totalRowData.push(grandSpent);
      bmData.push(totalRowData);
      // Spent row
      const spentRowData = ["Spent"];
      for (const mot of motives) spentRowData.push(motiveSpending[mot.id] || 0);
      spentRowData.push(grandSpent);
      spentRowData.push("");
      bmData.push(spentRowData);

      // V-Geld Analysis by User
      const vgeldAnalysisHeaders = [
        "User",
        "Received",
        "Spent",
        "Remaining",
        "% Used",
      ];
      const vgeldAnalysisData = [vgeldAnalysisHeaders];
      const vgeldSums = db
        .prepare(
          "SELECT to_user as user, SUM(amount) as received FROM vgeld WHERE project_id = ? GROUP BY to_user",
        )
        .all(projectId);
      const billSums = db
        .prepare(
          "SELECT email as user, SUM(amount) as spent FROM bills WHERE project_id = ? AND (status IS NULL OR status = 'confirmed') GROUP BY email",
        )
        .all(projectId);
      const analysis = {};
      vgeldSums.forEach((v) => {
        if (!analysis[v.user]) analysis[v.user] = { received: 0, spent: 0 };
        analysis[v.user].received = v.received || 0;
      });
      billSums.forEach((b) => {
        if (!analysis[b.user]) analysis[b.user] = { received: 0, spent: 0 };
        analysis[b.user].spent = b.spent || 0;
      });
      for (const [user, data] of Object.entries(analysis)) {
        const remaining = data.received - data.spent;
        const pctUsed =
          data.received > 0
            ? Math.round((data.spent / data.received) * 100)
            : 0;
        vgeldAnalysisData.push([
          user,
          data.received,
          data.spent,
          remaining,
          pctUsed + "%",
        ]);
      }

      // --- Write to user-provided Google Sheet ---
      const spreadsheetId = settings.exportSheetId;
      if (!spreadsheetId) {
        return res.status(400).json({
          error:
            "No Export Sheet ID configured. Create a Google Sheet, share it with the service account, and paste the Sheet ID below.",
        });
      }

      // Ensure the 3 tabs exist, remove any extras
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const requiredTabs = ["Bills", "V-Geld", "Budget Matrix"];
      const existingSheets = meta.data.sheets;
      const existingNames = existingSheets.map((s) => s.properties.title);
      const setupRequests = [];
      // Add missing tabs
      for (const title of requiredTabs) {
        if (!existingNames.includes(title))
          setupRequests.push({ addSheet: { properties: { title } } });
      }
      // Delete extra tabs (e.g. default "Sheet1")
      for (const s of existingSheets) {
        if (!requiredTabs.includes(s.properties.title)) {
          setupRequests.push({
            deleteSheet: { sheetId: s.properties.sheetId },
          });
        }
      }
      if (setupRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: setupRequests },
        });
      }

      // Clear existing data
      await sheets.spreadsheets.values.batchClear({
        spreadsheetId,
        requestBody: { ranges: requiredTabs },
      });

      // Write all data
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [
            { range: "Bills!A1", values: billsData },
            { range: "V-Geld!A1", values: vgeldData },
            { range: "Budget Matrix!A1", values: bmData },
          ],
        },
      });

      // Get sheet IDs for formatting
      const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetIds = {};
      for (const s of sheetMeta.data.sheets) {
        sheetIds[s.properties.title] = s.properties.sheetId;
      }

      // Format headers (dark bg, white bold text, frozen first row)
      const formatRequests = [];
      const headerBg = { red: 0.173, green: 0.243, blue: 0.314, alpha: 1 }; // #2C3E50
      const headerFg = { red: 1, green: 1, blue: 1, alpha: 1 };

      for (const [name, sheetId] of Object.entries(sheetIds)) {
        const colCount =
          name === "Bills"
            ? billsHeaders.length
            : name === "V-Geld"
              ? vgeldHeaders.length
              : bmHeaders.length;
        // Freeze header row
        formatRequests.push({
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        });
        // Header style
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: colCount,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: headerBg,
                textFormat: { bold: true, foregroundColor: headerFg },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: formatRequests },
      });

      const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      res.json({ ok: true, sheetUrl });
    } catch (err) {
      console.error("Google Sheet export error:", err);
      res
        .status(500)
        .json({ error: "Google Sheet export failed: " + err.message });
    }
  },
);

module.exports = router;
