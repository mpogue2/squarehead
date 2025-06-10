<?php
declare(strict_types=1);

namespace App\Helpers;

use Psr\Http\Message\ResponseInterface as Response;

class ApiResponse
{
    public static function success(Response $response, $data = null, ?string $message = null, int $status = 200): Response
    {
        $responseData = ['status' => 'success'];
        
        if ($data !== null) {
            $responseData['data'] = $data;
        }
        
        if ($message !== null) {
            $responseData['message'] = $message;
        }
        
        $response->getBody()->write(json_encode($responseData));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Access-Control-Allow-Origin', '*')
            ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length')
            ->withStatus($status);
    }
    
    public static function error(Response $response, string $message, int $status = 400, $errors = null): Response
    {
        $responseData = [
            'status' => 'error',
            'message' => $message
        ];
        
        if ($errors !== null) {
            $responseData['errors'] = $errors;
        }
        
        $response->getBody()->write(json_encode($responseData));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Access-Control-Allow-Origin', '*')
            ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->withHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length')
            ->withStatus($status);
    }
    
    public static function notFound(Response $response, string $message = 'Resource not found'): Response
    {
        return self::error($response, $message, 404);
    }
    
    public static function validationError(Response $response, array $errors, string $message = 'Validation failed'): Response
    {
        // Ensure all validation errors have CORS headers
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Headers: X-Requested-With, Content-Type, Accept, Origin, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS');
        return self::error($response, $message, 422, $errors);
    }
}
