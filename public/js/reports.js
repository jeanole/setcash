// ========== Reports ==========

async function loadReportUsers() {
    try {
        const res = await fetch("/api/report-users");
        const users = await res.json();
        const sel = document.getElementById("reportUserSelect");
        sel.innerHTML = users
            .map((u) => {
                const label =
                    u.roleName && u.roleName !== "Misc"
                        ? `${u.email} (${u.roleName})`
                        : u.email;
                return `<option value="${escapeHtml(u.email)}">${escapeHtml(label)}</option>`;
            })
            .join("");
    } catch (e) {
        console.error("Could not load report users:", e);
    }
}
