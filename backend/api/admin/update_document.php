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
$physical_document_received = strtoupper(trim($input["physical_document_received"] ?? "NO"));
$document_received_date = trim($input["document_received_date"] ?? "");
$physical_file_no = trim($input["physical_file_no"] ?? "");
$missing_documents = trim($input["missing_documents"] ?? "");
$document_remarks = trim($input["document_remarks"] ?? "");

if ($claim_id <= 0) {
    send_json(false, "Valid claim ID is required", null, 400);
}

if (!in_array($physical_document_received, ["YES", "NO"])) {
    send_json(false, "Physical document received must be YES or NO", null, 400);
}

try {
    $stmt = $conn->prepare("
        UPDATE medical_claims
        SET 
            physical_document_received = :physical_document_received,
            document_received_date = :document_received_date,
            physical_file_no = :physical_file_no,
            missing_documents = :missing_documents,
            document_remarks = :document_remarks,
            updated_at = NOW()
        WHERE claim_id = :claim_id
    ");

    $stmt->execute([
        ":physical_document_received" => $physical_document_received,
        ":document_received_date" => $document_received_date !== "" ? $document_received_date : null,
        ":physical_file_no" => $physical_file_no !== "" ? $physical_file_no : null,
        ":missing_documents" => $missing_documents !== "" ? $missing_documents : null,
        ":document_remarks" => $document_remarks !== "" ? $document_remarks : null,
        ":claim_id" => $claim_id
    ]);

    send_json(true, "Document tracking updated successfully");

} catch (PDOException $e) {
    send_json(false, "Failed to update document tracking", $e->getMessage(), 500);
}