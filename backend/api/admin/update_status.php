<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    send_json(false, "Invalid request method", null, 405);
}

$input = json_decode(file_get_contents("php://input"), true);

$claim_id = isset($input["claim_id"]) ? (int) $input["claim_id"] : 0;
$new_status_id = isset($input["new_status_id"]) ? (int) $input["new_status_id"] : 0;
$remarks = trim($input["remarks"] ?? "");

if ($claim_id <= 0 || $new_status_id <= 0 || $remarks === "") {
    send_json(false, "Claim ID, new status, and remarks are required", null, 400);
}

try {
    $conn->beginTransaction();

    $claimStmt = $conn->prepare("
        SELECT current_status_id 
        FROM medical_claims 
        WHERE claim_id = :claim_id
        LIMIT 1
    ");

    $claimStmt->execute([
        ":claim_id" => $claim_id
    ]);

    $claim = $claimStmt->fetch(PDO::FETCH_ASSOC);

    if (!$claim) {
        $conn->rollBack();
        send_json(false, "Claim not found", null, 404);
    }

    $old_status_id = $claim["current_status_id"];

    $statusStmt = $conn->prepare("
        SELECT status_id 
        FROM claim_statuses 
        WHERE status_id = :status_id
        LIMIT 1
    ");

    $statusStmt->execute([
        ":status_id" => $new_status_id
    ]);

    if (!$statusStmt->fetch()) {
        $conn->rollBack();
        send_json(false, "Invalid status selected", null, 400);
    }

    $updateStmt = $conn->prepare("
        UPDATE medical_claims
        SET 
            current_status_id = :new_status_id,
            latest_remark = :remarks,
            updated_at = NOW()
        WHERE claim_id = :claim_id
    ");

    $updateStmt->execute([
        ":new_status_id" => $new_status_id,
        ":remarks" => $remarks,
        ":claim_id" => $claim_id
    ]);

    $historyStmt = $conn->prepare("
        INSERT INTO claim_status_history
        (claim_id, old_status_id, new_status_id, remarks, updated_by)
        VALUES
        (:claim_id, :old_status_id, :new_status_id, :remarks, :updated_by)
    ");

    $historyStmt->execute([
        ":claim_id" => $claim_id,
        ":old_status_id" => $old_status_id,
        ":new_status_id" => $new_status_id,
        ":remarks" => $remarks,
        ":updated_by" => get_logged_admin_id()
    ]);

    $conn->commit();

    send_json(true, "Claim status updated successfully");

} catch (PDOException $e) {
    $conn->rollBack();
    send_json(false, "Failed to update status", $e->getMessage(), 500);
}