// ========== Core ==========

// calcNetto loaded from /js/utils.js

function updateDetailNetto() {
    const b19 =
        parseFloat(
            document.getElementById("detailBrutto19").value,
        ) || 0;
    const b7 =
        parseFloat(
            document.getElementById("detailBrutto7").value,
        ) || 0;
    const b0 =
        parseFloat(
            document.getElementById("detailBrutto0").value,
        ) || 0;
    const n19 = b19 / 1.19;
    const n7 = b7 / 1.07;
    const n0 = b0;
    document.getElementById("detailNetto19").textContent =
        formatCurrency(n19);
    document.getElementById("detailNetto7").textContent =
        formatCurrency(n7);
    document.getElementById("detailNetto0").textContent =
        formatCurrency(n0);
    document.getElementById("detailNettoTotal").textContent =
        formatCurrency(n19 + n7 + n0);
}

// ========== Comma/dot decimal handling for number inputs ==========
// Intercept comma key on type="number" inputs and convert to dot
document.addEventListener("keydown", function (e) {
    if (
        e.key === "," &&
        e.target.tagName === "INPUT" &&
        e.target.type === "number"
    ) {
        e.preventDefault();
        // Insert a dot at cursor position
        var inp = e.target;
        var start = inp.selectionStart;
        var val = inp.value;
        inp.value =
            val.slice(0, start) + "." + val.slice(inp.selectionEnd);
        inp.setSelectionRange(start + 1, start + 1);
        inp.dispatchEvent(new Event("input", { bubbles: true }));
    }
});

// ========== Pane switching (replaces tab bar) ==========
function switchPane(pane) {
    // Hide all content panes
    document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
    // Show target pane
    const target = document.getElementById("tab-" + pane);
    if (target) target.classList.add("active");
    // Update sidebar nav highlight
    document.querySelectorAll(".sidebar-nav").forEach((btn) => {
        if (btn.dataset.pane === pane) {
            btn.classList.add(
                "text-indigo-700",
                "bg-indigo-50",
                "font-semibold",
            );
            btn.classList.remove("text-slate-600");
        } else {
            btn.classList.remove(
                "text-indigo-700",
                "bg-indigo-50",
                "font-semibold",
            );
            btn.classList.add("text-slate-600");
        }
    });
    // Load data for pane
    if (pane === "bills") loadBills();
    if (pane === "spending") {
        loadSpending();
        loadCategorySpending();
    }
    if (pane === "vgeld") {
        loadVGeld();
        loadVGeldAnalysis();
    }
    if (pane === "budget") loadBudgetMatrix();
    if (pane === "reports") loadReportUsers();
    if (pane === "adm-settings") admLoadSettings();
    if (pane === "adm-members") {
        admLoadPositions().then(() => admLoadMembers());
    }
    if (pane === "adm-export") admLoadCredStatus();
    if (pane === "adm-telegram") admLoadTelegramSettings();
    if (pane === "adm-projects") admLoadProjects();
    // Close sidebar (always overlay now)
    closeMenu();
}

// ========== Format allocation display ==========
function formatAllocations(allocs, idField) {
    if (!allocs || allocs.length === 0) return "";
    if (allocs.length === 1 && allocs[0].percentage === 100)
        return escapeHtml(allocs[0].name);
    return allocs
        .map(
            (a) =>
                `${escapeHtml(a.name)} (${Math.round(a.percentage)}%)`,
        )
        .join(", ");
}

function closeModal() {
    document.getElementById("billModal").style.display = "none";
    currentBillId = null;
    galleryImages = [];
    galleryIndex = 0;
}

async function loadProjectData() {
    // Load motives, categories, positions, and project info for current project
    const [motivesRes, categoriesRes, positionsRes, projectRes] =
        await Promise.all([
            fetch("/api/motives"),
            fetch("/api/categories"),
            fetch("/api/positions"),
            fetch("/api/project-info"),
        ]);
    if (motivesRes.status === 403) {
        await showProjectSelector();
        return;
    }
    motivesData = await motivesRes.json();
    categoriesData = await categoriesRes.json();
    rolesData = positionsRes.ok ? await positionsRes.json() : [];
    const projectInfo = await projectRes.json();
    const projectName =
        projectInfo.projectName ||
        currentUser.currentProjectName ||
        "vBudget";
    const subtitle = projectInfo.projectSubtitle
        ? `<span class="block md:inline md:ml-2 text-sm font-normal text-slate-400">${escapeHtml(projectInfo.projectSubtitle)}</span>`
        : "";
    document.getElementById("appTitle").innerHTML =
        escapeHtml(projectName) + subtitle;
    document.title = projectName + " - vBudget";
    // Keep currentUser in sync
    if (projectInfo.projectName)
        currentUser.currentProjectName = projectInfo.projectName;
    if (projectInfo.version) {
        document.getElementById("appVersion").textContent =
            "v" + projectInfo.version;
    }

    // Update sidebar
    const isAdmin =
        currentUser.superAdmin ||
        ["admin", "owner"].includes(currentUser.currentProjectRole);
    const isOwner =
        currentUser.superAdmin ||
        currentUser.currentProjectRole === "owner";
    document.getElementById("user").innerHTML = "";
    updateSidebar(
        isAdmin,
        isOwner,
        projectInfo.version || "",
        projectName,
    );

    // Initialize upload allocation widgets (empty)
    createAllocationWidget(
        "uploadMotiveAlloc",
        "motive",
        motivesData,
        [],
        0,
    );
    createAllocationWidget(
        "uploadCategoryAlloc",
        "category",
        categoriesData,
        [],
        0,
    );

    // Update allocation amounts and netto display when brutto values change
    // (listeners only attached once — guard against repeated loadProjectData calls)
    if (!window._uploadBruttoListenersAttached) {
        window._uploadBruttoListenersAttached = true;
        const bruttoInputs = ["brutto19", "brutto7", "brutto0"].map(
            (name) =>
                document.querySelector(
                    `#uploadForm input[name="${name}"]`,
                ),
        );
        function updateUploadNetto() {
            const b19 = parseFloat(bruttoInputs[0].value) || 0;
            const b7 = parseFloat(bruttoInputs[1].value) || 0;
            const b0 = parseFloat(bruttoInputs[2].value) || 0;
            document.getElementById("uploadNetto19").textContent =
                formatCurrency(b19 / 1.19);
            document.getElementById("uploadNetto7").textContent =
                formatCurrency(b7 / 1.07);
            document.getElementById("uploadNetto0").textContent =
                formatCurrency(b0);
            document.getElementById("uploadNettoTotal").textContent =
                formatCurrency(b19 / 1.19 + b7 / 1.07 + b0);
        }
        bruttoInputs.forEach((input) => {
            input.addEventListener("input", () => {
                const total = bruttoInputs.reduce(
                    (sum, inp) => sum + (parseFloat(inp.value) || 0),
                    0,
                );
                document
                    .getElementById("uploadMotiveAlloc")
                    .updateAmount(total);
                document
                    .getElementById("uploadCategoryAlloc")
                    .updateAmount(total);
                updateUploadNetto();
            });
        });
    }

    // Show/hide admin-only and owner-only elements
    if (isAdmin) {
        document.getElementById("vgeldFormSection").style.display =
            "block";
        document
            .querySelectorAll(".admin-only")
            .forEach((el) => (el.style.display = ""));
        loadUsersForVGeld();
    } else {
        document.getElementById("vgeldFormSection").style.display =
            "none";
        document
            .querySelectorAll(".admin-only")
            .forEach((el) => (el.style.display = "none"));
    }
    if (isOwner) {
        document
            .querySelectorAll(".owner-only")
            .forEach((el) => (el.style.display = ""));
    } else {
        document
            .querySelectorAll(".owner-only")
            .forEach((el) => (el.style.display = "none"));
    }
    if (currentUser.superAdmin) {
        document
            .querySelectorAll(".superadmin-only")
            .forEach((el) => (el.style.display = ""));
    } else {
        document
            .querySelectorAll(".superadmin-only")
            .forEach((el) => (el.style.display = "none"));
    }

    // Reload data for the currently active pane
    const activePane = document.querySelector(
        ".tab-content.active",
    );
    if (activePane) {
        const paneId = activePane.id.replace("tab-", "");
        switchPane(paneId);
    }
}

async function init() {
    const res = await fetch("/api/user");
    const user = await res.json();
    if (!user) {
        window.location.href = "/login";
        return;
    }
    currentUser = user;
    document.getElementById("signed-in").style.display = "block";
    loadNotifications(); // fire-and-forget, updates bell badge

    // If user has a project selected, load project data immediately
    if (user.currentProjectId) {
        await loadProjectData();
    } else {
        // Need to select a project first
        document.getElementById("user").innerHTML = "";
        updateSidebar(user.superAdmin, user.superAdmin, "", "");
        await showProjectSelector();
    }

    // Multi-file upload preview
    function renderUploadThumbnails() {
        const container =
            document.getElementById("uploadThumbnails");
        container.innerHTML = "";
        pendingFiles.forEach((f, i) => {
            const thumb = document.createElement("div");
            thumb.className =
                "relative w-[72px] h-[72px] rounded-lg overflow-hidden border border-slate-200";
            const img = document.createElement("img");
            img.className = "w-full h-full object-cover block";
            img.src = URL.createObjectURL(f);
            img.onload = function () {
                URL.revokeObjectURL(this.src);
            };
            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className =
                "absolute top-0.5 right-0.5 bg-black/60 text-white border-none rounded-full w-5 h-5 text-sm leading-none cursor-pointer flex items-center justify-center p-0 hover:bg-rose-500";
            removeBtn.textContent = "\u00d7";
            removeBtn.onclick = function () {
                pendingFiles.splice(i, 1);
                renderUploadThumbnails();
            };
            thumb.appendChild(img);
            thumb.appendChild(removeBtn);
            container.appendChild(thumb);
        });
    }

    document
        .getElementById("uploadFileInput")
        .addEventListener("change", function () {
            const newFiles = Array.from(this.files);
            const space = 10 - pendingFiles.length;
            pendingFiles.push(...newFiles.slice(0, space));
            renderUploadThumbnails();
            this.value = "";
        });

    document
        .getElementById("uploadCameraInput")
        .addEventListener("change", function () {
            if (this.files[0] && pendingFiles.length < 10) {
                pendingFiles.push(this.files[0]);
                renderUploadThumbnails();
            }
            this.value = "";
        });

    document
        .getElementById("uploadForm")
        .addEventListener("submit", async (e) => {
            e.preventDefault();
            const form = e.target;

            const motiveAllocContainer =
                document.getElementById("uploadMotiveAlloc");
            const categoryAllocContainer = document.getElementById(
                "uploadCategoryAlloc",
            );
            const motiveAllocs =
                motiveAllocContainer.getAllocations();
            const categoryAllocs =
                categoryAllocContainer.getAllocations();

            // Validate allocation totals (only if allocations exist)
            if (motiveAllocs.length > 0) {
                const motiveTotal =
                    motiveAllocContainer.getTotalPercent();
                if (Math.abs(motiveTotal - 100) > 0.01) {
                    showMessage(
                        "uploadResult",
                        "Motive allocations must sum to 100% (currently " +
                            motiveTotal.toFixed(1) +
                            "%)",
                        true,
                    );
                    return;
                }
            }
            if (categoryAllocs.length > 0) {
                const catTotal =
                    categoryAllocContainer.getTotalPercent();
                if (Math.abs(catTotal - 100) > 0.01) {
                    showMessage(
                        "uploadResult",
                        "Kategorie allocations must sum to 100% (currently " +
                            catTotal.toFixed(1) +
                            "%)",
                        true,
                    );
                    return;
                }
            }

            const data = new FormData();
            // Add form fields (excluding file inputs)
            data.append("type", form.type.value);
            data.append("brutto19", form.brutto19.value);
            data.append("brutto7", form.brutto7.value);
            data.append("brutto0", form.brutto0.value);
            data.append("vendor", form.vendor.value);
            data.append("item", form.item.value);
            data.append("comment", form.comment.value);
            // Add pending files
            for (const f of pendingFiles) {
                data.append("photos", f);
            }
            // Add allocation data as JSON strings
            data.append(
                "motiveAllocations",
                JSON.stringify(motiveAllocs),
            );
            data.append(
                "categoryAllocations",
                JSON.stringify(categoryAllocs),
            );

            const resp = await fetch("/upload", {
                method: "POST",
                body: data,
            });
            const json = await resp.json();
            if (json.ok) {
                showMessage("uploadResult", "Bill uploaded successfully!", false);
                form.reset();
                pendingFiles = [];
                renderUploadThumbnails();
                // Re-initialize allocation widgets
                createAllocationWidget(
                    "uploadMotiveAlloc",
                    "motive",
                    motivesData,
                    [],
                    0,
                );
                createAllocationWidget(
                    "uploadCategoryAlloc",
                    "category",
                    categoriesData,
                    [],
                    0,
                );
            } else {
                showMessage("uploadResult", "Error: " + (json.error || "unknown"), true);
            }
        });

    // V-Geld form submission
    document
        .getElementById("vgeldForm")
        .addEventListener("submit", async (e) => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const data = {
                amount: formData.get("amount"),
                from: formData.get("from") || "External",
                to: formData.get("to"),
            };

            try {
                const resp = await fetch("/api/vgeld", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
                const json = await resp.json();
                if (json.ok) {
                    showMessage(
                        "vgeldResult",
                        "Transfer recorded!",
                        false,
                    );
                    form.reset();
                    loadVGeld();
                } else {
                    showMessage(
                        "vgeldResult",
                        "Error: " + (json.error || "unknown"),
                        true,
                    );
                }
            } catch (err) {
                showMessage(
                    "vgeldResult",
                    "Error: " + err.message,
                    true,
                );
            }
        });
}

init().catch((e) => console.error(e));
