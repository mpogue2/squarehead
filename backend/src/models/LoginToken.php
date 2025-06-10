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
        $stmt = $this->db->prepare("
            SELECT lt.*, u.* 
            FROM login_tokens lt 
            JOIN users u ON lt.user_id = u.id 
            WHERE lt.token = ? 
            AND lt.expires_at > datetime('now') 
            AND lt.used_at IS NULL
        ");
        
        $stmt->execute([$token]);
        $result = $stmt->fetch();
        
        if (!$result) {
            return null;
        }
        
        // Mark token as used
        $this->markTokenAsUsed($token);
        
        return $result;
    }
    
    /**
     * Mark token as used
     */
    private function markTokenAsUsed(string $token): void
    {
        $stmt = $this->db->prepare("
            UPDATE login_tokens 
            SET used_at = datetime('now') 
            WHERE token = ?
        ");
        $stmt->execute([$token]);
    }
    
    /**
     * Delete expired tokens for user
     */
    private function deleteExpiredTokens(int $userId): void
    {
        $stmt = $this->db->prepare("
            DELETE FROM login_tokens 
            WHERE user_id = ? 
            AND (expires_at < datetime('now') OR used_at IS NOT NULL)
        ");
        $stmt->execute([$userId]);
    }
}
