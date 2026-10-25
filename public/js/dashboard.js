let difficultyChartInstance;
let typeChartInstance;
const difficultyLabels = { DE: "Dễ", TRUNG_BINH: "Trung bình", KHO: "Khó" };
const typeLabels = {
    NHIEU_LUA_CHON: "Trắc nghiệm",
    DUNG_SAI: "Đúng/Sai",
    GHEP_HOP: "Ghép đôi",
    DIEN_KHUYET: "Điền khuyết",
};
const typeColors = ["#28c7a1", "#4e83ff", "#9877f7", "#ffb84d"];
const difficultyColors = {
    DE: "#4e87ff",
    TRUNG_BINH: "#8b72f5",
    KHO: "#c084fc",
};
const fmt = (n) => new Intl.NumberFormat("vi-VN").format(Number(n || 0));

function setToday() {
    const el = document.getElementById("todayDate");
    el.textContent = new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date());
    el.textContent =
        el.textContent.charAt(0).toUpperCase() + el.textContent.slice(1);
}
function showToast(message) {
    document.getElementById("toastMessage").textContent = message;
    bootstrap.Toast.getOrCreateInstance(
        document.getElementById("appToast"),
    ).show();
}
function statusBadge(status) {
    const s = String(status || "").toUpperCase();
    const map = {
        DA_DUYET: ["Đã duyệt", "status-approved"],
        DA_SINH: ["Đã sinh", "status-generated"],
        NHAP: ["Bản nháp", "status-draft"],
        DA_LUU_TRU: ["Lưu trữ", "status-archived"],
    };
    const [label, cls] = map[s] || [status || "Chưa xác định", "status-draft"];
    return `<span class="status-pill ${cls}"><i class="bi bi-circle-fill" style="font-size:5px"></i>${escapeHtml(label)}</span>`;
}
function escapeHtml(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (ch) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[ch],
    );
}
function renderDifficulty(rows) {
    const order = ["DE", "TRUNG_BINH", "KHO"];
    const data = order.map((key) =>
        Number((rows || []).find((r) => r.level === key)?.total || 0),
    );
    const ctx = document.getElementById("difficultyChart");
    if (difficultyChartInstance) difficultyChartInstance.destroy();
    difficultyChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: order.map((k) => difficultyLabels[k]),
            datasets: [
                {
                    data,
                    backgroundColor: ["#4d8cff", "#8973f6", "#c084fc"],
                    borderRadius: 6,
                    borderSkipped: false,
                    maxBarThickness: 42,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#152b5b",
                    padding: 11,
                    displayColors: false,
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: "#7183a6",
                        font: { family: "Be Vietnam Pro", size: 9 },
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: "#edf1fa", drawTicks: false },
                    border: { display: false, dash: [3, 4] },
                    ticks: {
                        color: "#94a1bb",
                        padding: 8,
                        precision: 0,
                        font: { family: "Be Vietnam Pro", size: 9 },
                    },
                },
            },
        },
    });
}
function renderTypes(rows, total) {
    const normalized = (rows || [])
        .map((r) => ({
            key: r.type,
            label: typeLabels[r.type] || r.type,
            value: Number(r.total || 0),
        }))
        .sort((a, b) => b.value - a.value);
    const ctx = document.getElementById("typeChart");
    if (typeChartInstance) typeChartInstance.destroy();
    typeChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: normalized.map((r) => r.label),
            datasets: [
                {
                    data: normalized.map((r) => r.value),
                    backgroundColor: normalized.map(
                        (r) =>
                            typeColors[
                                Object.keys(typeLabels).indexOf(r.key)
                            ] || "#b8c5e4",
                    ),
                    borderWidth: 0,
                    hoverOffset: 5,
                    spacing: 3,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "76%",
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: "#152b5b", padding: 11 },
            },
        },
    });
    document.getElementById("donutTotal").textContent = fmt(total);
    document.getElementById("typeLegend").innerHTML = normalized.length
        ? normalized
              .map(
                  (r) =>
                      `<div class="type-legend-item"><i class="legend-dot" style="background:${typeColors[Object.keys(typeLabels).indexOf(r.key)] || "#b8c5e4"}"></i><span class="legend-label">${escapeHtml(r.label)}</span><strong>${total ? Math.round((r.value / total) * 100) : 0}%</strong><small>(${fmt(r.value)})</small></div>`,
              )
              .join("")
        : '<div class="empty-state">Chưa có dữ liệu phân loại.</div>';
}
function renderAlerts(alerts) {
    const list = document.getElementById("alertsList");
    document.getElementById("alertCount").textContent = (alerts || []).length;
    if (!alerts?.length) {
        list.innerHTML =
            '<div class="empty-state"><i class="bi bi-shield-check"></i><span>Chưa phát hiện ma trận có tổng số câu không khớp.</span></div>';
        return;
    }
    list.innerHTML = alerts
        .map(
            (a, i) =>
                `<div class="alert-item ${i % 2 ? "warning" : ""}"><span class="alert-bullet"></span><div><strong>${escapeHtml(a.ten_ma_tran)}</strong><p>Mục tiêu ${fmt(a.tong_so_cau_muc_tieu)} câu, tổng chi tiết hiện tại ${fmt(a.tong_so_cau_o_ma_tran)} câu.</p></div></div>`,
        )
        .join("");
}
function renderExams(exams) {
    const body = document.getElementById("recentExams");
    if (!exams?.length) {
        body.innerHTML =
            '<tr><td colspan="7" class="table-loading">Chưa có đề thi. Sau khi sinh đề, dữ liệu sẽ xuất hiện tại đây.</td></tr>';
        document.getElementById("examTableSummary").textContent =
            "Chưa có dữ liệu đề thi";
        return;
    }
    body.innerHTML = exams
        .map((e) => {
            const date = e.thoi_diem_sinh_de
                ? new Date(e.thoi_diem_sinh_de).toLocaleDateString("vi-VN")
                : "—";
            return `<tr><td class="exam-code">${escapeHtml(e.ma_phien_ban)}</td><td class="exam-title">${escapeHtml(e.ten_ma_tran || "Đề thi")}</td><td>${escapeHtml(e.ten_hoc_phan || "—")}</td><td>${fmt(e.so_cau)} câu</td><td>${date}</td><td>${statusBadge(e.trang_thai)}</td><td><button class="btn-icon" style="width:28px;height:28px;font-size:12px" title="Xem thông tin" data-exam="${escapeHtml(e.ma_phien_ban)}"><i class="bi bi-arrow-up-right"></i></button></td></tr>`;
        })
        .join("");
    document.getElementById("examTableSummary").textContent =
        `Hiển thị ${exams.length} đề thi gần đây`;
}
async function loadDashboard() {
    document.getElementById("apiStatus").textContent = "Đang tải";
    try {
        const response = await fetch("/api/dashboard/stats");
        const result = await response.json();
        if (!response.ok || !result.success)
            throw new Error(result.message || "Không thể tải dữ liệu");
        document.getElementById("questionCount").textContent = fmt(
            result.stats.questions,
        );
        document.getElementById("courseCount").textContent = fmt(
            result.stats.courses,
        );
        document.getElementById("matrixCount").textContent = fmt(
            result.stats.matrices,
        );
        document.getElementById("examCount").textContent = fmt(
            result.stats.exams,
        );
        renderDifficulty(result.difficulty, result.stats.questions);
        renderTypes(result.types, result.stats.questions);
        renderAlerts(result.alerts);
        renderExams(result.recentExams);
        document.getElementById("apiStatus").textContent = "Đã kết nối";
        document.getElementById("apiStatus").style.color = "#22b98d";
    } catch (error) {
        document.getElementById("apiStatus").textContent = "Lỗi kết nối";
        document.getElementById("apiStatus").style.color = "#f07869";
        document.getElementById("recentExams").innerHTML =
            `<tr><td colspan="7" class="table-loading">Không tải được dữ liệu. ${escapeHtml(error.message)}. Kiểm tra MySQL và file .env.</td></tr>`;
        document.getElementById("alertsList").innerHTML =
            '<div class="empty-state"><i class="bi bi-exclamation-circle"></i><span>Chưa thể kiểm tra cảnh báo khi mất kết nối CSDL.</span></div>';
        renderDifficulty([]);
        renderTypes([], 0);
        showToast(
            "Không thể tải dữ liệu từ MySQL. Hãy kiểm tra cấu hình kết nối.",
        );
    }
}
setToday();
loadDashboard();
document
    .getElementById("refreshButton")
    .addEventListener("click", loadDashboard);
document
    .getElementById("menuToggle")
    .addEventListener("click", () =>
        document.getElementById("sidebar").classList.toggle("open"),
    );

document.querySelectorAll(".side-nav .nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
        const href = link.getAttribute("href");

        // Chỉ hiện thông báo với các chức năng chưa triển khai
        const unfinishedLinks = [
            "#users",
            "#settings",
            "#generate",
            "#exams",
            "#matrices",
        ];

        if (unfinishedLinks.includes(href)) {
            event.preventDefault();
            showToast("Màn hình này sẽ được triển khai ở bước tiếp theo.");
        } else {
            // Cho phép trình duyệt mở trang theo href
            document
                .querySelectorAll(".side-nav .nav-link")
                .forEach((a) => a.classList.remove("active"));

            link.classList.add("active");
        }

        if (window.innerWidth <= 1000) {
            document.getElementById("sidebar")?.classList.remove("open");
        }
    });
});

document.getElementById("globalSearch").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.value.trim())
        showToast(
            `Tìm kiếm “${event.target.value.trim()}” sẽ được tích hợp vào các màn hình quản lý.`,
        );
});
document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("globalSearch").focus();
    }
});
