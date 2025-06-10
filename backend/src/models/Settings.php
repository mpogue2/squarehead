<?php
declare(strict_types=1);

namespace App\Models;

class Settings extends BaseModel
{
    protected string $table = 'settings';
    
    protected array $fillable = [
        'setting_key',
        'setting_value',
        'setting_type'
    ];
    
    /**
     * Get setting by key
     */
    public function get(string $key): ?string
    {
        $stmt = $this->db->prepare("SELECT setting_value FROM settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $result = $stmt->fetch();
        
        return $result ? $result['setting_value'] : null;
    }
    
    /**
     * Set setting value
     */
    public function set(string $key, string $value, string $type = 'string'): bool
    {
        // Check if we're using SQLite or MariaDB
        $dbType = $this->db->getAttribute(\PDO::ATTR_DRIVER_NAME);
        
        if ($dbType === 'sqlite') {
            // SQLite syntax
            $stmt = $this->db->prepare("
                INSERT INTO settings (setting_key, setting_value, setting_type) 
                VALUES (?, ?, ?)
                ON CONFLICT(setting_key) DO UPDATE SET 
                    setting_value = excluded.setting_value,
                    setting_type = excluded.setting_type,
                    updated_at = CURRENT_TIMESTAMP
            ");
            
            return $stmt->execute([$key, $value, $type]);
        } else {
            // MySQL/MariaDB syntax
            $stmt = $this->db->prepare("
                INSERT INTO settings (setting_key, setting_value, setting_type) 
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    setting_value = VALUES(setting_value),
                    setting_type = VALUES(setting_type),
                    updated_at = CURRENT_TIMESTAMP
            ");
            
            return $stmt->execute([$key, $value, $type]);
        }
    }
    
    /**
     * Get all settings as key-value pairs
     */
    public function getAllSettings(): array
    {
        $stmt = $this->db->query("SELECT setting_key, setting_value, setting_type FROM settings");
        $results = $stmt->fetchAll();
        
        $settings = [];
        foreach ($results as $setting) {
            $settings[$setting['setting_key']] = $setting['setting_value'];
        }
        
        return $settings;
    }
}
