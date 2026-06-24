<?php

require_once "../../config/db.php";
require_once "../../helpers/response.php";
require_once "../../helpers/auth.php";

require_admin_login();
if ($_SERVER["REQUEST_METHOD"] !== "POST") send_json(false, "Only POST method is allowed", null, 405);
$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) send_json(false, "A JSON request body is required", null, 400);
$claimId = (int) ($input["claim_id"] ?? 0);
$recommendation = strtoupper(trim($input["medical_recommendation"] ?? ""));
$remark = trim($input["medical_remark"] ?? "");
$approvedDate = trim($input["doctor_approved_date"] ?? $input["recommendation_date"] ?? "");
if ($claimId <= 0 || $recommendation === "") send_json(false, "Claim ID and medical recommendation are required", null, 400);
if (!in_array($recommendation, ["PENDING", "RECOMMENDED", "NOT_RECOMMENDED"], true)) send_json(false, "Invalid medical recommendation", null, 400);
try {
    $stmt = $conn->prepare("UPDATE xd_claim_requests SET medical_recommendation = :recommendation, medical_remark = :remark, doctor_approved_date = :approved_date, updated_at = NOW() WHERE r_id = :claim_id");
    $stmt->execute([":recommendation" => $recommendation, ":remark" => $remark !== "" ? $remark : null, ":approved_date" => $approvedDate !== "" ? $approvedDate : null, ":claim_id" => $claimId]);
    if ($stmt->rowCount() === 0) { $exists = $conn->prepare("SELECT 1 FROM xd_claim_requests WHERE r_id = ?"); $exists->execute([$claimId]); if (!$exists->fetchColumn()) send_json(false, "Claim not found", null, 404); }
    send_json(true, "Medical recommendation updated successfully");
} catch (PDOException $e) { send_json(false, "Failed to update medical recommendation", null, 500); }
