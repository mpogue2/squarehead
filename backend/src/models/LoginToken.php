<?php
declare(strict_types=1);

namespace App\Models;

class LoginToken extends BaseModel
{
    protected string $table = 'login_tokens';
    
    protected array $fillable = [
        'token',
        'user_id',
        'expires_at'
    ];
    
    /**
     * Make the getCurrentDateFunction public for external use
     */
    public function getCurrentDateFunction(): string
    {
        return parent::getCurrentDateFunction();
    }
    
    /**
     * Generate a new login token for user
     */
    public function generateToken(int $userId, int $expiryHours = 1): string
    {
        // Generate secure random token
        $token = bin2hex(random_bytes(32));
        
        // Calculate expiry time
        $expiresAt = date('Y-m-d H:i:s', time() + ($expiryHours * 3600));
        
        // Clean up old tokens for this user
        $this->deleteExpiredTokens($userId);
        
        // Create new token
        $this->create([
            'token' => $token,
            'user_id' => $userId,
            'expires_at' => $expiresAt
        ]);
        
        return $token;
    }
    
    /**
     * Validate and use a token
     */
    public function validateToken(string $token): ?array
    {
        // Log validation attempt
        error_log("LoginToken: Validating token " . substr($token, 0, 10) . "...");
        
        // Get the appropriate date function
        $dateFunction = $this->getCurrentDateFunction();
        error_log("LoginToken: Using date function: " . $dateFunction);
        
        $query = "
            SELECT lt.*, u.* 
            FROM login_tokens lt 
            JOIN users u ON lt.user_id = u.id 
            WHERE lt.token = ? 
            AND lt.expires_at > {$dateFunction} 
            AND lt.used_at IS NULL
        ";
        
        error_log("LoginToken: Executing query: " . $query);
        $stmt = $this->db->prepare($query);
        $stmt->execute([$token]);
        $result = $stmt->fetch();
        
        if (!$result) {
            error_log("LoginToken: Token validation failed - no matching valid token found");
            return null;
        }
        
        error_log("LoginToken: Token valid for user ID: " . $result['user_id']);
        
        // Mark token as used
        $this->markTokenAsUsed($token);
        
        return $result;
    }
    
    /**
     * Mark token as used
     */
    private function markTokenAsUsed(string $token): void
    {
        // Get the appropriate date function
        $dateFunction = $this->getCurrentDateFunction();
        
        $query = "
            UPDATE login_tokens 
            SET used_at = {$dateFunction} 
            WHERE token = ?
        ";
        
        error_log("LoginToken: Marking token as used: " . substr($token, 0, 10) . "...");
        $stmt = $this->db->prepare($query);
        $stmt->execute([$token]);
        
        $rowCount = $stmt->rowCount();
        error_log("LoginToken: Updated {$rowCount} rows for token");
    }
    
    /**
     * Delete expired tokens for user
     */
    private function deleteExpiredTokens(int $userId): void
    {
        // Get the appropriate date function
        $dateFunction = $this->getCurrentDateFunction();
        
        $query = "
            DELETE FROM login_tokens 
            WHERE user_id = ? 
            AND (expires_at < {$dateFunction} OR used_at IS NOT NULL)
        ";
        
        error_log("LoginToken: Deleting expired tokens for user ID: " . $userId);
        $stmt = $this->db->prepare($query);
        $stmt->execute([$userId]);
        
        $rowCount = $stmt->rowCount();
        error_log("LoginToken: Deleted {$rowCount} expired tokens for user");
    }
}
