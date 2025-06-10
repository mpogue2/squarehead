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
    }
    
    /**
     * Auth middleware for protected routes
     */
    public function __invoke(Request $request, RequestHandler $handler): Response
    {
        $authHeader = $request->getHeaderLine('Authorization');
        
        if (empty($authHeader)) {
            $response = new \Slim\Psr7\Response();
            return ApiResponse::error($response, 'Authorization header required', 401);
        }
        
        $token = $this->jwtService->extractTokenFromHeader($authHeader);
        
        if (!$token) {
            $response = new \Slim\Psr7\Response();
            return ApiResponse::error($response, 'Invalid authorization format', 401);
        }
        
        $payload = $this->jwtService->validateToken($token);
        
        if (!$payload) {
            $response = new \Slim\Psr7\Response();
            return ApiResponse::error($response, 'Invalid or expired token', 401);
        }
        
        // Add user info to request attributes
        $request = $request->withAttribute('user_id', $payload['user_id']);
        $request = $request->withAttribute('user_email', $payload['email']);
        $request = $request->withAttribute('is_admin', $payload['is_admin']);
        $request = $request->withAttribute('user_role', $payload['role']);
        
        return $handler->handle($request);
    }
}
