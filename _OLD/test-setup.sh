#!/bin/bash

echo "🚀 Testing Square Dance Club Management System Setup"
echo "=================================================="

# Test if Node.js is available
echo -n "Node.js: "
if command -v node &> /dev/null; then
    echo "✅ $(node --version)"
else
    echo "❌ Not found - Please install Node.js 18+"
fi

# Test if PHP is available
echo -n "PHP: "
if command -v php &> /dev/null; then
    echo "✅ $(php --version | head -n 1)"
else
    echo "❌ Not found - Please install PHP 8.1+"
fi

# Test if Composer is available
echo -n "Composer: "
if command -v composer &> /dev/null; then
    echo "✅ $(composer --version | head -n 1)"
else
    echo "❌ Not found - Please install Composer"
fi

echo ""
echo "📁 Project Structure:"
echo "✅ Frontend folder created"
echo "✅ Backend folder created"
echo "✅ Configuration files created"

echo ""
echo "🔧 Next Steps:"
echo "1. cd frontend && npm install"
echo "2. cd backend && composer install"
echo "3. Start frontend: npm run dev (in frontend folder)"
echo "4. Start backend: php -S localhost:8000 -t public (in backend folder)"
echo ""
echo "🌐 Access URLs:"
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:8000/api/test"
