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
$computerNumber = trim($input["computer_number"] ?? "");
$nic = trim($input["nic"] ?? "");
$claimId = isset($input["claim_id"]) ? (int)$input["claim_id"] : 0;

// Required validation
if ($computerNumber === "" || $nic === "" || $claimId <= 0) {
    sendJsonResponse(false, "Computer number, NIC, and claim ID are required", null, 400);
}

try {
    // 1. Verify employee
   $employeeSql = "
    SELECT 
        e.e_id,
        e.computer_number,
        e.nic,
        e.initials,
        e.surname,
        e.division_code,
        d.division_name
    FROM xd_employees e
    LEFT JOIN xd_divisions d 
        ON e.division_code = d.div_code
    WHERE e.computer_number = :computer_number
    AND e.nic = :nic
    LIMIT 1
";

    $employeeStmt = $conn->prepare($employeeSql);
    $employeeStmt->execute([
        ":computer_number" => $computerNumber,
        ":nic" => $nic
    ]);

    $employee = $employeeStmt->fetch(PDO::FETCH_ASSOC);

    if (!$employee) {
        sendJsonResponse(false, "Invalid employee. Please check Computer Number and NIC", null, 401);
    }

    // 2. Get claim details
    
    $claimSql = "
        SELECT
            r_id AS claim_id,
            `reference`,
            opd_date,
            amount_requested,
            claim_type,
            patient_name,
            emp_computer_number,
            claim_for,
            status,
            is_document_received,
            document_received_date,
            invoice_number,
            medical_recommendation,
            medical_remark,
            doctor_approved_date,
            approved_amount,
            payment_approved_date,
            paid_date,
            created_at,
            updated_at
        FROM xd_claim_requests
        WHERE r_id = :claim_id
        AND emp_computer_number = :computer_number
        LIMIT 1
    ";

    $claimStmt = $conn->prepare($claimSql);
    $claimStmt->execute([
        ":claim_id" => $claimId,
        ":computer_number" => $computerNumber
    ]);

    $claim = $claimStmt->fetch(PDO::FETCH_ASSOC);

    if (!$claim) {
        sendJsonResponse(false, "Claim not found or you do not have permission to view this claim", null, 404);
    }

    // 3. Get claim status history timeline
    $historySql = "
        SELECT
            h.log_id,
            h.remarks,
            h.updated_at,
            h.claim_requests_id,
            h.updated_by,
            u.fullname AS updated_by_name,
            h.old_status_id,
            old_s.status_name AS old_status_name,
            h.new_status_id,
            new_s.status_name AS new_status_name
        FROM xd_claim_history_log h
        LEFT JOIN xd_statuses old_s
            ON h.old_status_id = old_s.s_id
        LEFT JOIN xd_statuses new_s
            ON h.new_status_id = new_s.s_id
        LEFT JOIN xsu_system_users u
            ON h.updated_by = u.u_id
        WHERE h.claim_requests_id = :claim_id
        ORDER BY h.updated_at ASC, h.log_id ASC
    ";

    $historyStmt = $conn->prepare($historySql);
    $historyStmt->execute([
        ":claim_id" => $claimId
    ]);

    $history = $historyStmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Return response
    sendJsonResponse(true, "Employee claim details loaded successfully", [
        "employee" => [
            "employee_id" => $employee["e_id"],
            "computer_number" => $employee["computer_number"],
            "nic" => $employee["nic"],
            "full_name" => trim(($employee["initials"] ?? "") . " " . ($employee["surname"] ?? "")),
            "division" => $employee["division_name"] ?? null
        ],
        "claim" => $claim,
        "history" => $history
    ], 200);

} catch (Throwable $e) {
    error_log($e->getMessage());

    sendJsonResponse(false, "Failed to load claim details. Please try again.", null, 500);
}