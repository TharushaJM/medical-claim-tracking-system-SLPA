<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();

try {
    $totalStmt = $conn->query("SELECT COUNT(*) AS total_claims FROM medical_claims");
    $totalClaims = $totalStmt->fetch(PDO::FETCH_ASSOC)["total_claims"];

    $statusStmt = $conn->query("
        SELECT 
            cs.status_id,
            cs.status_name,
            COUNT(mc.claim_id) AS total
        FROM claim_statuses cs
        LEFT JOIN medical_claims mc ON mc.current_status_id = cs.status_id
        GROUP BY cs.status_id, cs.status_name
        ORDER BY cs.status_order ASC
    ");

    $statusCounts = $statusStmt->fetchAll(PDO::FETCH_ASSOC);

    $paidStmt = $conn->query("
        SELECT COALESCE(SUM(approved_amount), 0) AS total_paid_amount
        FROM medical_claims mc
        INNER JOIN claim_statuses cs ON mc.current_status_id = cs.status_id
        WHERE cs.status_name = 'Paid'
    ");

    $totalPaidAmount = $paidStmt->fetch(PDO::FETCH_ASSOC)["total_paid_amount"];

    $recentStmt = $conn->query("
        SELECT 
            mc.claim_id,
            mc.reference_no,
            e.computer_no,
            e.full_name,
            mc.amount_requested,
            mc.claim_type,
            cs.status_name,
            mc.created_at
        FROM medical_claims mc
        INNER JOIN employees e ON mc.employee_id = e.employee_id
        INNER JOIN claim_statuses cs ON mc.current_status_id = cs.status_id
        ORDER BY mc.created_at DESC
        LIMIT 5
    ");

    $recentClaims = $recentStmt->fetchAll(PDO::FETCH_ASSOC);

    $actionStmt = $conn->query("
        SELECT 
            mc.claim_id,
            mc.reference_no,
            e.full_name,
            cs.status_name,
            mc.latest_remark
        FROM medical_claims mc
        INNER JOIN employees e ON mc.employee_id = e.employee_id
        INNER JOIN claim_statuses cs ON mc.current_status_id = cs.status_id
        WHERE cs.status_name IN ('Submitted', 'Document Needed', 'Submitted to Doctor', 'Payment Approved')
        ORDER BY mc.updated_at DESC
        LIMIT 5
    ");

    $claimsNeedingAction = $actionStmt->fetchAll(PDO::FETCH_ASSOC);

    send_json(true, "Dashboard data loaded", [
        "total_claims" => $totalClaims,
        "status_counts" => $statusCounts,
        "total_paid_amount" => $totalPaidAmount,
        "recent_claims" => $recentClaims,
        "claims_needing_action" => $claimsNeedingAction
    ]);

} catch (PDOException $e) {
    send_json(false, "Failed to load dashboard", $e->getMessage(), 500);
}