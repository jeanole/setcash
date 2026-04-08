// ========== Spending ==========

async function loadSpending() {
    const tbody = document.getElementById("spendingBody");
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    try {
        const res = await fetch("/api/bills/by-motive");
        const data = await res.json();
        if (data.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="5">No spending data.</td></tr>';
            document.getElementById(
                "grandTotalBudget",
            ).textContent = formatCurrency(0);
            document.getElementById("grandTotalSpent").textContent =
                formatCurrency(0);
            document.getElementById(
                "grandTotalRemaining",
            ).textContent = formatCurrency(0);
            document.getElementById(
                "grandTotalPercent",
            ).textContent = "0.00%";
            return;
        }
        let totalBudget = 0,
            totalSpent = 0;
        tbody.innerHTML = data
            .map((item) => {
                totalBudget += item.budget;
                totalSpent += item.spent;
                const bgClass =
                    item.percent > 100
                        ? "bg-rose-50"
                        : item.percent > 80
                          ? "bg-amber-50"
                          : "";
                const barColor =
                    item.percent > 100
                        ? "bg-rose-500"
                        : item.percent > 80
                          ? "bg-amber-500"
                          : "bg-emerald-500";
                return `<tr class="${bgClass}">
  <td class="px-3 py-2.5">${escapeHtml(item.motive)}</td>
  <td class="px-3 py-2.5 tabular-nums">${formatCurrency(item.budget)}</td>
  <td class="px-3 py-2.5 tabular-nums">${formatCurrency(item.spent)}</td>
  <td class="px-3 py-2.5 tabular-nums ${item.remaining < 0 ? "text-rose-600 font-semibold" : ""}">${formatCurrency(item.remaining)}</td>
  <td class="px-3 py-2.5">
    <div class="inline-block w-24 h-2 bg-slate-100 rounded-full mr-2 align-middle">
      <div class="progress-fill ${barColor} h-full rounded-full" style="width: ${Math.min(item.percent, 100)}%"></div>
    </div>
    <span class="text-xs text-slate-500">${item.percent.toFixed(2)}%</span>
  </td>
</tr>`;
            })
            .join("");
        const totalRemaining = totalBudget - totalSpent;
        const totalPercent =
            totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        document.getElementById("grandTotalBudget").textContent =
            formatCurrency(totalBudget);
        document.getElementById("grandTotalSpent").textContent =
            formatCurrency(totalSpent);
        document.getElementById("grandTotalRemaining").textContent =
            formatCurrency(totalRemaining);
        document.getElementById("grandTotalPercent").textContent =
            totalPercent.toFixed(2) + "%";
    } catch (e) {
        tbody.innerHTML =
            '<tr><td colspan="5">Error loading data.</td></tr>';
    }
}

async function loadCategorySpending() {
    const tbody = document.getElementById("categorySpendingBody");
    tbody.innerHTML =
        '<tr><td colspan="5" class="px-3 py-4 text-slate-400 text-center">Loading...</td></tr>';
    try {
        const res = await fetch("/api/bills/by-category");
        const data = await res.json();
        if (data.length === 0) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="px-3 py-4 text-slate-400 text-center">No category spending data.</td></tr>';
            document.getElementById(
                "catGrandTotalBudget",
            ).textContent = formatCurrency(0);
            document.getElementById(
                "catGrandTotalSpent",
            ).textContent = formatCurrency(0);
            document.getElementById(
                "catGrandTotalRemaining",
            ).textContent = formatCurrency(0);
            document.getElementById(
                "catGrandTotalPercent",
            ).textContent = "0.00%";
            return;
        }
        let totalBudget = 0,
            totalSpent = 0;
        tbody.innerHTML = data
            .map((item) => {
                totalBudget += item.budget;
                totalSpent += item.spent;
                const bgClass =
                    item.percent > 100
                        ? "bg-rose-50"
                        : item.percent > 80
                          ? "bg-amber-50"
                          : "";
                const barColor =
                    item.percent > 100
                        ? "bg-rose-500"
                        : item.percent > 80
                          ? "bg-amber-500"
                          : "bg-emerald-500";
                return `<tr class="${bgClass}">
  <td class="px-3 py-2.5">${escapeHtml(item.category)}</td>
  <td class="px-3 py-2.5 tabular-nums">${formatCurrency(item.budget)}</td>
  <td class="px-3 py-2.5 tabular-nums">${formatCurrency(item.spent)}</td>
  <td class="px-3 py-2.5 tabular-nums ${item.remaining < 0 ? "text-rose-600 font-semibold" : ""}">${formatCurrency(item.remaining)}</td>
  <td class="px-3 py-2.5">
    <div class="inline-block w-24 h-2 bg-slate-100 rounded-full mr-2 align-middle">
      <div class="progress-fill ${barColor} h-full rounded-full" style="width: ${Math.min(item.percent, 100)}%"></div>
    </div>
    <span class="text-xs text-slate-500">${item.percent.toFixed(2)}%</span>
  </td>
</tr>`;
            })
            .join("");
        const totalRemaining = totalBudget - totalSpent;
        const totalPercent =
            totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        document.getElementById("catGrandTotalBudget").textContent =
            formatCurrency(totalBudget);
        document.getElementById("catGrandTotalSpent").textContent =
            formatCurrency(totalSpent);
        document.getElementById(
            "catGrandTotalRemaining",
        ).textContent = formatCurrency(totalRemaining);
        document.getElementById(
            "catGrandTotalPercent",
        ).textContent = totalPercent.toFixed(2) + "%";
    } catch (e) {
        tbody.innerHTML =
            '<tr><td colspan="5">Error loading data.</td></tr>';
    }
}
