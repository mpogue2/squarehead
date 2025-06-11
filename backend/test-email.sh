#!/bin/bash
# Script to test email sending functionality

# Set default email if not provided
EMAIL=${1:-"test@example.com"}

# Color formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=======================================================${NC}"
echo -e "${YELLOW}   Testing Email Functionality for Square Dance Club    ${NC}"
echo -e "${YELLOW}=======================================================${NC}"
echo ""
echo -e "Testing email sending to: ${GREEN}$EMAIL${NC}"
echo ""

# Run the PHP test script
php test-email.php "$EMAIL"

# Check exit status
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Email test completed successfully!${NC}"
else
    echo -e "${RED}Email test failed. Check the output above for details.${NC}"
fi

echo ""
echo -e "${YELLOW}-------------------------------------------------------${NC}"
echo -e "  Note: You can also check the PHP error log for details:  "
echo -e "  - tail -f /var/log/apache2/error.log (Apache)  "
echo -e "  - tail -f php_errors.log (if configured in php.ini)  "
echo -e "${YELLOW}-------------------------------------------------------${NC}"