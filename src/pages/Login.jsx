import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        setError('');

        // Demo credentials for BOTH User and Admin
        const userEmail = 'user@demo.com';
        const userPassword = 'user123';

        const adminEmail = 'admin@demo.com';
        const adminPassword = 'admin123';

        if (email === userEmail && password === userPassword) {
            console.log('User login successful');
            localStorage.setItem('is_logged_in', 'true');
            localStorage.setItem('user_email', email);
            localStorage.setItem('user_role', 'user');
            navigate('/user-dashboard');
        } else if (email === adminEmail && password === adminPassword) {
            console.log('Admin login successful');
            localStorage.setItem('is_logged_in', 'true');
            localStorage.setItem('user_email', email);
            localStorage.setItem('user_role', 'admin');
            navigate('/admin-dashboard');
        } else {
            setError('Invalid email id / password');
        }
    };

    return (
        <div className="login-container">
            {/* Left side Hero banner */}
            <div className="login-left">
                <div className="logo-section">
                    <h2>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '8px' }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        AutoDoc ROC
                    </h2>
                </div>

                <div className="hero-text-section">
                    <h1>Effortless Legal Document Automation.</h1>
                    <p>
                        Create your company master record, add director information, and instantly generate board resolutions, minutes, and filings from a single source of truth.
                    </p>
                </div>

                <div className="login-footer-text">
                    © 2026 AutoDoc Platform. All rights reserved.
                </div>
            </div>

            {/* Right side form */}
            <div className="login-right">
                <div className="login-card">
                    <div className="login-card-header">
                        <h3>Welcome Back</h3>
                        <p>Log in to access your company dashboard.</p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                className="form-input"
                                placeholder="user@demo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn-submit">
                            Log In
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}