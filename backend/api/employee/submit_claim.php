<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(200);
    exit;
}

require_once "../../config/db.php";
require_once "../../helpers/response.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    sendJsonResponse(false, "Only POST method is allowed", null, 405);
}

// Read JSON input
$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
    sendJsonResponse(false, "Invalid JSON body", null, 400);
}

// Get input values
$reference = trim($input["reference"] ?? "");
$computerNumber = trim($input["computer_number"] ?? "");
$nic = trim($input["nic"] ?? "");
$opdDate = trim($input["opd_date"] ?? "");
$amountRequested = trim($input["amount_requested"] ?? "");
$claimType = strtolower(trim($input["claim_type"] ?? ""));
$claimFor = strtoupper(trim($input["claim_for"] ?? ""));
$patientName = trim($input["patient_name"] ?? "");

// Required field validation
if (
    $reference === "" ||
    $computerNumber === "" ||
    $nic === "" ||
    $opdDate === "" ||
    $amountRequested === "" ||
    $claimType === "" ||
    $claimFor === "" ||
    $patientName === ""
) {
    sendJsonResponse(false, "All required fields must be filled", null, 400);
}

// Validate OPD date format
$dateCheck = DateTime::createFromFormat("Y-m-d", $opdDate);
if (!$dateCheck || $dateCheck->format("Y-m-d") !== $opdDate) {
    sendJsonResponse(false, "Invalid OPD date format. Use YYYY-MM-DD", null, 400);
}

// Validate claim type
$allowedClaimTypes = ["opd", "specs"];
if (!in_array($claimType, $allowedClaimTypes, true)) {
    sendJsonResponse(false, "Invalid claim type. Use opd or specs", null, 400);
}

// Validate claim for
$allowedClaimFor = ["MYSELF", "SPOUSE", "CHILD", "MOTHER", "FATHER"];
if (!in_array($claimFor, $allowedClaimFor, true)) {
    sendJsonResponse(false, "Invalid claim for value", null, 400);
}

// Validate amount
if (!is_numeric($amountRequested) || (float)$amountRequested <= 0) {
    sendJsonResponse(false, "Amount requested must be a valid positive number", null, 400);
}

$amountRequested = (float)$amountRequested;


$submittedStatusId = 1;


$updatedByUserId = 1;

try {
    $conn->beginTransaction();

    // 1. Verify employee
    $employeeSql = "
        SELECT e_id, computer_number, nic
        FROM xd_employees
        WHERE computer_number = :computer_number
        AND nic = :nic
        LIMIT 1
    ";

    $employeeStmt = $conn->prepare($employeeSql);
    $employeeStmt->execute([
        ":computer_number" => $computerNumber,
        ":nic" => $nic
    ]);

    $employee = $employeeStmt->fetch(PDO::FETCH_ASSOC);

    if (!$employee) {
        $conn->rollBack();
        sendJsonResponse(false, "Invalid employee. Please check Computer Number and NIC", null, 401);
    }

    // 2. Check duplicate reference number
    $checkSql = "
        SELECT r_id
        FROM xd_claim_requests
        WHERE `reference` = :reference
        LIMIT 1
    ";

    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->execute([
        ":reference" => $reference
    ]);

    if ($checkStmt->fetch(PDO::FETCH_ASSOC)) {
        $conn->rollBack();
        sendJsonResponse(false, "This reference number already exists", null, 409);
    }

    // 3. Insert claim request
    $insertSql = "
        INSERT INTO xd_claim_requests (
            `reference`,
            opd_date,
            amount_requested,
            claim_type,
            patient_name,
            emp_computer_number,
            claim_for,
            status,
            created_at,
            updated_at
        ) VALUES (
            :reference,
            :opd_date,
            :amount_requested,
            :claim_type,
            :patient_name,
            :emp_computer_number,
            :claim_for,
            :status,
            NOW(),
            NOW()
        )
    ";

    $insertStmt = $conn->prepare($insertSql);
    $insertStmt->execute([
        ":reference" => $reference,
        ":opd_date" => $opdDate,
        ":amount_requested" => $amountRequested,
        ":claim_type" => $claimType,
        ":patient_name" => $patientName,
        ":emp_computer_number" => $computerNumber,
        ":claim_for" => $claimFor,
        ":status" => "Submitted"
    ]);

    $claimId = $conn->lastInsertId();

    // 4. Insert first status history record
    // Your table columns:
    // log_id, remarks, updated_at, claim_requests_id, updated_by, old_status_id, new_status_id
    $historySql = "
        INSERT INTO xd_claim_history_log (
            remarks,
            updated_at,
            claim_requests_id,
            updated_by,
            old_status_id,
            new_status_id
        ) VALUES (
            :remarks,
            NOW(),
            :claim_requests_id,
            :updated_by,
            :old_status_id,
            :new_status_id
        )
    ";

    $historyStmt = $conn->prepare($historySql);
    $historyStmt->execute([
        ":remarks" => "Claim submitted by employee",
        ":claim_requests_id" => $claimId,
        ":updated_by" => $updatedByUserId,
        ":old_status_id" => $submittedStatusId,
        ":new_status_id" => $submittedStatusId
    ]);

    $conn->commit();

    sendJsonResponse(true, "Medical claim request submitted successfully", [
        "claim_id" => $claimId,
        "reference" => $reference,
        "status" => "Submitted"
    ], 201);

} catch (Throwable $e) {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }

    
   error_log($e->getMessage());

    sendJsonResponse(false, "Claim submission failed. Please try again.", null, 500);
}