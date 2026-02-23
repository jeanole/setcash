// ========== V-Geld ==========

async function loadVGeld() {
    const tbody = document.getElementById("vgeldBody");
    tbody.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';

    try {
        const res = await fetch("/api/vgeld");
        allVGeld = await res.json();

        if (allVGeld.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="6">No transfers yet.</td></tr>';
        } else {
            const isAdmin =
                currentUser &&
                (currentUser.superAdmin ||
                    ["admin", "owner"].includes(
                        currentUser.currentProjectRole,
                    ));
            tbody.innerHTML = allVGeld
                .map(
                    (entry) => `
  <tr>
    <td class="px-3 py-2.5 text-slate-500">${escapeHtml(formatDate(entry.date))}</td>
    <td class="px-3 py-2.5 tabular-nums">${formatCurrency(entry.amount)}</td>
    <td class="px-3 py-2.5">${escapeHtml(entry.from || "External")}</td>
    <td class="px-3 py-2.5">${escapeHtml(entry.to)}</td>
    <td class="px-3 py-2.5 text-slate-500">${escapeHtml(entry.createdBy)}</td>
    <td class="admin-only px-3 py-2.5" style="${isAdmin ? "" : "display:none"}">
      <button class="text-xs px-2.5 py-1 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors border-none cursor-pointer" onclick="deleteVGeld(${entry.id})">Delete</button>
    </td>
  </tr>
`,
                )
                .join("");
        }
    } catch (e) {
        tbody.innerHTML =
            '<tr><td colspan="6">Error loading data.</td></tr>';
    }
}

async function loadVGeldAnalysis() {
    const analysisBody =
        document.getElementById("vgeldAnalysisBody");
    analysisBody.innerHTML =
        '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const res = await fetch("/api/vgeld/analysis");
        const analysis = await res.json();

        if (analysis.length === 0) {
            analysisBody.innerHTML =
                '<tr><td colspan="5">No data.</td></tr>';
            document.getElementById(
                "vgeldTotalReceived",
            ).textContent = formatCurrency(0);
            document.getElementById("vgeldTotalSpent").textContent =
                formatCurrency(0);
            document.getElementById(
                "vgeldTotalRemaining",
            ).textContent = formatCurrency(0);
            document.getElementById(
                "vgeldTotalPercent",
            ).textContent = "0.00%";
        } else {
            let totalReceived = 0,
                totalSpent = 0;
            analysisBody.innerHTML = analysis
                .map((item) => {
                    totalReceived += item.received;
                    totalSpent += item.spent;
                    const bgClass =
                        item.percentUsed > 100
                            ? "bg-rose-50"
                            : item.percentUsed > 80
                              ? "bg-amber-50"
                              : "";
                    const barColor =
                        item.percentUsed > 100
                            ? "bg-rose-500"
                            : item.percentUsed > 80
                              ? "bg-amber-500"
                              : "bg-emerald-500";
                    return `<tr class="${bgClass}">
    <td class="px-3 py-2.5">${escapeHtml(item.user)}</td>
    <td class="px-3 py-2.5 tabular-nums">${formatCurrency(item.received)}</td>
    <td class="px-3 py-2.5 tabular-nums">${formatCurrency(item.spent)}</td>
    <td class="px-3 py-2.5 tabular-nums ${item.remaining < 0 ? "text-rose-600 font-semibold" : ""}">${formatCurrency(item.remaining)}</td>
    <td class="px-3 py-2.5">
      <div class="inline-block w-24 h-2 bg-slate-100 rounded-full mr-2 align-middle">
        <div class="progress-fill ${barColor} h-full rounded-full" style="width: ${Math.min(item.percentUsed, 100)}%"></div>
      </div>
      <span class="text-xs text-slate-500">${item.percentUsed.toFixed(2)}%</span>
    </td>
  </tr>`;
                })
                .join("");
            const totalRemaining = totalReceived - totalSpent;
            const totalPercent =
                totalReceived > 0
                    ? (totalSpent / totalReceived) * 100
                    : 0;
            document.getElementById(
                "vgeldTotalReceived",
            ).textContent = formatCurrency(totalReceived);
            document.getElementById("vgeldTotalSpent").textContent =
                formatCurrency(totalSpent);
            document.getElementById(
                "vgeldTotalRemaining",
            ).textContent = formatCurrency(totalRemaining);
            document.getElementById(
                "vgeldTotalPercent",
            ).textContent = totalPercent.toFixed(2) + "%";
        }
    } catch (e) {
        analysisBody.innerHTML =
            '<tr><td colspan="5">Error loading data.</td></tr>';
    }
}

async function deleteVGeld(id) {
    if (!confirm("Delete this V-Geld transfer?")) return;
    try {
        const res = await fetch("/api/vgeld/" + id, {
            method: "DELETE",
        });
        const j = await res.json();
        if (j.ok) {
            loadVGeld();
        } else {
            alert("Error: " + (j.error || "unknown"));
        }
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function loadUsersForVGeld() {
    try {
        const res = await fetch("/api/users");
        const users = await res.json();
        const sel = document.getElementById("vgeldToSelect");
        sel.innerHTML = users
            .map(
                (u) =>
                    `<option value="${escapeHtml(u.email)}">${escapeHtml(u.email)}</option>`,
            )
            .join("");
    } catch (e) {
        console.error("Could not load users for V-Geld");
    }
}
