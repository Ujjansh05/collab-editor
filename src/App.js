import React, { useState, useEffect, useRef } from 'react';
import { FileText, Users, Plus, Trash2, Edit3, FileCode, Download, Copy, Check, Share2 } from 'lucide-react';
import { database } from './firebase';
import { ref, onValue, set, push, remove, update } from 'firebase/database';

function App() {
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [content, setContent] = useState('');
  const [users, setUsers] = useState([]);
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState('text');
  const [isLoading, setIsLoading] = useState(true);
  const [shareLink, setShareLink] = useState('');
  const textareaRef = useRef(null);
  const isUpdatingFromFirebase = useRef(false);

  const fileTemplates = {
    javascript: '// JavaScript File\n\nfunction main() {\n  console.log("Hello, World!");\n}\n\nmain();',
    python: '# Python File\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()',
    html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Document</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
    css: '/* CSS Stylesheet */\n\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n  background: #f5f5f5;\n}\n\nh1 {\n  color: #333;\n}',
    json: '{\n  "name": "project",\n  "version": "1.0.0",\n  "description": "Project description"\n}',
    markdown: '# Document Title\n\n## Introduction\n\nStart writing your markdown content here...',
    text: ''
  };

  const fileExtensions = {
    javascript: '.js',
    python: '.py',
    html: '.html',
    css: '.css',
    json: '.json',
    markdown: '.md',
    text: '.txt'
  };

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Initialize user on mount
  useEffect(() => {
    const id = 'user_' + Math.random().toString(36).substr(2, 9);
    setUserId(id);
    const name = 'User_' + id.substr(-4);
    setUserName(name);
  }, []);

  // Listen to documents list
  useEffect(() => {
    const docsRef = ref(database, 'documents');
    const unsubscribe = onValue(docsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const docsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setDocuments(docsList);
        if (!activeDocId && docsList.length > 0) {
          setActiveDocId(docsList[0].id);
        }
      } else {
        // Create initial documents
        createInitialDocuments();
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createInitialDocuments = async () => {
    const doc1 = {
      name: 'Project Proposal.md',
      content: '# Project Proposal\n\nStart writing your project proposal here...',
      type: 'markdown',
      lastEdited: Date.now()
    };
    const doc2 = {
      name: 'app.js',
      content: '// JavaScript Code\nconst greeting = "Hello, World!";\nconsole.log(greeting);',
      type: 'javascript',
      lastEdited: Date.now()
    };

    const docsRef = ref(database, 'documents');
    const newDoc1Ref = push(docsRef);
    const newDoc2Ref = push(docsRef);
    
    await set(newDoc1Ref, doc1);
    await set(newDoc2Ref, doc2);
  };

  // Listen to active document content
  useEffect(() => {
    if (!activeDocId) return;

    const docRef = ref(database, `documents/${activeDocId}`);
    const unsubscribe = onValue(docRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.content !== undefined) {
        isUpdatingFromFirebase.current = true;
        setContent(data.content);
        setTimeout(() => {
          isUpdatingFromFirebase.current = false;
        }, 100);
      }
    });

    return () => unsubscribe();
  }, [activeDocId]);

  // Listen to users on active document
  useEffect(() => {
    if (!activeDocId || !userId) return;

    // Add self to users
    const userRef = ref(database, `users/${activeDocId}/${userId}`);
    set(userRef, {
      name: userName,
      color: colors[Math.floor(Math.random() * colors.length)],
      typing: false,
      lastActive: Date.now()
    });

    // Listen to all users
    const usersRef = ref(database, `users/${activeDocId}`);
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const usersList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setUsers(usersList);
      }
    });

    // Cleanup on unmount or doc change
    return () => {
      remove(userRef);
      unsubscribe();
    };
  }, [activeDocId, userId, userName]);

  // Update typing status
  const typingTimeoutRef = useRef(null);
  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);

    if (isUpdatingFromFirebase.current) return;

    // Update document in Firebase
    const docRef = ref(database, `documents/${activeDocId}`);
    update(docRef, {
      content: newContent,
      lastEdited: Date.now()
    });

    // Update typing status
    const userRef = ref(database, `users/${activeDocId}/${userId}`);
    set(userRef, {
      name: userName,
      color: users.find(u => u.id === userId)?.color || colors[0],
      typing: true,
      lastActive: Date.now()
    });

    // Clear typing after 1 second
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      set(userRef, {
        name: userName,
        color: users.find(u => u.id === userId)?.color || colors[0],
        typing: false,
        lastActive: Date.now()
      });
    }, 1000);
  };

  const createNewDocument = () => {
    setShowNewDocModal(true);
    setNewDocName('');
    setNewDocType('text');
  };

  const confirmCreateDocument = async () => {
    if (!newDocName.trim()) return;
    
    const extension = fileExtensions[newDocType];
    const fullName = newDocName.includes('.') ? newDocName : newDocName + extension;
    
    const newDoc = {
      name: fullName,
      content: fileTemplates[newDocType],
      type: newDocType,
      lastEdited: Date.now()
    };

    const docsRef = ref(database, 'documents');
    const newDocRef = push(docsRef);
    await set(newDocRef, newDoc);
    setActiveDocId(newDocRef.key);
    setShowNewDocModal(false);
  };

  const deleteDocument = async (docId) => {
    if (documents.length === 1) return;
    
    const docRef = ref(database, `documents/${docId}`);
    await remove(docRef);
    
    if (activeDocId === docId) {
      const remaining = documents.filter(d => d.id !== docId);
      if (remaining.length > 0) {
        setActiveDocId(remaining[0].id);
      }
    }
  };

  const renameDocument = async (docId, newName) => {
    const docRef = ref(database, `documents/${docId}`);
    await update(docRef, { name: newName });
  };

  const downloadDocument = () => {
    const doc = documents.find(d => d.id === activeDocId);
    if (!doc) return;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareDocument = () => {
    const url = `${window.location.origin}${window.location.pathname}?doc=${activeDocId}`;
    navigator.clipboard.writeText(url);
    setShareLink(url);
    setTimeout(() => setShareLink(''), 3000);
  };

  // Check for shared document in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc');
    if (docId && documents.some(d => d.id === docId)) {
      setActiveDocId(docId);
    }
  }, [documents]);

  const updateUserName = async (newName) => {
    setUserName(newName);
    if (activeDocId && userId) {
      const userRef = ref(database, `users/${activeDocId}/${userId}`);
      await update(userRef, { name: newName });
    }
  };

  const activeDoc = documents.find(d => d.id === activeDocId);
  const isCodeFile = activeDoc?.type !== 'text' && activeDoc?.type !== 'markdown';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading CollabEdit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Real-time Status Banner */}
      <div className="fixed top-0 left-0 right-0 bg-green-50 border-b border-green-200 px-6 py-2 text-sm text-green-700 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-medium">🔥 Live Collaboration Active</span>
          <span className="text-green-600">• Share this page with others to edit together!</span>
        </div>
        {shareLink && (
          <span className="text-green-600 font-medium">✓ Share link copied!</span>
        )}
      </div>

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Create New File</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">File Name</label>
              <input
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmCreateDocument()}
                placeholder="Enter file name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">File Type</label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="text">Text (.txt)</option>
                <option value="markdown">Markdown (.md)</option>
                <option value="javascript">JavaScript (.js)</option>
                <option value="python">Python (.py)</option>
                <option value="html">HTML (.html)</option>
                <option value="css">CSS (.css)</option>
                <option value="json">JSON (.json)</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmCreateDocument}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewDocModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col mt-10">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Edit3 className="text-blue-600" size={24} />
            <h1 className="text-xl font-bold text-gray-800">CollabEdit</h1>
          </div>
          <button
            onClick={createNewDocument}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            New File
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">Files</h2>
          {documents.map(doc => {
            const isCode = doc.type !== 'text' && doc.type !== 'markdown';
            return (
              <div
                key={doc.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg mb-1 cursor-pointer transition-colors ${
                  activeDocId === doc.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => setActiveDocId(doc.id)}
              >
                {isCode ? <FileCode size={16} /> : <FileText size={16} />}
                <span className="flex-1 text-sm truncate">{doc.name}</span>
                {documents.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDocument(doc.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">
              Active Users ({users.length})
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {users.map(user => (
              <div key={user.id} className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full relative flex-shrink-0"
                  style={{ backgroundColor: user.color }}
                >
                  {user.typing && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
                {user.id === userId && isEditingName ? (
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onBlur={() => {
                      setIsEditingName(false);
                      updateUserName(userName);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingName(false);
                        updateUserName(userName);
                      }
                    }}
                    className="text-sm flex-1 px-2 py-1 border border-blue-300 rounded"
                    autoFocus
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm text-gray-600 cursor-pointer hover:text-blue-600 truncate block"
                      onClick={() => user.id === userId && setIsEditingName(true)}
                    >
                      {user.name} {user.id === userId && '(you)'}
                    </span>
                    {user.typing && (
                      <span className="text-xs text-green-600">typing...</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col mt-10">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={activeDoc?.name || ''}
              onChange={(e) => renameDocument(activeDocId, e.target.value)}
              className="text-2xl font-semibold text-gray-800 bg-transparent border-none outline-none focus:text-blue-600 w-full"
            />
            <p className="text-sm text-gray-500 mt-1">
              Last edited: {activeDoc?.lastEdited ? new Date(activeDoc.lastEdited).toLocaleTimeString() : 'Never'}
              {isCodeFile && <span className="ml-3 text-blue-600">• Code File</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={shareDocument}
              className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              title="Share document"
            >
              <Share2 size={18} />
              Share
            </button>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={downloadDocument}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Download file"
            >
              <Download size={18} />
              Download
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              className={`w-full h-full min-h-[600px] p-6 text-gray-800 leading-relaxed resize-none focus:outline-none bg-white rounded-lg shadow-sm border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all ${
                isCodeFile ? 'font-mono text-sm' : 'text-lg'
              }`}
              placeholder={isCodeFile ? "// Start coding..." : "Start typing... Changes sync in real-time!"}
              style={{ fontFamily: isCodeFile ? 'monospace' : 'Georgia, serif' }}
              spellCheck={!isCodeFile}
            />
          </div>
        </div>

        {/* Status Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-2 flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>{content.length} characters</span>
            <span>{content.split(/\s+/).filter(w => w.length > 0).length} words</span>
            <span>{content.split('\n').length} lines</span>
            {isCodeFile && <span className="text-blue-600">• {activeDoc?.type.toUpperCase()}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Connected • Real-time Sync Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;