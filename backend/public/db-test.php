<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

// Load .env file if it exists
if (file_exists(__DIR__ . '/../.env')) {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $dotenv->load();
}

use App\Database;
use App\Models\LoginToken;
use App\Models\BaseModel;

// Set headers for JSON response
header('Content-Type: application/json');

try {
    // Test basic database connection
    $connectionTest = Database::testConnection();
    
    // Create a LoginToken instance to test its methods
    $tokenModel = new LoginToken();
    
    // Get a reflection of the BaseModel class to call protected methods
    $reflectionClass = new ReflectionClass(BaseModel::class);
    $getDatabaseTypeMethod = $reflectionClass->getMethod('getDatabaseType');
    $getDatabaseTypeMethod->setAccessible(true);
    
    $getCurrentDateFunctionMethod = $reflectionClass->getMethod('getCurrentDateFunction');
    $getCurrentDateFunctionMethod->setAccessible(true);
    
    // Get database type and current date function
    $dbType = $getDatabaseTypeMethod->invoke($tokenModel);
    $dateFunction = $getCurrentDateFunctionMethod->invoke($tokenModel);
    
    // Get raw PDO driver name
    $pdo = Database::getConnection();
    $pdoDriverName = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    
    // Test a simple query with the current date function
    $sql = "SELECT {$dateFunction} as current_time";
    $stmt = $pdo->query($sql);
    $dateResult = $stmt->fetch();
    
    // Add database type info to the result
    $connectionTest['detected_db_type'] = $dbType;
    $connectionTest['pdo_driver_name'] = $pdoDriverName;
    $connectionTest['current_date_function'] = $dateFunction;
    $connectionTest['date_function_result'] = $dateResult['current_time'];
    
    // Return the test results
    echo json_encode($connectionTest, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    // Handle any errors
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}