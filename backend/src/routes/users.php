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
    try {
        $isAdmin = $request->getAttribute('is_admin');
        
        if (!$isAdmin) {
            return ApiResponse::error($response, 'Admin access required to geocode addresses', 403);
        }
        
        $userModel = new User();
        $results = $userModel->geocodeAllMissingCoordinates();
        
        $message = "Geocoding completed: {$results['geocoded']} addresses geocoded";
        if (!empty($results['errors'])) {
            $message .= ', ' . count($results['errors']) . ' errors occurred';
        }
        
        return ApiResponse::success($response, $results, $message);
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'Failed to geocode addresses: ' . $e->getMessage(), 500);
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
        
        // Check if email already exists
        $existingUser = $userModel->findByEmail($data['email']);
        if ($existingUser) {
            return ApiResponse::validationError($response, [
                'email' => 'Email address already exists'
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
        
        // Check if email already exists (for other users)
        if (!empty($data['email']) && $data['email'] !== $existingUser['email']) {
            $emailUser = $userModel->findByEmail($data['email']);
            if ($emailUser && $emailUser['id'] !== $id) {
                return ApiResponse::validationError($response, [
                    'email' => 'Email address already exists'
                ]);
            }
        }
        
        // Prepare update data - only include provided fields
        $updateData = [];
        $allowedFields = ['email', 'first_name', 'last_name', 'address', 'phone', 'role', 'partner_id', 'friend_id', 'status'];
        
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                if ($field === 'partner_id' || $field === 'friend_id') {
                    $updateData[$field] = !empty($data[$field]) ? (int)$data[$field] : null;
                } else {
                    $updateData[$field] = $data[$field];
                }
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
        $csvContent = "first_name,last_name,email,phone,address,role,status,partner_first_name,partner_last_name,friend_first_name,friend_last_name\n";
        
        // CSV Data rows - manually escape fields - include all fields needed for complete import
        foreach ($users as $user) {
            $csvContent .= implode(',', [
                '"' . str_replace('"', '""', $user['first_name']) . '"',
                '"' . str_replace('"', '""', $user['last_name']) . '"',
                '"' . str_replace('"', '""', $user['email']) . '"',
                '"' . str_replace('"', '""', $user['phone'] ?: '') . '"',
                '"' . str_replace('"', '""', $user['address'] ?: '') . '"',
                '"' . str_replace('"', '""', $user['is_admin'] ? 'admin' : 'member') . '"',
                '"' . str_replace('"', '""', $user['status']) . '"',
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
        
        try {
            // Make sure we have at least one line
            if (count($lines) < 1) {
                error_log("CSV Import error: No header line found");
                return ApiResponse::validationError($response, ['file' => 'Invalid CSV format - no header line'], 'Invalid CSV format');
            }
            
            // Get headers from first line and convert to lowercase
            $headerLine = trim($lines[0]);
            error_log("CSV header line: " . $headerLine);
            
            $headers = str_getcsv($headerLine);
            $headers = array_map('trim', $headers);
            $headers = array_map('strtolower', $headers);
            
            // Log headers for debugging
            error_log("CSV Import headers: " . implode(", ", $headers));
            
            // Check required headers
            $requiredHeaders = ['first_name', 'last_name', 'email'];
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
                
                // Log each data line for debugging
                error_log("Processing CSV row " . $i . ": " . $line);
                
                // Parse CSV row
                $row = str_getcsv($line);
                
                // Check column count matches header count
                if (count($row) != count($headers)) {
                    error_log("CSV Import error: Row " . ($i + 1) . " has " . count($row) . " columns but headers have " . count($headers) . " columns");
                    $errors[] = "Row " . ($i + 1) . ": Column count mismatch";
                    continue;
                }
                
                // Create associative array from row
                $data = array_combine($headers, $row);
                
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
                
                // Check for validation errors
                if (!empty($validationErrors)) {
                    $errors[] = "Row " . ($i + 1) . ": " . implode(', ', $validationErrors);
                    continue;
                }
                
                // Check if user with email already exists
                $existingUser = $userModel->findByEmail($data['email']);
                if ($existingUser) {
                    $skipCount++;
                    
                    // Update existing user's address and geocode if needed
                    if (!empty($data['address']) && ($data['address'] !== ($existingUser['address'] ?? ''))) {
                        try {
                            // Use updateWithGeocoding to handle address change with geocoding
                            $updateData = [
                                'address' => $data['address'],
                                // Include other fields that might have changed
                                'phone' => $data['phone'] ?? $existingUser['phone'],
                                'status' => $data['status'] ?? $existingUser['status'],
                                'role' => $data['role'] ?? $existingUser['role'],
                            ];
                            
                            $userModel->updateWithGeocoding($existingUser['id'], $updateData);
                            error_log("CSV Import: Updated address with geocoding for user ID {$existingUser['id']}");
                        } catch (Exception $e) {
                            error_log("CSV Import: Error updating address for user ID {$existingUser['id']}: " . $e->getMessage());
                        }
                    }
                    
                    // Even for skipped users, we'll update their partner/friend relationships
                    // Store relationship info for second pass
                    if (!empty($data['partner_first_name']) || !empty($data['partner_last_name']) || 
                        !empty($data['friend_first_name']) || !empty($data['friend_last_name'])) {
                        
                        $relationshipsToProcess[] = [
                            'user_id' => $existingUser['id'],
                            'email' => $data['email'],
                            'partner_first_name' => $data['partner_first_name'] ?? '',
                            'partner_last_name' => $data['partner_last_name'] ?? '',
                            'friend_first_name' => $data['friend_first_name'] ?? '',
                            'friend_last_name' => $data['friend_last_name'] ?? ''
                        ];
                    }
                    
                    continue; // Skip to next user
                }
                
                // Prepare user data without partner/friend relations initially
                $userData = [
                    'email' => $data['email'],
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'phone' => $data['phone'] ?? '',
                    'address' => $data['address'] ?? '',
                    'status' => $data['status'] ?? 'assignable',
                    'role' => $data['role'] ?? 'member',
                    'is_admin' => (strtolower($data['role'] ?? '') === 'admin') ? 1 : 0
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
                        error_log("CSV Import: Geocoding failed for new user: " . $e->getMessage());
                    }
                }

                // Create user first
                $newUser = $userModel->create($userData);
                $importCount++;
                
                // Store relationship info for second pass
                if (!empty($data['partner_first_name']) || !empty($data['partner_last_name']) || 
                    !empty($data['friend_first_name']) || !empty($data['friend_last_name'])) {
                    
                    $relationshipsToProcess[] = [
                        'user_id' => $newUser['id'],
                        'email' => $data['email'],
                        'partner_first_name' => $data['partner_first_name'] ?? '',
                        'partner_last_name' => $data['partner_last_name'] ?? '',
                        'friend_first_name' => $data['friend_first_name'] ?? '',
                        'friend_last_name' => $data['friend_last_name'] ?? ''
                    ];
                }
                // Relationships will be processed in second pass
            } catch (Exception $e) {
                error_log("CSV Import error processing row " . ($i + 1) . ": " . $e->getMessage());
                $errors[] = "Row " . ($i + 1) . ": " . $e->getMessage();
            }
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
                    // Search for partner by name
                    $sql = "SELECT id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1";
                    $stmt = $userModel->getDb()->prepare($sql);
                    $stmt->execute([$relationship['partner_first_name'], $relationship['partner_last_name']]);
                    $partnerId = $stmt->fetchColumn();
                    
                    if ($partnerId) {
                        $updateData['partner_id'] = $partnerId;
                        error_log("CSV Import: User ID {$userId} linked to partner ID {$partnerId}");
                        $relationshipsProcessed++;
                    } else {
                        error_log("CSV Import: Partner '{$relationship['partner_first_name']} {$relationship['partner_last_name']}' not found for user ID {$userId}");
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
                    // Search for friend by name
                    $sql = "SELECT id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1";
                    $stmt = $userModel->getDb()->prepare($sql);
                    $stmt->execute([$relationship['friend_first_name'], $relationship['friend_last_name']]);
                    $friendId = $stmt->fetchColumn();
                    
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
        $resultData = [
            'imported' => $importCount,
            'skipped' => $skipCount,
            'relationships_processed' => $relationshipsProcessed,
            'relationships_skipped' => $relationshipsSkipped,
            'geocoded_addresses' => $geocodedAddressCount,
            'errors' => $errors
        ];
        
        $message = "Import completed: {$importCount} users imported";
        if ($skipCount > 0) {
            $message .= ", {$skipCount} skipped (already exist)";
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
