<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();

$claim_id = isset($_GET["claim_id"]) ? (int) $_GET["claim_id"] : 0;

if ($claim_id <= 0) {
    send_json(false, "Valid claim ID is required", null, 400);
}

try {
    $stmt = $conn->prepare("
        SELECT 
            mc.*,
            e.computer_no,
            e.nic,
            e.full_name,
            e.designation,
            e.division,
            e.section,
            e.telephone,
            cs.status_name AS current_status_name
        FROM medical_claims mc
        INNER JOIN employees e ON mc.employee_id = e.employee_id
        INNER JOIN claim_statuses cs ON mc.current_status_id = cs.status_id
        WHERE mc.claim_id = :claim_id
        LIMIT 1
    ");

    $stmt->execute([
        ":claim_id" => $claim_id
    ]);

    $claim = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$claim) {
        send_json(false, "Claim not found", null, 404);
    }

    $historyStmt = $conn->prepare("
        SELECT 
            h.history_id,
            old_status.status_name AS old_status,
            new_status.status_name AS new_status,
            h.remarks,
            au.username AS updated_by,
            h.updated_at
        FROM claim_status_history h
        LEFT JOIN claim_statuses old_status ON h.old_status_id = old_status.status_id
        INNER JOIN claim_statuses new_status ON h.new_status_id = new_status.status_id
        INNER JOIN admin_users au ON h.updated_by = au.admin_id
        WHERE h.claim_id = :claim_id
        ORDER BY h.updated_at ASC
    ");

    $historyStmt->execute([
        ":claim_id" => $claim_id
    ]);

    $history = $historyStmt->fetchAll(PDO::FETCH_ASSOC);

    $statusStmt = $conn->query("
        SELECT status_id, status_name 
        FROM claim_statuses 
        ORDER BY status_order ASC
    ");

    $statuses = $statusStmt->fetchAll(PDO::FETCH_ASSOC);

    send_json(true, "Claim details loaded", [
        "claim" => $claim,
        "history" => $history,
        "statuses" => $statuses
    ]);

} catch (PDOException $e) {
    send_json(false, "Failed to load claim details", $e->getMessage(), 500);
}