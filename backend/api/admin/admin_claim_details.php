<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();
$claimId = (int) ($_GET["claim_id"] ?? 0);
if ($claimId <= 0) {
    send_json(false, "Valid claim ID is required", null, 400);
}

try {
    $claimStmt = $conn->prepare(
        "SELECT r.r_id AS claim_id, r.reference AS reference_no, r.opd_date, r.amount_requested, r.claim_type,
            r.patient_name, r.emp_computer_number AS computer_no, r.is_document_received, r.document_received_date,
            r.invoice_number, r.medical_recommendation, r.medical_remark, r.doctor_approved_date,
            r.approved_amount, r.payment_approved_date, r.paid_date, r.created_at, r.updated_at,
            r.claim_for, r.status AS current_status_name, e.nic, e.initials, e.surname,
            CONCAT_WS(' ', e.initials, e.surname) AS employee_name, d.division_name AS division
         FROM xd_claim_requests r
         LEFT JOIN xd_employees e ON e.computer_number = r.emp_computer_number
         LEFT JOIN xd_divisions d ON d.div_code = e.division_code
         WHERE r.r_id = :claim_id LIMIT 1"
    );
    $claimStmt->execute([":claim_id" => $claimId]);
    $claim = $claimStmt->fetch(PDO::FETCH_ASSOC);
    if (!$claim) {
        send_json(false, "Claim not found", null, 404);
    }

    $history = $conn->prepare(
        "SELECT h.log_id AS history_id, old_s.status_name AS old_status, new_s.status_name AS new_status,
            h.remarks, u.username AS updated_by, h.updated_at
         FROM xd_claim_history_log h
         LEFT JOIN xd_statuses old_s ON old_s.s_id = h.old_status_id
         LEFT JOIN xd_statuses new_s ON new_s.s_id = h.new_status_id
         LEFT JOIN xsu_system_users u ON u.u_id = h.updated_by
         WHERE h.claim_requests_id = :claim_id
         ORDER BY h.updated_at, h.log_id"
    );
    $history->execute([":claim_id" => $claimId]);
    $statuses = $conn->query("SELECT s_id AS status_id, status_name, status_order FROM xd_statuses ORDER BY status_order, s_id")->fetchAll(PDO::FETCH_ASSOC);
    send_json(true, "Claim details loaded", ["claim" => $claim, "history" => $history->fetchAll(PDO::FETCH_ASSOC), "statuses" => $statuses]);
} catch (PDOException $e) {
    send_json(false, "Failed to load claim details", null, 500);
}
