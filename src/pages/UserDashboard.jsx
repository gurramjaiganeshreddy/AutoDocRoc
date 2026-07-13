import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

export default function UserDashboard() {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [docComments, setDocComments] = useState([]);
    const [userInputs, setUserInputs] = useState({});

    // ONLYOFFICE Preview State
    const [compiledFilename, setCompiledFilename] = useState('');
    const [editorConfig, setEditorConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isApiLoaded, setIsApiLoaded] = useState(false);

    // Fetch all document templates on load
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/documents');
                if (response.ok) {
                    const data = await response.json();
                    setTemplates(data);
                }
            } catch (err) {
                console.error("Failed to fetch templates:", err);
            }
        };
        fetchTemplates();
    }, []);

    // Load template comments when a template is selected
    useEffect(() => {
        if (selectedTemplate) {
            const fetchComments = async () => {
                try {
                    const response = await fetch(`http://localhost:5000/api/documents/comments/${selectedTemplate}`);
                    if (response.ok) {
                        const data = await response.json();
                        setDocComments(data);
                        
                        // Initialize form fields with the selected text/quote as initial values
                        const initialInputs = {};
                        data.forEach(comment => {
                            initialInputs[comment.text] = comment.quote || '';
                        });
                        setUserInputs(initialInputs);
                        
                        // Reset preview
                        setCompiledFilename('');
                        setEditorConfig(null);
                    }
                } catch (err) {
                    console.error("Error loading template comments:", err);
                }
            };
            fetchComments();
        } else {
            setDocComments([]);
            setUserInputs({});
            setCompiledFilename('');
            setEditorConfig(null);
        }
    }, [selectedTemplate]);

    // Dynamically load ONLYOFFICE DocsAPI script
    useEffect(() => {
        const scriptId = 'onlyoffice-api-script';
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'http://localhost/web-apps/apps/api/documents/api.js';
            script.async = true;
            script.onload = () => {
                console.log('ONLYOFFICE DocsAPI script loaded successfully.');
                setIsApiLoaded(true);
            };
            script.onerror = () => {
                console.error('Failed to load ONLYOFFICE DocsAPI script.');
                setIsApiLoaded(false);
            };
            document.body.appendChild(script);
        } else {
            setIsApiLoaded(true);
        }

        return () => {
            if (window.docEditor) {
                try {
                    window.docEditor.destroyEditor();
                } catch (e) {
                    console.error('Error destroying editor:', e);
                }
                window.docEditor = null;
            }
        };
    }, []);

    // Instantiates ONLYOFFICE editor when compiled config is loaded
    useEffect(() => {
        if (editorConfig && isApiLoaded) {
            const timer = setTimeout(() => {
                try {
                    if (window.docEditor) {
                        window.docEditor.destroyEditor();
                        window.docEditor = null;
                    }

                    const placeholder = document.getElementById('onlyoffice-preview-placeholder');
                    if (placeholder) {
                        placeholder.innerHTML = '';
                    }

                    if (window.DocsAPI && window.DocsAPI.DocEditor) {
                        window.docEditor = new window.DocsAPI.DocEditor("onlyoffice-preview-placeholder", {
                            ...editorConfig,
                            width: "100%",
                            height: "750px",
                            editorConfig: {
                                ...editorConfig.editorConfig,
                                mode: 'view' // Preview only
                            }
                        });
                        console.log('ONLYOFFICE Editor initialized for preview.');
                    }
                } catch (err) {
                    console.error('Failed to initialize ONLYOFFICE Editor:', err);
                }
            }, 150);

            return () => clearTimeout(timer);
        }
    }, [editorConfig, isApiLoaded]);

    const handleInputChange = (fieldName, val) => {
        setUserInputs(prev => ({ ...prev, [fieldName]: val }));
    };

    const handlePreviewDocument = async (e) => {
        e.preventDefault();
        if (!selectedTemplate) return;

        setIsLoading(true);
        setEditorConfig(null);

        try {
            // Generate docx using manualData payload
            const response = await fetch('http://localhost:5000/api/documents/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: selectedTemplate,
                    manualData: userInputs
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.compiledFilename) {
                    setCompiledFilename(data.compiledFilename);

                    // Fetch ONLYOFFICE Config for the compiled preview doc
                    const configResponse = await fetch(`http://localhost:5000/api/documents/config/${data.compiledFilename}`);
                    if (configResponse.ok) {
                        const config = await configResponse.json();
                        setEditorConfig(config);
                    }
                } else {
                    alert("Failed to generate preview: " + (data.error || "Unknown error"));
                }
            } else {
                alert("Failed to compile preview document.");
            }
        } catch (err) {
            console.error("Preview error:", err);
            alert("Network error: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadWord = () => {
        if (!compiledFilename) return;
        window.open(`http://localhost:5000/api/documents/download-updated/${compiledFilename}`, '_blank');
    };

    const handleDownloadPdf = () => {
        if (!compiledFilename) return;
        window.open(`http://localhost:5000/api/documents/download-pdf/${compiledFilename}`, '_blank');
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="dashboard-container">
            {/* Custom Styles */}
            <style>{`
                .split-layout {
                    display: flex;
                    gap: 24px;
                    margin-top: 1.5rem;
                }
                .form-panel {
                    flex: 1;
                    background-color: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }
                .preview-panel {
                    flex: 1.8;
                    background-color: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }
                .preview-placeholder {
                    min-height: 750px;
                    background-color: #F8FAFC;
                    border: 1px dashed #CBD5E1;
                    border-radius: 6px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    color: #94A3B8;
                    font-style: italic;
                }
                .form-control {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #CBD5E0;
                    border-radius: 6px;
                    box-sizing: border-box;
                    font-size: 0.95rem;
                }
                .form-group {
                    margin-bottom: 1.25rem;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    color: #475569;
                    font-size: 0.9rem;
                }
                .btn-download-group {
                    display: flex;
                    gap: 12px;
                    margin-top: 1.25rem;
                }
            `}</style>

            {/* Sidebar navigation */}
            <div className="sidebar">
                <div>
                    <div className="sidebar-logo">
                        <h2>🏢 AutoDoc ROC</h2>
                    </div>
                    <ul className="sidebar-menu">
                        <li><span className="menu-item active">📝 Generate Documents</span></li>
                    </ul>
                </div>
                <div className="sidebar-footer">
                    Logged in: User
                </div>
            </div>

            {/* Main workspace */}
            <div className="main-content">
                <header className="top-header">
                    <div className="header-title">
                        <h1>User Dashboard</h1>
                    </div>
                    <div className="user-profile">
                        <span className="user-avatar">U</span>
                        <button onClick={handleLogout} className="btn-logout">
                            Log Out
                        </button>
                    </div>
                </header>

                <div className="content-body">
                    {/* Document Template Selection */}
                    <div style={{ backgroundColor: '#FFFFFF', padding: '1.25rem', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                            📁 Select Document Template
                        </label>
                        <select
                            className="form-control"
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            style={{ maxWidth: '400px' }}
                        >
                            <option value="">-- Choose a Template --</option>
                            {templates.map(tpl => {
                                const originalName = tpl.substring(tpl.indexOf('_') + 1);
                                return (
                                    <option key={tpl} value={tpl}>
                                        📄 {originalName}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {selectedTemplate && (
                        <div className="split-layout">
                            {/* Form Panel to enter details */}
                            <div className="form-panel">
                                <h3 style={{ margin: '0 0 1rem 0', color: '#1E293B', fontWeight: 600 }}>
                                    Fill Document Details
                                </h3>

                                <form onSubmit={handlePreviewDocument}>
                                    <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
                                        {docComments.map((comment, index) => (
                                            <div className="form-group" key={index}>
                                                <label>{comment.text}</label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={userInputs[comment.text] || ''}
                                                    onChange={(e) => handleInputChange(comment.text, e.target.value)}
                                                    placeholder={`Enter ${comment.text}`}
                                                    required
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        style={{ width: '100%', padding: '12px', marginTop: '1rem', fontWeight: 600 }}
                                    >
                                        🔄 Compile & Preview Document
                                    </button>
                                </form>
                            </div>

                            {/* Live Document Preview Panel */}
                            <div className="preview-panel">
                                <h3 style={{ margin: '0 0 1rem 0', color: '#1E293B', fontWeight: 600 }}>
                                    Document Preview
                                </h3>

                                {isLoading ? (
                                    <div className="preview-placeholder">
                                        Compiling document preview with your entries...
                                    </div>
                                ) : (
                                    <div id="onlyoffice-preview-placeholder" className="preview-placeholder">
                                        {!editorConfig && "Fill in the details on the left and click 'Compile & Preview' to load document..."}
                                    </div>
                                )}

                                {compiledFilename && !isLoading && (
                                    <div className="btn-download-group">
                                        <button
                                            onClick={handleDownloadWord}
                                            className="btn-primary"
                                            style={{ flex: 1, backgroundColor: '#3182CE' }}
                                        >
                                            📄 Download Word (DOCX)
                                        </button>
                                        <button
                                            onClick={handleDownloadPdf}
                                            className="btn-primary"
                                            style={{ flex: 1, backgroundColor: '#E53E3E' }}
                                        >
                                            📄 Download PDF
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}