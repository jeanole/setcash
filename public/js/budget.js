// ========== Budget Matrix ==========

async function loadBudgetMatrix() {
    try {
        const [matrixRes, motRes, catRes] = await Promise.all([
            fetch("/api/budget-matrix"),
            fetch("/api/motives"),
            fetch("/api/categories"),
        ]);
        budgetData = await matrixRes.json();
        motivesData = await motRes.json();
        categoriesData = await catRes.json();
    } catch (e) {
        document.getElementById("budgetMatrixContainer").innerHTML =
            "<p>Error loading budget matrix.</p>";
        return;
    }
    document.getElementById("budgetGrandTotal").textContent =
        "Total Budget (netto): " +
        formatCurrency(budgetData.grandTotal);
    // Compute total spent
    var ms = budgetData.motiveSpending || {};
    var totalSpent = 0;
    for (var k in ms) totalSpent += ms[k] || 0;
    var spentEl = document.getElementById("budgetGrandSpent");
    var spentCls =
        budgetData.grandTotal <= 0
            ? totalSpent > 0
                ? "bm-spent-over"
                : ""
            : totalSpent / budgetData.grandTotal >= 1
              ? "bm-spent-over"
              : totalSpent / budgetData.grandTotal >= 0.8
                ? "bm-spent-warn"
                : "bm-spent-ok";
    spentEl.textContent =
        "Total Ausgaben (netto): " + formatCurrency(totalSpent);
    spentEl.className = spentCls;
    renderBudgetMatrix();
}

function renderBudgetMatrix() {
    if (!budgetData) return;
    var container = document.getElementById(
        "budgetMatrixContainer",
    );
    var isAdmin =
        currentUser &&
        (currentUser.superAdmin ||
            ["admin", "owner"].includes(
                currentUser.currentProjectRole,
            ));
    var motives = budgetData.motives;
    var categories = budgetData.categories;

    if (
        motives.length === 0 &&
        categories.length === 0 &&
        !isAdmin
    ) {
        container.innerHTML =
            "<p>No budget data configured yet.</p>";
        return;
    }

    var motiveSpending = budgetData.motiveSpending || {};
    var categorySpending = budgetData.categorySpending || {};
    var cellSpending = budgetData.cellSpending || {};

    // Helper: color class for spent vs budget
    function spentClass(spent, budget) {
        if (budget <= 0) return spent > 0 ? "bm-spent-over" : "";
        var pct = spent / budget;
        if (pct >= 1) return "bm-spent-over";
        if (pct >= 0.8) return "bm-spent-warn";
        return "bm-spent-ok";
    }

    // Helper: cell background class based on spent vs budget
    function cellClass(spent, budget) {
        if (spent <= 0 && budget <= 0) return "";
        if (budget <= 0) return "bm-cell-neg";
        var pct = spent / budget;
        if (pct >= 1) return "bm-cell-over";
        if (pct >= 0.8) return "bm-cell-warn";
        if (pct > 0) return "bm-cell-ok";
        return "";
    }

    // Helper: tooltip text for a cell
    function cellTooltip(spent, budget) {
        if (spent <= 0 && budget <= 0) return "";
        var remaining = budget - spent;
        var pct =
            budget > 0 ? ((spent / budget) * 100).toFixed(1) : "—";
        return (
            "Budget (netto): " +
            formatCurrency(budget) +
            "\n" +
            "Ausgaben (netto): " +
            formatCurrency(spent) +
            "\n" +
            "Verbleibend: " +
            formatCurrency(remaining) +
            "\n" +
            "Verbraucht: " +
            pct +
            "%"
        );
    }

    var html =
        '<table id="budgetMatrixTable" class="w-full text-sm bm-table border border-slate-200 rounded-lg" style="border-collapse:separate;border-spacing:0"><thead><tr>';
    html +=
        '<th class="bm-corner bg-slate-800 text-white font-semibold text-xs min-w-[160px] px-3 py-2.5">Kategorie \\ Motiv</th>';

    // Column headers (motives)
    for (var mi = 0; mi < motives.length; mi++) {
        var m = motives[mi];
        var isDefault = m.name === "Default";
        if (isAdmin && !isDefault) {
            html +=
                '<th class="bm-col-header bg-slate-700 text-white min-w-[120px] px-3 py-2.5 text-xs font-semibold" data-mot-id="' +
                m.id +
                '">' +
                '<span class="bm-header-text">' +
                escapeHtml(m.name) +
                "</span>" +
                '<span class="bm-header-actions inline-flex gap-0.5 ml-1.5 align-middle">' +
                '<button class="bm-edit-col bg-transparent border-none text-sm cursor-pointer px-1 py-0.5 rounded text-white/50 hover:text-white hover:bg-white/15" title="Rename" data-mot-id="' +
                m.id +
                '">&#9998;</button>' +
                '<button class="bm-delete-col bg-transparent border-none text-sm cursor-pointer px-1 py-0.5 rounded text-white/50 hover:text-rose-500 hover:bg-rose-500/15" title="Delete" data-mot-id="' +
                m.id +
                '">&times;</button>' +
                "</span>" +
                "</th>";
        } else {
            html +=
                '<th class="bm-col-header bg-slate-700 text-white min-w-[120px] px-3 py-2.5 text-xs font-semibold' +
                (isDefault ? " bm-locked" : "") +
                '">' +
                '<span class="bm-header-text' +
                (isDefault ? " opacity-70 italic" : "") +
                '">' +
                escapeHtml(m.name) +
                "</span>" +
                "</th>";
        }
    }

    // Inline add-column cell (admin only)
    if (isAdmin) {
        html +=
            '<th class="bm-add-col bg-slate-50 px-2 py-2 min-w-[160px]">' +
            '<div class="flex items-center gap-1">' +
            '<input type="text" class="bm-inline-input" id="addMotiveInput" placeholder="Neues Motiv...">' +
            '<button class="bg-emerald-500 text-white border-none rounded w-7 h-7 text-lg font-bold cursor-pointer flex items-center justify-center p-0 shrink-0 hover:bg-emerald-600" id="addMotiveColBtn" title="Add">+</button>' +
            "</div>" +
            "</th>";
    }

    html +=
        '<th class="bg-slate-50 font-semibold text-right text-slate-900 px-3 py-2.5 text-xs">Budget (netto)</th>';
    html +=
        '<th class="bg-slate-50 font-semibold text-right text-slate-500 px-3 py-2.5 text-xs bm-spent-header">Ausgaben (netto)</th>';
    html += "</tr></thead><tbody>";

    // Data rows
    var totalSpentAll = 0;
    for (var ci = 0; ci < categories.length; ci++) {
        var cat = categories[ci];
        var isDefaultCat = cat.name === "Uncategorized";
        html += '<tr data-cat-id="' + cat.id + '">';

        // Row header
        if (isAdmin && !isDefaultCat) {
            html +=
                '<td class="bm-row-header bg-slate-100 font-semibold text-slate-800 px-3 py-2.5 text-xs" data-cat-id="' +
                cat.id +
                '">' +
                '<span class="bm-header-text">' +
                escapeHtml(cat.name) +
                "</span>" +
                '<span class="bm-header-actions inline-flex gap-0.5 ml-1.5 align-middle">' +
                '<button class="bm-edit-row bg-transparent border-none text-sm cursor-pointer px-1 py-0.5 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200" title="Rename" data-cat-id="' +
                cat.id +
                '">&#9998;</button>' +
                '<button class="bm-delete-row bg-transparent border-none text-sm cursor-pointer px-1 py-0.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50" title="Delete" data-cat-id="' +
                cat.id +
                '">&times;</button>' +
                "</span>" +
                "</td>";
        } else {
            html +=
                '<td class="bm-row-header bg-slate-100 font-semibold text-slate-800 px-3 py-2.5 text-xs' +
                (isDefaultCat ? " bm-locked" : "") +
                '">' +
                '<span class="bm-header-text' +
                (isDefaultCat ? " opacity-70 italic" : "") +
                '">' +
                escapeHtml(cat.name) +
                "</span></td>";
        }

        // Value cells
        var rowTotal = 0;
        for (var mi2 = 0; mi2 < motives.length; mi2++) {
            var mot = motives[mi2];
            var key = cat.id + "_" + mot.id;
            var val = budgetData.matrix[key] || 0;
            var cSpent = cellSpending[key] || 0;
            var cc = cellClass(cSpent, val);
            var ct = cellTooltip(cSpent, val);
            rowTotal += val;
            if (isAdmin) {
                var displayVal = val
                    ? val.toFixed(2).replace(".", ",")
                    : "0,00";
                html +=
                    '<td class="text-right tabular-nums p-px border border-slate-100' +
                    (cc ? " " + cc : "") +
                    '"' +
                    (ct ? ' title="' + escapeHtml(ct) + '"' : "") +
                    ">" +
                    '<input type="text" inputmode="decimal" class="budget-cell-input" value="' +
                    displayVal +
                    '" data-cat="' +
                    cat.id +
                    '" data-mot="' +
                    mot.id +
                    '">' +
                    "</td>";
            } else {
                html +=
                    '<td class="text-right tabular-nums px-3 py-2 border border-slate-100' +
                    (cc ? " " + cc : "") +
                    '"' +
                    (ct ? ' title="' + escapeHtml(ct) + '"' : "") +
                    ">" +
                    formatCurrency(val) +
                    "</td>";
            }
        }

        if (isAdmin) html += "<td></td>"; // spacer under "+" column

        // Row budget total
        html +=
            '<td class="bg-slate-50 font-semibold text-right text-slate-900 px-3 py-2 tabular-nums"><strong>' +
            formatCurrency(rowTotal) +
            "</strong></td>";

        // Row spent
        var catSpent = categorySpending[cat.id] || 0;
        totalSpentAll += catSpent;
        html +=
            '<td class="bm-row-spent text-right font-semibold tabular-nums px-3 py-2 ' +
            spentClass(catSpent, rowTotal) +
            '">' +
            formatCurrency(catSpent) +
            "</td>";

        html += "</tr>";
    }

    // Inline add-row (admin only)
    if (isAdmin) {
        var addColspan = motives.length + (isAdmin ? 1 : 0) + 2;
        html +=
            '<tr><td class="bm-row-header bg-slate-50 px-3 py-2 border-t-2 border-dashed border-slate-200" style="position:sticky;left:0;z-index:2">' +
            '<div class="flex items-center gap-1">' +
            '<input type="text" class="bm-inline-input" id="addCategoryInput" placeholder="Neue Kategorie...">' +
            '<button class="bg-emerald-500 text-white border-none rounded w-7 h-7 text-lg font-bold cursor-pointer flex items-center justify-center p-0 shrink-0 hover:bg-emerald-600" id="addCategoryRowBtn" title="Add">+</button>' +
            "</div>" +
            "</td>" +
            '<td colspan="' +
            addColspan +
            '" class="bg-slate-50 border-t-2 border-dashed border-slate-200"></td></tr>';
    }

    // Footer: budget totals row
    html +=
        '</tbody><tfoot><tr><th class="bg-slate-50 font-semibold text-right text-slate-900 px-3 py-2.5 text-xs">Budget (netto)</th>';
    var footerGrand = 0;
    for (var mi3 = 0; mi3 < motives.length; mi3++) {
        var colTotal = 0;
        for (var ci2 = 0; ci2 < categories.length; ci2++) {
            colTotal +=
                budgetData.matrix[
                    categories[ci2].id + "_" + motives[mi3].id
                ] || 0;
        }
        footerGrand += colTotal;
        html +=
            '<th class="bm-col-total bg-slate-50 font-semibold text-right tabular-nums px-3 py-2.5 text-xs" data-mot="' +
            motives[mi3].id +
            '">' +
            formatCurrency(colTotal) +
            "</th>";
    }
    if (isAdmin) html += '<th class="bg-slate-50"></th>';
    html +=
        '<th class="bm-footer-grand bg-slate-100 font-semibold text-right text-slate-900 tabular-nums px-3 py-2.5"><strong>' +
        formatCurrency(footerGrand) +
        "</strong></th>";
    html += '<th class="bg-slate-100"></th>';
    html += "</tr>";

    // Footer: spent totals row
    html +=
        '<tr><th class="bg-slate-50 font-semibold text-right text-slate-500 px-3 py-2.5 text-xs bm-spent-header">Ausgaben (netto)</th>';
    var footerSpentGrand = 0;
    for (var mi4 = 0; mi4 < motives.length; mi4++) {
        var motSpent = motiveSpending[motives[mi4].id] || 0;
        footerSpentGrand += motSpent;
        var colBudget = 0;
        for (var ci3 = 0; ci3 < categories.length; ci3++) {
            colBudget +=
                budgetData.matrix[
                    categories[ci3].id + "_" + motives[mi4].id
                ] || 0;
        }
        html +=
            '<th class="bm-col-spent text-right font-semibold tabular-nums px-3 py-2.5 text-xs ' +
            spentClass(motSpent, colBudget) +
            '" data-mot="' +
            motives[mi4].id +
            '">' +
            formatCurrency(motSpent) +
            "</th>";
    }
    if (isAdmin) html += '<th class="bg-slate-50"></th>';
    html += '<th class="bg-slate-100"></th>';
    html +=
        '<th class="text-right font-semibold tabular-nums px-3 py-2.5 ' +
        spentClass(footerSpentGrand, footerGrand) +
        '"><strong>' +
        formatCurrency(footerSpentGrand) +
        "</strong></th>";
    html += "</tr>";

    html += "</tfoot></table>";

    container.innerHTML = html;

    // Set scroll-padding to match sticky column width for snap alignment
    var cornerEl = container.querySelector(".bm-corner");
    if (cornerEl) {
        container.style.scrollPaddingLeft =
            cornerEl.offsetWidth + "px";
    }

    // Wire up admin interactions
    if (isAdmin) {
        // Live total updates on cell input + format on blur
        container
            .querySelectorAll(".budget-cell-input")
            .forEach(function (inp) {
                inp.addEventListener("input", updateBudgetTotals);
                inp.addEventListener("focus", function () {
                    // On focus, show raw number for easy editing
                    var num = parseNum(inp.value);
                    inp.value = num
                        ? num.toString().replace(".", ",")
                        : "";
                    inp.select();
                });
                inp.addEventListener("blur", function () {
                    // On blur, format with comma
                    var num = parseNum(inp.value);
                    inp.value = num.toFixed(2).replace(".", ",");
                });
            });

        // Helper: turn a header cell into an inline edit input
        function startHeaderEdit(cell, oldName, saveCallback) {
            var span = cell.querySelector(".bm-header-text");
            var actions = cell.querySelector(".bm-header-actions");
            if (span) span.style.display = "none";
            if (actions) actions.style.display = "none";
            var input = document.createElement("input");
            input.type = "text";
            input.value = oldName;
            input.className = "bm-header-input";
            cell.appendChild(input);
            input.focus();
            input.select();

            function commit() {
                var newName = input.value.trim();
                if (!newName || newName === oldName) {
                    renderBudgetMatrix();
                    return;
                }
                saveCallback(newName);
            }
            input.addEventListener("blur", commit);
            input.addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    input.blur();
                }
                if (e.key === "Escape") {
                    renderBudgetMatrix();
                }
            });
        }

        // Edit column (motive) name
        container
            .querySelectorAll(".bm-edit-col")
            .forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var th = btn.closest("th");
                    var motId = th.dataset.motId;
                    var oldName =
                        th.querySelector(
                            ".bm-header-text",
                        ).textContent;
                    startHeaderEdit(
                        th,
                        oldName,
                        function (newName) {
                            fetch("/api/admin/motive/" + motId, {
                                method: "PUT",
                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },
                                body: JSON.stringify({
                                    motive: newName,
                                }),
                            })
                                .then(function (r) {
                                    return r.json();
                                })
                                .then(function (j) {
                                    if (j.ok) loadBudgetMatrix();
                                    else {
                                        alert(j.error || "Error");
                                        renderBudgetMatrix();
                                    }
                                });
                        },
                    );
                });
            });

        // Edit row (category) name
        container
            .querySelectorAll(".bm-edit-row")
            .forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var td = btn.closest("td");
                    var catId = td.dataset.catId;
                    var oldName =
                        td.querySelector(
                            ".bm-header-text",
                        ).textContent;
                    startHeaderEdit(
                        td,
                        oldName,
                        function (newName) {
                            fetch("/api/admin/category/" + catId, {
                                method: "PUT",
                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },
                                body: JSON.stringify({
                                    category: newName,
                                }),
                            })
                                .then(function (r) {
                                    return r.json();
                                })
                                .then(function (j) {
                                    if (j.ok) loadBudgetMatrix();
                                    else {
                                        alert(j.error || "Error");
                                        renderBudgetMatrix();
                                    }
                                });
                        },
                    );
                });
            });

        // Delete column (motive)
        container
            .querySelectorAll(".bm-delete-col")
            .forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var motId = btn.dataset.motId;
                    if (
                        !confirm(
                            "Delete this Motiv column and its budget data?",
                        )
                    )
                        return;
                    fetch("/api/admin/motive/" + motId, {
                        method: "DELETE",
                    })
                        .then(function (r) {
                            return r.json();
                        })
                        .then(function (j) {
                            if (j.ok) loadBudgetMatrix();
                            else alert(j.error || "Error");
                        });
                });
            });

        // Delete row (category)
        container
            .querySelectorAll(".bm-delete-row")
            .forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var catId = btn.dataset.catId;
                    if (
                        !confirm(
                            "Delete this Kategorie row and its budget data?",
                        )
                    )
                        return;
                    fetch("/api/admin/category/" + catId, {
                        method: "DELETE",
                    })
                        .then(function (r) {
                            return r.json();
                        })
                        .then(function (j) {
                            if (j.ok) loadBudgetMatrix();
                            else alert(j.error || "Error");
                        });
                });
            });

        // Add motive column (inline)
        function submitNewMotive() {
            var input = document.getElementById("addMotiveInput");
            var name = (input.value || "").trim();
            if (!name) {
                input.focus();
                return;
            }
            input.disabled = true;
            fetch("/api/admin/motive", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motive: name, budget: 0 }),
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.ok) loadBudgetMatrix();
                    else {
                        alert(j.error || "Error");
                        input.disabled = false;
                    }
                });
        }
        document
            .getElementById("addMotiveColBtn")
            .addEventListener("click", submitNewMotive);
        document
            .getElementById("addMotiveInput")
            .addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    submitNewMotive();
                }
            });

        // Add category row (inline)
        function submitNewCategory() {
            var input = document.getElementById("addCategoryInput");
            var name = (input.value || "").trim();
            if (!name) {
                input.focus();
                return;
            }
            input.disabled = true;
            fetch("/api/admin/category", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: name, budget: 0 }),
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.ok) loadBudgetMatrix();
                    else {
                        alert(j.error || "Error");
                        input.disabled = false;
                    }
                });
        }
        document
            .getElementById("addCategoryRowBtn")
            .addEventListener("click", submitNewCategory);
        document
            .getElementById("addCategoryInput")
            .addEventListener("keydown", function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    submitNewCategory();
                }
            });
    }
}

function updateBudgetTotals() {
    if (!budgetData) return;
    var motives = budgetData.motives;
    var categories = budgetData.categories;
    var motiveSpending = budgetData.motiveSpending || {};
    var categorySpending = budgetData.categorySpending || {};
    var cellSpending = budgetData.cellSpending || {};

    function cellClass(spent, budget) {
        if (spent <= 0 && budget <= 0) return "";
        if (budget <= 0) return "bm-cell-neg";
        var pct = spent / budget;
        if (pct >= 1) return "bm-cell-over";
        if (pct >= 0.8) return "bm-cell-warn";
        if (pct > 0) return "bm-cell-ok";
        return "";
    }

    function cellTooltip(spent, budget) {
        if (spent <= 0 && budget <= 0) return "";
        var remaining = budget - spent;
        var pct =
            budget > 0 ? ((spent / budget) * 100).toFixed(1) : "—";
        return (
            "Budget (netto): " +
            formatCurrency(budget) +
            "\n" +
            "Ausgaben (netto): " +
            formatCurrency(spent) +
            "\n" +
            "Verbleibend: " +
            formatCurrency(remaining) +
            "\n" +
            "Verbraucht: " +
            pct +
            "%"
        );
    }

    function spentClass(spent, budget) {
        if (budget <= 0) return spent > 0 ? "bm-spent-over" : "";
        var pct = spent / budget;
        if (pct >= 1) return "bm-spent-over";
        if (pct >= 0.8) return "bm-spent-warn";
        return "bm-spent-ok";
    }

    // Update matrix from inputs and refresh cell appearance
    document
        .querySelectorAll(".budget-cell-input")
        .forEach(function (inp) {
            var key = inp.dataset.cat + "_" + inp.dataset.mot;
            var newVal = parseNum(inp.value);
            budgetData.matrix[key] = newVal;
            var td = inp.closest("td");
            var cSpent = cellSpending[key] || 0;
            var cc = cellClass(cSpent, newVal);
            var ct = cellTooltip(cSpent, newVal);
            // Update td class
            td.className =
                "bm-cell bm-cell-editable" + (cc ? " " + cc : "");
            // Update td title
            td.title = ct;
        });

    // Row totals + spent colors
    var rows = document.querySelectorAll(
        "#budgetMatrixTable tbody tr[data-cat-id]",
    );
    rows.forEach(function (row, ri) {
        if (ri >= categories.length) return;
        var rowTotal = 0;
        for (var mi = 0; mi < motives.length; mi++) {
            rowTotal +=
                budgetData.matrix[
                    categories[ri].id + "_" + motives[mi].id
                ] || 0;
        }
        var cell = row.querySelector(".bm-row-total");
        if (cell)
            cell.innerHTML =
                "<strong>" + formatCurrency(rowTotal) + "</strong>";
        var spentCell = row.querySelector(".bm-row-spent");
        if (spentCell) {
            var catSpent = categorySpending[categories[ri].id] || 0;
            spentCell.className =
                "bm-row-spent " + spentClass(catSpent, rowTotal);
        }
    });

    // Column totals + spent colors
    var footerGrand = 0;
    for (var mi2 = 0; mi2 < motives.length; mi2++) {
        var colTotal = 0;
        for (var ci = 0; ci < categories.length; ci++) {
            colTotal +=
                budgetData.matrix[
                    categories[ci].id + "_" + motives[mi2].id
                ] || 0;
        }
        footerGrand += colTotal;
        var colCell = document.querySelector(
            '.bm-col-total[data-mot="' + motives[mi2].id + '"]',
        );
        if (colCell) colCell.textContent = formatCurrency(colTotal);
        var motSpent = motiveSpending[motives[mi2].id] || 0;
        var spentColCell = document.querySelector(
            '.bm-col-spent[data-mot="' + motives[mi2].id + '"]',
        );
        if (spentColCell)
            spentColCell.className =
                "bm-col-spent " + spentClass(motSpent, colTotal);
    }

    var grandCell = document.querySelector(".bm-footer-grand");
    if (grandCell)
        grandCell.innerHTML =
            "<strong>" + formatCurrency(footerGrand) + "</strong>";

    // Update header grand total + spent color
    document.getElementById("budgetGrandTotal").textContent =
        "Total Budget (netto): " + formatCurrency(footerGrand);
    var totalSpent = 0;
    for (var k in motiveSpending)
        totalSpent += motiveSpending[k] || 0;
    var spentEl = document.getElementById("budgetGrandSpent");
    var spentCls =
        footerGrand <= 0
            ? totalSpent > 0
                ? "bm-spent-over"
                : ""
            : totalSpent / footerGrand >= 1
              ? "bm-spent-over"
              : totalSpent / footerGrand >= 0.8
                ? "bm-spent-warn"
                : "bm-spent-ok";
    spentEl.className = spentCls;
}

async function saveBudgetMatrix() {
    var inputs = document.querySelectorAll(".budget-cell-input");
    var cells = [];
    inputs.forEach(function (inp) {
        cells.push({
            category_id: parseInt(inp.dataset.cat),
            motive_id: parseInt(inp.dataset.mot),
            amount: parseNum(inp.value),
        });
    });
    try {
        var res = await fetch("/api/admin/budget-matrix", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cells: cells }),
        });
        var j = await res.json();
        if (j.ok) {
            showMessage("budgetSaveResult", "Budget saved!", false);
            loadBudgetMatrix();
        } else {
            showMessage(
                "budgetSaveResult",
                "Error: " + (j.error || "unknown"),
                true,
            );
        }
    } catch (e) {
        showMessage(
            "budgetSaveResult",
            "Error: " + e.message,
            true,
        );
    }
}
