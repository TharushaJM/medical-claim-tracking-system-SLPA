<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();

try {
    $page = max(1, (int) ($_GET["page"] ?? 1));
    $limit = min(100, max(1, (int) ($_GET["limit"] ?? 10)));
    $offset = ($page - 1) * $limit;

    $where = [];
    $params = [];
    $search = trim($_GET["search"] ?? "");
    $status = trim($_GET["status"] ?? "");
    $statusId = (int) ($_GET["status_id"] ?? 0);
    $claimType = strtolower(trim($_GET["claim_type"] ?? ""));
    $division = trim($_GET["division"] ?? "");
    $dateFrom = trim($_GET["date_from"] ?? "");
    $dateTo = trim($_GET["date_to"] ?? "");

    if ($search !== "") {
        $where[] = "(r.reference LIKE :search OR r.emp_computer_number LIKE :search OR e.nic LIKE :search OR CONCAT_WS(' ', e.initials, e.surname) LIKE :search)";
        $params[":search"] = "%{$search}%";
    }
    if ($statusId > 0) {
        $where[] = "s.s_id = :status_id";
        $params[":status_id"] = $statusId;
    } elseif ($status !== "") {
        $where[] = "r.status = :status";
        $params[":status"] = $status;
    }
    if (in_array($claimType, ["opd", "specs"], true)) {
        $where[] = "r.claim_type = :claim_type";
        $params[":claim_type"] = $claimType;
    }
    if ($division !== "") {
        $where[] = "d.division_name = :division";
        $params[":division"] = $division;
    }
    if ($dateFrom !== "") {
        $where[] = "r.opd_date >= :date_from";
        $params[":date_from"] = $dateFrom;
    }
    if ($dateTo !== "") {
        $where[] = "r.opd_date <= :date_to";
        $params[":date_to"] = $dateTo;
    }
    if (filter_var($_GET["needs_action"] ?? false, FILTER_VALIDATE_BOOLEAN)) {
        $where[] = "r.status IN ('Submitted', 'Document Needed', 'Payment Approved')";
    }

    $whereSql = $where ? "WHERE " . implode(" AND ", $where) : "";
    $fromSql = "FROM xd_claim_requests r
        LEFT JOIN xd_employees e ON e.computer_number = r.emp_computer_number
        LEFT JOIN xd_divisions d ON d.div_code = e.division_code
        LEFT JOIN xd_statuses s ON s.status_name = r.status";

    $count = $conn->prepare("SELECT COUNT(*) {$fromSql} {$whereSql}");
    $count->execute($params);
    $totalRecords = (int) $count->fetchColumn();

    $sql = "SELECT r.r_id AS claim_id, r.reference AS reference_no, r.emp_computer_number AS computer_no,
            e.nic, CONCAT_WS(' ', e.initials, e.surname) AS employee_name, d.division_name AS division,
            r.opd_date, r.amount_requested, r.claim_type, r.claim_for, r.patient_name,
            s.s_id AS status_id, r.status AS status_name, r.created_at, r.updated_at
            {$fromSql} {$whereSql}
            ORDER BY COALESCE(r.created_at, r.updated_at) DESC, r.r_id DESC
            LIMIT :limit OFFSET :offset";
    $stmt = $conn->prepare($sql);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(":limit", $limit, PDO::PARAM_INT);
    $stmt->bindValue(":offset", $offset, PDO::PARAM_INT);
    $stmt->execute();

    $statuses = $conn->query("SELECT s_id AS status_id, status_name, status_order FROM xd_statuses ORDER BY status_order, s_id")->fetchAll(PDO::FETCH_ASSOC);
    send_json(true, "Claims loaded successfully", [
        "claims" => $stmt->fetchAll(PDO::FETCH_ASSOC),
        "statuses" => $statuses,
        "pagination" => ["current_page" => $page, "limit" => $limit, "total_records" => $totalRecords, "total_pages" => (int) ceil($totalRecords / $limit)]
    ]);
} catch (PDOException $e) {
    send_json(false, "Failed to load claims", null, 500);
}
