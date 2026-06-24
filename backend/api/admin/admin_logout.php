<?php

require_once "../../helpers/response.php";

session_start();
session_unset();
session_destroy();

send_json(true, "Logout successful");