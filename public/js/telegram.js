// ========== Telegram ==========

async function openTelegramLinkModal() {
    closeMenu();
    // Check current status
    let tgStatus;
    try {
        tgStatus = await (
            await fetch("/api/telegram/status")
        ).json();
    } catch (e) {
        return;
    }

    const modal = document.getElementById("telegramLinkModal");
    const body = document.getElementById("telegramLinkBody");

    if (tgStatus.linked) {
        body.innerHTML = `
<p style="color:#27ae60;font-weight:600">Telegram-Account ist verknüpft.</p>
<p style="font-size:0.9em;color:#666">Verknüpft seit: ${escapeHtml(tgStatus.linkedAt || "")}</p>
<button class="danger" onclick="unlinkTelegramSelf()">Verknüpfung aufheben</button>
`;
    } else {
        body.innerHTML =
            '<p style="color:#999">Code wird geladen...</p>';
        modal.style.display = "flex";
        try {
            const res = await fetch("/api/telegram/link-code");
            const data = await res.json();
            if (data.code) {
                body.innerHTML = `
    <p>Sende diesen Befehl an den Telegram-Bot eures Projekts:</p>
    <div style="background:#f4f4f4;border:1px solid #ddd;border-radius:6px;padding:12px 16px;font-family:monospace;font-size:1.1em;letter-spacing:2px;text-align:center;margin:12px 0">/link ${escapeHtml(data.code)}</div>
    <p style="font-size:0.85em;color:#888">Der Code ist 10 Minuten gültig.</p>
  `;
            } else {
                body.innerHTML =
                    '<p style="color:red">' +
                    escapeHtml(data.error || "Fehler") +
                    "</p>";
            }
        } catch (e) {
            body.innerHTML =
                '<p style="color:red">Fehler beim Laden des Codes.</p>';
        }
    }
    modal.style.display = "flex";
}

async function unlinkTelegramSelf() {
    if (!confirm("Telegram-Verknüpfung aufheben?")) return;
    await fetch("/api/telegram/links/me", { method: "DELETE" });
    document.getElementById("telegramLinkModal").style.display =
        "none";
    // Refresh sidebar button
    const tgStatus = await (
        await fetch("/api/telegram/status")
    ).json();
    const tgBtn = document.getElementById("sidebarTelegramBtn");
    tgBtn.textContent = "Telegram verknüpfen";
    tgBtn.style.color = "";
}
