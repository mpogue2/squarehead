<?php
// A simple development login helper that works without email
// This bypasses the need for email to log in during development
?>
<!DOCTYPE html>
<html>
<head>
    <title>Development Login Helper</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2 {
            color: #1a73e8;
        }
        .container {
            background-color: #f9f9f9;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 20px;
            margin-bottom: 20px;
        }
        input[type="email"], button {
            width: 100%;
            padding: 10px;
            margin-bottom: 15px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 16px;
        }
        button {
            background-color: #1a73e8;
            color: white;
            border: none;
            cursor: pointer;
            font-weight: bold;
        }
        button:hover {
            background-color: #155db1;
        }
        pre {
            background-color: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
        }
        .success {
            background-color: #d4edda;
            border-color: #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
        }
        .error {
            background-color: #f8d7da;
            border-color: #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <h1>Development Login Helper</h1>
    
    <div class="container">
        <h2>Get Direct JWT Token</h2>
        <p>This will generate a JWT token directly for the provided email (bypasses the email sending step).</p>
        
        <form id="jwtForm">
            <input type="email" id="jwtEmail" placeholder="Enter your email" value="mpogue@zenstarstudio.com">
            <button type="submit">Generate JWT</button>
        </form>
        
        <div id="jwtResult"></div>
    </div>
    
    <div class="container">
        <h2>Get Login Token</h2>
        <p>This will generate a login token without sending an email.</p>
        
        <form id="tokenForm">
            <input type="email" id="tokenEmail" placeholder="Enter your email" value="mpogue@zenstarstudio.com">
            <button type="submit">Generate Login Token</button>
        </form>
        
        <div id="tokenResult"></div>
    </div>
    
    <script>
        document.getElementById('jwtForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('jwtEmail').value;
            const resultDiv = document.getElementById('jwtResult');
            
            resultDiv.innerHTML = 'Generating JWT...';
            
            try {
                const response = await fetch(`/api/auth/dev-jwt?email=${encodeURIComponent(email)}`);
                const data = await response.json();
                
                if (data.status === 'success') {
                    // Store token in localStorage for login
                    localStorage.setItem('auth-storage', JSON.stringify({
                        state: {
                            isAuthenticated: true,
                            user: data.data.user,
                            token: data.data.token,
                            _hasHydrated: true
                        },
                        version: 0
                    }));
                    
                    resultDiv.innerHTML = `
                        <div class="success">
                            <h3>Success!</h3>
                            <p>JWT token generated and stored in localStorage.</p>
                            <p><a href="/login" target="_blank">Go to Login Page</a></p>
                            <p><a href="/" target="_blank">Go to Dashboard</a></p>
                        </div>
                        <pre>${JSON.stringify(data.data, null, 2)}</pre>
                    `;
                } else {
                    resultDiv.innerHTML = `
                        <div class="error">
                            <h3>Error</h3>
                            <p>${data.message}</p>
                        </div>
                    `;
                }
            } catch (error) {
                resultDiv.innerHTML = `
                    <div class="error">
                        <h3>Error</h3>
                        <p>${error.message}</p>
                        <p>Make sure the backend server is running.</p>
                    </div>
                `;
            }
        });
        
        document.getElementById('tokenForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('tokenEmail').value;
            const resultDiv = document.getElementById('tokenResult');
            
            resultDiv.innerHTML = 'Generating login token...';
            
            try {
                const response = await fetch(`/api/auth/dev-token?email=${encodeURIComponent(email)}`);
                const data = await response.json();
                
                if (data.status === 'success') {
                    const loginUrl = `/login?token=${encodeURIComponent(data.data.token)}`;
                    
                    resultDiv.innerHTML = `
                        <div class="success">
                            <h3>Success!</h3>
                            <p>Login token generated.</p>
                            <p><a href="${loginUrl}" target="_blank">Click here to login</a></p>
                        </div>
                        <pre>${JSON.stringify(data.data, null, 2)}</pre>
                    `;
                } else {
                    resultDiv.innerHTML = `
                        <div class="error">
                            <h3>Error</h3>
                            <p>${data.message}</p>
                        </div>
                    `;
                }
            } catch (error) {
                resultDiv.innerHTML = `
                    <div class="error">
                        <h3>Error</h3>
                        <p>${error.message}</p>
                        <p>Make sure the backend server is running.</p>
                    </div>
                `;
            }
        });
    </script>
</body>
</html>