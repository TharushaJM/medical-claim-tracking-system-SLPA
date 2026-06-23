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
$approved_amount = isset($input["approved_amount"]) ? (float) $input["approved_amount"] : 0;
$payment_approved_date = trim($input["payment_approved_date"] ?? "");
$paid_date = trim($input["paid_date"] ?? "");
$payment_remark = trim($input["payment_remark"] ?? "");

if ($claim_id <= 0) {
    send_json(false, "Valid claim ID is required", null, 400);
}

try {
    $stmt = $conn->prepare("
        UPDATE medical_claims
        SET 
            approved_amount = :approved_amount,
            payment_approved_date = :payment_approved_date,
            paid_date = :paid_date,
            payment_remark = :payment_remark,
            updated_at = NOW()
        WHERE claim_id = :claim_id
    ");

    $stmt->execute([
        ":approved_amount" => $approved_amount,
        ":payment_approved_date" => $payment_approved_date !== "" ? $payment_approved_date : null,
        ":paid_date" => $paid_date !== "" ? $paid_date : null,
        ":payment_remark" => $payment_remark !== "" ? $payment_remark : null,
        ":claim_id" => $claim_id
    ]);

    send_json(true, "Payment details updated successfully");

} catch (PDOException $e) {
    send_json(false, "Failed to update payment details", $e->getMessage(), 500);
}