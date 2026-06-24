<?php

require_once "../../helpers/response.php";

session_start();

if (isset($_SESSION["admin_id"])) {
    send_json(true, "Admin logged in", [
        "admin_id" => $_SESSION["admin_id"],
        "username" => $_SESSION["admin_username"]
    ]);
}

send_json(false, "Not logged in", null, 401);