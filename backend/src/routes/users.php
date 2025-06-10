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
            $updateData['is_admin'] = !empty($data['is_admin']) ? 1 : 0;
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
