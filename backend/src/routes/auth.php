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
        $data = json_decode($request->getBody()->getContents(), true);
        $email = $data['email'] ?? '';
        
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ApiResponse::validationError($response, ['email' => 'Valid email address is required']);
        }
        
        // Check if user exists
        $userModel = new User();
        $user = $userModel->findByEmail($email);
        
        if (!$user) {
            // For security, don't reveal if email exists or not
            return ApiResponse::success($response, null, 'If that email is registered, a login link has been sent.');
        }
        
        // Generate login token
        $tokenModel = new LoginToken();
        $token = $tokenModel->generateToken($user['id']);
        
        // Send email
        $emailService = new EmailService();
        $emailSent = $emailService->sendLoginLink($email, $token);
        
        if (!$emailSent) {
            return ApiResponse::error($response, 'Failed to send email. Please try again.', 500);
        }
        
        return ApiResponse::success($response, null, 'Login link sent to your email address.');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'An error occurred while processing your request.', 500);
    }
});

// POST /api/auth/validate-token - Validate login token and return JWT
$app->post('/api/auth/validate-token', function (Request $request, Response $response) {
    try {
        $data = json_decode($request->getBody()->getContents(), true);
        $token = $data['token'] ?? '';
        
        if (empty($token)) {
            return ApiResponse::validationError($response, ['token' => 'Token is required']);
        }
        
        // Validate login token
        $tokenModel = new LoginToken();
        $result = $tokenModel->validateToken($token);
        
        if (!$result) {
            return ApiResponse::error($response, 'Invalid or expired token', 401);
        }
        
        // Generate JWT token
        $jwtService = new JWTService();
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
        
        return ApiResponse::success($response, $responseData, 'Login successful');
        
    } catch (Exception $e) {
        return ApiResponse::error($response, 'An error occurred while validating the token.', 500);
    }
});

// GET /api/auth/dev-token - Development only: Get login token without email
if (getenv('APP_ENV') === 'development' || !getenv('APP_ENV')) {
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
