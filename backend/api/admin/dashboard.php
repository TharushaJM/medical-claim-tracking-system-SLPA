<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();

try {
    $totalClaims = (int) $conn->query("SELECT COUNT(*) FROM xd_claim_requests")->fetchColumn();
    $statusCounts = $conn->query(
        "SELECT s.s_id AS status_id, s.status_name, s.status_order, COUNT(r.r_id) AS total
         FROM xd_statuses s
         LEFT JOIN xd_claim_requests r ON r.status = s.status_name
         GROUP BY s.s_id, s.status_name, s.status_order
         ORDER BY s.status_order, s.s_id"
    )->fetchAll(PDO::FETCH_ASSOC);

    $paymentSummary = $conn->query(
        "SELECT
            COALESCE(SUM(CASE WHEN status = 'Paid' THEN COALESCE(approved_amount, amount_requested, 0) ELSE 0 END), 0) AS total_paid_amount,
            COALESCE(SUM(CASE WHEN status = 'Payment Approved' THEN COALESCE(approved_amount, amount_requested, 0) ELSE 0 END), 0) AS pending_payment_amount,
            COALESCE(SUM(CASE WHEN status IN ('Approved by Doctor', 'Payment Approved', 'Paid') THEN COALESCE(approved_amount, amount_requested, 0) ELSE 0 END), 0) AS total_approved_amount
         FROM xd_claim_requests"
    )->fetch(PDO::FETCH_ASSOC);

    $claimSelect = "SELECT r.r_id AS claim_id, r.reference AS reference_no, r.emp_computer_number AS computer_no,
        CONCAT_WS(' ', e.initials, e.surname) AS employee_name, r.opd_date, r.amount_requested,
        r.claim_type, r.status AS status_name, r.created_at, r.updated_at
        FROM xd_claim_requests r
        LEFT JOIN xd_employees e ON e.computer_number = r.emp_computer_number";
    $recentClaims = $conn->query("{$claimSelect} ORDER BY COALESCE(r.created_at, r.updated_at) DESC, r.r_id DESC LIMIT 8")->fetchAll(PDO::FETCH_ASSOC);
    $claimsNeedingAction = $conn->query("{$claimSelect} WHERE r.status IN ('Submitted', 'Document Needed', 'Payment Approved') ORDER BY COALESCE(r.updated_at, r.created_at) DESC, r.r_id DESC LIMIT 8")->fetchAll(PDO::FETCH_ASSOC);
    $typeCounts = $conn->query("SELECT claim_type, COUNT(*) AS total FROM xd_claim_requests GROUP BY claim_type")->fetchAll(PDO::FETCH_ASSOC);

    send_json(true, "Dashboard data loaded", [
        "total_claims" => $totalClaims,
        "status_counts" => $statusCounts,
        "total_paid_amount" => (float) $paymentSummary["total_paid_amount"],
        "payment_summary" => $paymentSummary,
        "recent_claims" => $recentClaims,
        "claims_needing_action" => $claimsNeedingAction,
        "claim_type_counts" => $typeCounts
    ]);
} catch (PDOException $e) {
    send_json(false, "Failed to load dashboard", null, 500);
}
