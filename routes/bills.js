const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const db = require("../db");
const DATA_DIR = db.DATA_DIR;
const { ensureAuth, ensureProjectAccess, ensureProjectAdmin } = require("../middleware");
const { saveAllocations, getMotiveDisplayString } = require("./helpers");

// Calculate bill number for a user within a project (1.01-1.20, 2.01-2.20, etc.)
function calculateBillNumber(userEmail, projectId) {
  const count = projectId
    ? db
        .prepare(
          "SELECT COUNT(*) as count FROM bills WHERE LOWER(email) = LOWER(?) AND project_id = ?",
        )
        .get(userEmail, projectId).count
    : db
        .prepare(
          "SELECT COUNT(*) as count FROM bills WHERE LOWER(email) = LOWER(?)",
        )
        .get(userEmail).count;
  const group = Math.floor(count / 20) + 1;
  const position = (count % 20) + 1;
  return `${group}.${position.toString().padStart(2, "0")}`;
}

// Keep legacy bills.filename/file in sync with first image
function syncLegacyImageColumns(billId) {
  const firstImage = db
    .prepare(
      "SELECT filename, file FROM bill_images WHERE bill_id = ? ORDER BY sort_order, id LIMIT 1",
    )
    .get(billId);
  if (firstImage) {
    db.prepare("UPDATE bills SET filename = ?, file = ? WHERE id = ?").run(
      firstImage.filename,
      firstImage.file,
      billId,
    );
  } else {
    db.prepare("UPDATE bills SET filename = ?, file = ? WHERE id = ?").run(
      "",
      "",
      billId,
    );
  }
}

// API: Bills list
router.get("/api/bills", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const bills = db
    .prepare("SELECT * FROM bills WHERE project_id = ? ORDER BY id")
    .all(projectId);

  // Bulk-fetch email -> position map for this project
  const userRoles = {};
  db.prepare(
    `
    SELECT pm.user_email as email, COALESCE(pp.name, 'Misc') as role_name
    FROM project_members pm
    LEFT JOIN project_positions pp ON pp.id = pm.position_id
    WHERE pm.project_id = ?
  `,
  )
    .all(projectId)
    .forEach((u) => {
      userRoles[u.email] = u.role_name;
    });

  // Bulk-fetch all allocations
  const allMotiveAllocs = db
    .prepare(
      `
    SELECT bm.bill_id, bm.motive_id, bm.percentage, m.name
    FROM bill_motives bm JOIN motives m ON m.id = bm.motive_id
    JOIN bills b ON b.id = bm.bill_id WHERE b.project_id = ?
  `,
    )
    .all(projectId);
  const allCategoryAllocs = db
    .prepare(
      `
    SELECT bc.bill_id, bc.category_id, bc.percentage, c.name
    FROM bill_categories bc JOIN categories c ON c.id = bc.category_id
    JOIN bills b ON b.id = bc.bill_id WHERE b.project_id = ?
  `,
    )
    .all(projectId);

  // Bulk-fetch all images for this project
  const allImages = db
    .prepare("SELECT bi.* FROM bill_images bi JOIN bills b ON b.id = bi.bill_id WHERE b.project_id = ? ORDER BY bi.sort_order, bi.id")
    .all(projectId);
  const imagesByBill = {};
  for (const img of allImages) {
    if (!imagesByBill[img.bill_id]) imagesByBill[img.bill_id] = [];
    imagesByBill[img.bill_id].push({
      id: img.id,
      filename: img.filename,
      file: img.file,
      sortOrder: img.sort_order,
    });
  }

  const motivesByBill = {};
  for (const a of allMotiveAllocs) {
    if (!motivesByBill[a.bill_id]) motivesByBill[a.bill_id] = [];
    motivesByBill[a.bill_id].push({
      motiveId: a.motive_id,
      name: a.name,
      percentage: a.percentage,
    });
  }
  const categoriesByBill = {};
  for (const a of allCategoryAllocs) {
    if (!categoriesByBill[a.bill_id]) categoriesByBill[a.bill_id] = [];
    categoriesByBill[a.bill_id].push({
      categoryId: a.category_id,
      name: a.name,
      percentage: a.percentage,
    });
  }

  const mapped = bills.map((b) => ({
    id: b.id,
    date: b.date,
    email: b.email,
    role: userRoles[b.email] || "Misc",
    billNumber: b.bill_number,
    type: b.type,
    vendor: b.vendor,
    item: b.item,
    comment: b.comment,
    motive: b.motive,
    brutto19: b.brutto19,
    brutto7: b.brutto7,
    brutto0: b.brutto0,
    amount: b.amount,
    netto19: (b.brutto19 || 0) / 1.19,
    netto7: (b.brutto7 || 0) / 1.07,
    netto0: b.brutto0 || 0,
    nettoAmount: b.netto_amount || 0,
    filename: b.filename,
    file: b.file,
    images: imagesByBill[b.id] || [],
    motiveAllocations: motivesByBill[b.id] || [],
    categoryAllocations: categoriesByBill[b.id] || [],
    status: b.status || "confirmed",
    ocrStatus: b.ocr_status || null,
    ocrFields: b.ocr_fields ? JSON.parse(b.ocr_fields) : null,
  }));
  res.json(mapped);
});

// Upload bill with images
router.post(
  "/upload",
  ensureProjectAccess,
  (req, res, next) => {
    // multer is attached to req via app.locals.upload
    const upload = req.app.locals.upload;
    upload.array("photos", 10)(req, res, next);
  },
  (req, res) => {
    const projectId = req.user.currentProjectId;
    const { type, vendor, comment, item, motive, brutto19, brutto7, brutto0 } =
      req.body;
    const b19 = parseFloat(brutto19) || 0;
    const b7 = parseFloat(brutto7) || 0;
    const b0 = parseFloat(brutto0) || 0;
    const billNumber = calculateBillNumber(req.user.email, projectId);

    // Parse allocation JSON strings from FormData
    let motiveAllocations = [];
    let categoryAllocations = [];
    try {
      if (req.body.motiveAllocations)
        motiveAllocations = JSON.parse(req.body.motiveAllocations);
    } catch (e) {}
    try {
      if (req.body.categoryAllocations)
        categoryAllocations = JSON.parse(req.body.categoryAllocations);
    } catch (e) {}

    // Build motive display string for legacy column
    let motiveDisplay = motive || "";
    if (motiveAllocations.length > 0) {
      motiveDisplay = motiveAllocations
        .map((a) => a.name || "")
        .filter(Boolean)
        .join(", ");
    }

    let firstFilePath = "";
    let firstFilename = "";

    const nettoAmount = b19 / 1.19 + b7 / 1.07 + b0;
    const uploadStatus =
      !vendor || vendor.trim() === "" || b19 + b7 + b0 === 0
        ? "draft"
        : "confirmed";

    const result = db
      .prepare(
        `INSERT INTO bills
    (date, email, bill_number, type, vendor, item, comment, motive, brutto19, brutto7, brutto0, amount, netto_amount, filename, file, project_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        new Date().toISOString(),
        req.user.email,
        billNumber,
        type || "Kauf",
        vendor || "",
        item || "",
        comment || "",
        motiveDisplay,
        b19,
        b7,
        b0,
        b19 + b7 + b0,
        nettoAmount,
        "", // filename - will update after saving images
        "", // file - will update after saving images
        projectId,
        uploadStatus,
      );

    const billId = result.lastInsertRowid;

    // Save uploaded files
    const files = req.files || [];
    if (files.length > 0) {
      const userFolder = req.user.email.split("@")[0];
      const uploadsDir = path.join(DATA_DIR, "uploads", userFolder);
      if (!fs.existsSync(path.join(DATA_DIR, "uploads")))
        fs.mkdirSync(path.join(DATA_DIR, "uploads"));
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

      const insertImg = db.prepare(
        "INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, ?)",
      );
      const dateStr = new Date().toISOString().split("T")[0];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = path.extname(f.originalname) || ".jpg";
        const suffix = files.length > 1 ? `_${i + 1}` : "";
        const savedFilename = `${userFolder}_${billNumber}_${dateStr}${suffix}${ext}`;
        const savedFilePath = path.join(uploadsDir, savedFilename);
        fs.writeFileSync(savedFilePath, f.buffer);
        const relPath = `${userFolder}/${savedFilename}`;
        insertImg.run(billId, f.originalname, relPath, i);

        if (i === 0) {
          firstFilePath = relPath;
          firstFilename = f.originalname;
        }
      }

      // Update legacy columns with first image for backward compat
      db.prepare("UPDATE bills SET filename = ?, file = ? WHERE id = ?").run(
        firstFilename,
        firstFilePath,
        billId,
      );
    }

    // Save allocations to junction tables
    saveAllocations(billId, motiveAllocations, categoryAllocations, projectId);

    // Log bill creation event
    db.prepare(
      "INSERT INTO editlog (timestamp, user, bill_id, changes, project_id, source) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      new Date().toISOString(),
      req.user.email,
      billId,
      JSON.stringify({ _event: "created" }),
      projectId,
      "user",
    );

    res.json({ ok: true, id: billId });
  },
);

router.put("/api/bills/:id", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const bill = db
    .prepare("SELECT * FROM bills WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!bill) return res.status(404).json({ error: "Not found" });

  const {
    email,
    type,
    vendor,
    item,
    comment,
    motive,
    brutto19,
    brutto7,
    brutto0,
    motiveAllocations,
    categoryAllocations,
    bill_number,
    date,
  } = req.body;
  const changes = {};
  const updates = [];
  const params = [];

  if (date !== undefined && date !== bill.date) {
    changes.date = date;
    updates.push("date = ?");
    params.push(date);
  }
  if (email !== undefined && email !== bill.email) {
    changes.email = email;
    updates.push("email = ?");
    params.push(email);
  }
  if (type !== undefined && type !== bill.type) {
    changes.type = type;
    updates.push("type = ?");
    params.push(type);
  }
  if (vendor !== undefined && vendor !== bill.vendor) {
    changes.vendor = vendor;
    updates.push("vendor = ?");
    params.push(vendor);
  }
  if (item !== undefined && item !== bill.item) {
    changes.item = item;
    updates.push("item = ?");
    params.push(item);
  }
  if (comment !== undefined && comment !== bill.comment) {
    changes.comment = comment;
    updates.push("comment = ?");
    params.push(comment);
  }
  if (motive !== undefined && motive !== bill.motive) {
    changes.motive = motive;
    updates.push("motive = ?");
    params.push(motive);
  }
  if (brutto19 !== undefined && parseFloat(brutto19) !== bill.brutto19) {
    changes.brutto19 = parseFloat(brutto19);
    updates.push("brutto19 = ?");
    params.push(parseFloat(brutto19));
  }
  if (brutto7 !== undefined && parseFloat(brutto7) !== bill.brutto7) {
    changes.brutto7 = parseFloat(brutto7);
    updates.push("brutto7 = ?");
    params.push(parseFloat(brutto7));
  }
  if (brutto0 !== undefined && parseFloat(brutto0) !== bill.brutto0) {
    changes.brutto0 = parseFloat(brutto0);
    updates.push("brutto0 = ?");
    params.push(parseFloat(brutto0));
  }

  // Auto-promote draft to confirmed when vendor and amount are both present
  if (bill.status === "draft") {
    const newVendor = vendor !== undefined ? vendor : bill.vendor || "";
    const newB19 =
      brutto19 !== undefined ? parseFloat(brutto19) : bill.brutto19 || 0;
    const newB7 =
      brutto7 !== undefined ? parseFloat(brutto7) : bill.brutto7 || 0;
    const newB0 =
      brutto0 !== undefined ? parseFloat(brutto0) : bill.brutto0 || 0;
    if (newVendor.trim() !== "" && newB19 + newB7 + newB0 > 0) {
      changes.status = "confirmed";
      updates.push("status = ?");
      params.push("confirmed");
    }
  }

  // Save allocations if provided
  if (motiveAllocations !== undefined || categoryAllocations !== undefined) {
    saveAllocations(
      id,
      motiveAllocations || [],
      categoryAllocations || [],
      projectId,
    );
    // Update legacy motive column with display string
    const motiveStr = getMotiveDisplayString(id);
    if (motiveStr !== bill.motive) {
      changes.motive = motiveStr;
      updates.push("motive = ?");
      params.push(motiveStr);
    }
  }

  if (Object.keys(changes).length > 0) {
    // Recalculate total amount and netto
    const newB19 =
      changes.brutto19 !== undefined ? changes.brutto19 : bill.brutto19;
    const newB7 =
      changes.brutto7 !== undefined ? changes.brutto7 : bill.brutto7;
    const newB0 =
      changes.brutto0 !== undefined ? changes.brutto0 : bill.brutto0;
    updates.push("amount = ?");
    params.push((newB19 || 0) + (newB7 || 0) + (newB0 || 0));
    updates.push("netto_amount = ?");
    params.push((newB19 || 0) / 1.19 + (newB7 || 0) / 1.07 + (newB0 || 0));

    // Strip OCR-suggested fields that the user has now explicitly edited
    if (bill.ocr_fields) {
      let ocrFields = JSON.parse(bill.ocr_fields);
      const editedFields = Object.keys(changes);
      // BUG-8: When a brutto field is edited, also strip "amount" since it gets recalculated
      const bruttoFields = ["brutto19", "brutto7", "brutto0"];
      const anyBruttoEdited = bruttoFields.some((f) => editedFields.includes(f));
      const fieldsToRemove = anyBruttoEdited ? [...editedFields, "amount"] : editedFields;
      ocrFields = ocrFields.filter((f) => !fieldsToRemove.includes(f));
      if (ocrFields.length === 0) {
        updates.push("ocr_fields = ?");
        params.push(null);
        updates.push("ocr_status = ?");
        params.push(null);
      } else {
        updates.push("ocr_fields = ?");
        params.push(JSON.stringify(ocrFields));
      }
    }

    params.push(id);
    db.prepare(`UPDATE bills SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
    );

    // Log the edit
    db.prepare(
      "INSERT INTO editlog (timestamp, user, bill_id, changes, project_id) VALUES (?, ?, ?, ?, ?)",
    ).run(
      new Date().toISOString(),
      req.user.email,
      id,
      JSON.stringify(changes),
      projectId,
    );
  } else if (
    motiveAllocations !== undefined ||
    categoryAllocations !== undefined
  ) {
    // Log allocation changes even if no other fields changed
    db.prepare(
      "INSERT INTO editlog (timestamp, user, bill_id, changes, project_id) VALUES (?, ?, ?, ?, ?)",
    ).run(
      new Date().toISOString(),
      req.user.email,
      id,
      JSON.stringify({ allocations: "updated" }),
      projectId,
    );
  }
  res.json({ ok: true });
});

const ALLOWED_OCR_FIELDS = ["date", "vendor", "item", "type", "brutto19", "brutto7", "brutto0", "amount", "comment"];

router.patch("/api/bills/:id/verify-field", ensureAuth, ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id) || id <= 0) return res.status(400).json({ error: "Invalid bill ID" });

  const { field } = req.body;
  if (!field || typeof field !== "string" || !ALLOWED_OCR_FIELDS.includes(field)) {
    return res.status(400).json({ error: "Invalid or missing field name" });
  }

  const bill = db
    .prepare("SELECT id, ocr_fields, ocr_status FROM bills WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!bill) return res.status(404).json({ error: "Bill not found" });

  let ocrFields = [];
  try { ocrFields = JSON.parse(bill.ocr_fields || "[]"); } catch {}

  if (!ocrFields.includes(field)) {
    return res.status(400).json({ error: "Field is not in ocr_fields" });
  }

  const remaining = ocrFields.filter((f) => f !== field);

  if (remaining.length === 0) {
    db.prepare("UPDATE bills SET ocr_fields = NULL, ocr_status = NULL WHERE id = ?").run(id);
  } else {
    db.prepare("UPDATE bills SET ocr_fields = ? WHERE id = ?").run(JSON.stringify(remaining), id);
  }

  db.prepare(
    "INSERT INTO editlog (timestamp, user, bill_id, changes, project_id, source) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    new Date().toISOString(),
    req.user.email,
    id,
    JSON.stringify({ _event: "verified", field }),
    projectId,
    "user",
  );

  res.json({
    ok: true,
    ocrFields: remaining.length > 0 ? remaining : null,
    ocrStatus: remaining.length > 0 ? "done" : null,
  });
});

router.delete("/api/bills/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);

  // Verify bill belongs to this project
  const bill = db
    .prepare("SELECT id FROM bills WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!bill) return res.status(404).json({ error: "Not found" });

  // Clean up image files from disk
  const images = db
    .prepare("SELECT file FROM bill_images WHERE bill_id = ?")
    .all(id);
  for (const img of images) {
    if (img.file) {
      const imgPath = path.join(DATA_DIR, "uploads", img.file);
      if (fs.existsSync(imgPath)) {
        try {
          fs.unlinkSync(imgPath);
        } catch (e) {
          console.error("Failed to delete image file:", e.message);
        }
      }
    }
  }

  db.prepare("DELETE FROM bill_images WHERE bill_id = ?").run(id);
  db.prepare("DELETE FROM bill_motives WHERE bill_id = ?").run(id);
  db.prepare("DELETE FROM bill_categories WHERE bill_id = ?").run(id);
  db.prepare("DELETE FROM bills WHERE id = ?").run(id);
  res.json({ ok: true });
});

// Bulk delete bills
router.post("/api/bills/bulk-delete", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No ids provided" });
  }

  // Filter to only bills in this project
  const placeholders = ids.map(() => "?").join(",");
  const validBills = db
    .prepare(
      `SELECT id FROM bills WHERE id IN (${placeholders}) AND project_id = ?`,
    )
    .all(...ids, projectId);
  const validIds = validBills.map((b) => b.id);
  if (validIds.length === 0) return res.json({ ok: true, deleted: 0 });

  const vPlaceholders = validIds.map(() => "?").join(",");

  // Clean up image files from disk
  const images = db
    .prepare(`SELECT file FROM bill_images WHERE bill_id IN (${vPlaceholders})`)
    .all(...validIds);
  for (const img of images) {
    if (img.file) {
      const imgPath = path.join(DATA_DIR, "uploads", img.file);
      if (fs.existsSync(imgPath)) {
        try {
          fs.unlinkSync(imgPath);
        } catch (e) {
          console.error("Failed to delete image file:", e.message);
        }
      }
    }
  }

  db.prepare(`DELETE FROM bill_images WHERE bill_id IN (${vPlaceholders})`).run(
    ...validIds,
  );
  db.prepare(
    `DELETE FROM bill_motives WHERE bill_id IN (${vPlaceholders})`,
  ).run(...validIds);
  db.prepare(
    `DELETE FROM bill_categories WHERE bill_id IN (${vPlaceholders})`,
  ).run(...validIds);
  const result = db
    .prepare(`DELETE FROM bills WHERE id IN (${vPlaceholders})`)
    .run(...validIds);

  console.log("Bulk deleted", result.changes, "bills");
  res.json({ ok: true, deleted: result.changes });
});

// Add images to existing bill
router.post(
  "/api/bills/:id/images",
  ensureProjectAccess,
  (req, res, next) => {
    const upload = req.app.locals.upload;
    upload.array("photos", 10)(req, res, next);
  },
  (req, res) => {
    const projectId = req.user.currentProjectId;
    const id = parseInt(req.params.id);
    const bill = db
      .prepare("SELECT * FROM bills WHERE id = ? AND project_id = ?")
      .get(id, projectId);
    if (!bill) return res.status(404).json({ error: "Not found" });

    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: "No files" });

    // Check current image count
    const currentCount = db
      .prepare("SELECT COUNT(*) as count FROM bill_images WHERE bill_id = ?")
      .get(id).count;
    if (currentCount + files.length > 10) {
      return res.status(400).json({ error: "Maximum 10 images per bill" });
    }

    const userFolder = bill.email.split("@")[0];
    const uploadsDir = path.join(DATA_DIR, "uploads", userFolder);
    if (!fs.existsSync(path.join(DATA_DIR, "uploads")))
      fs.mkdirSync(path.join(DATA_DIR, "uploads"));
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const insertImg = db.prepare(
      "INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, ?)",
    );
    const dateStr = new Date().toISOString().split("T")[0];
    const newImages = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = path.extname(f.originalname) || ".jpg";
      const sortOrder = currentCount + i;
      const savedFilename = `${userFolder}_${bill.bill_number || id}_${dateStr}_${sortOrder}${ext}`;
      const savedFilePath = path.join(uploadsDir, savedFilename);
      fs.writeFileSync(savedFilePath, f.buffer);
      const relPath = `${userFolder}/${savedFilename}`;
      const imgResult = insertImg.run(id, f.originalname, relPath, sortOrder);
      newImages.push({
        id: imgResult.lastInsertRowid,
        filename: f.originalname,
        file: relPath,
        sortOrder,
      });
    }

    // Update legacy columns with first image
    syncLegacyImageColumns(id);

    db.prepare(
      "INSERT INTO editlog (timestamp, user, bill_id, changes, project_id) VALUES (?, ?, ?, ?, ?)",
    ).run(
      new Date().toISOString(),
      req.user.email,
      id,
      JSON.stringify({ images: `added ${files.length}` }),
      projectId,
    );

    res.json({ ok: true, images: newImages });
  },
);

// Replace single image (crop)
router.put(
  "/api/bills/:id/images/:imageId",
  ensureProjectAccess,
  (req, res, next) => {
    const upload = req.app.locals.upload;
    upload.single("photo")(req, res, next);
  },
  (req, res) => {
    const projectId = req.user.currentProjectId;
    const billId = parseInt(req.params.id);
    const imageId = parseInt(req.params.imageId);
    const bill = db
      .prepare("SELECT * FROM bills WHERE id = ? AND project_id = ?")
      .get(billId, projectId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const image = db
      .prepare("SELECT * FROM bill_images WHERE id = ? AND bill_id = ?")
      .get(imageId, billId);
    if (!image) return res.status(404).json({ error: "Image not found" });
    if (!req.file) return res.status(400).json({ error: "No file" });

    // Overwrite the existing file on disk
    const imgPath = path.join(DATA_DIR, "uploads", image.file);
    const dir = path.dirname(imgPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(imgPath, req.file.buffer);

    db.prepare(
      "INSERT INTO editlog (timestamp, user, bill_id, changes, project_id) VALUES (?, ?, ?, ?, ?)",
    ).run(
      new Date().toISOString(),
      req.user.email,
      billId,
      JSON.stringify({ image: "cropped" }),
      projectId,
    );

    res.json({ ok: true });
  },
);

// Delete single image from bill
router.delete(
  "/api/bills/:id/images/:imageId",
  ensureProjectAccess,
  (req, res) => {
    const projectId = req.user.currentProjectId;
    const billId = parseInt(req.params.id);
    const imageId = parseInt(req.params.imageId);
    const bill = db
      .prepare("SELECT * FROM bills WHERE id = ? AND project_id = ?")
      .get(billId, projectId);
    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const image = db
      .prepare("SELECT * FROM bill_images WHERE id = ? AND bill_id = ?")
      .get(imageId, billId);
    if (!image) return res.status(404).json({ error: "Image not found" });

    // Delete file from disk
    if (image.file) {
      const imgPath = path.join(DATA_DIR, "uploads", image.file);
      if (fs.existsSync(imgPath)) {
        try {
          fs.unlinkSync(imgPath);
        } catch (e) {
          console.error("Failed to delete image file:", e.message);
        }
      }
    }

    db.prepare("DELETE FROM bill_images WHERE id = ?").run(imageId);

    // Update legacy columns
    syncLegacyImageColumns(billId);

    db.prepare(
      "INSERT INTO editlog (timestamp, user, bill_id, changes, project_id) VALUES (?, ?, ?, ?, ?)",
    ).run(
      new Date().toISOString(),
      req.user.email,
      billId,
      JSON.stringify({ image: "deleted" }),
      projectId,
    );

    res.json({ ok: true });
  },
);

// Legacy single image replace (backward compat)
router.post(
  "/api/bills/:id/image",
  ensureProjectAccess,
  (req, res, next) => {
    const upload = req.app.locals.upload;
    upload.single("photo")(req, res, next);
  },
  (req, res) => {
    const projectId = req.user.currentProjectId;
    const id = parseInt(req.params.id);
    const bill = db
      .prepare("SELECT * FROM bills WHERE id = ? AND project_id = ?")
      .get(id, projectId);
    if (!bill) return res.status(404).json({ error: "Not found" });
    if (!req.file) return res.status(400).json({ error: "No file" });

    const userFolder = bill.email.split("@")[0];
    const uploadsDir = path.join(DATA_DIR, "uploads", userFolder);
    if (!fs.existsSync(path.join(DATA_DIR, "uploads")))
      fs.mkdirSync(path.join(DATA_DIR, "uploads"));
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const dateStr = new Date().toISOString().split("T")[0];
    const ext = path.extname(req.file.originalname) || ".jpg";
    const filename = `${userFolder}_${bill.bill_number || id}_${dateStr}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    const file = `${userFolder}/${filename}`;
    // Also add to bill_images
    db.prepare(
      "INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, ?)",
    ).run(id, req.file.originalname, file, 0);
    syncLegacyImageColumns(id);

    db.prepare(
      "INSERT INTO editlog (timestamp, user, bill_id, changes, project_id) VALUES (?, ?, ?, ?, ?)",
    ).run(
      new Date().toISOString(),
      req.user.email,
      id,
      JSON.stringify({ image: "added" }),
      projectId,
    );

    res.json({ ok: true, file });
  },
);

router.get("/api/bills/log", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const logs = db
    .prepare("SELECT * FROM editlog WHERE project_id = ? ORDER BY id")
    .all(projectId);
  const mapped = logs.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    user: l.user,
    billId: l.bill_id,
    changes: JSON.parse(l.changes || "{}"),
    source: l.source || "user",
  }));
  res.json(mapped);
});

router.get("/api/bills/by-motive", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const allocated = db
    .prepare(
      `
    SELECT bm.motive_id, m.name as motive, SUM(b.netto_amount * bm.percentage / 100) as spent
    FROM bill_motives bm
    JOIN bills b ON b.id = bm.bill_id
    JOIN motives m ON m.id = bm.motive_id
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    GROUP BY bm.motive_id
  `,
    )
    .all(projectId);

  const uncatSpent = db
    .prepare(
      `
    SELECT SUM(b.netto_amount) as spent FROM bills b
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    AND b.id NOT IN (SELECT DISTINCT bill_id FROM bill_motives)
  `,
    )
    .get(projectId);

  const motives = db
    .prepare("SELECT * FROM motives WHERE project_id = ? ORDER BY id")
    .all(projectId);
  const spending = {};
  allocated.forEach((a) => {
    spending[a.motive] = a.spent || 0;
  });

  const result = motives.map((m) => {
    const spent = spending[m.name] || 0;
    return {
      motive: m.name,
      budget: m.budget,
      spent,
      remaining: m.budget - spent,
      percent: m.budget > 0 ? (spent / m.budget) * 100 : 0,
    };
  });

  if (uncatSpent && uncatSpent.spent > 0) {
    result.push({
      motive: "Default",
      budget: 0,
      spent: uncatSpent.spent,
      remaining: 0,
      percent: 0,
    });
  }
  res.json(result);
});

router.get("/api/bills/by-category", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const allocated = db
    .prepare(
      `
    SELECT bc.category_id, c.name as category, SUM(b.netto_amount * bc.percentage / 100) as spent
    FROM bill_categories bc
    JOIN bills b ON b.id = bc.bill_id
    JOIN categories c ON c.id = bc.category_id
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    GROUP BY bc.category_id
  `,
    )
    .all(projectId);

  const uncatSpent = db
    .prepare(
      `
    SELECT SUM(b.netto_amount) as spent FROM bills b
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    AND b.id NOT IN (SELECT DISTINCT bill_id FROM bill_categories)
  `,
    )
    .get(projectId);

  const categories = db
    .prepare("SELECT * FROM categories WHERE project_id = ? ORDER BY id")
    .all(projectId);
  const spending = {};
  allocated.forEach((a) => {
    spending[a.category] = a.spent || 0;
  });

  const result = categories.map((c) => {
    const spent = spending[c.name] || 0;
    return {
      category: c.name,
      budget: c.budget,
      spent,
      remaining: c.budget - spent,
      percent: c.budget > 0 ? (spent / c.budget) * 100 : 0,
    };
  });

  if (uncatSpent && uncatSpent.spent > 0) {
    result.push({
      category: "Uncategorized",
      budget: 0,
      spent: uncatSpent.spent,
      remaining: 0,
      percent: 0,
    });
  }
  res.json(result);
});

// Serve uploaded files (supports subdirectories like /uploads/user/file.jpg)
// Security: enforce project membership/authorization and prevent cross-project access
router.get("/uploads/*", ensureProjectAccess, (req, res) => {
  const relPath = req.params[0];
  if (!relPath) return res.status(404).send("Not found");

  // Look up image by file path in bill_images first
  let row = db
    .prepare(
      `
      SELECT bi.file, b.project_id
      FROM bill_images bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE bi.file = ?
    `,
    )
    .get(relPath);

  // Fallback to legacy bills.file column
  if (!row) {
    row = db
      .prepare("SELECT file, project_id FROM bills WHERE file = ?")
      .get(relPath);
  }

  if (!row || !row.file) {
    return res.status(404).send("Not found");
  }

  const targetProjectId = row.project_id;
  const user = req.user;

  // Super-admins can access any project; regular users are bound to currentProjectId
  if (!user.superAdmin && user.currentProjectId !== targetProjectId) {
    return res.status(403).send("Forbidden");
  }

  const file = path.join(DATA_DIR, "uploads", row.file);
  if (!fs.existsSync(file)) {
    return res.status(404).send("Not found");
  }
  return res.sendFile(file);
});

module.exports = router;
