<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    send_json(false, "Only POST method is allowed", null, 405);
}
$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) {
    send_json(false, "A JSON request body is required", null, 400);
}
$claimId = (int) ($input["claim_id"] ?? 0);
$newStatusId = (int) ($input["new_status_id"] ?? 0);
$remarks = trim($input["remarks"] ?? "");
if ($claimId <= 0 || $newStatusId <= 0 || $remarks === "") {
    send_json(false, "Claim ID, new status, and remarks are required", null, 400);
}

try {
    $conn->beginTransaction();
    $claimStmt = $conn->prepare("SELECT status FROM xd_claim_requests WHERE r_id = :claim_id FOR UPDATE");
    $claimStmt->execute([":claim_id" => $claimId]);
    $claim = $claimStmt->fetch(PDO::FETCH_ASSOC);
    if (!$claim) {
        $conn->rollBack();
        send_json(false, "Claim not found", null, 404);
    }
    $statusStmt = $conn->prepare("SELECT s_id, status_name FROM xd_statuses WHERE s_id = :status_id LIMIT 1");
    $statusStmt->execute([":status_id" => $newStatusId]);
    $newStatus = $statusStmt->fetch(PDO::FETCH_ASSOC);
    if (!$newStatus) {
        $conn->rollBack();
        send_json(false, "Invalid status selected", null, 400);
    }
    $oldIdStmt = $conn->prepare("SELECT s_id FROM xd_statuses WHERE status_name = :status_name LIMIT 1");
    $oldIdStmt->execute([":status_name" => $claim["status"]]);
    $oldStatusId = $oldIdStmt->fetchColumn();
    if ($oldStatusId === false) {
        $conn->rollBack();
        send_json(false, "The claim has an unknown current status", null, 409);
    }
    $conn->prepare("UPDATE xd_claim_requests SET status = :status, updated_at = NOW() WHERE r_id = :claim_id")
        ->execute([":status" => $newStatus["status_name"], ":claim_id" => $claimId]);
    $conn->prepare("INSERT INTO xd_claim_history_log (remarks, claim_requests_id, updated_by, old_status_id, new_status_id) VALUES (:remarks, :claim_id, :updated_by, :old_status_id, :new_status_id)")
        ->execute([":remarks" => $remarks, ":claim_id" => $claimId, ":updated_by" => get_logged_admin_id(), ":old_status_id" => $oldStatusId, ":new_status_id" => $newStatusId]);
    $conn->commit();
    send_json(true, "Claim status updated successfully");
} catch (PDOException $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    send_json(false, "Failed to update status", null, 500);
}
