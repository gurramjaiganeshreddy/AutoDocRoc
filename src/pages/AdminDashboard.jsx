import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [registry, setRegistry] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    // --- Active Document Content & Info ---
    const [uploadedDocName, setUploadedDocName] = useState('');
    const [docFilename, setDocFilename] = useState('');
    const [editorConfig, setEditorConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isApiLoaded, setIsApiLoaded] = useState(false);

    // --- Template Designer States ---
    const [searchFieldQuery, setSearchFieldQuery] = useState('');
    const [docComments, setDocComments] = useState([]);
    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(true);

    // Fetch registered companies on load
    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/companies');
                if (response.ok) {
                    const data = await response.json();
                    setRegistry(data);
                }
            } catch (err) {
                console.error('Database connection error:', err);
            }
        };
        fetchCompanies();
    }, []);

    // Fallback polling for backend parser to handle Community Edition and ensure comments display
    useEffect(() => {
        let interval;
        if (docFilename) {
            const pollBackend = async () => {
                try {
                    const response = await fetch(`http://localhost:5000/api/documents/comments/${docFilename}`);
                    if (response.ok) {
                        const data = await response.json();
                        const mappedComments = data.map(comment => ({
                            id: comment.id,
                            commentId: comment.id,
                            fieldName: comment.text || '',
                            selectedText: comment.quote || '',
                            currentValue: comment.quote || '',
                            createdAt: Date.now()
                        }));
                        setDocComments(mappedComments);
                    }
                } catch (err) {
                    console.error("Polling backend comments failed:", err);
                }
            };
            pollBackend(); // Fetch immediately
            interval = setInterval(pollBackend, 2000); // Poll every 2 seconds
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [docFilename]);

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
                console.error('Failed to load ONLYOFFICE DocsAPI script. Make sure Document Server is running at http://localhost/');
                setIsApiLoaded(false);
            };
            document.body.appendChild(script);
        } else {
            setIsApiLoaded(true);
        }

        // Clean up ONLYOFFICE editor instance on unmount
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

    // Synchronize comments from ONLYOFFICE to React state
    const syncComments = (connector) => {
        try {
            connector.executeMethod("GetAllComments", [], (comments) => {
                if (Array.isArray(comments) && comments.length > 0) {
                    const mappedComments = comments.map(comment => ({
                        id: comment.Id,
                        commentId: comment.Id,
                        fieldName: comment.Text || '',
                        selectedText: comment.Quote || '',
                        currentValue: comment.Quote || '',
                        createdAt: comment.Time || Date.now()
                    }));
                    setDocComments(mappedComments);
                }
            });
        } catch (err) {
            console.error("Failed to execute GetAllComments:", err);
        }
    };

    // Force save the document so the backend parser receives changes instantly
    const forceSaveAndSync = (connector) => {
        try {
            connector.executeMethod("Save");
        } catch (e) {
            console.warn("Connector Save not supported:", e);
        }
        syncComments(connector);
    };

    // Instantiates ONLYOFFICE editor when config is loaded
    useEffect(() => {
        if (editorConfig && isApiLoaded) {
            const timer = setTimeout(() => {
                try {
                    if (window.docEditor) {
                        window.docEditor.destroyEditor();
                        window.docEditor = null;
                    }

                    const placeholder = document.getElementById('onlyoffice-editor-placeholder');
                    if (placeholder) {
                        placeholder.innerHTML = '';
                    }

                    if (window.DocsAPI && window.DocsAPI.DocEditor) {
                        window.docEditor = new window.DocsAPI.DocEditor("onlyoffice-editor-placeholder", {
                            ...editorConfig,
                            width: "100%",
                            height: "800px",
                            events: {
                                ...editorConfig.events,
                                onAppReady: () => {
                                    console.log('ONLYOFFICE Editor is fully ready.');
                                    try {
                                        const connector = window.docEditor.getConnector();
                                        if (connector) {
                                            syncComments(connector);

                                            connector.attachEvent("onAddComment", () => {
                                                console.log("Event: onAddComment");
                                                forceSaveAndSync(connector);
                                            });
                                            connector.attachEvent("onChangeCommentData", () => {
                                                console.log("Event: onChangeCommentData");
                                                forceSaveAndSync(connector);
                                            });
                                            connector.attachEvent("onRemoveComment", () => {
                                                console.log("Event: onRemoveComment");
                                                forceSaveAndSync(connector);
                                            });
                                            connector.attachEvent("onChangeTextSelection", () => {
                                                console.log("Event: onChangeTextSelection");
                                                syncComments(connector);
                                            });
                                        }
                                    } catch (e) {
                                        console.warn("Could not bind connector events:", e);
                                    }
                                },
                                onDocumentStateChange: (event) => {
                                    console.log("Event: onDocumentStateChange", event.data);
                                    if (window.docEditor) {
                                        const connector = window.docEditor.getConnector();
                                        if (connector) {
                                            setTimeout(() => {
                                                syncComments(connector);
                                            }, 200);
                                        }
                                    }
                                }
                            }
                        });
                        console.log('ONLYOFFICE Editor initialized successfully.');
                    }
                } catch (err) {
                    console.error('Failed to initialize ONLYOFFICE Editor:', err);
                }
            }, 150);

            return () => clearTimeout(timer);
        }
    }, [editorConfig, isApiLoaded]);

    const handleSelectCompany = (comp) => {
        setSelectedCompany(comp);
        setUploadedDocName('');
        setDocFilename('');
        setEditorConfig(null);
        setDocComments([]);
        setIsUploadPanelOpen(true);
        if (window.docEditor) {
            try {
                window.docEditor.destroyEditor();
            } catch (e) {
                console.error(e);
            }
            window.docEditor = null;
        }
    };

    // Upload document file to backend and fetch ONLYOFFICE config
    const handleSystemFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadedDocName(file.name);
        setIsLoading(true);
        setEditorConfig(null);
        if (window.docEditor) {
            try {
                window.docEditor.destroyEditor();
            } catch (e) {
                console.error(e);
            }
            window.docEditor = null;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const uploadResponse = await fetch('http://localhost:5000/api/documents/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error("Upload failed");
            }

            const uploadData = await uploadResponse.json();
            const filename = uploadData.filename;
            setDocFilename(filename);

            const configResponse = await fetch(`http://localhost:5000/api/documents/config/${filename}`);
            if (!configResponse.ok) {
                throw new Error("Failed to load editor config");
            }

            const config = await configResponse.json();
            setEditorConfig(config);
            setIsUploadPanelOpen(false);
        } catch (err) {
            console.error("Connection error:", err);
            alert("Could not connect to ONLYOFFICE or backend server.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadOriginal = () => {
        if (!docFilename) return;
        window.open(`http://localhost:5000/api/documents/download-original/${docFilename}`, '_blank');
    };

    const handleDownloadUpdated = () => {
        if (!docFilename) return;
        window.open(`http://localhost:5000/api/documents/download-updated/${docFilename}`, '_blank');
    };

    const handleDownloadPdf = () => {
        if (!docFilename) return;
        window.open(`http://localhost:5000/api/documents/download-pdf/${docFilename}`, '_blank');
    };

    const handleGenerateDocument = async () => {
        if (!docFilename || !selectedCompany) return;

        try {
            const response = await fetch('http://localhost:5000/api/documents/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: docFilename,
                    companyId: selectedCompany._id || selectedCompany.id
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.downloadUrl) {
                    alert("Document compiled successfully! Downloading now...");
                    window.open(data.downloadUrl, '_blank');
                } else {
                    alert("Failed to generate document: " + (data.error || "Unknown error"));
                }
            } else {
                alert("Failed to compile document.");
            }
        } catch (err) {
            console.error(err);
            alert("Network error compiling document: " + err.message);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    // Client-side mapping solver to display corresponding database values
    const resolveValue = (commentText) => {
        if (!selectedCompany) return null;
        const text = commentText.toLowerCase().trim();
        if (text.includes('company name') || text.includes('name of the company')) return selectedCompany.companyName;
        if (text.includes('cin')) return selectedCompany.cin;
        if (text.includes('pan')) return selectedCompany.pan;
        if (text.includes('email')) return selectedCompany.email;
        if (text.includes('registered address') || text.includes('address')) return selectedCompany.address;

        if (selectedCompany.directors && selectedCompany.directors[0]) {
            const dir = selectedCompany.directors[0];
            if (text.includes('director name') || text.includes('name of director')) return dir.name;
            if (text.includes('din')) return dir.din;
            if (text.includes('designation')) return dir.designation;
        }

        if (text === 'day') {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[new Date().getDay()];
        }
        if (text === 'month') {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            return months[new Date().getMonth()];
        }
        if (text === 'date') {
            return new Date().toLocaleDateString('en-GB'); // dd/mm/yyyy
        }

        return null;
    };

    const filteredRegistry = registry.filter(comp =>
        comp.companyName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="dashboard-container">
            {/* Custom Styles */}
            <style>{`
                .a4-workspace-scroll {
                    background-color: #F7FAFC;
                    border-radius: 8px;
                    border: 1px solid #E2E8F0;
                    padding: 8px;
                    min-height: 810px;
                }
                .properties-panel {
                    display: none;
                }
                .preview-panel {
                    flex: 2.8;
                }
                .sidebar-right {
                    flex: 1.2;
                    background-color: #FFFFFF;
                    border: 1px solid #E2E8F0;
                    border-radius: 8px;
                    padding: 1.25rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                }
                .field-card {
                    background-color: #F8FAFC;
                    border: 1px solid #E2E8F0;
                    border-radius: 6px;
                    padding: 16px;
                    margin-bottom: 16px;
                    transition: all 0.2s;
                }
                .field-card:hover {
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    border-color: #74A8A4;
                }
                .form-control {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #CBD5E0;
                    border-radius: 4px;
                    box-sizing: border-box;
                }
            `}</style>

            {/* Sidebar */}
            <div className="sidebar">
                <div>
                    <div className="sidebar-logo">
                        <h2>🏢 AutoDoc ROC</h2>
                    </div>
                    <div className="menu-title">Main Menu</div>
                    <ul className="sidebar-menu">
                        <li><span className="menu-item active">Dashboard</span></li>
                    </ul>
                </div>
                <div className="sidebar-footer">Logged in: Admin</div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                <header className="top-header">
                    <div className="search-bar-container">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search company..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="header-actions">
                        <button onClick={handleLogout} className="btn-logout">Log Out</button>
                    </div>
                </header>

                <div className="content-body">
                    {/* Companies Table */}
                    <div className="table-card">
                        <div className="table-header"><h2>Registered Companies</h2></div>
                        <table className="registry-table">
                            <thead>
                                <tr>
                                    <th>Company Name</th>
                                    <th>CIN</th>
                                    <th>Email</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRegistry.map(comp => (
                                    <tr key={comp._id || comp.id}>
                                        <td>{comp.companyName}</td>
                                        <td>{comp.cin}</td>
                                        <td>{comp.email}</td>
                                        <td>
                                            <button className="btn-select" onClick={() => handleSelectCompany(comp)}>
                                                Select Company
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* SELECT & EDIT VIEW */}
                    {selectedCompany && (
                        <div>
                            {/* Unified Horizontal Control Bar */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                borderRadius: '8px',
                                padding: '12px 20px',
                                marginBottom: '1.5rem',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                gap: '20px',
                                flexWrap: 'wrap'
                            }}>
                                {/* Selected Company Info */}
                                <div>
                                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#718096', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                        Selected Company
                                    </span>
                                    <strong style={{ fontSize: '0.95rem', color: '#2D3748' }}>{selectedCompany.companyName}</strong>
                                    <span style={{ fontSize: '0.8rem', color: '#718096', marginLeft: '8px' }}>({selectedCompany.cin})</span>
                                </div>

                                {/* Upload Trigger Controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <label className="btn-primary" style={{ display: 'inline-block', fontSize: '0.85rem', padding: '8px 16px', cursor: 'pointer', margin: 0 }}>
                                        📤 Upload Document
                                        <input
                                            type="file"
                                            style={{ display: 'none' }}
                                            onChange={handleSystemFileUpload}
                                            accept=".pdf,.docx,.doc,.rtf"
                                        />
                                    </label>

                                    {uploadedDocName && (
                                        <div style={{ backgroundColor: '#F0FFF4', border: '1px solid #C6F6D5', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', color: '#22543D', fontWeight: 500 }}>
                                            📄 Active: {uploadedDocName}
                                        </div>
                                    )}
                                </div>

                                {/* Connection Status */}
                                <div>
                                    {isApiLoaded ? (
                                        <span style={{ color: '#48BB78', fontWeight: 'bold', fontSize: '0.85rem', backgroundColor: '#F0FDF4', padding: '6px 12px', borderRadius: '20px', border: '1px solid #DCFCE7' }}>
                                            🟢 Connected to ONLYOFFICE
                                        </span>
                                    ) : (
                                        <span style={{ color: '#E53E3E', fontWeight: 'bold', fontSize: '0.85rem', backgroundColor: '#FEF2F2', padding: '6px 12px', borderRadius: '20px', border: '1px solid #FEE2E2' }}>
                                            🔴 ONLYOFFICE Server Disconnected
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="split-layout" style={{ display: 'flex', gap: '20px' }}>
                                {/* Collapsible left upload panel */}
                                <div className="properties-panel" style={{
                                    flex: isUploadPanelOpen ? '0.8' : '0',
                                    minWidth: isUploadPanelOpen ? '250px' : '0px',
                                    maxWidth: isUploadPanelOpen ? '300px' : '0px',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s ease',
                                    border: isUploadPanelOpen ? '1px solid #E2E8F0' : 'none',
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: '8px',
                                    padding: isUploadPanelOpen ? '1.25rem' : '0rem'
                                }}>
                                    <h3 style={{ marginBottom: '1rem', color: '#2D3748', fontWeight: 600 }}>
                                        Document Selector
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: '200px' }}>
                                        <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '0.85rem' }}>
                                            <strong style={{ display: 'block', marginBottom: '5px', color: '#4A5568' }}>Selected Company:</strong>
                                            <div>{selectedCompany.companyName}</div>
                                            <div style={{ color: '#718096', fontSize: '0.8rem', marginTop: '3px' }}>CIN: {selectedCompany.cin}</div>
                                        </div>

                                        {/* Upload Trigger Box */}
                                        <div style={{ border: '2px dashed #74A8A4', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#F0F9F9', textAlign: 'center' }}>
                                            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📤</span>
                                            <h4 style={{ margin: '0 0 5px 0', color: 'var(--primary-teal)', fontSize: '0.9rem' }}>Choose Document File</h4>
                                            <p style={{ fontSize: '0.75rem', color: '#718096', margin: '0 0 1rem 0' }}>Supports Word (.docx, .doc), PDF (.pdf) or RTF (.rtf)</p>

                                            <label className="btn-primary" style={{ display: 'block', fontSize: '0.85rem', padding: '8px', cursor: 'pointer', textAlign: 'center' }}>
                                                💻 Upload From System
                                                <input
                                                    type="file"
                                                    style={{ display: 'none' }}
                                                    onChange={handleSystemFileUpload}
                                                    accept=".pdf,.docx,.doc,.rtf"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Sidebar Collapse/Expand Toggle Button */}
                                <button
                                    onClick={() => setIsUploadPanelOpen(!isUploadPanelOpen)}
                                    style={{
                                        alignSelf: 'stretch',
                                        backgroundColor: '#F7FAFC',
                                        border: '1px solid #E2E8F0',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        padding: '0 8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        color: '#718096',
                                        transition: 'all 0.2s',
                                        minHeight: '200px'
                                    }}
                                    title={isUploadPanelOpen ? "Collapse Upload Panel" : "Expand Upload Panel"}
                                >
                                    <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontWeight: 'bold' }}>
                                        {isUploadPanelOpen ? '◀ COLLAPSE' : '▶ UPLOAD PANEL'}
                                    </div>
                                </button>

                                {/* Live Editable Preview (Middle) */}
                                <div className="preview-panel">
                                    <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Workspace Editor (Powered by ONLYOFFICE)</span>
                                    </div>

                                    <div className="a4-workspace-scroll">
                                        {isLoading && (
                                            <div style={{ textAlign: 'center', paddingTop: '250px', color: '#718096', fontSize: '0.95rem' }}>
                                                Preparing document editing workspace...
                                            </div>
                                        )}

                                        <div
                                            id="onlyoffice-editor-placeholder"
                                            style={{
                                                width: '100%',
                                                height: '800px',
                                                display: isLoading ? 'none' : 'block',
                                                borderRadius: '8px',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {!editorConfig && !isLoading && (
                                                <div style={{ color: '#A0AEC0', textAlign: 'center', paddingTop: '250px', fontStyle: 'italic', fontSize: '0.95rem', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E0', height: '100%', boxSizing: 'border-box' }}>
                                                    Upload a Word document, PDF, or RTF file to open the editor workspace...
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {editorConfig && (
                                        <div style={{
                                            marginTop: '1.25rem',
                                            display: 'flex',
                                            justifyContent: 'flex-start',
                                            alignItems: 'center',
                                            gap: '15px',
                                            backgroundColor: '#1E1E24',
                                            padding: '12px 20px',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                            color: '#FFFFFF',
                                            fontSize: '0.85rem',
                                            flexWrap: 'wrap'
                                        }}>
                                            <button
                                                onClick={handleDownloadOriginal}
                                                style={{ background: 'none', border: 'none', color: '#A0AEC0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 500 }}
                                            >
                                                📄 Original DOCX
                                            </button>
                                            <span style={{ color: '#4A5568' }}>|</span>
                                            <button
                                                onClick={handleDownloadUpdated}
                                                style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 500 }}
                                            >
                                                📄 Updated DOCX
                                            </button>
                                            <span style={{ color: '#4A5568' }}>|</span>
                                            <button
                                                onClick={handleDownloadPdf}
                                                style={{ background: 'none', border: 'none', color: '#FEB2B2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 500 }}
                                            >
                                                📄 PDF
                                            </button>
                                            <span style={{ color: '#4A5568' }}>|</span>
                                            <button
                                                onClick={handleGenerateDocument}
                                                style={{ background: 'none', border: 'none', color: '#63B3ED', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 500 }}
                                            >
                                                🔄 Generate
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Template Fields Sidebar (Right) */}
                                {editorConfig && (
                                    <div className="sidebar-right">
                                        <h3 style={{ marginBottom: '1rem', color: '#2D3748', fontWeight: 600 }}>
                                            Template Fields
                                        </h3>
                                        <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '1.25rem' }}>
                                            Created automatically from comments in ONLYOFFICE. Add, edit, or delete comments inside the editor to manage fields.
                                        </p>

                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Search fields..."
                                            value={searchFieldQuery}
                                            onChange={(e) => setSearchFieldQuery(e.target.value)}
                                            style={{ marginBottom: '1.25rem' }}
                                        />

                                        <div style={{ maxHeight: '700px', overflowY: 'auto' }}>
                                            {docComments.length === 0 ? (
                                                <div style={{ color: '#A0AEC0', textAlign: 'center', fontStyle: 'italic', padding: '20px', border: '1px dashed #E2E8F0', borderRadius: '6px' }}>
                                                    No template fields found. Highlight text in the document and add a comment to create a field.
                                                </div>
                                            ) : (
                                                docComments
                                                    .filter(comment => (comment.fieldName || '').toLowerCase().includes(searchFieldQuery.toLowerCase()))
                                                    .map(comment => {
                                                        const resolved = resolveValue(comment.fieldName) || comment.selectedText;
                                                        return (
                                                            <div className="field-card" key={comment.id}>
                                                                <strong style={{ display: 'block', fontSize: '1rem', color: '#2D3748', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px', marginBottom: '12px' }}>
                                                                    {comment.fieldName}
                                                                </strong>
                                                                <div style={{ fontSize: '0.85rem', color: '#718096', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    <div>
                                                                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#A0AEC0', textTransform: 'uppercase', marginBottom: '2px' }}>Selected Text</span>
                                                                        <span style={{ color: '#4A5568', fontWeight: 500 }}>{comment.selectedText}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#A0AEC0', textTransform: 'uppercase', marginBottom: '2px' }}>Current Value</span>
                                                                        <span style={{ color: '#2B6CB0', fontWeight: 'bold' }}>{String(resolved)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            )}
                                        </div>
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