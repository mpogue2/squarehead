<?php
declare(strict_types=1);

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class JWTService
{
    private string $secretKey;
    private string $algorithm = 'HS256';
    private int $expiration = 3600; // 1 hour
    
    public function __construct()
    {
        $this->secretKey = $_ENV['JWT_SECRET'] ?? 'dev_jwt_secret_key_change_in_production';
    }
    
    /**
     * Generate JWT token for user
     */
    public function generateToken(array $user): string
    {
        // Force mpogue@zenstarstudio.com to always be admin
        $isAdmin = (bool)$user['is_admin'];
        $role = $user['role'];
        
        if ($user['email'] === 'mpogue@zenstarstudio.com') {
            $isAdmin = true;
            $role = 'admin';
        }
        
        $payload = [
            'iss' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
            'aud' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
            'iat' => time(),
            'exp' => time() + $this->expiration,
            'user_id' => $user['id'],
            'email' => $user['email'],
            'is_admin' => $isAdmin,
            'role' => $role
        ];
        
        return JWT::encode($payload, $this->secretKey, $this->algorithm);
    }
    
    /**
     * Generate long-lived JWT token for development (1 year)
     */
    public function generateLongLivedToken(array $user): string
    {
        $oneYear = 365 * 24 * 60 * 60; // 1 year in seconds
        
        // Force mpogue@zenstarstudio.com to always be admin
        $isAdmin = (bool)$user['is_admin'];
        $role = $user['role'];
        
        if ($user['email'] === 'mpogue@zenstarstudio.com') {
            $isAdmin = true;
            $role = 'admin';
        }
        
        $payload = [
            'iss' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
            'aud' => $_ENV['APP_URL'] ?? 'http://localhost:8000',
            'iat' => time(),
            'exp' => time() + $oneYear,
            'user_id' => $user['id'],
            'email' => $user['email'],
            'is_admin' => $isAdmin,
            'role' => $role,
            'dev_long_lived' => true // Mark as development token
        ];
        
        return JWT::encode($payload, $this->secretKey, $this->algorithm);
    }
    
    /**
     * Validate and decode JWT token
     */
    public function validateToken(string $token): ?array
    {
        // Log the token validation attempt
        error_log("JWT validation attempt for token: " . substr($token, 0, 10) . "...");
        
        // Development mode bypass
        if ($token === 'dev-token-valid' && 
            (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development') || 
            !isset($_ENV['APP_ENV'])) {
            error_log("Using development token bypass");
            return [
                'user_id' => 1,
                'email' => 'mpogue@zenstarstudio.com',
                'is_admin' => true,
                'role' => 'admin',
                'iat' => time(),
                'exp' => time() + 3600
            ];
        }
        
        try {
            $decoded = JWT::decode($token, new Key($this->secretKey, $this->algorithm));
            $payload = (array)$decoded;
            
            // Log successful validation
            error_log("JWT validation successful for user: " . ($payload['email'] ?? 'unknown'));
            
            // Ensure mpogue@zenstarstudio.com is always an admin
            if (isset($payload['email']) && $payload['email'] === 'mpogue@zenstarstudio.com') {
                $payload['is_admin'] = true;
                $payload['role'] = 'admin';
            }
            
            return $payload;
        } catch (Exception $e) {
            // Log the validation error
            error_log("JWT validation failed: " . $e->getMessage());
            error_log("Token attempted: " . $token);
            
            // Include more debugging info in development
            if ((isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'development') || !isset($_ENV['APP_ENV'])) {
                error_log("JWT debug info - Algorithm: {$this->algorithm}, Secret key first 5 chars: " . substr($this->secretKey, 0, 5));
                error_log("JWT exception stack trace: " . $e->getTraceAsString());
            }
            
            return null;
        }
    }
    
    /**
     * Extract token from Authorization header
     */
    public function extractTokenFromHeader(string $authHeader): ?string
    {
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            return $matches[1];
        }
        
        return null;
    }
    
    /**
     * Get user ID from token
     */
    public function getUserIdFromToken(string $token): ?int
    {
        $payload = $this->validateToken($token);
        return $payload ? (int)$payload['user_id'] : null;
    }
}
