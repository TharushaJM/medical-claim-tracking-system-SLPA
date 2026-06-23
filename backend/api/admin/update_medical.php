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
$medical_recommendation = strtoupper(trim($input["medical_recommendation"] ?? "PENDING"));
$medical_remark = trim($input["medical_remark"] ?? "");
$recommendation_date = trim($input["recommendation_date"] ?? "");

if ($claim_id <= 0) {
    send_json(false, "Valid claim ID is required", null, 400);
}

if (!in_array($medical_recommendation, ["PENDING", "RECOMMENDED", "NOT_RECOMMENDED"])) {
    send_json(false, "Invalid medical recommendation", null, 400);
}

try {
    $stmt = $conn->prepare("
        UPDATE medical_claims
        SET 
            medical_recommendation = :medical_recommendation,
            medical_remark = :medical_remark,
            recommendation_date = :recommendation_date,
            updated_at = NOW()
        WHERE claim_id = :claim_id
    ");

    $stmt->execute([
        ":medical_recommendation" => $medical_recommendation,
        ":medical_remark" => $medical_remark !== "" ? $medical_remark : null,
        ":recommendation_date" => $recommendation_date !== "" ? $recommendation_date : null,
        ":claim_id" => $claim_id
    ]);

    send_json(true, "Medical recommendation updated successfully");

} catch (PDOException $e) {
    send_json(false, "Failed to update medical recommendation", $e->getMessage(), 500);
}