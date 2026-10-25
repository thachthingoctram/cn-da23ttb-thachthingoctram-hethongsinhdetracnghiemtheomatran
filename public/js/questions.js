const API = "/api/questions";

const $ = (id) => document.getElementById(id);
const modal = new bootstrap.Modal($("questionModal"));

let questions = [];
let courses = [];
let links = [];

const TYPE_LABELS = {
    NHIEU_LUA_CHON: "Nhiều lựa chọn",
    DUNG_SAI: "Đúng / Sai",
    GHEP_HOP: "Ghép hợp",
    DIEN_KHUYET: "Điền khuyết",
};

const DIFFICULTY_LABELS = {
    DE: "Dễ",
    TRUNG_BINH: "Trung bình",
    KHO: "Khó",
};

const STATUS_LABELS = {
    HOAT_DONG: "Hoạt động",
    NGUNG_HOAT_DONG: "Ngừng hoạt động",
    NHAP: "Bản nháp",
    CHO_DUYET: "Chờ duyệt",
};

const STATUS_CLASSES = {
    HOAT_DONG: "bg-success-subtle text-success",
    NGUNG_HOAT_DONG: "bg-secondary-subtle text-secondary",
    NHAP: "bg-light text-dark",
    CHO_DUYET: "bg-warning-subtle text-warning-emphasis",
};

function escapeHtml(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (char) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[char],
    );
}

function showMessage(message, type = "success") {
    const element = $("message");
    element.className = `alert alert-${type}`;
    element.textContent = message;

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearMessage() {
    $("message").className = "alert d-none";
    $("message").textContent = "";
}

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
        throw new Error(data.message || `Lỗi HTTP ${response.status}`);
    }

    return data;
}

function makeOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
}

function fillCourseSelect(select, includeAll = false) {
    select.replaceChildren();

    select.appendChild(
        makeOption("", includeAll ? "Tất cả học phần" : "Chọn học phần"),
    );

    courses.forEach((course) => {
        select.appendChild(
            makeOption(
                course.ma_hoc_phan,
                `${course.ma_hoc_phan_code} - ${course.ten_hoc_phan}`,
            ),
        );
    });
}

function updateLinkSelect(selectedId = "") {
    const courseId = Number($("questionCourse").value);
    const select = $("questionLink");

    select.replaceChildren(makeOption("", "Chọn chương / chuẩn đầu ra"));

    links
        .filter((link) => Number(link.ma_hoc_phan) === courseId)
        .forEach((link) => {
            const label =
                `${link.ten_chuong} — ${link.ma_chuan_code}: ` +
                link.noi_dung_chuan_dau_ra;

            select.appendChild(makeOption(link.ma_lien_ket, label));
        });

    if (selectedId) {
        select.value = String(selectedId);
    }
}

async function loadOptions() {
    const data = await api(`${API}/options`);

    courses = data.courses || [];
    links = data.links || [];

    fillCourseSelect($("filterCourse"), true);
    fillCourseSelect($("questionCourse"));
    updateLinkSelect();
}

function buildFilterUrl() {
    const params = new URLSearchParams();

    const fields = {
        keyword: $("filterKeyword").value.trim(),
        hoc_phan: $("filterCourse").value,
        dang: $("filterType").value,
        muc_do: $("filterDifficulty").value,
        trang_thai: $("filterStatus").value,
    };

    Object.entries(fields).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });

    const query = params.toString();
    return query ? `${API}?${query}` : API;
}

async function loadQuestions() {
    $("questionTable").innerHTML = `
    <tr>
      <td colspan="9" class="text-center py-4">Đang tải dữ liệu...</td>
    </tr>
  `;

    try {
        const data = await api(buildFilterUrl());
        questions = data.questions || [];
        renderQuestions();
    } catch (error) {
        $("questionTable").innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-danger py-4">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;

        showMessage(error.message, "danger");
    }
}

function renderQuestions() {
    $("totalQuestions").textContent = questions.length;
    $("activeQuestions").textContent = questions.filter(
        (q) => q.trang_thai === "HOAT_DONG",
    ).length;
    $("pendingQuestions").textContent = questions.filter(
        (q) => q.trang_thai === "CHO_DUYET",
    ).length;
    $("resultCount").textContent = `${questions.length} kết quả`;

    if (!questions.length) {
        $("questionTable").innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-secondary py-5">
          Không tìm thấy câu hỏi phù hợp.
        </td>
      </tr>
    `;
        return;
    }

    $("questionTable").innerHTML = questions
        .map((q) => {
            const statusClass =
                STATUS_CLASSES[q.trang_thai] || "bg-light text-dark";

            const questionText = String(q.noi_dung_cau_hoi || "");
            const shortText =
                questionText.length > 140
                    ? `${questionText.slice(0, 140)}…`
                    : questionText;

            const linkText = `${q.ten_chuong || ""} / ${q.ma_chuan_code || ""}`;

            return `
      <tr>
        <td>
          <span class="fw-semibold">${escapeHtml(q.ma_cau_hoi_code)}</span>
        </td>

        <td>
          <div class="question-content" title="${escapeHtml(questionText)}">
            ${escapeHtml(shortText)}
          </div>
        </td>

        <td>
          <div>${escapeHtml(q.ten_hoc_phan)}</div>
          <small class="text-secondary">
            ${escapeHtml(q.ma_hoc_phan_code)}
          </small>
        </td>

        <td>
          <div>${escapeHtml(linkText)}</div>
          <small class="text-secondary">
            ${escapeHtml(q.noi_dung_chuan_dau_ra || "")}
          </small>
        </td>

        <td>${escapeHtml(TYPE_LABELS[q.dang_cau_hoi] || q.dang_cau_hoi)}</td>

        <td>
          <span class="badge bg-info-subtle text-info-emphasis">
            ${escapeHtml(DIFFICULTY_LABELS[q.muc_do_kho] || q.muc_do_kho)}
          </span>
        </td>

        <td class="text-center">${Number(q.so_lan_su_dung) || 0}</td>

        <td>
          <span class="badge ${statusClass}">
            ${escapeHtml(STATUS_LABELS[q.trang_thai] || q.trang_thai)}
          </span>
        </td>

        <td>
          <div class="d-flex gap-1">
            <button
              class="btn btn-sm btn-outline-primary"
              data-action="edit"
              data-id="${q.ma_cau_hoi}"
              title="Sửa câu hỏi">
              Sửa
            </button>

            <button
              class="btn btn-sm btn-outline-secondary"
              data-action="status"
              data-id="${q.ma_cau_hoi}"
              data-status="${q.trang_thai}"
              title="Đổi trạng thái">
              ${q.trang_thai === "NGUNG_HOAT_DONG" ? "Kích hoạt" : "Ngừng"}
            </button>
          </div>
        </td>
      </tr>
    `;
        })
        .join("");
}

function resetQuestionForm() {
    $("questionForm").reset();
    $("questionId").value = "";
    $("questionModalTitle").textContent = "Thêm câu hỏi";
    $("btnSave").textContent = "Lưu câu hỏi";
    $("questionStatus").value = "HOAT_DONG";
    updateLinkSelect();
}

function openAddModal() {
    clearMessage();
    resetQuestionForm();
    modal.show();
}

function openEditModal(id) {
    const q = questions.find((item) => Number(item.ma_cau_hoi) === Number(id));

    if (!q) {
        showMessage(
            "Không tìm thấy câu hỏi trong danh sách hiện tại. Hãy tải lại dữ liệu.",
            "warning",
        );
        return;
    }

    clearMessage();
    resetQuestionForm();

    $("questionId").value = q.ma_cau_hoi;
    $("questionCode").value = q.ma_cau_hoi_code;
    $("questionCourse").value = String(q.ma_hoc_phan);

    updateLinkSelect(q.ma_lien_ket_chuong_cdr);

    $("questionType").value = q.dang_cau_hoi;
    $("questionDifficulty").value = q.muc_do_kho;
    $("questionContent").value = q.noi_dung_cau_hoi || "";
    $("questionOptions").value =
        q.cac_lua_chon == null ? "" : JSON.stringify(q.cac_lua_chon, null, 2);
    $("questionAnswer").value = JSON.stringify(q.dap_an, null, 2);
    $("questionExplanation").value = q.giai_thich || "";
    $("questionStatus").value = q.trang_thai;

    $("questionModalTitle").textContent = "Cập nhật câu hỏi";
    $("btnSave").textContent = "Lưu thay đổi";

    modal.show();
}

function parseJsonField(value, label, allowEmpty = false) {
    const text = value.trim();

    if (!text && allowEmpty) return null;

    if (!text) {
        throw new Error(`Vui lòng nhập ${label}.`);
    }

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${label} không đúng định dạng JSON.`);
    }
}

function collectQuestionForm() {
    const cacLuaChon = parseJsonField(
        $("questionOptions").value,
        "các lựa chọn",
        true,
    );

    const dapAn = parseJsonField($("questionAnswer").value, "đáp án");

    return {
        ma_cau_hoi_code: $("questionCode").value.trim(),
        ma_hoc_phan: Number($("questionCourse").value),
        ma_lien_ket_chuong_cdr: Number($("questionLink").value),
        dang_cau_hoi: $("questionType").value,
        muc_do_kho: $("questionDifficulty").value,
        noi_dung_cau_hoi: $("questionContent").value.trim(),
        cac_lua_chon: cacLuaChon,
        dap_an: dapAn,
        giai_thich: $("questionExplanation").value.trim(),
        trang_thai: $("questionStatus").value,
    };
}

async function saveQuestion(event) {
    event.preventDefault();
    clearMessage();

    const saveButton = $("btnSave");

    try {
        const id = $("questionId").value;
        const payload = collectQuestionForm();

        saveButton.disabled = true;
        saveButton.textContent = "Đang lưu...";

        if (id) {
            await api(`${API}/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        } else {
            await api(API, {
                method: "POST",
                body: JSON.stringify(payload),
            });
        }

        modal.hide();
        showMessage(
            id ? "Cập nhật câu hỏi thành công." : "Thêm câu hỏi thành công.",
        );

        await loadQuestions();
    } catch (error) {
        showMessage(error.message, "danger");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = $("questionId").value
            ? "Lưu thay đổi"
            : "Lưu câu hỏi";
    }
}

async function changeStatus(id, currentStatus) {
    const newStatus =
        currentStatus === "NGUNG_HOAT_DONG" ? "HOAT_DONG" : "NGUNG_HOAT_DONG";

    const action =
        newStatus === "HOAT_DONG" ? "kích hoạt lại" : "ngừng sử dụng";

    if (!window.confirm(`Bạn có chắc muốn ${action} câu hỏi này?`)) {
        return;
    }

    try {
        await api(`${API}/${encodeURIComponent(id)}/status`, {
            method: "PATCH",
            body: JSON.stringify({ trang_thai: newStatus }),
        });

        showMessage("Đổi trạng thái câu hỏi thành công.");
        await loadQuestions();
    } catch (error) {
        showMessage(error.message, "danger");
    }
}

$("btnAdd").addEventListener("click", openAddModal);
$("questionForm").addEventListener("submit", saveQuestion);

$("questionCourse").addEventListener("change", () => {
    updateLinkSelect();
});

$("filterForm").addEventListener("submit", (event) => {
    event.preventDefault();
    clearMessage();
    loadQuestions();
});

$("btnReset").addEventListener("click", () => {
    setTimeout(() => {
        clearMessage();
        loadQuestions();
    }, 0);
});

$("questionTable").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const { action, id, status } = button.dataset;

    if (action === "edit") {
        openEditModal(id);
    } else if (action === "status") {
        changeStatus(id, status);
    }
});

async function init() {
    try {
        await loadOptions();
        await loadQuestions();
    } catch (error) {
        showMessage(`Không thể khởi tạo màn hình: ${error.message}`, "danger");
    }
}

const importModal = new bootstrap.Modal($("importModal"));

let importRows = [];
let importErrors = [];
let importReady = false;

const IMPORT_TYPE_LABELS = {
    NHIEU_LUA_CHON: "Nhiều lựa chọn",
    DUNG_SAI: "Đúng / Sai",
    GHEP_HOP: "Ghép hợp",
    DIEN_KHUYET: "Điền khuyết",
};

const IMPORT_DIFFICULTY_LABELS = {
    DE: "Dễ",
    TRUNG_BINH: "Trung bình",
    KHO: "Khó",
};

function showImportMessage(message, type = "info") {
    const element = $("importMessage");
    element.className = `alert alert-${type}`;
    element.textContent = message;
    element.classList.remove("d-none");
}

function resetImportPreview() {
    importRows = [];
    importErrors = [];
    importReady = false;

    $("importSummary").classList.add("d-none");
    $("importPreviewSection").classList.add("d-none");
    $("importMessage").classList.add("d-none");
    $("importPreviewTable").innerHTML = "";
    $("btnConfirmImport").disabled = true;
}

function downloadImportTemplate() {
    const headers = [
        "ma_cau_hoi_code",
        "ma_hoc_phan",
        "ma_lien_ket_chuong_cdr",
        "dang_cau_hoi",
        "muc_do_kho",
        "noi_dung_cau_hoi",
        "cac_lua_chon",
        "dap_an",
        "giai_thich",
        "trang_thai",
    ];

    const sample = [
        "CH001",
        "1",
        "1",
        "NHIEU_LUA_CHON",
        "DE",
        "Nội dung câu hỏi mẫu",
        '[{"ma":"A","noi_dung":"Phương án A"},{"ma":"B","noi_dung":"Phương án B"}]',
        '"A"',
        "Giải thích đáp án",
        "NHAP",
    ];

    const escapeCsv = (value) => `"${String(value).replace(/"/g, '""')}"`;

    const csv = [
        headers.map(escapeCsv).join(","),
        sample.map(escapeCsv).join(","),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "mau_import_cau_hoi.csv";
    link.click();

    URL.revokeObjectURL(url);
}

async function previewImportFile() {
    const file = $("importFile").files[0];

    resetImportPreview();

    if (!file) {
        showImportMessage("Vui lòng chọn file CSV hoặc Excel.", "warning");
        return;
    }

    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
        showImportMessage("Định dạng file không được hỗ trợ.", "danger");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showImportMessage("File vượt quá giới hạn 5 MB.", "danger");
        return;
    }

    const button = $("btnPreviewImport");
    button.disabled = true;
    button.textContent = "Đang kiểm tra...";

    try {
        const formData = new FormData();
        formData.append("file", file);

        // Không đặt Content-Type thủ công khi gửi FormData.
        const response = await fetch(`${API}/import/preview`, {
            method: "POST",
            body: formData,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Không kiểm tra được file.");
        }

        importRows = data.rows || [];
        importErrors = data.errors || [];

        $("importTotal").textContent = data.total ?? importRows.length;
        $("importValid").textContent = data.valid ?? 0;
        $("importInvalid").textContent = data.invalid ?? importErrors.length;

        $("importSummary").classList.remove("d-none");
        $("importPreviewSection").classList.remove("d-none");

        renderImportPreview();

        importReady =
            importRows.length > 0 &&
            importErrors.length === 0 &&
            Number(data.invalid || 0) === 0;

        $("btnConfirmImport").disabled = !importReady;

        showImportMessage(
            importReady
                ? "Dữ liệu hợp lệ. Bạn có thể xác nhận nhập câu hỏi."
                : "File có dữ liệu lỗi. Hãy sửa file và kiểm tra lại trước khi nhập.",
            importReady ? "success" : "warning",
        );
    } catch (error) {
        showImportMessage(error.message, "danger");
    } finally {
        button.disabled = false;
        button.innerHTML =
            '<i class="bi bi-search me-1"></i> Kiểm tra và xem trước';
    }
}

function renderImportPreview() {
    const errorsByLine = new Map();

    importErrors.forEach((item) => {
        errorsByLine.set(Number(item.dong), item.loi || []);
    });

    if (!importRows.length) {
        $("importPreviewTable").innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    Không có dữ liệu xem trước.
                </td>
            </tr>
        `;
        return;
    }

    $("importPreviewTable").innerHTML = importRows
        .map((row, index) => {
            const line = index + 2;
            const errors = errorsByLine.get(line) || [];
            const valid = errors.length === 0;

            const content = String(row.noi_dung_cau_hoi || "");

            return `
                <tr class="${valid ? "" : "table-danger"}">
                    <td>${line}</td>
                    <td class="fw-semibold">
                        ${escapeHtml(row.ma_cau_hoi_code)}
                    </td>
                    <td>${escapeHtml(row.ma_hoc_phan)}</td>
                    <td>
                        ${escapeHtml(
                            IMPORT_TYPE_LABELS[row.dang_cau_hoi] ||
                                row.dang_cau_hoi,
                        )}
                    </td>
                    <td>
                        ${escapeHtml(
                            IMPORT_DIFFICULTY_LABELS[row.muc_do_kho] ||
                                row.muc_do_kho,
                        )}
                    </td>
                    <td style="min-width: 220px; max-width: 350px;">
                        ${escapeHtml(content.slice(0, 150))}
                        ${content.length > 150 ? "…" : ""}
                    </td>
                    <td style="min-width: 220px;">
                        ${
                            valid
                                ? '<span class="badge bg-success-subtle text-success">Hợp lệ</span>'
                                : `
                                    <span class="badge bg-danger">Có lỗi</span>
                                    <ul class="small text-danger mt-2 mb-0 ps-3">
                                        ${errors
                                            .map(
                                                (error) =>
                                                    `<li>${escapeHtml(error)}</li>`,
                                            )
                                            .join("")}
                                    </ul>
                                `
                        }
                    </td>
                </tr>
            `;
        })
        .join("");
}

async function confirmImport() {
    if (!importReady || !importRows.length) {
        showImportMessage(
            "Vui lòng kiểm tra file và sửa tất cả lỗi trước khi nhập.",
            "warning",
        );
        return;
    }

    if (
        !window.confirm(
            `Bạn có chắc muốn nhập ${importRows.length} câu hỏi vào ngân hàng?`,
        )
    ) {
        return;
    }

    const button = $("btnConfirmImport");
    button.disabled = true;
    button.textContent = "Đang nhập dữ liệu...";

    try {
        const response = await fetch(`${API}/import/commit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                rows: importRows,
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
            if (Array.isArray(data.errors) && data.errors.length) {
                importErrors = data.errors;
                renderImportPreview();

                $("importInvalid").textContent = importErrors.length;
                $("importValid").textContent = Math.max(
                    0,
                    importRows.length - importErrors.length,
                );

                importReady = false;
            }

            throw new Error(data.message || "Không nhập được câu hỏi.");
        }

        importModal.hide();

        $("importFile").value = "";
        $("importFileName").textContent = "";
        resetImportPreview();

        showMessage(
            data.message || `Nhập thành công ${data.imported || 0} câu hỏi.`,
            "success",
        );

        await loadQuestions();
    } catch (error) {
        showImportMessage(error.message, "danger");
    } finally {
        button.disabled = !importReady;
        button.innerHTML =
            '<i class="bi bi-database-check me-1"></i> Xác nhận nhập';
    }
}

$("btnImport").addEventListener("click", () => {
    resetImportPreview();
    $("importFile").value = "";
    $("importFileName").textContent = "";
    importModal.show();
});

$("importFile").addEventListener("change", () => {
    resetImportPreview();

    const file = $("importFile").files[0];
    $("importFileName").textContent = file ? `File đã chọn: ${file.name}` : "";
});

$("btnPreviewImport").addEventListener("click", previewImportFile);
$("btnConfirmImport").addEventListener("click", confirmImport);
$("btnDownloadTemplate").addEventListener("click", downloadImportTemplate);

init();
