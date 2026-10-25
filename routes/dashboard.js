const express = require("express");
const router = express.Router();
const db = require("../db");

// Thống kê Dashboard
router.get("/stats", async (req, res) => {
    try {
        // 1. Thống kê tổng số câu hỏi
        const [[questionRow]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM cau_hoi
        `);

        // 2. Thống kê học phần đang hoạt động
        const [[courseRow]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM hoc_phan
            WHERE trang_thai = 'HOAT_DONG'
        `);

        // 3. Thống kê ma trận chưa lưu trữ
        const [[matrixRow]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM ma_tran_de
            WHERE trang_thai <> 'DA_LUU_TRU'
        `);

        // 4. Thống kê đề thi
        const [[examRow]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM de_thi
        `);

        // 5. Phân bố câu hỏi theo mức độ khó
        const [difficultyRows] = await db.query(`
            SELECT
                muc_do_kho AS level,
                COUNT(*) AS total
            FROM cau_hoi
            GROUP BY muc_do_kho
        `);

        // 6. Phân bố câu hỏi theo dạng
        const [typeRows] = await db.query(`
            SELECT
                dang_cau_hoi AS type,
                COUNT(*) AS total
            FROM cau_hoi
            GROUP BY dang_cau_hoi
        `);

        // 7. Danh sách 5 đề thi gần đây
        const [recentExams] = await db.query(`
            SELECT
                dt.ma_de_thi,
                dt.ma_phien_ban,
                dt.trang_thai,
                dt.thoi_diem_sinh_de,
                hp.ten_hoc_phan,
                mt.ten_ma_tran,
                COUNT(chtd.ma_ban_ghi) AS so_cau
            FROM de_thi dt
            LEFT JOIN hoc_phan hp
                ON hp.ma_hoc_phan = dt.ma_hoc_phan
            LEFT JOIN ma_tran_de mt
                ON mt.ma_ma_tran = dt.ma_ma_tran
            LEFT JOIN cau_hoi_trong_de chtd
                ON chtd.ma_de_thi = dt.ma_de_thi
            GROUP BY
                dt.ma_de_thi,
                dt.ma_phien_ban,
                dt.trang_thai,
                dt.thoi_diem_sinh_de,
                hp.ten_hoc_phan,
                mt.ten_ma_tran
            ORDER BY dt.ma_de_thi DESC
            LIMIT 5
        `);

        // 8. Cảnh báo ma trận có tổng số câu không khớp
        const [alerts] = await db.query(`
            SELECT
                mt.ma_ma_tran,
                mt.ten_ma_tran,
                mt.tong_so_cau_muc_tieu,
                COALESCE(SUM(ct.so_cau_yeu_cau), 0)
                    AS tong_so_cau_o_ma_tran
            FROM ma_tran_de mt
            LEFT JOIN chi_tiet_ma_tran ct
                ON ct.ma_ma_tran = mt.ma_ma_tran
            WHERE mt.trang_thai <> 'DA_LUU_TRU'
            GROUP BY
                mt.ma_ma_tran,
                mt.ten_ma_tran,
                mt.tong_so_cau_muc_tieu
            HAVING
                COALESCE(SUM(ct.so_cau_yeu_cau), 0)
                <> mt.tong_so_cau_muc_tieu
            ORDER BY mt.ma_ma_tran DESC
            LIMIT 5
        `);

        // 9. Trả dữ liệu cho frontend
        res.json({
            success: true,
            stats: {
                questions: Number(questionRow.total),
                courses: Number(courseRow.total),
                matrices: Number(matrixRow.total),
                exams: Number(examRow.total),
            },
            difficulty: difficultyRows,
            types: typeRows,
            recentExams,
            alerts,
        });
    } catch (error) {
        console.error("Lỗi truy vấn dashboard:", error);

        res.status(500).json({
            success: false,
            message:
                "Không lấy được dữ liệu Dashboard. Hãy kiểm tra CSDL và cấu hình .env.",
            detail: error.message,
        });
    }
});

module.exports = router;
