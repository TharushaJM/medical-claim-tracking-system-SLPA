<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();

try {
    $page = isset($_GET["page"]) ? (int) $_GET["page"] : 1;
    $limit = isset($_GET["limit"]) ? (int) $_GET["limit"] : 10;

    if ($page < 1) {
        $page = 1;
    }

    if ($limit < 1) {
        $limit = 10;
    }

    $offset = ($page - 1) * $limit;

    $search = trim($_GET["search"] ?? "");
    $status_id = trim($_GET["status_id"] ?? "");
    $claim_type = trim($_GET["claim_type"] ?? "");
    $date_from = trim($_GET["date_from"] ?? "");
    $date_to = trim($_GET["date_to"] ?? "");

    $where = [];
    $params = [];

    if ($search !== "") {
        $where[] = "(
            mc.reference_no LIKE :search OR
            e.computer_no LIKE :search OR
            e.nic LIKE :search OR
            e.full_name LIKE :search
        )";
        $params[":search"] = "%$search%";
    }

    if ($status_id !== "") {
        $where[] = "mc.current_status_id = :status_id";
        $params[":status_id"] = $status_id;
    }

    if ($claim_type !== "") {
        $where[] = "mc.claim_type = :claim_type";
        $params[":claim_type"] = $claim_type;
    }

    if ($date_from !== "") {
        $where[] = "mc.opd_date >= :date_from";
        $params[":date_from"] = $date_from;
    }

    if ($date_to !== "") {
        $where[] = "mc.opd_date <= :date_to";
        $params[":date_to"] = $date_to;
    }

    $whereSql = "";

    if (!empty($where)) {
        $whereSql = "WHERE " . implode(" AND ", $where);
    }

    $countSql = "
        SELECT COUNT(*) AS total
        FROM medical_claims mc
        INNER JOIN employees e ON mc.employee_id = e.employee_id
        INNER JOIN claim_statuses cs ON mc.current_status_id = cs.status_id
        $whereSql
    ";

    $countStmt = $conn->prepare($countSql);
    $countStmt->execute($params);
    $totalRecords = (int) $countStmt->fetch(PDO::FETCH_ASSOC)["total"];
    $totalPages = ceil($totalRecords / $limit);

    $sql = "
        SELECT 
            mc.claim_id,
            mc.reference_no,
            e.computer_no,
            e.nic,
            e.full_name,
            e.division,
            mc.opd_date,
            mc.amount_requested,
            mc.claim_type,
            mc.claim_for,
            mc.patient_name,
            cs.status_id,
            cs.status_name,
            mc.latest_remark,
            mc.created_at
        FROM medical_claims mc
        INNER JOIN employees e ON mc.employee_id = e.employee_id
        INNER JOIN claim_statuses cs ON mc.current_status_id = cs.status_id
        $whereSql
        ORDER BY mc.created_at DESC
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $conn->prepare($sql);

    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }

    $stmt->bindValue(":limit", $limit, PDO::PARAM_INT);
    $stmt->bindValue(":offset", $offset, PDO::PARAM_INT);
    $stmt->execute();

    $claims = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $statusStmt = $conn->query("
        SELECT status_id, status_name 
        FROM claim_statuses 
        ORDER BY status_order ASC
    ");

    $statuses = $statusStmt->fetchAll(PDO::FETCH_ASSOC);

    send_json(true, "Claims loaded successfully", [
        "claims" => $claims,
        "statuses" => $statuses,
        "pagination" => [
            "current_page" => $page,
            "limit" => $limit,
            "total_records" => $totalRecords,
            "total_pages" => $totalPages
        ]
    ]);

} catch (PDOException $e) {
    send_json(false, "Failed to load claims", $e->getMessage(), 500);
}