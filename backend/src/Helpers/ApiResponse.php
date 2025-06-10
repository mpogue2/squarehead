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
        return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
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
        return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
    }
    
    public static function notFound(Response $response, string $message = 'Resource not found'): Response
    {
        return self::error($response, $message, 404);
    }
    
    public static function validationError(Response $response, array $errors, string $message = 'Validation failed'): Response
    {
        return self::error($response, $message, 422, $errors);
    }
}
