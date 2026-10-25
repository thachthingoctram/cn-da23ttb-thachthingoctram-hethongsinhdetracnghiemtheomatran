const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const XLSX = require("xlsx");

const QUESTION_TYPES = [
    "NHIEU_LUA_CHON",
    "DUNG_SAI",
    "GHEP_HOP",
    "DIEN_KHUYET",
];

const DIFFICULTIES = ["DE", "TRUNG_BINH", "KHO"];
const STATUSES = ["HOAT_DONG", "NGUNG_HOAT_DONG", "NHAP", "CHO_DUYET"];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (!/\.(csv|xlsx|xls)$/i.test(file.originalname)) {
            return callback(new Error("Chỉ chấp nhận file CSV hoặc Excel."));
        }
        callback(null, true);
    },
});

function parseJson(value, fallback = null) {
    if (value == null || value === "") return fallback;
    if (typeof value === "object") return value;

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function validateQuestion(body) {
    const {
        ma_cau_hoi_code,
        ma_hoc_phan,
        ma_lien_ket_chuong_cdr,
        dang_cau_hoi,
        muc_do_kho,
        noi_dung_cau_hoi,
        cac_lua_chon,
        dap_an,
        trang_thai,
    } = body;

    if (!String(ma_cau_hoi_code || "").trim()) {
        return "Vui lòng nhập mã câu hỏi.";
    }

    if (!Number.isInteger(Number(ma_hoc_phan)) || Number(ma_hoc_phan) <= 0) {
        return "Vui lòng chọn học phần.";
    }

    if (
        !Number.isInteger(Number(ma_lien_ket_chuong_cdr)) ||
        Number(ma_lien_ket_chuong_cdr) <= 0
    ) {
        return "Vui lòng chọn liên kết chương và chuẩn đầu ra.";
    }

    if (!QUESTION_TYPES.includes(dang_cau_hoi)) {
        return "Dạng câu hỏi không hợp lệ.";
    }

    if (!DIFFICULTIES.includes(muc_do_kho)) {
        return "Mức độ khó không hợp lệ.";
    }

    if (!String(noi_dung_cau_hoi || "").trim()) {
        return "Vui lòng nhập nội dung câu hỏi.";
    }

    if (dap_an === undefined || dap_an === null || dap_an === "") {
        return "Vui lòng nhập đáp án.";
    }

    if (!STATUSES.includes(trang_thai || "HOAT_DONG")) {
        return "Trạng thái câu hỏi không hợp lệ.";
    }

    if (
        cac_lua_chon !== undefined &&
        cac_lua_chon !== null &&
        !Array.isArray(cac_lua_chon) &&
        typeof cac_lua_chon !== "object"
    ) {
        return "Các lựa chọn phải có định dạng JSON.";
    }

    return null;
}

function normalizeImportRow(row) {
    const code = String(row.ma_cau_hoi_code || "").trim();

    const options =
        row.cac_lua_chon === "" || row.cac_lua_chon == null
            ? null
            : parseJson(row.cac_lua_chon, undefined);

    const answer =
        row.dap_an === "" || row.dap_an == null
            ? undefined
            : parseJson(row.dap_an, undefined);

    return {
        ma_cau_hoi_code: code,
        ma_hoc_phan: Number(row.ma_hoc_phan),
        ma_lien_ket_chuong_cdr: Number(row.ma_lien_ket_chuong_cdr),
        dang_cau_hoi: String(row.dang_cau_hoi || "").trim(),
        muc_do_kho: String(row.muc_do_kho || "").trim(),
        noi_dung_cau_hoi: String(row.noi_dung_cau_hoi || "").trim(),
        cac_lua_chon: options === undefined ? null : options,
        dap_an: answer,
        giai_thich: String(row.giai_thich || "").trim(),
        trang_thai: String(row.trang_thai || "HOAT_DONG").trim(),
    };
}

async function validateImportRows(rows, connection = db) {
    const errors = [];
    const seenCodes = new Set();
    const normalizedRows = [];

    for (let index = 0; index < rows.length; index++) {
        const line = index + 2;
        const row = normalizeImportRow(rows[index]);
        const rowErrors = [];

        if (
            rows[index].cac_lua_chon !== "" &&
            rows[index].cac_lua_chon != null &&
            row.cac_lua_chon === null
        ) {
            rowErrors.push("Các lựa chọn không đúng định dạng JSON.");
        }

        if (
            rows[index].dap_an !== "" &&
            rows[index].dap_an != null &&
            row.dap_an === undefined
        ) {
            rowErrors.push("Đáp án không đúng định dạng JSON.");
        }

        if (row.dap_an === undefined) {
            rowErrors.push("Vui lòng nhập đáp án hợp lệ.");
        }

        const validationError = validateQuestion(row);
        if (validationError) rowErrors.push(validationError);

        if (row.ma_cau_hoi_code) {
            if (seenCodes.has(row.ma_cau_hoi_code)) {
                rowErrors.push("Mã câu hỏi bị trùng trong file.");
            }
            seenCodes.add(row.ma_cau_hoi_code);

            const [existing] = await connection.query(
                `SELECT ma_cau_hoi
         FROM cau_hoi
         WHERE ma_cau_hoi_code = ?
         LIMIT 1`,
                [row.ma_cau_hoi_code],
            );

            if (existing.length) {
                rowErrors.push("Mã câu hỏi đã tồn tại trong hệ thống.");
            }
        }

        if (
            Number.isInteger(row.ma_hoc_phan) &&
            row.ma_hoc_phan > 0 &&
            Number.isInteger(row.ma_lien_ket_chuong_cdr) &&
            row.ma_lien_ket_chuong_cdr > 0
        ) {
            const [linkRows] = await connection.query(
                `SELECT ma_lien_ket
         FROM chuong_chuan_dau_ra
         WHERE ma_lien_ket = ?
           AND ma_hoc_phan = ?
         LIMIT 1`,
                [row.ma_lien_ket_chuong_cdr, row.ma_hoc_phan],
            );

            if (!linkRows.length) {
                rowErrors.push(
                    "Liên kết chương/chuẩn đầu ra không thuộc học phần đã chọn.",
                );
            }
        }

        if (rowErrors.length) {
            errors.push({
                dong: line,
                ma_cau_hoi_code: row.ma_cau_hoi_code,
                loi: [...new Set(rowErrors)],
            });
        }

        normalizedRows.push(row);
    }

    return { normalizedRows, errors };
}

// Danh sách câu hỏi và bộ lọc
router.get("/", async (req, res) => {
    try {
        const {
            keyword = "",
            hoc_phan = "",
            muc_do = "",
            dang = "",
            trang_thai = "",
        } = req.query;

        const conditions = [];
        const params = [];

        if (String(keyword).trim()) {
            conditions.push(`(
        ch.ma_cau_hoi_code LIKE ?
        OR ch.noi_dung_cau_hoi LIKE ?
      )`);
            params.push(
                `%${String(keyword).trim()}%`,
                `%${String(keyword).trim()}%`,
            );
        }

        if (hoc_phan) {
            conditions.push("ch.ma_hoc_phan = ?");
            params.push(hoc_phan);
        }

        if (muc_do && DIFFICULTIES.includes(muc_do)) {
            conditions.push("ch.muc_do_kho = ?");
            params.push(muc_do);
        }

        if (dang && QUESTION_TYPES.includes(dang)) {
            conditions.push("ch.dang_cau_hoi = ?");
            params.push(dang);
        }

        if (trang_thai && STATUSES.includes(trang_thai)) {
            conditions.push("ch.trang_thai = ?");
            params.push(trang_thai);
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [rows] = await db.query(
            `
      SELECT
        ch.ma_cau_hoi,
        ch.ma_cau_hoi_code,
        ch.ma_hoc_phan,
        ch.ma_lien_ket_chuong_cdr,
        ch.dang_cau_hoi,
        ch.muc_do_kho,
        ch.noi_dung_cau_hoi,
        ch.cac_lua_chon,
        ch.dap_an,
        ch.giai_thich,
        ch.trang_thai,
        ch.so_lan_su_dung,
        ch.ngay_tao,
        ch.ngay_cap_nhat,
        hp.ma_hoc_phan_code,
        hp.ten_hoc_phan,
        ck.ten_chuong,
        cdr.ma_chuan_code,
        cdr.noi_dung_chuan_dau_ra
      FROM cau_hoi ch
      JOIN hoc_phan hp
        ON hp.ma_hoc_phan = ch.ma_hoc_phan
      JOIN chuong_chuan_dau_ra lk
        ON lk.ma_lien_ket = ch.ma_lien_ket_chuong_cdr
        AND lk.ma_hoc_phan = ch.ma_hoc_phan
      JOIN chuong_kien_thuc ck
        ON ck.ma_chuong = lk.ma_chuong
        AND ck.ma_hoc_phan = lk.ma_hoc_phan
      JOIN chuan_dau_ra cdr
        ON cdr.ma_chuan_dau_ra = lk.ma_chuan_dau_ra
        AND cdr.ma_hoc_phan = lk.ma_hoc_phan
      ${where}
      ORDER BY ch.ma_cau_hoi DESC
    `,
            params,
        );

        const questions = rows.map((row) => ({
            ...row,
            cac_lua_chon: parseJson(row.cac_lua_chon, []),
            dap_an: parseJson(row.dap_an, null),
        }));

        res.json({ success: true, questions });
    } catch (error) {
        console.error("Lỗi lấy danh sách câu hỏi:", error.message);
        res.status(500).json({
            success: false,
            message: "Không lấy được danh sách câu hỏi.",
        });
    }
});

// Dữ liệu cho các ô chọn trong biểu mẫu
router.get("/options", async (req, res) => {
    try {
        const [courses] = await db.query(`
      SELECT ma_hoc_phan, ma_hoc_phan_code, ten_hoc_phan
      FROM hoc_phan
      WHERE trang_thai = 'HOAT_DONG'
      ORDER BY ten_hoc_phan
    `);

        const [links] = await db.query(`
      SELECT
        lk.ma_lien_ket,
        lk.ma_hoc_phan,
        ck.ten_chuong,
        cdr.ma_chuan_code,
        cdr.noi_dung_chuan_dau_ra
      FROM chuong_chuan_dau_ra lk
      JOIN chuong_kien_thuc ck
        ON ck.ma_chuong = lk.ma_chuong
        AND ck.ma_hoc_phan = lk.ma_hoc_phan
      JOIN chuan_dau_ra cdr
        ON cdr.ma_chuan_dau_ra = lk.ma_chuan_dau_ra
        AND cdr.ma_hoc_phan = lk.ma_hoc_phan
      WHERE ck.trang_thai = 'HOAT_DONG'
        AND cdr.trang_thai = 'HOAT_DONG'
      ORDER BY lk.ma_hoc_phan, ck.thu_tu_hien_thi, cdr.thu_tu_hien_thi
    `);

        res.json({ success: true, courses, links });
    } catch (error) {
        console.error("Lỗi lấy dữ liệu biểu mẫu:", error.message);
        res.status(500).json({
            success: false,
            message: "Không lấy được dữ liệu học phần và chuẩn đầu ra.",
        });
    }
});

// Xem trước và kiểm tra file CSV/Excel
router.post("/import/preview", (req, res) => {
    upload.single("file")(req, res, async (uploadError) => {
        if (uploadError) {
            return res.status(400).json({
                success: false,
                message: uploadError.message,
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng chọn file CSV hoặc Excel.",
            });
        }

        try {
            const workbook = XLSX.read(req.file.buffer, {
                type: "buffer",
                cellDates: false,
            });

            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                return res.status(400).json({
                    success: false,
                    message: "File không có trang tính dữ liệu.",
                });
            }

            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
                defval: "",
                raw: false,
            });

            if (!rows.length) {
                return res.status(400).json({
                    success: false,
                    message: "File không có dữ liệu câu hỏi.",
                });
            }

            if (rows.length > 1000) {
                return res.status(400).json({
                    success: false,
                    message: "Mỗi lần chỉ được nhập tối đa 1000 câu hỏi.",
                });
            }

            const requiredColumns = [
                "ma_cau_hoi_code",
                "ma_hoc_phan",
                "ma_lien_ket_chuong_cdr",
                "dang_cau_hoi",
                "muc_do_kho",
                "noi_dung_cau_hoi",
                "cac_lua_chon",
                "dap_an",
            ];

            const headers = Object.keys(rows[0]);
            const missingColumns = requiredColumns.filter(
                (column) => !headers.includes(column),
            );

            if (missingColumns.length) {
                return res.status(400).json({
                    success: false,
                    message: `File thiếu các cột bắt buộc: ${missingColumns.join(", ")}`,
                });
            }

            const { normalizedRows, errors } = await validateImportRows(rows);

            res.json({
                success: true,
                message: errors.length
                    ? "File có dữ liệu chưa hợp lệ. Hãy sửa lỗi trước khi nhập."
                    : "Dữ liệu hợp lệ, có thể xác nhận nhập.",
                total: normalizedRows.length,
                valid: normalizedRows.length - errors.length,
                invalid: errors.length,
                errors,
                rows: normalizedRows,
            });
        } catch (error) {
            console.error("Lỗi xem trước file import:", error.message);
            res.status(400).json({
                success: false,
                message:
                    "Không đọc được file. Hãy kiểm tra định dạng và nội dung.",
            });
        }
    });
});

// Xác nhận nhập dữ liệu đã xem trước
router.post("/import/commit", async (req, res) => {
    const rows = req.body?.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Không có dữ liệu để nhập.",
        });
    }

    if (rows.length > 1000) {
        return res.status(400).json({
            success: false,
            message: "Mỗi lần chỉ được nhập tối đa 1000 câu hỏi.",
        });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { normalizedRows, errors } = await validateImportRows(
            rows,
            connection,
        );

        if (errors.length) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    "Dữ liệu đã thay đổi hoặc có lỗi. Không có câu hỏi nào được nhập.",
                errors,
            });
        }

        for (const row of normalizedRows) {
            await connection.query(
                `INSERT INTO cau_hoi (
          ma_cau_hoi_code,
          ma_hoc_phan,
          ma_lien_ket_chuong_cdr,
          dang_cau_hoi,
          muc_do_kho,
          noi_dung_cau_hoi,
          cac_lua_chon,
          dap_an,
          giai_thich,
          trang_thai
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.ma_cau_hoi_code,
                    row.ma_hoc_phan,
                    row.ma_lien_ket_chuong_cdr,
                    row.dang_cau_hoi,
                    row.muc_do_kho,
                    row.noi_dung_cau_hoi,
                    row.cac_lua_chon == null
                        ? null
                        : JSON.stringify(row.cac_lua_chon),
                    JSON.stringify(row.dap_an),
                    row.giai_thich || null,
                    row.trang_thai || "HOAT_DONG",
                ],
            );
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: `Nhập thành công ${normalizedRows.length} câu hỏi.`,
            imported: normalizedRows.length,
        });
    } catch (error) {
        if (connection) await connection.rollback();

        console.error("Lỗi nhập câu hỏi:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Mã câu hỏi bị trùng. Không có câu hỏi nào được nhập.",
            });
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({
                success: false,
                message:
                    "Học phần hoặc liên kết chương/chuẩn đầu ra không hợp lệ.",
            });
        }

        res.status(500).json({
            success: false,
            message: "Không nhập được dữ liệu. Giao dịch đã được hoàn tác.",
        });
    } finally {
        if (connection) connection.release();
    }
});

// Thêm câu hỏi
router.post("/", async (req, res) => {
    try {
        const body = req.body;
        const validationError = validateQuestion(body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError,
            });
        }

        const [result] = await db.query(
            `
      INSERT INTO cau_hoi (
        ma_cau_hoi_code,
        ma_hoc_phan,
        ma_lien_ket_chuong_cdr,
        dang_cau_hoi,
        muc_do_kho,
        noi_dung_cau_hoi,
        cac_lua_chon,
        dap_an,
        giai_thich,
        trang_thai
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
            [
                String(body.ma_cau_hoi_code).trim(),
                Number(body.ma_hoc_phan),
                Number(body.ma_lien_ket_chuong_cdr),
                body.dang_cau_hoi,
                body.muc_do_kho,
                String(body.noi_dung_cau_hoi).trim(),
                body.cac_lua_chon == null
                    ? null
                    : JSON.stringify(body.cac_lua_chon),
                JSON.stringify(body.dap_an),
                body.giai_thich || null,
                body.trang_thai || "HOAT_DONG",
            ],
        );

        res.status(201).json({
            success: true,
            message: "Thêm câu hỏi thành công.",
            ma_cau_hoi: result.insertId,
        });
    } catch (error) {
        console.error("Lỗi thêm câu hỏi:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Mã câu hỏi đã tồn tại.",
            });
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({
                success: false,
                message:
                    "Học phần hoặc liên kết chương/chuẩn đầu ra không hợp lệ.",
            });
        }

        res.status(500).json({
            success: false,
            message: "Không thêm được câu hỏi.",
        });
    }
});

// Cập nhật câu hỏi
router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã câu hỏi không hợp lệ.",
            });
        }

        const body = req.body;
        const validationError = validateQuestion(body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError,
            });
        }

        const [existing] = await db.query(
            "SELECT ma_cau_hoi FROM cau_hoi WHERE ma_cau_hoi = ?",
            [id],
        );

        if (!existing.length) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy câu hỏi.",
            });
        }

        await db.query(
            `
      UPDATE cau_hoi
      SET
        ma_cau_hoi_code = ?,
        ma_hoc_phan = ?,
        ma_lien_ket_chuong_cdr = ?,
        dang_cau_hoi = ?,
        muc_do_kho = ?,
        noi_dung_cau_hoi = ?,
        cac_lua_chon = ?,
        dap_an = ?,
        giai_thich = ?,
        trang_thai = ?
      WHERE ma_cau_hoi = ?
    `,
            [
                String(body.ma_cau_hoi_code).trim(),
                Number(body.ma_hoc_phan),
                Number(body.ma_lien_ket_chuong_cdr),
                body.dang_cau_hoi,
                body.muc_do_kho,
                String(body.noi_dung_cau_hoi).trim(),
                body.cac_lua_chon == null
                    ? null
                    : JSON.stringify(body.cac_lua_chon),
                JSON.stringify(body.dap_an),
                body.giai_thich || null,
                body.trang_thai || "HOAT_DONG",
                id,
            ],
        );

        res.json({
            success: true,
            message: "Cập nhật câu hỏi thành công.",
        });
    } catch (error) {
        console.error("Lỗi cập nhật câu hỏi:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Mã câu hỏi đã được sử dụng.",
            });
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({
                success: false,
                message:
                    "Học phần hoặc liên kết chương/chuẩn đầu ra không hợp lệ.",
            });
        }

        res.status(500).json({
            success: false,
            message: "Không cập nhật được câu hỏi.",
        });
    }
});

// Đổi trạng thái câu hỏi
router.patch("/:id/status", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { trang_thai } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Mã câu hỏi không hợp lệ.",
            });
        }

        if (!STATUSES.includes(trang_thai)) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái không hợp lệ.",
            });
        }

        const [result] = await db.query(
            "UPDATE cau_hoi SET trang_thai = ? WHERE ma_cau_hoi = ?",
            [trang_thai, id],
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy câu hỏi.",
            });
        }

        res.json({
            success: true,
            message: "Cập nhật trạng thái câu hỏi thành công.",
        });
    } catch (error) {
        console.error("Lỗi đổi trạng thái câu hỏi:", error.message);
        res.status(500).json({
            success: false,
            message: "Không đổi được trạng thái câu hỏi.",
        });
    }
});

module.exports = router;
