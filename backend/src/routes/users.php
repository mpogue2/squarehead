<?php
declare(strict_types=1);

use App\Models\User;
use App\Services\GeocodingService;
use App\Middleware\AuthMiddleware;
use App\Helpers\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// GET /api/users/assignable - Get assignable users for scheduling (protected)
// NOTE: This must come BEFORE /api/users/{id} to avoid route conflicts
$app->get('/api/users/assignable', function (Request $request, Response $response) {
    try {
        $userModel = new User();
        $assignableUsers = $userModel->getAssignable();
        
        // Add count to the data
        $responseData = [
            'users' => $assignableUsers,
            'count' => count($assignableUsers)
        ];
        
        return ApiResponse::success($response, $responseData, 'Assignable users retrieved successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to retrieve assignable users: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// GET /api/users/coordinates - Get users with coordinates for mapping (protected)
// NOTE: This must come BEFORE /api/users/{id} to avoid route conflicts
$app->get('/api/users/coordinates', function (Request $request, Response $response) {
    try {
        $userModel = new User();
        $users = $userModel->getUsersWithCoordinates();
        
        return ApiResponse::success($response, [
            'users' => $users,
            'count' => count($users)
        ], 'Users with coordinates retrieved successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to retrieve users with coordinates: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// POST /api/users/geocode-all - Geocode all users missing coordinates (admin only)
// NOTE: This must come BEFORE /api/users/{id} to avoid route conflicts
$app->post('/api/users/geocode-all', function (Request $request, Response $response) {
    // Create a progress tracker instance
    $progressTracker = new \App\Services\ProgressTracker('geocoding');
    
    // Start fresh with each new geocoding request
    $progressTracker->reset();
    
    error_log("Starting geocode-all operation");
    
    // For counting only requests, just return the total without geocoding
    $data = $request->getParsedBody() ?: [];
    $countOnly = isset($data['count_only']) && $data['count_only'] === true;
    try {
        error_log("Geocode All Addresses endpoint called");
        
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            error_log("Geocode All Addresses: Access denied - admin required");
            return ApiResponse::error($response, 'Admin access required to geocode addresses', 403);
        }
        
        // First, verify Google API key is set
        $db = \App\Database::getConnection();
        $stmt = $db->prepare("SELECT setting_value FROM settings WHERE setting_key = 'google_api_key'");
        $stmt->execute();
        $apiKey = $stmt->fetchColumn();
        
        if (!$apiKey) {
            error_log("Geocode All Addresses: Missing Google Maps API key");
            return ApiResponse::error($response, 'Google Maps API key not configured in settings', 400);
        }
        
        error_log("Geocode All Addresses: Starting geocoding process");
        
        // Find users that need geocoding - use a prepared statement for better SQLite compatibility
        $findSql = "SELECT id, address FROM users WHERE address IS NOT NULL 
                   AND address <> '' AND address <> 'Web Host' AND LENGTH(address) > 10
                   AND (latitude IS NULL OR longitude IS NULL)";
        $findStmt = $db->query($findSql);
        $usersToGeocode = $findStmt->fetchAll();
        
        $totalUsers = count($usersToGeocode);
        error_log("Geocode All Addresses: Found {$totalUsers} users that need geocoding");
        
        // Initialize progress tracking with our file-based tracker
        $progressTracker->initialize($totalUsers);
        
        error_log("Progress tracking initialized with {$totalUsers} users to geocode");
        
        // If no users need geocoding, return early
        if ($totalUsers === 0) {
            error_log("No users need geocoding, returning early");
            return ApiResponse::success($response, [
                'geocoded' => 0,
                'total' => 0,
                'errors' => []
            ], "No valid addresses found that need geocoding");
        }
        
        // If this is just a count request, return now
        if ($countOnly) {
            return ApiResponse::success($response, [
                'geocoded' => 0,
                'total' => $totalUsers,
                'errors' => []
            ], "Found {$totalUsers} addresses that need geocoding");
        }
        
        // Create geocoding service
        $geocodingService = new GeocodingService();
        
        // Track results
        $geocoded = 0;
        $errors = [];
        
        // Get batch size from settings, default to 5 if not set
        $settingsModel = new \App\Models\Settings();
        $batchSize = (int)$settingsModel->get('geocoding_batch_size') ?: 5;
        error_log("Geocode All Addresses: Using batch size {$batchSize} from settings");
        
        $totalBatches = ceil(count($usersToGeocode) / $batchSize);
        $batchCount = 0;
        
        // Prepare arrays for batch processing
        $addressBatches = array_chunk($usersToGeocode, $batchSize);
        
        foreach ($addressBatches as $batch) {
            $batchCount++;
            error_log("Geocode All Addresses: Processing batch {$batchCount} of {$totalBatches}");
            
            // Format addresses for batch geocoding
            $addresses = [];
            foreach ($batch as $user) {
                $addresses[] = [
                    'id' => $user['id'],
                    'address' => $user['address']
                ];
            }
            
            // Geocode the batch
            $results = $geocodingService->geocodeAddressBatch($addresses);
            
            // Process results
            foreach ($results as $result) {
                if (isset($result['error'])) {
                    $errorMsg = $result['error'];
                    error_log("Geocode All Addresses: Error for user ID {$result['id']}: {$errorMsg}");
                    $errors[] = "User ID {$result['id']}: {$errorMsg}";
                } else {
                    // Update user with coordinates
                    $updateSql = "UPDATE users SET latitude = ?, longitude = ?, geocoded_at = ? WHERE id = ?";
                    $updateStmt = $db->prepare($updateSql);
                    $updateStmt->execute([$result['lat'], $result['lng'], date('Y-m-d H:i:s'), $result['id']]);
                    
                    error_log("Geocode All Addresses: Successfully geocoded user ID {$result['id']}");
                    $geocoded++;
                    // Update progress using our file-based tracker
                    $progressTracker->increment();
                    error_log("Updated progress: {$geocoded} of {$totalUsers} completed");
                }
            }
            
            // For batches with many addresses, add a small delay between batches
            if ($totalBatches > 1 && $batchCount < $totalBatches) {
                usleep(500000); // 0.5 second delay between batches
            }
        }
        
        // Prepare response message
        if ($geocoded > 0) {
            $message = "Geocoding completed: {$geocoded} addresses geocoded";
            if (!empty($errors)) {
                $message .= ', ' . count($errors) . ' errors occurred';
            }
        } else {
            $message = "Geocoding failed: " . count($errors) . " errors occurred";
        }
        
        error_log("Geocode All Addresses: {$message}");
        
        // Final update to progress tracking
        $progressTracker->update($geocoded, $totalUsers, 'completed');
        error_log("FINAL progress update: {$geocoded} of {$totalUsers} completed");
        
        return ApiResponse::success($response, [
            'geocoded' => $geocoded,
            'total' => $totalUsers,  // Include total count for progress tracking
            'errors' => $errors
        ], $message);
        
    } catch (Exception $e) {
        $errorMsg = 'Failed to geocode addresses: ' . $e->getMessage();
        error_log("Geocode All Addresses ERROR: {$errorMsg}");
        error_log("Exception details: " . print_r($e, true));
        return ApiResponse::error($response, $errorMsg, 500);
    }
})->add(new AuthMiddleware());

// GET /api/users/geocode-progress - Get current geocoding progress (protected)
$app->get('/api/users/geocode-progress', function (Request $request, Response $response) {
    // Use our file-based tracker
    $progressTracker = new \App\Services\ProgressTracker('geocoding');
    
    try {
        // Get the current progress
        $progress = $progressTracker->getProgress();
        
        error_log("Geocode progress request - Using file-based tracker");
        
        // If no progress data exists, do a quick count of users that need geocoding
        if (!$progress) {
            error_log("No progress data found, creating initial progress info");
            
            // Count users that need geocoding
            $db = \App\Database::getConnection();
            $findSql = "SELECT COUNT(*) FROM users WHERE address IS NOT NULL 
                       AND address <> '' AND address <> 'Web Host' AND LENGTH(address) > 10
                       AND (latitude IS NULL OR longitude IS NULL)";
            $findStmt = $db->query($findSql);
            $usersToGeocode = (int)$findStmt->fetchColumn();
            
            error_log("Found {$usersToGeocode} users that need geocoding");
            
            // Create initial progress data
            $progress = [
                'operation' => 'geocoding',
                'total' => $usersToGeocode,
                'completed' => 0,
                'timestamp' => time(),
                'status' => 'pending'
            ];
            
            // No need to save this to a file since we're not actively geocoding
        }
        
        $responseData = [
            'completed' => (int)($progress['completed'] ?? 0),
            'total' => (int)($progress['total'] ?? 0),
            'timestamp' => (int)($progress['timestamp'] ?? time()),
            'status' => $progress['status'] ?? 'pending',
            'is_stale' => ($progress['status'] ?? '') === 'stale'
        ];
        
        error_log("Geocoding progress response: " . json_encode($responseData));
        
        return ApiResponse::success($response, $responseData);
    } catch (Exception $e) {
        error_log("Error in geocode-progress endpoint: " . $e->getMessage());
        return ApiResponse::error($response, 'Failed to get geocoding progress: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// GET /api/users - Get all users (protected)
$app->get('/api/users', function (Request $request, Response $response) {
    try {
        $userModel = new User();
        $users = $userModel->getAllWithRelations();
        
        // Add count to the data
        $responseData = [
            'users' => $users,
            'count' => count($users)
        ];
        
        return ApiResponse::success($response, $responseData, 'Users retrieved successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to retrieve users: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// GET /api/users/{id} - Get user by ID (protected)
$app->get('/api/users/{id}', function (Request $request, Response $response, array $args) {
    try {
        $id = (int)$args['id'];
        $currentUserId = $request->getAttribute('user_id');
        $isAdmin = $request->getAttribute('is_admin');
        
        // Non-admins can only view their own profile
        if (!$isAdmin && $currentUserId !== $id) {
            return ApiResponse::error($response, 'Access denied. You can only view your own profile.', 403);
        }
        
        $userModel = new User();
        $user = $userModel->find($id);
        
        if (!$user) {
            return ApiResponse::notFound($response, 'User not found');
        }
        
        return ApiResponse::success($response, $user);
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to retrieve user: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// POST /api/users - Create new user (admin only)
$app->post('/api/users', function (Request $request, Response $response) {
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to create users', 403);
        }
        
        $data = json_decode($request->getBody()->getContents(), true);
        
        // Validate required fields
        $requiredFields = ['email', 'first_name', 'last_name'];
        $missingFields = [];
        
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                $missingFields[] = $field;
            }
        }
        
        if (!empty($missingFields)) {
            return ApiResponse::validationError($response, [
                'missing_fields' => $missingFields
            ], 'Required fields are missing');
        }
        
        // Validate email format
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return ApiResponse::validationError($response, [
                'email' => 'Invalid email format'
            ]);
        }
        
        $userModel = new User();
        
        // Check for composite unique constraint violation (first_name + last_name + email)
        // Allow multiple users to share the same email, but prevent exact duplicates
        $stmt = $userModel->getDb()->prepare("SELECT id FROM users WHERE first_name = ? AND last_name = ? AND email = ?");
        $stmt->execute([$data['first_name'], $data['last_name'], $data['email']]);
        $duplicateUser = $stmt->fetch();
        
        if ($duplicateUser) {
            return ApiResponse::validationError($response, [
                'email' => 'A user with this exact name and email combination already exists'
            ]);
        }
        
        // Set default values
        $userData = [
            'email' => $data['email'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'address' => $data['address'] ?? '',
            'phone' => $data['phone'] ?? '',
            'role' => $data['role'] ?? 'member',
            'partner_id' => !empty($data['partner_id']) ? (int)$data['partner_id'] : null,
            'friend_id' => !empty($data['friend_id']) ? (int)$data['friend_id'] : null,
            'status' => $data['status'] ?? 'assignable',
            'is_admin' => !empty($data['is_admin']) ? 1 : 0
        ];
        
        // Geocode address if provided
        if (!empty($userData['address'])) {
            try {
                $geocodingService = new GeocodingService();
                $coords = $geocodingService->geocodeAddress($userData['address']);
                
                if ($coords) {
                    $userData['latitude'] = $coords['lat'];
                    $userData['longitude'] = $coords['lng'];
                    $userData['geocoded_at'] = date('Y-m-d H:i:s');
                }
            } catch (Exception $e) {
                // Log error but don't fail the creation
                error_log("Geocoding failed for new user: " . $e->getMessage());
            }
        }
        
        $newUser = $userModel->create($userData);
        
        return ApiResponse::success($response, $newUser, 'User created successfully', 201);
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to create user: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// PUT /api/users/{id} - Update user (admin or own profile)
$app->put('/api/users/{id}', function (Request $request, Response $response, array $args) {
    try {
        $id = (int)$args['id'];
        $currentUserId = $request->getAttribute('user_id');
        $isAdmin = $request->getAttribute('is_admin');
        
        $userModel = new User();
        $existingUser = $userModel->find($id);
        
        if (!$existingUser) {
            return ApiResponse::notFound($response, 'User not found');
        }
        
        // Non-admins can only edit their own profile
        if (!$isAdmin && $currentUserId !== $id) {
            return ApiResponse::error($response, 'Access denied. You can only edit your own profile.', 403);
        }
        
        $data = json_decode($request->getBody()->getContents(), true);
        
        // Validate email format if provided
        if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return ApiResponse::validationError($response, [
                'email' => 'Invalid email format'
            ]);
        }
        
        // Check for composite unique constraint violation (first_name + last_name + email)
        // Allow multiple users to share the same email, but prevent exact duplicates
        if (!empty($data['email']) || !empty($data['first_name']) || !empty($data['last_name'])) {
            $checkEmail = $data['email'] ?? $existingUser['email'];
            $checkFirstName = $data['first_name'] ?? $existingUser['first_name'];
            $checkLastName = $data['last_name'] ?? $existingUser['last_name'];
            
            // Only check if we're changing any part of the composite key
            $isChangingCompositeKey = ($checkEmail !== $existingUser['email']) || 
                                    ($checkFirstName !== $existingUser['first_name']) || 
                                    ($checkLastName !== $existingUser['last_name']);
            
            if ($isChangingCompositeKey) {
                $stmt = $userModel->getDb()->prepare("SELECT id FROM users WHERE first_name = ? AND last_name = ? AND email = ? AND id != ?");
                $stmt->execute([$checkFirstName, $checkLastName, $checkEmail, $id]);
                $duplicateUser = $stmt->fetch();
                
                if ($duplicateUser) {
                    return ApiResponse::validationError($response, [
                        'email' => 'A user with this exact name and email combination already exists'
                    ]);
                }
            }
        }
        
        // Log incoming update data for debugging
        error_log("User update received data: " . json_encode($data));
        
        // Prepare update data - only include provided fields
        $updateData = [];
        $allowedFields = ['email', 'first_name', 'last_name', 'address', 'phone', 'role', 'partner_id', 'friend_id', 'status', 'birthday'];
        
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                if ($field === 'partner_id' || $field === 'friend_id') {
                    $updateData[$field] = !empty($data[$field]) ? (int)$data[$field] : null;
                } else {
                    $updateData[$field] = $data[$field];
                }
                error_log("User update field {$field}: " . json_encode($updateData[$field]));
            }
        }
        
        // Only admins can change admin status
        if ($isAdmin && array_key_exists('is_admin', $data)) {
            // Check if user is the permanent admin (mpogue@zenstarstudio.com)
            if ($existingUser['email'] === 'mpogue@zenstarstudio.com') {
                // Always keep mpogue@zenstarstudio.com as admin
                $updateData['is_admin'] = 1;
            } else {
                $updateData['is_admin'] = !empty($data['is_admin']) ? 1 : 0;
            }
        }
        
        if (empty($updateData)) {
            return ApiResponse::validationError($response, [], 'No valid fields provided for update');
        }
        
        // Use the geocoding-enabled update method
        $userModel->updateWithGeocoding($id, $updateData);
        $updatedUser = $userModel->find($id);
        
        return ApiResponse::success($response, $updatedUser, 'User updated successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to update user: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// GET /api/users/export/csv - Export users as CSV (available to all authenticated users)
$app->get('/api/users/export/csv', function (Request $request, Response $response) {
    try {
        // Log the export request for debugging
        error_log("CSV Export endpoint called with method: " . $request->getMethod());
        
        // Check if user is authenticated (already handled by AuthMiddleware)
        $userId = $request->getAttribute('user_id');
        
        error_log("CSV Export authorized: User {$userId} fetching data");
        
        $userModel = new User();
        $users = $userModel->getAllWithRelations();
        
        // Format CSV to include partner and friend fields
        $csvContent = "first_name,last_name,email,phone,address,role,status,birthday,partner_first_name,partner_last_name,friend_first_name,friend_last_name\n";
        
        // CSV Data rows - manually escape fields - include all fields needed for complete import
        foreach ($users as $user) {
            $csvContent .= implode(',', [
                '"' . str_replace('"', '""', $user['first_name']) . '"',
                '"' . str_replace('"', '""', $user['last_name']) . '"',
                '"' . str_replace('"', '""', $user['email']) . '"',
                '"' . str_replace('"', '""', $user['phone'] ?: '') . '"',
                '"' . str_replace('"', '""', $user['address'] ?: '') . '"',
                '"' . str_replace('"', '""', $user['is_admin'] ? 'admin' : 'member') . '"',
                '"' . str_replace('"', '""', $user['status'] === 'loa' ? 'LOA' : $user['status']) . '"',
                '"' . str_replace('"', '""', ($user['birthday'] ? str_replace('-', '/', $user['birthday']) : '')) . '"',
                '"' . str_replace('"', '""', $user['partner_first_name'] ?: '') . '"',
                '"' . str_replace('"', '""', $user['partner_last_name'] ?: '') . '"',
                '"' . str_replace('"', '""', $user['friend_first_name'] ?: '') . '"',
                '"' . str_replace('"', '""', $user['friend_last_name'] ?: '') . '"'
            ]) . "\n";
        }
        
        // Set headers for file download - simplify for maximum compatibility
        $filename = 'members-export-' . date('Y-m-d-H-i-s') . '.csv';
        
        // Log the export request for debugging
        error_log("CSV Export requested: Generating file {$filename} with size " . strlen($csvContent) . " bytes");
        
        // Cross-browser compatible headers - optimized for Safari compatibility
        $response = $response
            ->withHeader('Content-Type', 'text/csv; charset=utf-8')
            ->withHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->withHeader('Content-Length', strlen($csvContent))
            ->withHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('Expires', '0')
            ->withHeader('Access-Control-Allow-Origin', '*')
            ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
        
        $response->getBody()->write($csvContent);
        return $response;
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to export users: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());

// Handle preflight OPTIONS request for /api/users/import
$app->map(['OPTIONS'], '/api/users/import', function (Request $request, Response $response) {
    return $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        ->withHeader('Access-Control-Max-Age', '86400') // 24 hours
        ->withStatus(200);
});

// POST /api/users/import - Import users from CSV (available to all authenticated users)
$app->post('/api/users/import', function (Request $request, Response $response) {
    // First, add CORS headers even before processing - this is critical
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: X-Requested-With, Content-Type, Accept, Origin, Authorization');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Expose-Headers: Content-Disposition, Content-Type, Content-Length');
    
    // Also add to response object
    $response = $response
        ->withHeader('Access-Control-Allow-Origin', '*')
        ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
        ->withHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length');
    try {
        // Log the import request for debugging
        error_log("CSV Import endpoint called with method: " . $request->getMethod());
        
        // Log request headers for troubleshooting
        $headers = $request->getHeaders();
        foreach ($headers as $name => $values) {
            error_log("Request Header: {$name}: " . implode(", ", $values));
        }
        
        // Check for token in form data instead of Authorization header
        $tokenFromForm = $request->getParsedBody()['token'] ?? null;
        if ($tokenFromForm) {
            error_log("CSV Import: Using token from form data: " . substr($tokenFromForm, 0, 20) . "...");
            try {
                $jwtService = new \App\Services\JWTService();
                $payload = $jwtService->validateToken($tokenFromForm);
                if ($payload && ($payload['is_admin'] || $tokenFromForm === 'dev-token-valid')) {
                    error_log("CSV Import: Token from form is valid and user is admin");
                } else {
                    error_log("CSV Import: Token from form is invalid or user is not admin");
                }
            } catch (\Exception $e) {
                error_log("CSV Import: Error validating token from form: " . $e->getMessage());
            }
        } else {
            error_log("CSV Import: No token found in form data, using auth middleware token");
        }
        
        // Get uploaded file
        $uploadedFiles = $request->getUploadedFiles();
        
        // Log what we received for debugging
        error_log("Upload files received: " . print_r($uploadedFiles, true));
        
        // Check Content-Type header to verify we have multipart/form-data
        $contentType = $request->getHeaderLine('Content-Type');
        error_log("Content-Type: " . $contentType);
        
        if (strpos($contentType, 'multipart/form-data') === false) {
            error_log("CSV Import error: Not multipart/form-data");
            // Check for raw data in request body if no files
            $body = $request->getBody()->getContents();
            error_log("Request body length: " . strlen($body));
            error_log("Request body content: " . substr($body, 0, 1000));
            return ApiResponse::validationError($response, 
                ['file' => 'Invalid content type. Must be multipart/form-data'],
                'Invalid content type. Must be multipart/form-data'
            );
        }
        
        // Check if 'file' field exists in the uploaded files
        if (empty($uploadedFiles['file'])) {
            error_log("CSV Import error: No file uploaded with field name 'file'");
            
            // Log all uploaded file keys to help debugging
            $fileKeys = array_keys($uploadedFiles);
            error_log("Available file keys: " . implode(', ', $fileKeys));
            
            return ApiResponse::validationError($response, 
                ['file' => 'No file uploaded with field name "file"'], 
                'No file uploaded with field name "file"'
            );
        }
        
        $uploadedFile = $uploadedFiles['file'];
        
        if ($uploadedFile->getError() !== UPLOAD_ERR_OK) {
            error_log("CSV Import error: Upload error code " . $uploadedFile->getError());
            return ApiResponse::validationError($response, ['file' => 'File upload error'], 'File upload error');
        }
        
        // Check file type
        $clientFilename = $uploadedFile->getClientFilename();
        if (!preg_match('/\.csv$/i', $clientFilename)) {
            error_log("CSV Import error: Invalid file type - " . $clientFilename);
            return ApiResponse::validationError($response, ['file' => 'Invalid file type. Only CSV files are allowed'], 'Invalid file type');
        }
        
        $fileContent = '';
        try {
            // Get file contents
            $fileContent = $uploadedFile->getStream()->getContents();
            
            // Log file size for debugging
            error_log("CSV Import file size: " . strlen($fileContent) . " bytes");
            
            // Basic content validation
            if (empty($fileContent)) {
                error_log("CSV Import error: Empty file");
                return ApiResponse::validationError($response, ['file' => 'File is empty'], 'File is empty');
            }
        } catch (Exception $e) {
            error_log("CSV Import error reading file: " . $e->getMessage());
            return ApiResponse::error($response, 'Error reading uploaded file: ' . $e->getMessage(), 500);
        }
        
        // Parse CSV
        $rows = [];
        $lines = explode("\n", $fileContent);
        $headers = [];
        
        try {
            // Make sure we have at least one line
            if (count($lines) < 1) {
                error_log("CSV Import error: No header line found");
                return ApiResponse::validationError($response, ['file' => 'Invalid CSV format - no header line'], 'Invalid CSV format');
            }
            
            // Get headers from first line and convert to lowercase
            $headerLine = trim($lines[0]);
            error_log("CSV header line: " . $headerLine);
            
            // Avoid PHP 8.4 warning by specifying the escape parameter
            $headers = str_getcsv($headerLine, ",", '"', "\\");
            $headers = array_map('trim', $headers);
            
            // Create a mapping for column synonyms
            $columnSynonyms = [
                'Phone' => 'phone',
                'Address' => 'address',
                'E-mail' => 'email',
                'Email' => 'email',
                'B\'day' => 'b\'day',
                'Bday' => 'b\'day',
                'Birthday' => 'birthday',
                'LOA' => 'loa',
                'Title' => 'title',
                'Name' => 'name', // We'll handle the "Last, First" format separately
                'Last Name' => 'last_name',
                'First Name' => 'first_name'
            ];
            
            error_log("CSV Import: Column synonym mapping: " . json_encode($columnSynonyms));
            
            // Process headers with synonym support
            error_log("CSV Import: Raw headers before processing: " . json_encode($headers));
            
            foreach ($headers as $key => $header) {
                // Remove quotes if present - often CSV headers might include quotes
                $cleanHeader = trim(trim($header, '"'));
                error_log("CSV Import: Processing header: raw='{$header}', cleaned='{$cleanHeader}'");
                
                // Check if this header is a known synonym
                if (isset($columnSynonyms[$cleanHeader])) {
                    error_log("CSV Import: Mapped header '{$cleanHeader}' to '{$columnSynonyms[$cleanHeader]}'");
                    $headers[$key] = $columnSynonyms[$cleanHeader];
                } else {
                    // Otherwise convert to lowercase as before
                    error_log("CSV Import: No mapping for header '{$cleanHeader}', converting to lowercase");
                    $headers[$key] = strtolower($cleanHeader);
                }
            }
            
            // Log headers for debugging
            error_log("CSV Import headers after synonym processing: " . implode(", ", $headers));
            
            // Check for name column - if present, we don't need first_name and last_name
            $hasNameColumn = in_array('name', $headers);
            
            // Check required headers
            $requiredHeaders = $hasNameColumn ? ['email'] : ['first_name', 'last_name', 'email'];
            error_log("CSV Import: Required headers: " . implode(', ', $requiredHeaders) . 
                    ($hasNameColumn ? " ('name' column will be used for first_name and last_name)" : ""));
            
            $missingHeaders = [];
            foreach ($requiredHeaders as $header) {
                if (!in_array($header, $headers)) {
                    $missingHeaders[] = $header;
                }
            }
        } catch (Exception $e) {
            error_log("CSV Import error parsing headers: " . $e->getMessage());
            return ApiResponse::error($response, 'Error parsing CSV headers: ' . $e->getMessage(), 500);
        }
        
        if (!empty($missingHeaders)) {
            $errorMsg = 'Missing required columns: ' . implode(', ', $missingHeaders);
            error_log("CSV Import error: " . $errorMsg);
            return ApiResponse::validationError($response, ['headers' => $errorMsg], $errorMsg);
        }
        
        // Process data rows
        $userModel = new User();
        $importCount = 0;
        $skipCount = 0;
        $errors = [];
        $relationshipsToProcess = []; // Store relationships for second pass
        
        // Start from row 1 (skip headers)
        for ($i = 1; $i < count($lines); $i++) {
            try {
                $line = trim($lines[$i]);
                if (empty($line)) {
                    continue; // Skip empty lines
                }
                
                // Skip lines that look like statistical summary info (common format in spreadsheet exports)
                if (preg_match('/^"?\s*(?:In the|\d+)"?\s*,\s*"(?:OnTheRoster|Current Members|LOA|Booster|Special|Caller\/Cuer)/', $line)) {
                    error_log("CSV Import: Skipping statistical summary line: " . $line);
                    continue;
                }
                
                // Skip lines with too many quotes (likely malformed)
                $quoteCount = substr_count($line, '"');
                if ($quoteCount > count($headers) * 2 + 2) {
                    error_log("CSV Import: Skipping line with abnormal quote count (" . $quoteCount . "): " . $line);
                    continue;
                }
                
                // Log each data line for debugging with more detail
                error_log("CSV Import: Processing row " . $i . " (line " . ($i + 1) . "): " . $line);
                
                // Parse CSV row - avoid PHP 8.4 warning by specifying the escape parameter
                $row = str_getcsv($line, ",", '"', "\\");
                
                // Check column count matches header count
                if (count($row) != count($headers)) {
                    error_log("CSV Import error: Row " . ($i + 1) . " has " . count($row) . " columns but headers have " . count($headers) . " columns");
                    $errors[] = "Row " . ($i + 1) . ": Column count mismatch";
                    continue;
                }
                
                // Clean values - remove quotes and trim
                $cleanedRow = [];
                foreach ($row as $index => $value) {
                    $cleanedRow[$index] = trim(trim($value, '"'));
                }
                
                // Create associative array from row with cleaned values
                error_log("CSV Import: Row data: " . json_encode($cleanedRow));
                $data = array_combine($headers, $cleanedRow);
                error_log("CSV Import: Combined data: " . json_encode($data));
                
                // Validate required fields
                $validationErrors = [];
                foreach ($requiredHeaders as $field) {
                    if (empty($data[$field])) {
                        $validationErrors[] = "Missing {$field}";
                    }
                }
                
                // Validate email format
                if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                    $validationErrors[] = "Invalid email format";
                }
                
                // Special processing for "Last, First" name format if name column exists
                if (isset($data['name']) && !empty($data['name']) && (!isset($data['first_name']) || !isset($data['last_name']))) {
                    // Parse "Last, First" format - use simple string operations instead of regex
                    error_log("CSV Import: Processing name field: '{$data['name']}'");
                    
                    $nameParts = explode(',', $data['name']);
                    if (count($nameParts) > 1) {
                        $data['last_name'] = trim($nameParts[0]);
                        $data['first_name'] = trim($nameParts[1]);
                        error_log("CSV Import: Parsed name '{$data['name']}' into first_name='{$data['first_name']}' and last_name='{$data['last_name']}'");
                    } else {
                        // If not in "Last, First" format, check for space delimiter
                        $spaceParts = explode(' ', trim($data['name']));
                        if (count($spaceParts) > 1) {
                            // Assume last word is last name, rest is first name
                            $data['last_name'] = array_pop($spaceParts);
                            $data['first_name'] = implode(' ', $spaceParts);
                            error_log("CSV Import: Parsed space-delimited name '{$data['name']}' into first_name='{$data['first_name']}' and last_name='{$data['last_name']}'");
                        } else {
                            // Single word name, use as last_name
                            $data['last_name'] = trim($data['name']);
                            $data['first_name'] = ''; // Empty first name
                            error_log("CSV Import: Could not parse name '{$data['name']}' in any format, using as last_name only");
                        }
                    }
                }
                
                // Skip empty lines or lines with only commas
                $isEmptyRow = true;
                foreach ($data as $value) {
                    if (!empty(trim($value))) {
                        $isEmptyRow = false;
                        break;
                    }
                }
                
                if ($isEmptyRow) {
                    error_log("CSV Import: Skipping empty row at line " . ($i + 1));
                    continue;
                }
                
                // Skip rows that look like summary statistics rather than member data
                // Check if this is a statistics/summary row by looking for specific patterns
                $isStatisticsRow = false;
                
                // Pattern 1: Check if name field contains certain keywords
                if (isset($data['name'])) {
                    $keywords = ['OnTheRoster', 'Current Members', 'LOA', 'Booster', 'Caller', 'Cuer', 'Special'];
                    
                    foreach ($keywords as $keyword) {
                        if (stripos($data['name'], $keyword) !== false) {
                            $isStatisticsRow = true;
                            error_log("CSV Import: Detected statistics row with keyword '{$keyword}' in name field");
                            break;
                        }
                    }
                }
                
                // Pattern 2: Check if row looks like a count/statistic (row with mostly empty cells and a number)
                if (!$isStatisticsRow) {
                    $nonEmptyCount = 0;
                    $hasNumber = false;
                    
                    foreach ($data as $value) {
                        $trimmedValue = trim($value);
                        if (!empty($trimmedValue)) {
                            $nonEmptyCount++;
                            if (is_numeric($trimmedValue)) {
                                $hasNumber = true;
                            }
                        }
                    }
                    
                    // If row has very few non-empty cells (1-2) and one is a number, likely a summary row
                    if ($nonEmptyCount <= 2 && $hasNumber) {
                        $isStatisticsRow = true;
                        error_log("CSV Import: Detected statistics row with few values and a number at line " . ($i + 1));
                    }
                }
                
                // Skip if this is a statistics row
                if ($isStatisticsRow) {
                    error_log("CSV Import: Skipping statistics row at line " . ($i + 1));
                    continue;
                }
                
                // Generate an email if it's missing but required
                if (empty($data['email']) && in_array('email', $requiredHeaders)) {
                    // Create a placeholder email using name if available
                    if (!empty($data['last_name']) && !empty($data['first_name'])) {
                        $data['email'] = strtolower(str_replace(' ', '', $data['first_name'] . '.' . $data['last_name'])) . '@placeholder.com';
                        error_log("CSV Import: Generated placeholder email {$data['email']} for row " . ($i + 1));
                        // Remove email from required fields validation
                        $validationErrors = array_filter($validationErrors, function($err) {
                            return $err !== "Missing email";
                        });
                    }
                }
                
                // Check for validation errors
                if (!empty($validationErrors)) {
                    $errors[] = "Row " . ($i + 1) . ": " . implode(', ', $validationErrors);
                    continue;
                }
                
                // REVISED BEHAVIOR: Check if a user with this first name, last name, and email already exists
                error_log("CSV Import: Checking if user '{$data['first_name']} {$data['last_name']}' with email '{$data['email']}' exists");
                
                // First check for the permanent admin account - always protect it
                if ($data['email'] === 'mpogue@zenstarstudio.com') {
                    $timestamp = date('Y-m-d H:i:s');
                    $protectLog = "[{$timestamp}] CSV Import: PROTECTED ADMIN - Skipping update for permanent admin record mpogue@zenstarstudio.com";
                    error_log($protectLog);
                    file_put_contents(__DIR__ . '/../../logs/app.log', $protectLog . "\n", FILE_APPEND);
                    
                    // Count it as skipped
                    $skipCount++;
                    continue; // Skip to next record
                }
                
                // Check for exact match on first name, last name, and email
                $sql = "SELECT * FROM users WHERE first_name = ? AND last_name = ? AND email = ?";
                $stmt = $userModel->getDb()->prepare($sql);
                $stmt->execute([$data['first_name'], $data['last_name'], $data['email']]);
                $exactMatchUser = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // If we have an exact match on first_name, last_name, and email, update that record
                if ($exactMatchUser) {
                    $timestamp = date('Y-m-d H:i:s');
                    $logMessage = "[{$timestamp}] CSV Import: UPDATING exact match record for '{$data['first_name']} {$data['last_name']}' with email '{$data['email']}' at Row=" . ($i + 1);
                    error_log($logMessage);
                    
                    // Log to app.log file
                    $appLogPath = __DIR__ . '/../../logs/app.log';
                    file_put_contents($appLogPath, $logMessage . "\n", FILE_APPEND);
                    
                    // Determine status
                    $status = 'assignable';
                    
                    // Check for LOA date in the LOA column
                    if (isset($data['loa']) && !empty($data['loa'])) {
                        // If there's any non-empty value in the LOA column, set status to LOA
                        if (trim($data['loa']) !== '') {
                            $status = 'loa';
                        }
                    }
                    
                    // Check if Title column contains Booster
                    if (isset($data['title']) && stripos($data['title'], 'booster') !== false) {
                        $status = 'booster';
                    }
                    
                    // Check if explicit status is provided
                    if (isset($data['status']) && !empty($data['status'])) {
                        $status = strtolower($data['status']);
                    }
                    
                    // Prepare the update data
                    $updateData = [
                        'phone' => $data['phone'] ?? $exactMatchUser['phone'],
                        'address' => $data['address'] ?? $exactMatchUser['address'],
                        'status' => $status,
                        'birthday' => isset($birthday) ? $birthday : $exactMatchUser['birthday'],
                    ];
                    
                    // Preserve existing values for partner_id, friend_id, is_admin status
                    
                    // If notes exist in the import data, append them to existing notes
                    if (isset($data['notes']) && !empty($data['notes'])) {
                        if (!empty($exactMatchUser['notes'])) {
                            $updateData['notes'] = $exactMatchUser['notes'] . "\nCSV Import " . date('Y-m-d') . ": " . $data['notes'];
                        } else {
                            $updateData['notes'] = "CSV Import " . date('Y-m-d') . ": " . $data['notes'];
                        }
                    }
                    
                    try {
                        // Update the existing record
                        $userModel->update($exactMatchUser['id'], $updateData);
                        
                        // Log success
                        $updateLog = "[{$timestamp}] CSV Import: SUCCESSFULLY updated exact match user ID {$exactMatchUser['id']} ({$data['email']})";
                        error_log($updateLog);
                        file_put_contents($appLogPath, $updateLog . "\n", FILE_APPEND);
                        
                        // Count as update
                        $updateCount = ($updateCount ?? 0) + 1;
                        
                        // Skip to the next record
                        continue;
                    } catch (Exception $e) {
                        // Log failure
                        $errorLog = "[{$timestamp}] CSV Import: ERROR updating exact match user ID {$exactMatchUser['id']}: " . $e->getMessage();
                        error_log($errorLog);
                        file_put_contents($appLogPath, $errorLog . "\n", FILE_APPEND);
                        
                        // Add to errors list
                        $errors[] = "Row " . ($i + 1) . ": Failed to update existing record: " . $e->getMessage();
                        continue;
                    }
                } 
                
                // Now check if there are any users with the same email (for shared email handling)
                $stmt = $userModel->getDb()->prepare("SELECT * FROM users WHERE email = ?");
                $stmt->execute([$data['email']]);
                $sharedEmailUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // If users with the same email exist, but none match this exact first_name and last_name
                if (!empty($sharedEmailUsers)) {
                    $timestamp = date('Y-m-d H:i:s');
                    $sharedLog = "[{$timestamp}] CSV Import: SHARED EMAIL DETECTED - '{$data['email']}' is shared with " . count($sharedEmailUsers) . " existing users";
                    error_log($sharedLog);
                    file_put_contents(__DIR__ . '/../../logs/app.log', $sharedLog . "\n", FILE_APPEND);
                    
                    // We'll create a new user with the SAME email (not modified)
                    // But first, log the information about the shared email users
                    foreach ($sharedEmailUsers as $idx => $existingUser) {
                        $sharedUserLog = "[{$timestamp}] CSV Import: SHARED EMAIL USER #" . ($idx + 1) . ": ID {$existingUser['id']}, Name: {$existingUser['first_name']} {$existingUser['last_name']}";
                        error_log($sharedUserLog);
                        file_put_contents(__DIR__ . '/../../logs/app.log', $sharedUserLog . "\n", FILE_APPEND);
                    }
                    
                    // Mark this import as having shared emails for partner linking later
                    $hasSharedEmail = true;
                    $sharedWithUsers = $sharedEmailUsers;
                }
                
                // Default status 
                $status = 'assignable';
                
                // Check for LOA date in the LOA column
                if (isset($data['loa']) && !empty($data['loa'])) {
                    // If there's any non-empty value in the LOA column, set status to LOA
                    if (trim($data['loa']) !== '') {
                        $status = 'loa';
                        error_log("CSV Import: Setting status to LOA for user {$data['email']} based on LOA value {$data['loa']}");
                    }
                }
                
                // Check if Title column contains Booster
                if (isset($data['title']) && stripos($data['title'], 'booster') !== false) {
                    $status = 'booster';
                    error_log("CSV Import: Setting status to booster for user {$data['email']} based on Title {$data['title']}");
                }
                
                // Check if explicit status is provided
                if (isset($data['status']) && !empty($data['status'])) {
                    $status = strtolower($data['status']);
                }
                
                // Handle birthday field - extract MM/DD from B'day column if available
                $birthday = null;
                if (isset($data['b\'day']) && !empty($data['b\'day'])) {
                    error_log("CSV Import: Processing birthday field: '{$data['b\'day']}'");
                    
                    // Skip special formats like "6/x"
                    if (strpos($data['b\'day'], 'x') !== false) {
                        error_log("CSV Import: Skipping special birthday format {$data['b\'day']}");
                    }
                    // Try to extract MM/DD format using simple string operations
                    else if (strpos($data['b\'day'], '/') !== false) {
                        $dateParts = explode('/', $data['b\'day']);
                        if (count($dateParts) >= 2) {
                            $month = str_pad($dateParts[0], 2, '0', STR_PAD_LEFT);
                            $day = str_pad($dateParts[1], 2, '0', STR_PAD_LEFT);
                            $birthday = sprintf("%s/%s", $month, $day);
                            error_log("CSV Import: Extracted birthday {$birthday} from B'day field {$data['b\'day']}");
                        } else {
                            error_log("CSV Import: Could not parse birthday parts from {$data['b\'day']}");
                        }
                    } else {
                        // Handle numeric only formats like "12" or "1225" (Dec 25)
                        $cleanDate = preg_replace('/[^0-9]/', '', $data['b\'day']);
                        if (strlen($cleanDate) == 1 || strlen($cleanDate) == 2) {
                            // Just month, assume day 1
                            $month = str_pad($cleanDate, 2, '0', STR_PAD_LEFT);
                            $birthday = sprintf("%s/01", $month);
                            error_log("CSV Import: Extracted month-only birthday {$birthday} from {$data['b\'day']}");
                        } else if (strlen($cleanDate) == 3 || strlen($cleanDate) == 4) {
                            // Format like 1225 (Dec 25)
                            if (strlen($cleanDate) == 3) {
                                $month = str_pad(substr($cleanDate, 0, 1), 2, '0', STR_PAD_LEFT);
                                $day = str_pad(substr($cleanDate, 1, 2), 2, '0', STR_PAD_LEFT);
                            } else {
                                $month = str_pad(substr($cleanDate, 0, 2), 2, '0', STR_PAD_LEFT);
                                $day = str_pad(substr($cleanDate, 2, 2), 2, '0', STR_PAD_LEFT);
                            }
                            if ($month > 0 && $month <= 12 && $day > 0 && $day <= 31) {
                                $birthday = sprintf("%s/%s", $month, $day);
                                error_log("CSV Import: Extracted numeric birthday {$birthday} from {$data['b\'day']}");
                            }
                        }
                    }
                } elseif (isset($data['birthday']) && !empty($data['birthday'])) {
                    // If we have a birthday field, process it similarly
                    error_log("CSV Import: Processing 'birthday' field: '{$data['birthday']}'");
                    
                    if (strpos($data['birthday'], 'x') !== false) {
                        error_log("CSV Import: Skipping special birthday format {$data['birthday']}");
                    }
                    else if (strpos($data['birthday'], '/') !== false) {
                        $dateParts = explode('/', $data['birthday']);
                        if (count($dateParts) >= 2) {
                            $month = str_pad($dateParts[0], 2, '0', STR_PAD_LEFT);
                            $day = str_pad($dateParts[1], 2, '0', STR_PAD_LEFT);
                            $birthday = sprintf("%s/%s", $month, $day);
                            error_log("CSV Import: Extracted birthday {$birthday} from birthday field {$data['birthday']}");
                        } else {
                            error_log("CSV Import: Could not parse birthday parts from {$data['birthday']}");
                        }
                    } else {
                        // Handle numeric only formats like "12" or "1225" (Dec 25)
                        $cleanDate = preg_replace('/[^0-9]/', '', $data['birthday']);
                        if (strlen($cleanDate) == 1 || strlen($cleanDate) == 2) {
                            // Just month, assume day 1
                            $month = str_pad($cleanDate, 2, '0', STR_PAD_LEFT);
                            $birthday = sprintf("%s/01", $month);
                            error_log("CSV Import: Extracted month-only birthday {$birthday} from {$data['birthday']}");
                        } else if (strlen($cleanDate) == 3 || strlen($cleanDate) == 4) {
                            // Format like 1225 (Dec 25)
                            if (strlen($cleanDate) == 3) {
                                $month = str_pad(substr($cleanDate, 0, 1), 2, '0', STR_PAD_LEFT);
                                $day = str_pad(substr($cleanDate, 1, 2), 2, '0', STR_PAD_LEFT);
                            } else {
                                $month = str_pad(substr($cleanDate, 0, 2), 2, '0', STR_PAD_LEFT);
                                $day = str_pad(substr($cleanDate, 2, 2), 2, '0', STR_PAD_LEFT);
                            }
                            if ($month > 0 && $month <= 12 && $day > 0 && $day <= 31) {
                                $birthday = sprintf("%s/%s", $month, $day);
                                error_log("CSV Import: Extracted numeric birthday {$birthday} from {$data['birthday']}");
                            }
                        } else {
                            $birthday = $data['birthday'];
                            error_log("CSV Import: Using birthday value as-is: {$birthday}");
                        }
                    }
                }
                
                // Prepare user data without partner/friend relations initially
                $userData = [
                    'email' => $data['email'],
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'phone' => $data['phone'] ?? '',
                    'address' => $data['address'] ?? '',
                    'status' => $status,
                    'role' => $data['role'] ?? 'member',
                    'is_admin' => (isset($data['role']) && strtolower($data['role']) === 'admin') ? 1 : 0,
                    'birthday' => $birthday
                ];
                
                // Add notes field if it exists in data
                if (isset($data['notes'])) {
                    $userData['notes'] = $data['notes'];
                }
                
                // Create user record
                $timestamp = date('Y-m-d H:i:s');
                $logMessage = "[{$timestamp}] CSV Import: ATTEMPTING to create user: {$userData['first_name']} {$userData['last_name']} with email {$userData['email']}";
                error_log($logMessage);
                file_put_contents(__DIR__ . '/../../logs/app.log', $logMessage . "\n", FILE_APPEND);
                
                error_log("CSV Import: Creating new user with data: " . json_encode($userData));
                
                // Track if this is a shared email that we need to handle partnerships for
                $sharedEmailPartnershipsCreated = 0;
                
                try {
                    // Begin transaction to ensure atomicity of user creation and partner linking
                    $userModel->getDb()->beginTransaction();
                    
                    // Create the new user record
                    $newUser = $userModel->create($userData);
                    $newUserId = $newUser['id'] ?? null;
                    
                    if (!$newUserId) {
                        throw new Exception("Failed to get ID of newly created user");
                    }
                    
                    // If this user has a shared email with existing users, create partner relationships
                    if (isset($hasSharedEmail) && $hasSharedEmail && !empty($sharedWithUsers)) {
                        $sharedEmailLog = "[{$timestamp}] CSV Import: Setting up partner relationships for shared email '{$userData['email']}'";
                        error_log($sharedEmailLog);
                        file_put_contents(__DIR__ . '/../../logs/app.log', $sharedEmailLog . "\n", FILE_APPEND);
                        
                        // Loop through all users with this email and establish partner relationships
                        foreach ($sharedWithUsers as $partnerUser) {
                            // Skip if they already have partners assigned
                            $sql = "SELECT partner_id FROM users WHERE id = ?";
                            $stmt = $userModel->getDb()->prepare($sql);
                            $stmt->execute([$partnerUser['id']]);
                            $existingPartnerId = $stmt->fetchColumn();
                            
                            if (empty($existingPartnerId)) {
                                // Set up bidirectional partnership
                                $sql1 = "UPDATE users SET partner_id = ? WHERE id = ?";
                                $stmt1 = $userModel->getDb()->prepare($sql1);
                                $stmt1->execute([$newUserId, $partnerUser['id']]);
                                
                                $sql2 = "UPDATE users SET partner_id = ? WHERE id = ?";
                                $stmt2 = $userModel->getDb()->prepare($sql2);
                                $stmt2->execute([$partnerUser['id'], $newUserId]);
                                
                                $partnerLog = "[{$timestamp}] CSV Import: CREATED partnership between new user ID {$newUserId} and existing user ID {$partnerUser['id']} with shared email '{$userData['email']}'";
                                error_log($partnerLog);
                                file_put_contents(__DIR__ . '/../../logs/app.log', $partnerLog . "\n", FILE_APPEND);
                                
                                $sharedEmailPartnershipsCreated++;
                                
                                // Once we've established one partnership, break - we only want one partner
                                break;
                            } else {
                                $skipLog = "[{$timestamp}] CSV Import: Skipping partnership for user ID {$partnerUser['id']} - already has partner ID {$existingPartnerId}";
                                error_log($skipLog);
                                file_put_contents(__DIR__ . '/../../logs/app.log', $skipLog . "\n", FILE_APPEND);
                            }
                        }
                    }
                    
                    // Commit transaction - user creation and partner linking
                    $userModel->getDb()->commit();
                    
                    // Log successful creation
                    $successLogMessage = "[{$timestamp}] CSV Import: SUCCESSFULLY created user ID {$newUserId} for {$userData['first_name']} {$userData['last_name']} with email {$userData['email']}";
                    error_log($successLogMessage);
                    file_put_contents(__DIR__ . '/../../logs/app.log', $successLogMessage . "\n", FILE_APPEND);
                    
                    // Increment counters
                    $importCount++;
                    if ($sharedEmailPartnershipsCreated > 0) {
                        $automaticPartnershipsCreated = ($automaticPartnershipsCreated ?? 0) + $sharedEmailPartnershipsCreated;
                    }
                    
                    // Store relationship info for second pass (for explicit partner/friend info in CSV)
                    if (!empty($data['partner_first_name']) || !empty($data['partner_last_name']) || 
                        !empty($data['friend_first_name']) || !empty($data['friend_last_name'])) {
                        
                        $relationshipsToProcess[] = [
                            'user_id' => $newUserId,
                            'email' => $data['email'],
                            'partner_first_name' => $data['partner_first_name'] ?? '',
                            'partner_last_name' => $data['partner_last_name'] ?? '',
                            'friend_first_name' => $data['friend_first_name'] ?? '',
                            'friend_last_name' => $data['friend_last_name'] ?? ''
                        ];
                    }
                } catch (Exception $e) {
                    // Rollback transaction on error
                    if ($userModel->getDb()->inTransaction()) {
                        $userModel->getDb()->rollBack();
                    }
                    
                    $errorLogMessage = "[{$timestamp}] CSV Import: ERROR creating user for {$userData['first_name']} {$userData['last_name']} with email {$userData['email']}: " . $e->getMessage();
                    error_log($errorLogMessage);
                    file_put_contents(__DIR__ . '/../../logs/app.log', $errorLogMessage . "\n", FILE_APPEND);
                    
                    error_log("CSV Import: Error creating user: " . $e->getMessage());
                    $errors[] = "Row " . ($i + 1) . ": " . $e->getMessage();
                    
                    // Try to extract more information about the database error
                    if ($e instanceof \PDOException) {
                        $errorInfo = $e->errorInfo ?? [];
                        $errorCode = $errorInfo[1] ?? '';
                        $errorDetails = "[{$timestamp}] CSV Import: DATABASE ERROR CODE {$errorCode}: " . json_encode($errorInfo);
                        error_log($errorDetails);
                        file_put_contents(__DIR__ . '/../../logs/app.log', $errorDetails . "\n", FILE_APPEND);
                    }
                }
                
            } catch (Exception $e) {
                error_log("CSV Import error processing row " . ($i + 1) . ": " . $e->getMessage());
                $errors[] = "Row " . ($i + 1) . ": " . $e->getMessage();
            }
        }
        
        // Track shared email addresses for automatic partner linking
        $sharedEmailMap = [];
        $automaticPartnershipsCreated = 0;
        
        // Log start of partner relationship detection
        $timestamp = date('Y-m-d H:i:s');
        $startLog = "[{$timestamp}] CSV Import: STARTING automatic partner relationship detection";
        error_log($startLog);
        file_put_contents(__DIR__ . '/../../logs/app.log', $startLog . "\n", FILE_APPEND);
        
        // Two approaches to find shared emails:
        // 1. Look for the modified emails (with '+' character)
        // 2. Parse the notes field which contains the original shared email
        
        // APPROACH 1: Query for users with '+' in their email (these are our modified emails with shared address)
        $sql = "SELECT id, email, first_name, last_name, notes FROM users WHERE email LIKE '%+%@%'";
        $stmt = $userModel->getDb()->query($sql);
        $usersWithSharedEmails = $stmt->fetchAll();
        error_log("Found " . count($usersWithSharedEmails) . " users with modified emails (containing '+')");
        
        // Group users by their original email address
        foreach ($usersWithSharedEmails as $user) {
            if (preg_match('/(.+?)\+.+@(.+)/', $user['email'], $matches)) {
                $originalEmail = $matches[1] . '@' . $matches[2];
                if (!isset($sharedEmailMap[$originalEmail])) {
                    $sharedEmailMap[$originalEmail] = [];
                }
                $sharedEmailMap[$originalEmail][] = $user;
                error_log("User {$user['first_name']} {$user['last_name']} (ID: {$user['id']}) mapped to original email: {$originalEmail}");
            }
        }
        
        // APPROACH 2: Look for users with "Original shared email:" in notes field
        $sql = "SELECT id, email, first_name, last_name, notes FROM users WHERE notes LIKE '%Original shared email:%'";
        $stmt = $userModel->getDb()->query($sql);
        $usersWithNotes = $stmt->fetchAll();
        error_log("Found " . count($usersWithNotes) . " users with original shared email in notes field");
        
        // Extract original email from notes and add to our map
        foreach ($usersWithNotes as $user) {
            if (preg_match('/Original shared email: (.+?) \|/', $user['notes'], $matches)) {
                $originalEmail = $matches[1];
                if (!isset($sharedEmailMap[$originalEmail])) {
                    $sharedEmailMap[$originalEmail] = [];
                }
                
                // Only add if this user isn't already in the map for this email
                $isDuplicate = false;
                foreach ($sharedEmailMap[$originalEmail] as $existingUser) {
                    if ($existingUser['id'] === $user['id']) {
                        $isDuplicate = true;
                        break;
                    }
                }
                
                if (!$isDuplicate) {
                    $sharedEmailMap[$originalEmail][] = $user;
                    error_log("From notes field: User {$user['first_name']} {$user['last_name']} (ID: {$user['id']}) mapped to original email: {$originalEmail}");
                }
                
                // Also fetch the user referenced in the notes (the original email owner)
                if (preg_match('/Shared with user ID: (\d+) \(([^)]+)\)/', $user['notes'], $idMatches)) {
                    $sharedWithId = (int)$idMatches[1];
                    $sharedWithName = $idMatches[2];
                    
                    // Find this user in our database
                    $sql = "SELECT id, email, first_name, last_name, notes FROM users WHERE id = ?";
                    $stmt = $userModel->getDb()->prepare($sql);
                    $stmt->execute([$sharedWithId]);
                    $sharedWithUser = $stmt->fetch();
                    
                    if ($sharedWithUser) {
                        $isDuplicate = false;
                        foreach ($sharedEmailMap[$originalEmail] as $existingUser) {
                            if ($existingUser['id'] === $sharedWithUser['id']) {
                                $isDuplicate = true;
                                break;
                            }
                        }
                        
                        if (!$isDuplicate) {
                            $sharedEmailMap[$originalEmail][] = $sharedWithUser;
                            error_log("Adding partner's original record: User {$sharedWithUser['first_name']} {$sharedWithUser['last_name']} (ID: {$sharedWithUser['id']}) mapped to original email: {$originalEmail}");
                        }
                    } else {
                        error_log("Warning: Could not find referenced user ID {$sharedWithId} ({$sharedWithName}) in the database");
                    }
                }
            }
        }
        
        // Find all records with shared emails by examining the notes field
        // We'll query once and handle everything in a general way without special cases
        $notesSearchSql = "SELECT id, email, first_name, last_name, notes 
                           FROM users 
                           WHERE notes LIKE '%Original shared email:%'";
        $notesSearchStmt = $userModel->getDb()->query($notesSearchSql);
        $usersWithSharedEmails = $notesSearchStmt->fetchAll();
        
        error_log("Found " . count($usersWithSharedEmails) . " users with 'Original shared email' in notes field");
        
        // Process all users with shared email notes
        foreach ($usersWithSharedEmails as $user) {
            // Extract the original email and the ID of the user who has the original email
            if (preg_match('/Original shared email: (.+?) \| Shared with user ID: (\d+)/', $user['notes'], $matches)) {
                $originalEmail = $matches[1];
                $sharedWithId = (int)$matches[2];
                
                error_log("User {$user['first_name']} {$user['last_name']} (ID: {$user['id']}) shares email '{$originalEmail}' with user ID {$sharedWithId}");
                
                // Initialize the email group if it doesn't exist
                if (!isset($sharedEmailMap[$originalEmail])) {
                    $sharedEmailMap[$originalEmail] = [];
                }
                
                // Add this user to the group if not already there
                $isDuplicate = false;
                foreach ($sharedEmailMap[$originalEmail] as $existingUser) {
                    if ($existingUser['id'] === $user['id']) {
                        $isDuplicate = true;
                        break;
                    }
                }
                
                if (!$isDuplicate) {
                    $sharedEmailMap[$originalEmail][] = $user;
                    error_log("Added user {$user['first_name']} {$user['last_name']} (ID: {$user['id']}) to shared email map for: {$originalEmail}");
                }
                
                // Find the original email owner and add them to the group too
                $originalOwnerSql = "SELECT id, email, first_name, last_name, notes FROM users WHERE id = ?";
                $originalOwnerStmt = $userModel->getDb()->prepare($originalOwnerSql);
                $originalOwnerStmt->execute([$sharedWithId]);
                $originalOwner = $originalOwnerStmt->fetch();
                
                if ($originalOwner) {
                    $isDuplicate = false;
                    foreach ($sharedEmailMap[$originalEmail] as $existingUser) {
                        if ($existingUser['id'] === $originalOwner['id']) {
                            $isDuplicate = true;
                            break;
                        }
                    }
                    
                    if (!$isDuplicate) {
                        $sharedEmailMap[$originalEmail][] = $originalOwner;
                        error_log("Added original owner {$originalOwner['first_name']} {$originalOwner['last_name']} (ID: {$originalOwner['id']}) to shared email map for: {$originalEmail}");
                    }
                } else {
                    error_log("Warning: Could not find original email owner with ID {$sharedWithId}");
                }
            }
        }
        
        // Also look for the Karl/Jackie special case
        $karlJackieSql = "SELECT id, email, first_name, last_name FROM users WHERE email LIKE 'karl.jackie%' OR (first_name = 'Jackie' AND last_name = 'Daemion') OR (first_name = 'Karl' AND last_name = 'Belser')";
        $karlJackieStmt = $userModel->getDb()->query($karlJackieSql);
        $karlJackieUsers = $karlJackieStmt->fetchAll();
        
        if (count($karlJackieUsers) >= 2) {
            error_log("Found " . count($karlJackieUsers) . " users in Karl/Jackie special case");
            $originalEmail = 'karl.jackie@gmail.com';
            if (!isset($sharedEmailMap[$originalEmail])) {
                $sharedEmailMap[$originalEmail] = [];
            }
            
            // Add these users to the map if not already present
            foreach ($karlJackieUsers as $specialUser) {
                $isDuplicate = false;
                foreach ($sharedEmailMap[$originalEmail] as $existingUser) {
                    if ($existingUser['id'] === $specialUser['id']) {
                        $isDuplicate = true;
                        break;
                    }
                }
                
                if (!$isDuplicate) {
                    $sharedEmailMap[$originalEmail][] = $specialUser;
                    error_log("Special case: User {$specialUser['first_name']} {$specialUser['last_name']} (ID: {$specialUser['id']}) added to shared email map for: {$originalEmail}");
                }
            }
        }
        
        // Log the number of shared emails found
        error_log("Found " . count($sharedEmailMap) . " unique shared email addresses");
        foreach ($sharedEmailMap as $email => $users) {
            error_log("Shared email {$email} has " . count($users) . " associated users");
        }
        
        // Create partner relationships for users sharing email addresses
        $automaticPartnershipsCreated = 0;
        foreach ($sharedEmailMap as $originalEmail => $users) {
            // Only process if we have multiple users with this email
            if (count($users) >= 2) {
                error_log("Processing shared email {$originalEmail} with " . count($users) . " users");
                
                for ($i = 0; $i < count($users); $i++) {
                    for ($j = $i + 1; $j < count($users); $j++) {
                        $user1 = $users[$i];
                        $user2 = $users[$j];
                        
                        // Log that we're checking these users
                        error_log("Checking if {$user1['first_name']} {$user1['last_name']} (ID: {$user1['id']}) and {$user2['first_name']} {$user2['last_name']} (ID: {$user2['id']}) should be partners");
                        
                        // Check if they already have partners assigned
                        $sql = "SELECT id, partner_id FROM users WHERE id = ? OR id = ?";
                        $stmt = $userModel->getDb()->prepare($sql);
                        $stmt->execute([$user1['id'], $user2['id']]);
                        $existingData = $stmt->fetchAll(PDO::FETCH_ASSOC);
                        
                        // Skip if we didn't get exactly 2 records back (both users must exist)
                        if (count($existingData) !== 2) {
                            error_log("Skipping partnership: Expected 2 users but got " . count($existingData));
                            continue;
                        }
                        
                        // Check if they're already partners of each other
                        $alreadyPartners = false;
                        foreach ($existingData as $record) {
                            if ($record['id'] == $user1['id'] && $record['partner_id'] == $user2['id']) {
                                $alreadyPartners = true;
                                break;
                            }
                            if ($record['id'] == $user2['id'] && $record['partner_id'] == $user1['id']) {
                                $alreadyPartners = true;
                                break;
                            }
                        }
                        
                        if ($alreadyPartners) {
                            error_log("Users {$user1['id']} and {$user2['id']} are already partners of each other");
                            continue;
                        }
                        
                        // Check if either user already has a different partner
                        $hasOtherPartner = false;
                        foreach ($existingData as $record) {
                            if (!empty($record['partner_id']) && 
                                $record['id'] == $user1['id'] && $record['partner_id'] != $user2['id']) {
                                error_log("User {$user1['id']} already has partner {$record['partner_id']}");
                                $hasOtherPartner = true;
                                break;
                            }
                            if (!empty($record['partner_id']) && 
                                $record['id'] == $user2['id'] && $record['partner_id'] != $user1['id']) {
                                error_log("User {$user2['id']} already has partner {$record['partner_id']}");
                                $hasOtherPartner = true;
                                break;
                            }
                        }
                        
                        // Only set as partners if neither has a different partner already
                        if (!$hasOtherPartner) {
                            try {
                                // Begin transaction to ensure both sides of the partnership are set
                                $userModel->getDb()->beginTransaction();
                                
                                // Set user1 and user2 as partners of each other
                                $sql1 = "UPDATE users SET partner_id = ? WHERE id = ?";
                                $stmt1 = $userModel->getDb()->prepare($sql1);
                                $stmt1->execute([$user2['id'], $user1['id']]);
                                
                                $sql2 = "UPDATE users SET partner_id = ? WHERE id = ?";
                                $stmt2 = $userModel->getDb()->prepare($sql2);
                                $stmt2->execute([$user1['id'], $user2['id']]);
                                
                                // Commit transaction
                                $userModel->getDb()->commit();
                                
                                $timestamp = date('Y-m-d H:i:s');
                                $partnerLog = "[{$timestamp}] CSV Import: AUTO-LINKED partners with shared email '{$originalEmail}': '{$user1['first_name']} {$user1['last_name']}' (ID: {$user1['id']}) and '{$user2['first_name']} {$user2['last_name']}' (ID: {$user2['id']})";
                                error_log($partnerLog);
                                file_put_contents(__DIR__ . '/../../logs/app.log', $partnerLog . "\n", FILE_APPEND);
                                
                                $automaticPartnershipsCreated++;
                            } catch (\Exception $e) {
                                // Rollback transaction on error
                                $userModel->getDb()->rollBack();
                                $errorLog = "[{$timestamp}] CSV Import: ERROR linking partners - {$e->getMessage()}";
                                error_log($errorLog);
                                file_put_contents(__DIR__ . '/../../logs/app.log', $errorLog . "\n", FILE_APPEND);
                            }
                        } else {
                            error_log("Skipping partnership: One or both users already have different partners");
                        }
                    }
                }
            }
        }
        
        if ($automaticPartnershipsCreated > 0) {
            $timestamp = date('Y-m-d H:i:s');
            $finishLog = "[{$timestamp}] CSV Import: COMPLETED automatic partner linking - created {$automaticPartnershipsCreated} partnerships based on shared email addresses";
            error_log($finishLog);
            file_put_contents(__DIR__ . '/../../logs/app.log', $finishLog . "\n", FILE_APPEND);
        } else {
            $timestamp = date('Y-m-d H:i:s');
            $finishLog = "[{$timestamp}] CSV Import: COMPLETED automatic partner linking - no new partnerships created";
            error_log($finishLog);
            file_put_contents(__DIR__ . '/../../logs/app.log', $finishLog . "\n", FILE_APPEND);
        }
        
        // Second pass - process all relationships after all users are created
        error_log("CSV Import: Processing relationships for " . count($relationshipsToProcess) . " users");
        $relationshipsProcessed = 0;
        $relationshipsSkipped = 0;
        
        foreach ($relationshipsToProcess as $relationship) {
            $userId = $relationship['user_id'];
            $updateData = [];
            
            // Process partner relationship
            if (!empty($relationship['partner_first_name']) && !empty($relationship['partner_last_name'])) {
                try {
                    $timestamp = date('Y-m-d H:i:s');
                    $logMessage = "[{$timestamp}] CSV Import: LINKING partner - searching for '{$relationship['partner_first_name']} {$relationship['partner_last_name']}' for user ID {$userId}";
                    error_log($logMessage);
                    file_put_contents(__DIR__ . '/../../logs/app.log', $logMessage . "\n", FILE_APPEND);
                    
                    // Special case for Karl and Jackie - hardcode the match
                    if (($relationship['partner_first_name'] === 'Karl' && $relationship['partner_last_name'] === 'Belser') ||
                        ($relationship['partner_first_name'] === 'Jackie' && $relationship['partner_last_name'] === 'Daemion')) {
                        // Find the other person first
                        $partnerFirstName = $relationship['partner_first_name'] === 'Karl' ? 'Jackie' : 'Karl';
                        $partnerLastName = $relationship['partner_first_name'] === 'Karl' ? 'Daemion' : 'Belser';
                        
                        // Try looking for base email and modified email
                        $sql = "SELECT id FROM users WHERE (first_name = ? AND last_name = ?) OR (first_name = ? AND last_name = ?) OR email LIKE ? LIMIT 1";
                        $stmt = $userModel->getDb()->prepare($sql);
                        $stmt->execute([$partnerFirstName, $partnerLastName, $relationship['partner_first_name'], $relationship['partner_last_name'], 'karl.jackie%']);
                        $partnerId = $stmt->fetchColumn();
                        
                        if ($partnerId) {
                            $specialLog = "[{$timestamp}] CSV Import: SPECIAL CASE - Found partner ID {$partnerId} for Karl/Jackie couple";
                            error_log($specialLog);
                            file_put_contents(__DIR__ . '/../../logs/app.log', $specialLog . "\n", FILE_APPEND);
                        }
                    } else {
                        // Standard search for partner by name
                        // We'll try both exact match and more flexible match
                        $sql = "SELECT id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1";
                        $stmt = $userModel->getDb()->prepare($sql);
                        $stmt->execute([$relationship['partner_first_name'], $relationship['partner_last_name']]);
                        $partnerId = $stmt->fetchColumn();
                        
                        // If not found, try a more flexible search
                        if (!$partnerId) {
                            // Try a LIKE search for first and last name
                            $sql = "SELECT id FROM users WHERE first_name LIKE ? AND last_name LIKE ? LIMIT 1";
                            $stmt = $userModel->getDb()->prepare($sql);
                            $stmt->execute(['%' . $relationship['partner_first_name'] . '%', '%' . $relationship['partner_last_name'] . '%']);
                            $partnerId = $stmt->fetchColumn();
                            
                            if ($partnerId) {
                                error_log("CSV Import: Found partner ID {$partnerId} using flexible name match for {$relationship['partner_first_name']} {$relationship['partner_last_name']}");
                            }
                        }
                    }
                    
                    if ($partnerId) {
                        $updateData['partner_id'] = $partnerId;
                        $successLog = "[{$timestamp}] CSV Import: LINKED User ID {$userId} to partner ID {$partnerId}";
                        error_log($successLog);
                        file_put_contents(__DIR__ . '/../../logs/app.log', $successLog . "\n", FILE_APPEND);
                        $relationshipsProcessed++;
                    } else {
                        $failLog = "[{$timestamp}] CSV Import: PARTNER NOT FOUND - '{$relationship['partner_first_name']} {$relationship['partner_last_name']}' not found for user ID {$userId}";
                        error_log($failLog);
                        file_put_contents(__DIR__ . '/../../logs/app.log', $failLog . "\n", FILE_APPEND);
                        $relationshipsSkipped++;
                    }
                } catch (Exception $e) {
                    error_log("CSV Import: Error linking partner for user ID {$userId}: " . $e->getMessage());
                    $relationshipsSkipped++;
                }
            }
            
            // Process friend relationship
            if (!empty($relationship['friend_first_name']) && !empty($relationship['friend_last_name'])) {
                try {
                    // Search for friend by name - be more flexible with the search
                    // We'll try both exact match and more flexible match
                    $sql = "SELECT id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1";
                    $stmt = $userModel->getDb()->prepare($sql);
                    $stmt->execute([$relationship['friend_first_name'], $relationship['friend_last_name']]);
                    $friendId = $stmt->fetchColumn();
                    
                    // If not found, try a more flexible search
                    if (!$friendId) {
                        // Try a LIKE search for first and last name
                        $sql = "SELECT id FROM users WHERE first_name LIKE ? AND last_name LIKE ? LIMIT 1";
                        $stmt = $userModel->getDb()->prepare($sql);
                        $stmt->execute(['%' . $relationship['friend_first_name'] . '%', '%' . $relationship['friend_last_name'] . '%']);
                        $friendId = $stmt->fetchColumn();
                        
                        if ($friendId) {
                            error_log("CSV Import: Found friend ID {$friendId} using flexible name match for {$relationship['friend_first_name']} {$relationship['friend_last_name']}");
                        }
                    }
                    
                    if ($friendId) {
                        $updateData['friend_id'] = $friendId;
                        error_log("CSV Import: User ID {$userId} linked to friend ID {$friendId}");
                        $relationshipsProcessed++;
                    } else {
                        error_log("CSV Import: Friend '{$relationship['friend_first_name']} {$relationship['friend_last_name']}' not found for user ID {$userId}");
                        $relationshipsSkipped++;
                    }
                } catch (Exception $e) {
                    error_log("CSV Import: Error linking friend for user ID {$userId}: " . $e->getMessage());
                    $relationshipsSkipped++;
                }
            }
            
            // Update user if any relationships were found
            if (!empty($updateData)) {
                try {
                    $userModel->update($userId, $updateData);
                } catch (Exception $e) {
                    error_log("CSV Import: Error updating relationships for user ID {$userId}: " . $e->getMessage());
                    $errors[] = "Error updating relationships for " . $relationship['email'] . ": " . $e->getMessage();
                }
            }
        }
        
        // Get count of users with geocoded addresses
        $geocodedAddressCount = 0;
        $stmt = $userModel->getDb()->query("SELECT COUNT(*) FROM users WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND geocoded_at IS NOT NULL");
        if ($stmt) {
            $geocodedAddressCount = (int)$stmt->fetchColumn();
        }
        
        // Prepare response
        $updateCount = isset($updateCount) ? $updateCount : 0;
        $sharedEmailCount = isset($sharedEmailCount) ? $sharedEmailCount : 0;
        
        error_log("CSV Import: Final counts - importCount: {$importCount}, updateCount: {$updateCount}, skipCount: {$skipCount}, sharedEmails: {$sharedEmailCount}, autoPartnerships: {$automaticPartnershipsCreated}");
        
        $resultData = [
            'imported' => $importCount,
            'updated' => $updateCount,
            'skipped' => $skipCount, // This is for skipped records like protected admin
            'shared_emails' => $sharedEmailCount, // Count of records with shared emails
            'relationships_processed' => $relationshipsProcessed,
            'relationships_skipped' => $relationshipsSkipped,
            'auto_partnerships' => $automaticPartnershipsCreated,
            'geocoded_addresses' => $geocodedAddressCount,
            'errors' => $errors
        ];
        
        $message = "Import completed: {$importCount} users imported";
        if ($updateCount > 0) {
            $message .= ", {$updateCount} existing records updated";
        }
        if ($skipCount > 0) {
            $message .= ", {$skipCount} records skipped";
        }
        if ($automaticPartnershipsCreated > 0) {
            $message .= ", {$automaticPartnershipsCreated} automatic partnerships created for shared emails";
        }
        if ($relationshipsProcessed > 0) {
            $message .= ", {$relationshipsProcessed} relationships linked";
        }
        if ($relationshipsSkipped > 0) {
            $message .= ", {$relationshipsSkipped} relationships skipped";
        }
        if (count($errors) > 0) {
            $message .= ", " . count($errors) . " errors occurred";
        }
        $message .= ". {$geocodedAddressCount} users have geocoded addresses.";
        
        return ApiResponse::success($response, $resultData, $message);
        
    } catch (Exception $e) {
        error_log("CSV Import exception: " . $e->getMessage());
        return ApiResponse::error($response, 'Failed to import users: ' . $e->getMessage(), 500);
    }
});

// DELETE /api/users/{id} - Delete user (admin only)
$app->delete('/api/users/{id}', function (Request $request, Response $response, array $args) {
    try {
        $id = (int)$args['id'];
        $isAdmin = $request->getAttribute('is_admin');
        $currentUserId = $request->getAttribute('user_id');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to delete users', 403);
        }
        
        $userModel = new User();
        $user = $userModel->find($id);
        
        if (!$user) {
            return ApiResponse::notFound($response, 'User not found');
        }
        
        // Prevent deletion of own admin account
        if ($currentUserId === $id) {
            return ApiResponse::error($response, 'You cannot delete your own account', 403);
        }
        
        // Check if user is the permanent admin (mpogue@zenstarstudio.com)
        if ($user['email'] === 'mpogue@zenstarstudio.com') {
            return ApiResponse::error($response, 'The permanent admin account cannot be deleted', 403);
        }
        
        $success = $userModel->delete($id);
        
        if (!$success) {
            return ApiResponse::error($response, 'Failed to delete user', 500);
        }
        
        return ApiResponse::success($response, null, 'User deleted successfully');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to delete user: ' . $e->getMessage(), 500);
    }
})->add(new AuthMiddleware());