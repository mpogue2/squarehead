<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Services\JWTService;
use App\Helpers\ApiResponse;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

class AuthMiddleware
{
    private JWTService $jwtService;
    
    public function __construct()
    {
        $this->jwtService = new JWTService();
        
        // Ensure permanent admin status for mpogue@zenstarstudio.com
        $this->ensurePermanentAdmin();
    }
    
    /**
     * Ensure mpogue@zenstarstudio.com is always an admin in the database
     */
    private function ensurePermanentAdmin(): void
    {
        try {
            $userModel = new \App\Models\User();
            $permanentAdmin = $userModel->findByEmail('mpogue@zenstarstudio.com');
            
            if ($permanentAdmin) {
                // If the user exists but isn't an admin, update them
                if (!$permanentAdmin['is_admin']) {
                    $userModel->update($permanentAdmin['id'], [
                        'is_admin' => 1,
                        'role' => 'admin'
                    ]);
                    error_log("Permanent admin status restored for mpogue@zenstarstudio.com");
                }
            }
        } catch (\Exception $e) {
            // Just log the error, don't crash the application
            error_log("Error ensuring permanent admin: " . $e->getMessage());
        }
    }
    
    /**
     * Auth middleware for protected routes
     */
    public function __invoke(Request $request, RequestHandler $handler): Response
    {
        $path = $request->getUri()->getPath();
        error_log("AuthMiddleware: Processing request for path: {$path}");
        
        $authHeader = $request->getHeaderLine('Authorization');
        
        if (empty($authHeader)) {
            error_log("AuthMiddleware: Missing Authorization header");
            $response = new \Slim\Psr7\Response();
            return ApiResponse::error($response, 'Authorization header required', 401);
        }
        
        $token = $this->jwtService->extractTokenFromHeader($authHeader);
        
        if (!$token) {
            error_log("AuthMiddleware: Invalid authorization format");
            $response = new \Slim\Psr7\Response();
            return ApiResponse::error($response, 'Invalid authorization format', 401);
        }
        
        $payload = $this->jwtService->validateToken($token);
        
        if (!$payload) {
            error_log("AuthMiddleware: Invalid or expired token");
            $response = new \Slim\Psr7\Response();
            return ApiResponse::error($response, 'Invalid or expired token', 401);
        }
        
        // Add user info to request attributes
        $request = $request->withAttribute('user_id', $payload['user_id']);
        $request = $request->withAttribute('user_email', $payload['email']);
        $request = $request->withAttribute('is_admin', $payload['is_admin']);
        $request = $request->withAttribute('user_role', $payload['role']);
        
        error_log("AuthMiddleware: User authenticated - ID: {$payload['user_id']}, Email: {$payload['email']}, Admin: " . ($payload['is_admin'] ? 'Yes' : 'No'));
        
        return $handler->handle($request);
    }
}
