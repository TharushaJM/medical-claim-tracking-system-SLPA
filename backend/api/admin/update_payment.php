<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();
if ($_SERVER["REQUEST_METHOD"] !== "POST") send_json(false, "Only POST method is allowed", null, 405);
$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) send_json(false, "A JSON request body is required", null, 400);
$claimId = (int) ($input["claim_id"] ?? 0);
$approvedAmount = $input["approved_amount"] ?? null;
$paymentApprovedDate = trim($input["payment_approved_date"] ?? "");
$paidDate = trim($input["paid_date"] ?? "");
if ($claimId <= 0 || $approvedAmount === null || !is_numeric($approvedAmount) || (float) $approvedAmount < 0) send_json(false, "A valid claim ID and non-negative approved amount are required", null, 400);
try {
    $stmt = $conn->prepare("UPDATE xd_claim_requests SET approved_amount = :approved_amount, payment_approved_date = :payment_approved_date, paid_date = :paid_date, updated_at = NOW() WHERE r_id = :claim_id");
    $stmt->execute([":approved_amount" => (float) $approvedAmount, ":payment_approved_date" => $paymentApprovedDate !== "" ? $paymentApprovedDate : null, ":paid_date" => $paidDate !== "" ? $paidDate : null, ":claim_id" => $claimId]);
    if ($stmt->rowCount() === 0) { $exists = $conn->prepare("SELECT 1 FROM xd_claim_requests WHERE r_id = ?"); $exists->execute([$claimId]); if (!$exists->fetchColumn()) send_json(false, "Claim not found", null, 404); }
    send_json(true, "Payment details updated successfully");
} catch (PDOException $e) { send_json(false, "Failed to update payment details", null, 500); }
