// ========== Crop Modal ==========

function openCropModal(file, onDone) {
    // onDone(resultFile) — resultFile is cropped Blob or original File (skip), or null (cancel)
    var modal = document.getElementById("cropModal");
    var img = document.getElementById("cropperTarget");

    // Destroy previous Cropper instance if any
    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }

    // Show modal first so the image is laid out in visible DOM
    modal.style.display = "flex";
    cropCallback = onDone;

    // Reset img src to avoid stale image flash
    img.src = "";

    var url = URL.createObjectURL(file);
    img.onload = function () {
        // Don't revoke yet — Cropper.js reads the src internally
        cropperInstance = new Cropper(img, {
            viewMode: 1,
            autoCropArea: 0.8,
            responsive: true,
            dragMode: "move",
            checkCrossOrigin: false,
            background: true,
            modal: true,
            guides: true,
            center: true,
            highlight: true,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: true,
        });
    };
    img.src = url;
}

function cleanupCropper() {
    var img = document.getElementById("cropperTarget");
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
    // Revoke object URL to free memory
    if (img.src && img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
    img.src = "";
    document.getElementById("cropModal").style.display = "none";
}

function cropModalSave() {
    if (!cropperInstance || !cropCallback) return;
    cropperInstance.getCroppedCanvas({ maxWidth: 4096, maxHeight: 4096 }).toBlob(function (blob) {
        var cb = cropCallback;
        cropCallback = null;
        cleanupCropper();
        cb(blob);
    }, "image/jpeg", 0.92);
}

function cropModalSkip() {
    if (!cropCallback) return;
    var cb = cropCallback;
    cropCallback = null;
    cleanupCropper();
    cb(null); // null = use original
}

function cropModalCancel() {
    if (!cropCallback) return;
    var cb = cropCallback;
    cropCallback = null;
    cleanupCropper();
    cb(undefined); // undefined = cancelled (discard)
}

// Process an array of File objects through crop modal sequentially.
// Returns a Promise that resolves with an array of processed Files/Blobs.
function processThroughCropModal(files) {
    return new Promise((resolve) => {
        const results = [];
        let index = 0;

        function next() {
            if (index >= files.length) {
                resolve(results);
                return;
            }
            const file = files[index++];
            const counter = document.getElementById("cropModalCounter");
            if (counter) counter.textContent = files.length > 1 ? `${index} / ${files.length}` : "";
            openCropModal(file, function (result) {
                if (result === undefined) {
                    // Cancelled — discard this file, continue
                } else if (result === null) {
                    // Skipped — use original
                    results.push(file);
                } else {
                    // Cropped blob — use it (preserve filename)
                    const named = new File([result], file.name || "image.jpg", { type: result.type });
                    results.push(named);
                }
                next();
            });
        }

        next();
    });
}

// Add image input wiring for edit modal (called once on DOMContentLoaded)
function initAddImageInputs() {
    document.getElementById("addImageInput").addEventListener("change", async function () {
        const files = Array.from(this.files);
        this.value = "";
        if (!files.length) return;
        const processed = await processThroughCropModal(files);
        if (processed.length > 0) addImagesToCurrentBill(processed);
    });

    document.getElementById("addCameraInput").addEventListener("change", async function () {
        const files = Array.from(this.files);
        this.value = "";
        if (!files.length) return;
        const processed = await processThroughCropModal(files);
        if (processed.length > 0) addImagesToCurrentBill(processed);
    });
}

// ========== Gallery ==========

function renderGallery() {
    const noImageText = document.getElementById("noImageText");
    const carousel = document.getElementById("galleryCarousel");
    const track = document.getElementById("galleryTrack");
    const dots = document.getElementById("galleryDots");
    const downloadLink = document.getElementById("downloadLink");
    const deleteBtn = document.getElementById("deleteImageBtn");
    const addLabel = document.getElementById("addImageLabel");
    const addCamera = document.getElementById("addCameraLabel");
    const counter = document.getElementById("imageCounter");

    // Always show add buttons
    addLabel.style.display = "inline-block";
    addCamera.style.display = "inline-block";

    if (galleryImages.length === 0) {
        noImageText.style.display = "block";
        carousel.style.display = "none";
        downloadLink.style.display = "none";
        deleteBtn.style.display = "none";
        counter.textContent = "";
        return;
    }

    noImageText.style.display = "none";
    carousel.style.display = "block";
    deleteBtn.style.display = "inline-block";

    // Build track slides
    track.innerHTML = galleryImages
        .map(
            (img, i) =>
                `<div class="min-w-full flex items-center justify-center p-4"><img src="/uploads/${escapeHtml(img.file)}" onclick="openImageModal(${i})" title="Click to view full size" class="max-w-full max-h-[300px] rounded cursor-pointer hover:opacity-90" /></div>`,
        )
        .join("");

    // Dots
    dots.innerHTML = galleryImages
        .map(
            (_, i) =>
                `<span class="w-2 h-2 rounded-full cursor-pointer transition-colors ${i === galleryIndex ? "bg-indigo-500" : "bg-slate-300"}" onclick="galleryGoTo(${i})"></span>`,
        )
        .join("");

    // Counter
    counter.textContent = `(${galleryIndex + 1} / ${galleryImages.length})`;

    // Download link
    const current = galleryImages[galleryIndex];
    if (current) {
        downloadLink.href = "/uploads/" + current.file;
        downloadLink.download = current.filename || "image";
        downloadLink.style.display = "inline-block";
    }

    // Nav visibility
    document.getElementById("galleryPrev").style.display =
        galleryImages.length > 1 ? "" : "none";
    document.getElementById("galleryNext").style.display =
        galleryImages.length > 1 ? "" : "none";

    updateGalleryPosition();
}

function updateGalleryPosition() {
    const track = document.getElementById("galleryTrack");
    track.style.transform = `translateX(-${galleryIndex * 100}%)`;
    // Update active dot
    document.querySelectorAll(".gallery-dot").forEach((d, i) => {
        d.classList.toggle("active", i === galleryIndex);
    });
    // Update counter and download link
    const counter = document.getElementById("imageCounter");
    if (galleryImages.length > 0) {
        counter.textContent = `(${galleryIndex + 1} / ${galleryImages.length})`;
        const current = galleryImages[galleryIndex];
        const downloadLink =
            document.getElementById("downloadLink");
        downloadLink.href = "/uploads/" + current.file;
        downloadLink.download = current.filename || "image";
    }
}

function galleryNav(dir) {
    if (galleryImages.length === 0) return;
    galleryIndex =
        (galleryIndex + dir + galleryImages.length) %
        galleryImages.length;
    updateGalleryPosition();
}

function galleryGoTo(idx) {
    galleryIndex = idx;
    updateGalleryPosition();
}

function openImageModal(idx) {
    if (idx !== undefined) galleryIndex = idx;
    if (galleryImages.length === 0) return;
    const current = galleryImages[galleryIndex];
    document.getElementById("fullSizeImage").src =
        "/uploads/" + current.file;
    updateFullsizeCounter();
    document.getElementById("imageModal").style.display = "flex";
}

function closeImageModal() {
    document.getElementById("imageModal").style.display = "none";
}

function fullsizeNav(dir) {
    if (galleryImages.length <= 1) return;
    galleryIndex =
        (galleryIndex + dir + galleryImages.length) %
        galleryImages.length;
    document.getElementById("fullSizeImage").src =
        "/uploads/" + galleryImages[galleryIndex].file;
    updateFullsizeCounter();
    updateGalleryPosition();
}

function updateFullsizeCounter() {
    const el = document.getElementById("fullsizeCounter");
    const prevBtn = document.getElementById("fullPrev");
    const nextBtn = document.getElementById("fullNext");
    if (galleryImages.length > 1) {
        el.textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
        el.style.display = "block";
        prevBtn.style.display = "";
        nextBtn.style.display = "";
    } else {
        el.style.display = "none";
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
    }
}

async function deleteCurrentImage() {
    if (currentBillId === null || galleryImages.length === 0)
        return;
    const img = galleryImages[galleryIndex];
    if (!confirm("Delete this image?")) return;
    try {
        const res = await fetch(
            `/api/bills/${currentBillId}/images/${img.id}`,
            { method: "DELETE" },
        );
        const j = await res.json();
        if (j.ok) {
            showMessage("imageResult", "Image deleted", false);
            await loadBills();
            const bill = allBills.find(
                (b) => b.id === currentBillId,
            );
            if (bill) {
                galleryImages = bill.images || [];
                if (galleryIndex >= galleryImages.length)
                    galleryIndex = Math.max(
                        0,
                        galleryImages.length - 1,
                    );
                renderGallery();
            }
        } else {
            showMessage(
                "imageResult",
                "Error: " + (j.error || "unknown"),
                true,
            );
        }
    } catch (err) {
        showMessage("imageResult", "Error: " + err.message, true);
    }
}

async function addImagesToCurrentBill(files) {
    if (currentBillId === null || !files || files.length === 0)
        return;
    const formData = new FormData();
    for (const f of files) formData.append("photos", f);
    try {
        const res = await fetch(
            `/api/bills/${currentBillId}/images`,
            { method: "POST", body: formData },
        );
        const j = await res.json();
        if (j.ok) {
            showMessage(
                "imageResult",
                `Added ${j.images.length} image(s)`,
                false,
            );
            await loadBills();
            const bill = allBills.find(
                (b) => b.id === currentBillId,
            );
            if (bill) {
                galleryImages = bill.images || [];
                galleryIndex = galleryImages.length - 1; // Show last added
                renderGallery();
            }
        } else {
            showMessage(
                "imageResult",
                "Error: " + (j.error || "unknown"),
                true,
            );
        }
    } catch (err) {
        showMessage("imageResult", "Error: " + err.message, true);
    }
}
