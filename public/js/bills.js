// ========== Bills ==========

function populateFilterDropdowns() {
    const personSel = document.getElementById("filterPerson");
    const motiveSel = document.getElementById("filterMotive");
    const categorySel = document.getElementById("filterCategory");
    const roleSel = document.getElementById("filterRole");

    // Person
    const persons = [
        ...new Set(allBills.map((b) => b.email)),
    ].sort();
    personSel.innerHTML =
        '<option value="">All Persons</option>' +
        persons
            .map(
                (p) =>
                    `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`,
            )
            .join("");

    // Motives
    motiveSel.innerHTML =
        '<option value="">All Motives</option>' +
        motivesData
            .map(
                (m) =>
                    `<option value="${m.id}">${escapeHtml(m.name)}</option>`,
            )
            .join("");

    // Categories
    categorySel.innerHTML =
        '<option value="">All Categories</option>' +
        categoriesData
            .map(
                (c) =>
                    `<option value="${c.id}">${escapeHtml(c.name)}</option>`,
            )
            .join("");

    // Roles
    roleSel.innerHTML =
        '<option value="">All Roles</option>' +
        rolesData
            .map(
                (r) =>
                    `<option value="${escapeHtml(r.name)}">${escapeHtml(r.name)}</option>`,
            )
            .join("");

    // Restore current filter values
    personSel.value = billFilters.person;
    motiveSel.value = billFilters.motive;
    categorySel.value = billFilters.category;
    roleSel.value = billFilters.role;
}

function initFilterListeners() {
    const ids = [
        "filterPerson",
        "filterMotive",
        "filterCategory",
        "filterRole",
        "filterType",
        "filterDateFrom",
        "filterDateTo",
        "filterSearch",
    ];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        el.addEventListener(
            el.tagName === "INPUT" && el.type === "text"
                ? "input"
                : "change",
            () => {
                billFilters.person =
                    document.getElementById("filterPerson").value;
                billFilters.motive =
                    document.getElementById("filterMotive").value;
                billFilters.category =
                    document.getElementById("filterCategory").value;
                billFilters.role =
                    document.getElementById("filterRole").value;
                billFilters.type =
                    document.getElementById("filterType").value;
                billFilters.dateFrom =
                    document.getElementById("filterDateFrom").value;
                billFilters.dateTo =
                    document.getElementById("filterDateTo").value;
                billFilters.search =
                    document.getElementById("filterSearch").value;
                billPage = 1;
                renderFilteredBills();
            },
        );
    });

    // Sortable headers
    document
        .querySelectorAll("#billsTable th.sortable")
        .forEach((th) => {
            th.addEventListener("click", () => {
                const col = th.dataset.sort;
                if (billSort.column === col) {
                    if (billSort.dir === "asc")
                        billSort.dir = "desc";
                    else if (billSort.dir === "desc") {
                        billSort.column = null;
                        billSort.dir = "asc";
                    }
                } else {
                    billSort.column = col;
                    billSort.dir = "asc";
                }
                // Update arrow indicators
                document
                    .querySelectorAll("#billsTable th.sortable")
                    .forEach((h) => {
                        h.classList.remove("sort-asc", "sort-desc");
                    });
                if (billSort.column) {
                    th.classList.add(
                        billSort.dir === "asc"
                            ? "sort-asc"
                            : "sort-desc",
                    );
                }
                renderFilteredBills();
            });
        });
}

function resetBillFilters() {
    billFilters = {
        person: "",
        motive: "",
        category: "",
        role: "",
        type: "",
        dateFrom: "",
        dateTo: "",
        search: "",
    };
    billSort = { column: null, dir: "asc" };
    billPage = 1;
    document.getElementById("filterPerson").value = "";
    document.getElementById("filterMotive").value = "";
    document.getElementById("filterCategory").value = "";
    document.getElementById("filterRole").value = "";
    document.getElementById("filterType").value = "";
    document.getElementById("filterDateFrom").value = "";
    document.getElementById("filterDateTo").value = "";
    document.getElementById("filterSearch").value = "";
    document
        .querySelectorAll("#billsTable th.sortable")
        .forEach((h) =>
            h.classList.remove("sort-asc", "sort-desc"),
        );
    renderFilteredBills();
}

function renderFilteredBills() {
    let bills = allBills.slice();

    // Apply filters
    if (billFilters.person)
        bills = bills.filter((b) => b.email === billFilters.person);
    if (billFilters.motive) {
        const mid = Number(billFilters.motive);
        bills = bills.filter(
            (b) =>
                b.motiveAllocations &&
                b.motiveAllocations.some((a) => a.motiveId === mid),
        );
    }
    if (billFilters.category) {
        const cid = Number(billFilters.category);
        bills = bills.filter(
            (b) =>
                b.categoryAllocations &&
                b.categoryAllocations.some(
                    (a) => a.categoryId === cid,
                ),
        );
    }
    if (billFilters.role)
        bills = bills.filter(
            (b) => (b.role || "Misc") === billFilters.role,
        );
    if (billFilters.type)
        bills = bills.filter(
            (b) => (b.type || "Kauf") === billFilters.type,
        );
    if (billFilters.dateFrom) {
        const from = new Date(billFilters.dateFrom);
        bills = bills.filter((b) => new Date(b.date) >= from);
    }
    if (billFilters.dateTo) {
        const to = new Date(billFilters.dateTo);
        to.setHours(23, 59, 59, 999);
        bills = bills.filter((b) => new Date(b.date) <= to);
    }
    if (billFilters.search) {
        const q = billFilters.search.toLowerCase();
        bills = bills.filter(
            (b) =>
                (b.vendor || "").toLowerCase().includes(q) ||
                (b.item || "").toLowerCase().includes(q) ||
                (b.comment || "").toLowerCase().includes(q),
        );
    }

    // Apply sort
    if (billSort.column) {
        const dir = billSort.dir === "asc" ? 1 : -1;
        bills.sort((a, b) => {
            let va, vb;
            const col = billSort.column;
            if (col === "total") {
                va =
                    (a.brutto19 || 0) +
                        (a.brutto7 || 0) +
                        (a.brutto0 || 0) ||
                    a.amount ||
                    0;
                vb =
                    (b.brutto19 || 0) +
                        (b.brutto7 || 0) +
                        (b.brutto0 || 0) ||
                    b.amount ||
                    0;
            } else if (col === "netto") {
                va =
                    (a.brutto19 || 0) / 1.19 +
                    (a.brutto7 || 0) / 1.07 +
                    (a.brutto0 || 0);
                vb =
                    (b.brutto19 || 0) / 1.19 +
                    (b.brutto7 || 0) / 1.07 +
                    (b.brutto0 || 0);
            } else if (col === "date") {
                va = new Date(a.date || 0).getTime();
                vb = new Date(b.date || 0).getTime();
            } else if (
                ["brutto19", "brutto7", "brutto0"].includes(col)
            ) {
                va = a[col] || 0;
                vb = b[col] || 0;
            } else {
                va = (a[col] || "").toString().toLowerCase();
                vb = (b[col] || "").toString().toLowerCase();
            }
            if (va < vb) return -dir;
            if (va > vb) return dir;
            return 0;
        });
    }

    // Pagination
    const totalFiltered = bills.length;
    const totalPages = Math.max(
        1,
        Math.ceil(totalFiltered / BILLS_PER_PAGE),
    );
    if (billPage > totalPages) billPage = totalPages;
    const startIdx = (billPage - 1) * BILLS_PER_PAGE;
    const pageBills = bills.slice(
        startIdx,
        startIdx + BILLS_PER_PAGE,
    );

    // Render
    const tbody = document.getElementById("billsBody");
    const isAdmin =
        currentUser &&
        (currentUser.superAdmin ||
            ["admin", "owner"].includes(
                currentUser.currentProjectRole,
            ));
    if (totalFiltered === 0) {
        tbody.innerHTML =
            '<tr><td colspan="15">No matching bills.</td></tr>';
    } else {
        tbody.innerHTML = pageBills
            .map((bill) => {
                const b19 = bill.brutto19 || 0;
                const b7 = bill.brutto7 || 0;
                const b0 = bill.brutto0 || 0;
                const total = b19 + b7 + b0 || bill.amount || 0;
                const nettoTotal = b19 / 1.19 + b7 / 1.07 + b0;
                const motiveDisplay =
                    formatAllocations(bill.motiveAllocations) ||
                    escapeHtml(bill.motive);
                const categoryDisplay = formatAllocations(
                    bill.categoryAllocations,
                );
                return `
    <tr data-id="${bill.id}" class="clickable-row cursor-pointer${bill.status === "draft" ? " bill-draft-row" : ""}" onclick="openBillDetail(${bill.id})">
      <td class="admin-only px-3 py-2.5" style="${isAdmin ? "" : "display:none"}" onclick="event.stopPropagation()"><input type="checkbox" class="bill-checkbox" data-id="${bill.id}" onchange="updateSelectedCount()"></td>
      <td class="px-3 py-2.5"><strong class="text-slate-900">${escapeHtml(bill.billNumber || "-")}</strong>${bill.status === "draft" ? ' <span class="bg-rose-500 text-white rounded text-[0.65rem] px-1.5 py-px align-middle">Entwurf</span>' : ""}</td>
      <td class="px-3 py-2.5 text-slate-500">${escapeHtml(formatDate(bill.date))}</td>
      <td class="px-3 py-2.5">${escapeHtml(bill.email)}</td>
      <td class="px-3 py-2.5 text-slate-500">${escapeHtml(bill.role || "Misc")}</td>
      <td class="px-3 py-2.5 text-slate-500">${escapeHtml(bill.type || "Kauf")}</td>
      <td class="px-3 py-2.5">${escapeHtml(bill.vendor)}</td>
      <td class="px-3 py-2.5">${escapeHtml(bill.item)}</td>
      <td class="px-3 py-2.5 tabular-nums">${b19 ? formatCurrency(b19) : "-"}</td>
      <td class="px-3 py-2.5 tabular-nums">${b7 ? formatCurrency(b7) : "-"}</td>
      <td class="px-3 py-2.5 tabular-nums">${b0 ? formatCurrency(b0) : "-"}</td>
      <td class="px-3 py-2.5 tabular-nums"><strong class="text-slate-900">${formatCurrency(total)}</strong></td>
      <td class="px-3 py-2.5 tabular-nums"><strong class="text-slate-900">${formatCurrency(nettoTotal)}</strong></td>
      <td class="px-3 py-2.5 text-slate-500 text-xs">${motiveDisplay}${categoryDisplay ? '<br><span class="text-slate-400">' + categoryDisplay + "</span>" : ""}</td>
      <td class="px-3 py-2.5"><button class="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors border-none cursor-pointer" onclick="event.stopPropagation(); openBillDetail(${bill.id})">View</button></td>
    </tr>`;
            })
            .join("");
    }

    // Update count
    const endIdx = Math.min(
        startIdx + BILLS_PER_PAGE,
        totalFiltered,
    );
    document.getElementById("billsCount").textContent =
        totalFiltered === allBills.length
            ? `${startIdx + 1}\u2013${endIdx} of ${totalFiltered}`
            : `${startIdx + 1}\u2013${endIdx} of ${totalFiltered} (filtered from ${allBills.length})`;

    // Render pagination controls
    renderBillsPagination(totalPages);

    // Reset selection state
    const selectAll = document.getElementById("selectAllBills");
    if (selectAll) selectAll.checked = false;
    updateSelectedCount();
}

function renderBillsPagination(totalPages) {
    const container = document.getElementById("billsPagination");
    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }

    const pgBase =
        "px-2.5 py-1 text-sm rounded-md min-w-[34px] text-center border cursor-pointer transition-colors";
    const pgNormal =
        pgBase +
        " bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300";
    const pgActive =
        pgBase + " bg-indigo-600 text-white border-indigo-600";
    const pgDisabled =
        pgBase +
        " bg-slate-50 text-slate-300 border-slate-200 cursor-default";

    let html = "";
    html += `<button class="${billPage <= 1 ? pgDisabled : pgNormal}" ${billPage <= 1 ? "disabled" : ""} onclick="goToBillPage(${billPage - 1})">\u2039</button>`;

    const maxVisible = 7;
    let start = Math.max(1, billPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1)
        start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
        html += `<button class="${pgNormal}" onclick="goToBillPage(1)">1</button>`;
        if (start > 2)
            html +=
                '<span class="px-1 text-slate-400">\u2026</span>';
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="${i === billPage ? pgActive : pgNormal}" onclick="goToBillPage(${i})">${i}</button>`;
    }
    if (end < totalPages) {
        if (end < totalPages - 1)
            html +=
                '<span class="px-1 text-slate-400">\u2026</span>';
        html += `<button class="${pgNormal}" onclick="goToBillPage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="${billPage >= totalPages ? pgDisabled : pgNormal}" ${billPage >= totalPages ? "disabled" : ""} onclick="goToBillPage(${billPage + 1})">\u203A</button>`;
    container.innerHTML = html;
}

function goToBillPage(page) {
    billPage = page;
    renderFilteredBills();
    document
        .getElementById("billsTable")
        .scrollIntoView({ behavior: "smooth", block: "start" });
}

// One-time init for filter listeners
let filtersInitialized = false;

async function loadBills() {
    const tbody = document.getElementById("billsBody");
    tbody.innerHTML = '<tr><td colspan="15">Loading...</td></tr>';
    try {
        const [billsRes, logsRes] = await Promise.all([
            fetch("/api/bills"),
            fetch("/api/bills/log"),
        ]);
        allBills = await billsRes.json();
        allLogs = await logsRes.json();

        // Update draft badge
        const draftCount = allBills.filter(
            (b) => b.status === "draft",
        ).length;
        const badge = document.getElementById("draftBadge");
        if (draftCount > 0) {
            badge.textContent = draftCount;
            badge.style.display = "";
        } else {
            badge.style.display = "none";
        }

        if (!filtersInitialized) {
            initFilterListeners();
            filtersInitialized = true;
        }
        populateFilterDropdowns();

        if (allBills.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="15">No bills yet.</td></tr>';
            document.getElementById("billsCount").textContent = "";
            return;
        }
        renderFilteredBills();
    } catch (e) {
        tbody.innerHTML =
            '<tr><td colspan="15">Error loading bills.</td></tr>';
    }
}

function openBillDetail(id) {
    currentBillId = id;
    const bill = allBills.find((b) => b.id === id);
    if (!bill) return;

    // Store the bill ID in hidden field
    document.getElementById("detailBillId").value = bill.id;

    // Populate form fields
    document.getElementById("detailBillNumber").value =
        bill.billNumber || "-";
    document.getElementById("detailDate").value = formatDate(
        bill.date,
    );
    document.getElementById("detailType").value =
        bill.type || "Kauf";

    // Populate email dropdown with users
    const emailSelect = document.getElementById("detailEmail");
    fetch("/api/users")
        .then((r) => r.json())
        .then((users) => {
            emailSelect.innerHTML = users
                .map(
                    (u) =>
                        `<option value="${escapeHtml(u.email)}" ${u.email === bill.email ? "selected" : ""}>${escapeHtml(u.email)}</option>`,
                )
                .join("");
        });
    document.getElementById("detailVendor").value =
        bill.vendor || "";
    document.getElementById("detailItem").value = bill.item || "";
    document.getElementById("detailBrutto19").value =
        bill.brutto19 || 0;
    document.getElementById("detailBrutto7").value =
        bill.brutto7 || 0;
    document.getElementById("detailBrutto0").value =
        bill.brutto0 || 0;
    document.getElementById("detailComment").value =
        bill.comment || "";

    // Show netto values
    updateDetailNetto();

    // Calculate total amount
    const billTotal =
        (bill.brutto19 || 0) +
        (bill.brutto7 || 0) +
        (bill.brutto0 || 0);

    // Initialize allocation widgets with existing data
    createAllocationWidget(
        "detailMotiveAlloc",
        "motive",
        motivesData,
        bill.motiveAllocations || [],
        billTotal,
    );
    createAllocationWidget(
        "detailCategoryAlloc",
        "category",
        categoriesData,
        bill.categoryAllocations || [],
        billTotal,
    );

    // Update allocation amounts and netto display when brutto values change
    const detailBruttoInputs = [
        "detailBrutto19",
        "detailBrutto7",
        "detailBrutto0",
    ].map((id) => document.getElementById(id));
    const _detailBruttoHandler = () => {
        const total = detailBruttoInputs.reduce(
            (sum, inp) => sum + (parseFloat(inp.value) || 0),
            0,
        );
        document
            .getElementById("detailMotiveAlloc")
            .updateAmount(total);
        document
            .getElementById("detailCategoryAlloc")
            .updateAmount(total);
        updateDetailNetto();
    };
    detailBruttoInputs.forEach((input) => {
        input.oninput = _detailBruttoHandler;
    });

    // Handle images (gallery)
    galleryImages = bill.images || [];
    galleryIndex = 0;
    renderGallery();

    // Load edit history for this bill (by ID)
    const billLogs = allLogs.filter((log) => log.billId === id);
    const logBody = document.getElementById("billLogBody");
    if (billLogs.length === 0) {
        logBody.innerHTML =
            '<tr><td colspan="3">No edits yet.</td></tr>';
    } else {
        logBody.innerHTML = billLogs
            .map(
                (entry) => `
    <tr>
      <td class="px-3 py-2 text-slate-500 text-xs">${escapeHtml(formatDate(entry.timestamp))}</td>
      <td class="px-3 py-2 text-sm">${escapeHtml(entry.user)}</td>
      <td class="px-3 py-2">${formatChanges(entry.changes)}</td>
    </tr>
  `,
            )
            .join("");
    }

    // Show modal
    document.getElementById("billModal").style.display = "flex";
}

function formatChanges(changes) {
    if (!changes) return "";
    return Object.entries(changes)
        .map(
            ([key, value]) =>
                `<span class="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs">${escapeHtml(key)}: ${escapeHtml(String(value))}</span>`,
        )
        .join(", ");
}

function closeModal() {
    document.getElementById("billModal").style.display = "none";
    currentBillId = null;
    galleryImages = [];
    galleryIndex = 0;
}

async function deleteBill() {
    if (currentBillId === null) return;
    if (
        !confirm(
            "Are you sure you want to delete this bill? This cannot be undone.",
        )
    )
        return;
    try {
        const res = await fetch("/api/bills/" + currentBillId, {
            method: "DELETE",
        });
        const j = await res.json();
        if (j.ok) {
            closeModal();
            loadBills();
        } else {
            alert("Error: " + (j.error || "unknown"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

function toggleSelectAll(checkbox) {
    document
        .querySelectorAll(".bill-checkbox")
        .forEach((cb) => (cb.checked = checkbox.checked));
    updateSelectedCount();
}

function updateSelectedCount() {
    const checked = document.querySelectorAll(
        ".bill-checkbox:checked",
    ).length;
    document.getElementById("selectedCount").textContent = checked;
    document.getElementById("deleteSelectedBtn").style.display =
        checked > 0 ? "inline-block" : "none";
}

async function deleteSelected() {
    const checkboxes = document.querySelectorAll(
        ".bill-checkbox:checked",
    );
    const ids = Array.from(checkboxes).map((cb) =>
        parseInt(cb.dataset.id),
    );

    if (ids.length === 0) return;
    if (
        !confirm(
            `Delete ${ids.length} selected bill(s)? This cannot be undone.`,
        )
    )
        return;

    const resultEl = document.getElementById("billsResult");
    resultEl.textContent = "Deleting...";

    try {
        const res = await fetch("/api/bills/bulk-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
        });
        const j = await res.json();
        if (j.ok) {
            resultEl.textContent =
                "Deleted " + j.deleted + " bills";
            resultEl.className =
                "bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-4 py-3 text-sm mb-3";
            document.getElementById("selectAllBills").checked =
                false;
            loadBills();
        } else {
            resultEl.textContent = "Error: " + (j.error || "Error");
            resultEl.className =
                "bg-rose-50 text-rose-700 border border-rose-200 rounded-lg px-4 py-3 text-sm mb-3";
        }
    } catch (e) {
        resultEl.textContent = "Error: " + e.message;
        resultEl.className =
            "bg-rose-50 text-rose-700 border border-rose-200 rounded-lg px-4 py-3 text-sm mb-3";
    }
    setTimeout(() => {
        resultEl.textContent = "";
        resultEl.className = "";
    }, 5000);
}

function downloadReport() {
    const email = document.getElementById("reportUserSelect").value;
    if (!email) {
        alert("Please select a user");
        return;
    }
    window.open(
        "/api/report/" + encodeURIComponent(email),
        "_blank",
    );
}

// ========== Bill modal event handlers ==========
document.addEventListener("DOMContentLoaded", () => {
    // Wire add-image inputs with crop flow
    initAddImageInputs();

    // Close modal when clicking outside
    document.getElementById("billModal").addEventListener("click", (e) => {
        if (e.target.id === "billModal") closeModal();
    });

    // Save bill changes
    document.getElementById("billDetailForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (currentBillId === null) return;

        const motiveAllocContainer = document.getElementById("detailMotiveAlloc");
        const categoryAllocContainer = document.getElementById("detailCategoryAlloc");
        const motiveAllocs = motiveAllocContainer.getAllocations();
        const categoryAllocs = categoryAllocContainer.getAllocations();

        if (motiveAllocs.length > 0) {
            const motiveTotal = motiveAllocContainer.getTotalPercent();
            if (Math.abs(motiveTotal - 100) > 0.01) {
                showMessage("detailResult", "Motive allocations must sum to 100%", true);
                return;
            }
        }
        if (categoryAllocs.length > 0) {
            const categoryTotal = categoryAllocContainer.getTotalPercent();
            if (Math.abs(categoryTotal - 100) > 0.01) {
                showMessage("detailResult", "Category allocations must sum to 100%", true);
                return;
            }
        }

        const form = e.target;
        const data = {
            vendor: form.vendor.value,
            description: form.description.value,
            brutto19: parseNum(form.brutto19.value),
            brutto7: parseNum(form.brutto7.value),
            brutto0: parseNum(form.brutto0.value),
            date: form.date.value,
            isDraft: form.isDraft ? form.isDraft.checked : false,
            motiveAllocations: motiveAllocs,
            categoryAllocations: categoryAllocs,
        };

        try {
            const res = await fetch("/api/bills/" + currentBillId, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const j = await res.json();
            if (j.ok) {
                showMessage("detailResult", "Bill updated!", false);
                loadBills();
            } else {
                showMessage("detailResult", "Error: " + (j.error || "unknown"), true);
            }
        } catch (err) {
            showMessage("detailResult", "Error: " + err.message, true);
        }
    });
});
