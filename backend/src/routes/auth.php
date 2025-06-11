<?php
declare(strict_types=1);

use App\Models\User;
use App\Models\LoginToken;
use App\Services\JWTService;
use App\Services\EmailService;
use App\Helpers\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

// POST /api/auth/send-login-link - Send passwordless login link
$app->post('/api/auth/send-login-link', function (Request $request, Response $response) {
    try {
        // Log the request
        error_log("POST /api/auth/send-login-link - Request received");
        
        $data = json_decode($request->getBody()->getContents(), true);
        $email = $data['email'] ?? '';
        
        // Log the email
        error_log("Login request for email: " . $email);
        
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            error_log("Invalid email format: " . $email);
            return ApiResponse::validationError($response, ['email' => 'Valid email address is required']);
        }
        
        // Check if user exists
        $userModel = new User();
        $user = $userModel->findByEmail($email);
        
        if (!$user) {
            error_log("User not found for email: " . $email);
            
            // Check if we're in development mode
            $isDevelopment = (getenv('APP_ENV') === 'development' || !getenv('APP_ENV'));
            
            if ($isDevelopment) {
                // In development, return a clear error that the user doesn't exist
                return ApiResponse::error($response, 'User not found with that email address.', 404, [
                    'details' => 'This error is only shown in development mode. In production, the system would return a generic success message for security reasons.'
                ]);
            } else {
                // For security in production, don't reveal if email exists or not
                return ApiResponse::success($response, null, 'If that email is registered, a login link has been sent.');
            }
        }
        
        error_log("User found with ID: " . $user['id']);
        
        // Generate login token
        $tokenModel = new LoginToken();
        try {
            $token = $tokenModel->generateToken($user['id']);
            error_log("Generated token: " . $token);
        } catch (Exception $e) {
            error_log("Token generation error: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            
            // If we're in development, return a detailed error
            if (getenv('APP_ENV') === 'development' || !getenv('APP_ENV')) {
                return ApiResponse::error($response, 'Failed to generate login token: ' . $e->getMessage(), 500);
            }
            
            // In production, use a fallback token
            $token = bin2hex(random_bytes(32));
            error_log("Using fallback token: " . $token);
        }
        
        // Ensure logs directory exists
        if (!is_dir(__DIR__ . '/../../logs')) {
            mkdir(__DIR__ . '/../../logs', 0777, true);
        }
        
        // Store login token in file for development and backup
        file_put_contents(__DIR__ . '/../../logs/login_tokens.log', date('[Y-m-d H:i:s] ') . "EMAIL: {$email}, TOKEN: {$token}" . PHP_EOL, FILE_APPEND);
        
        // Send email
        $emailService = new EmailService();
        $emailSent = $emailService->sendLoginLink($email, $token);
        
        error_log("Email sending result: " . ($emailSent ? 'Success' : 'Failed'));
        
        // Login URL for both development and production
        $loginUrl = "http://localhost:5181/login?token=" . urlencode($token);
        
        // If email failed to send, return a detailed error
        if (!$emailSent) {
            error_log("Failed to send email to: " . $email);
            
            // Always include token in development
            $isDevelopment = (getenv('APP_ENV') === 'development' || !getenv('APP_ENV'));
            
            if ($isDevelopment) {
                $responseData = [
                    'development_only' => [
                        'token' => $token,
                        'login_url' => $loginUrl
                    ],
                    'error' => 'Email sending failed. Check SMTP settings and server logs for details.'
                ];
                
                // Log the token and URL prominently for easy access
                error_log("============================================");
                error_log("DEVELOPMENT LOGIN TOKEN: " . $token);
                error_log("LOGIN URL: " . $loginUrl);
                error_log("============================================");
                
                return ApiResponse::error(
                    $response, 
                    'Failed to send login link. Please check email settings and server logs.', 
                    500, 
                    $responseData
                );
            } else {
                // In production, don't expose tokens in the error
                return ApiResponse::error(
                    $response, 
                    'Failed to send login link. Please try again later or contact support.', 
                    500
                );
            }
        }
        
        // Success - only include token in response for development
        $isDevelopment = (getenv('APP_ENV') === 'development' || !getenv('APP_ENV'));
        $responseData = $isDevelopment ? [
            'development_only' => [
                'token' => $token,
                'login_url' => $loginUrl
            ]
        ] : null;
        
        // Log for easy access in development
        if ($isDevelopment) {
            error_log("============================================");
            error_log("DEVELOPMENT LOGIN TOKEN: " . $token);
            error_log("LOGIN URL: " . $loginUrl);
            error_log("============================================");
        }
        
        return ApiResponse::success($response, $responseData, 'Login link sent to your email address.');
        
    } catch (Exception $e) {
        error_log("Exception in send-login-link: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        
        // Check if we're in development mode
        $isDevelopment = (getenv('APP_ENV') === 'development' || !getenv('APP_ENV'));
        
        if ($isDevelopment) {
            // In development, create a fallback token and return detailed error
            $token = bin2hex(random_bytes(32));
            $loginUrl = "http://localhost:5181/login?token=" . urlencode($token);
            
            error_log("============================================");
            error_log("FALLBACK LOGIN TOKEN: " . $token);
            error_log("LOGIN URL: " . $loginUrl);
            error_log("============================================");
            
            $responseData = [
                'development_only' => [
                    'token' => $token,
                    'login_url' => $loginUrl
                ],
                'error_details' => $e->getMessage()
            ];
            
            return ApiResponse::error(
                $response, 
                'An unexpected error occurred while processing your login request. Check server logs for details.', 
                500, 
                $responseData
            );
        } else {
            // In production, return a generic error
            return ApiResponse::error(
                $response, 
                'An unexpected error occurred while processing your login request. Please try again later.', 
                500
            );
        }
    }
});

// POST /api/auth/validate-token - Validate login token and return JWT
$app->post('/api/auth/validate-token', function (Request $request, Response $response) {
    try {
        error_log("POST /api/auth/validate-token - Request received");
        
        $data = json_decode($request->getBody()->getContents(), true);
        $token = $data['token'] ?? '';
        
        error_log("Token to validate: " . substr($token, 0, 10) . "...");
        
        if (empty($token)) {
            error_log("Empty token provided");
            return ApiResponse::validationError($response, ['token' => 'Token is required']);
        }
        
        // Validate login token
        $tokenModel = new LoginToken();
        error_log("Calling LoginToken->validateToken()");
        $result = $tokenModel->validateToken($token);
        
        if (!$result) {
            error_log("Token validation failed - token not found or expired");
            
            // Check if the token exists but is expired or used
            $stmt = $tokenModel->db->prepare("
                SELECT 
                    token, 
                    expires_at, 
                    used_at,
                    NOW() as current_time
                FROM login_tokens 
                WHERE token = ?
            ");
            $stmt->execute([$token]);
            $tokenInfo = $stmt->fetch();
            
            if ($tokenInfo) {
                error_log("Token found in database:");
                error_log("- Expires at: " . $tokenInfo['expires_at']);
                error_log("- Used at: " . ($tokenInfo['used_at'] ?? 'Not used'));
                error_log("- Current time: " . $tokenInfo['current_time']);
                
                if ($tokenInfo['used_at']) {
                    return ApiResponse::error($response, 'Token has already been used', 401);
                } elseif ($tokenInfo['expires_at'] < $tokenInfo['current_time']) {
                    return ApiResponse::error($response, 'Token has expired', 401);
                }
            }
            
            return ApiResponse::error($response, 'Invalid or expired token', 401);
        }
        
        error_log("Token validated successfully for user ID: " . $result['id']);
        
        // Generate JWT token
        $jwtService = new JWTService();
        error_log("Generating JWT token");
        $jwtToken = $jwtService->generateToken($result);
        
        $responseData = [
            'token' => $jwtToken,
            'user' => [
                'id' => $result['id'],
                'email' => $result['email'],
                'first_name' => $result['first_name'],
                'last_name' => $result['last_name'],
                'role' => $result['role'],
                'is_admin' => (bool)$result['is_admin']
            ]
        ];
        
        error_log("Login successful for user: " . $result['email']);
        
        return ApiResponse::success($response, $responseData, 'Login successful');
        
    } catch (Exception $e) {
        error_log("Exception in validate-token: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        
        return ApiResponse::error($response, 'An error occurred while validating the token: ' . $e->getMessage(), 500);
    }
});

// GET /api/auth/dev-tokens - Development only: List all active login tokens
if (getenv('APP_ENV') === 'development' || !getenv('APP_ENV')) {
    $app->get('/api/auth/dev-tokens', function (Request $request, Response $response) {
        try {
            error_log("GET /api/auth/dev-tokens - Request received");
            
            // Get the login token model
            $tokenModel = new LoginToken();
            
            // Get the appropriate date function
            $dateFunction = $tokenModel->getCurrentDateFunction();
            
            // Query for all active tokens
            $query = "
                SELECT 
                    lt.id, 
                    lt.token, 
                    lt.user_id, 
                    lt.expires_at, 
                    lt.used_at,
                    u.email, 
                    u.first_name, 
                    u.last_name,
                    {$dateFunction} as current_time
                FROM login_tokens lt
                JOIN users u ON lt.user_id = u.id
                WHERE lt.expires_at > {$dateFunction}
                ORDER BY lt.expires_at DESC
            ";
            
            $stmt = $tokenModel->db->query($query);
            $tokens = $stmt->fetchAll();
            
            // Calculate additional info
            foreach ($tokens as &$token) {
                // Add login URL
                $token['login_url'] = "http://localhost:5181/login?token=" . urlencode($token['token']);
                
                // Format expiry info
                $expiresAt = strtotime($token['expires_at']);
                $now = strtotime($token['current_time']);
                $token['expires_in_seconds'] = max(0, $expiresAt - $now);
                $token['expires_in_minutes'] = round(max(0, $token['expires_in_seconds'] / 60));
                $token['is_valid'] = ($token['expires_in_seconds'] > 0) && ($token['used_at'] === null);
            }
            
            return ApiResponse::success(
                $response, 
                ['tokens' => $tokens], 
                sprintf('Found %d active login tokens', count($tokens))
            );
            
        } catch (Exception $e) {
            error_log("Exception in dev-tokens: " . $e->getMessage());
            error_log("Stack trace: " . $e->getTraceAsString());
            
            return ApiResponse::error(
                $response, 
                'An error occurred while fetching tokens: ' . $e->getMessage(), 
                500
            );
        }
    });
    
    // GET /api/auth/dev-token - Development only: Get login token without email
    $app->get('/api/auth/dev-token', function (Request $request, Response $response) {
        try {
            $email = $request->getQueryParams()['email'] ?? '';
            
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ApiResponse::validationError($response, ['email' => 'Valid email address is required']);
            }
            
            // Check if user exists
            $userModel = new User();
            $user = $userModel->findByEmail($email);
            
            if (!$user) {
                return ApiResponse::error($response, 'User not found', 404);
            }
            
            // Generate login token
            $tokenModel = new LoginToken();
            $token = $tokenModel->generateToken($user['id']);
            
            $responseData = [
                'token' => $token,
                'login_url' => "/login?token={$token}",
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name']
                ]
            ];
            
            return ApiResponse::success($response, $responseData, 'Development login token generated');
            
        } catch (Exception $e) {
            return ApiResponse::error($response, 'An error occurred while generating token.', 500);
        }
    });
    
    // GET /api/auth/dev-jwt - Development only: Get JWT token directly
    $app->get('/api/auth/dev-jwt', function (Request $request, Response $response) {
        try {
            $email = $request->getQueryParams()['email'] ?? '';
            
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ApiResponse::validationError($response, ['email' => 'Valid email address is required']);
            }
            
            // Check if user exists
            $userModel = new User();
            $user = $userModel->findByEmail($email);
            
            if (!$user) {
                return ApiResponse::error($response, 'User not found', 404);
            }
            
            // Generate JWT token directly
            $jwtService = new JWTService();
            $jwtToken = $jwtService->generateToken($user);
            
            $responseData = [
                'token' => $jwtToken,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'role' => $user['role'],
                    'is_admin' => (bool)$user['is_admin']
                ]
            ];
            
            return ApiResponse::success($response, $responseData, 'Development JWT token generated');
            
        } catch (Exception $e) {
            return ApiResponse::error($response, 'An error occurred while generating JWT.', 500);
        }
    });
    
    // GET /api/auth/dev-long-token - Development only: Get 1-year JWT token
    $app->get('/api/auth/dev-long-token', function (Request $request, Response $response) {
        try {
            $email = $request->getQueryParams()['email'] ?? '';
            
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return ApiResponse::validationError($response, ['email' => 'Valid email address is required']);
            }
            
            // Check if user exists
            $userModel = new User();
            $user = $userModel->findByEmail($email);
            
            if (!$user) {
                return ApiResponse::error($response, 'User not found', 404);
            }
            
            // Generate long-lived JWT token (1 year)
            $jwtService = new JWTService();
            $longToken = $jwtService->generateLongLivedToken($user);
            
            // Create frontend login URL
            $frontendUrl = 'http://localhost:5181';
            $loginUrl = $frontendUrl . '/auth/dev-login?token=' . urlencode($longToken);
            $membersUrl = $frontendUrl . '/members?token=' . urlencode($longToken);
            
            $responseData = [
                'token' => $longToken,
                'expires_in' => '1 year',
                'login_url' => $loginUrl,
                'members_url' => $membersUrl,
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'role' => $user['role'],
                    'is_admin' => (bool)$user['is_admin']
                ]
            ];
            
            return ApiResponse::success($response, $responseData, 'Long-lived development token generated (1 year)');
            
        } catch (Exception $e) {
            return ApiResponse::error($response, 'An error occurred while generating long token.', 500);
        }
    });
}
